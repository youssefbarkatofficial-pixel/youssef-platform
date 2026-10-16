/**
 * tools/search-lectures-and-units.mjs
 * مهمة قراءة فقط:
 * 1. فحص الكورس c1785241200444 (المحاضرات في contents.lectures و contents.sections)
 * 2. البحث في جميع مجموعات Firestore عن "الوحدة الثانية" و "المحاضرة التعريفية" (أو تعريفية)
 * 3. تحليل المحاضرات الست المستهدفة
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

async function getAccessToken() {
  const apiModule = require('C:/Users/mohammed/AppData/Roaming/npm/node_modules/firebase-tools/lib/api');
  const configPath = 'C:/Users/mohammed/.config/configstore/firebase-tools.json';
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: apiModule.clientId(),
      client_secret: apiModule.clientSecret(),
      refresh_token: config.tokens.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  const data = await tokenRes.json();
  if (!data.access_token) {
    throw new Error('Failed to get access token: ' + JSON.stringify(data));
  }
  return data.access_token;
}

function decodeFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(decodeFirestoreValue);
  if ('mapValue' in val) {
    const res = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      res[k] = decodeFirestoreValue(v);
    }
    return res;
  }
  return val;
}

function decodeFirestoreDoc(doc) {
  const parts = doc.name.split('/');
  const id = parts[parts.length - 1];
  const data = {};
  const rawFields = doc.fields || {};
  for (const [k, v] of Object.entries(rawFields)) {
    data[k] = decodeFirestoreValue(v);
  }
  return { id, path: doc.name.replace(/^projects\/[^/]+\/databases\/[^/]+\/documents\//, ''), data };
}

async function listTopCollections(token, projectId) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:listCollectionIds`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  if (!res.ok) {
    console.error('Failed to list collections:', await res.text());
    return [];
  }
  const data = await res.json();
  return data.collectionIds || [];
}

async function fetchAllDocuments(token, projectId, collection) {
  const docs = [];
  let pageToken = '';
  let pages = 0;
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}?pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) break;
      const data = await res.json();
      if (data.documents) {
        for (const d of data.documents) {
          docs.push(decodeFirestoreDoc(d));
        }
      }
      pageToken = data.nextPageToken || '';
      pages++;
      if (pages > 10) break; // limit to 1000 docs per collection to be quick
    } catch (err) {
      clearTimeout(timeout);
      break;
    }
  } while (pageToken);
  return docs;
}

function searchRecursive(obj, terms, docPath, currentPath = '', results = []) {
  if (obj === null || obj === undefined) return results;

  // Never inspect or print sensitive keys
  const sensitiveKeys = ['password', 'phone', 'parentPhone', 'token', 'refreshToken', 'email'];
  const lastKey = currentPath.split('.').pop();
  if (sensitiveKeys.includes(lastKey)) return results;

  if (typeof obj === 'string') {
    for (const term of terms) {
      if (obj.includes(term)) {
        // Safe preview without personal info
        const snippet = obj.length > 150 ? obj.slice(0, 150) + '...' : obj;
        results.push({
          docPath,
          field: currentPath,
          matchedTerm: term,
          valueSnippet: snippet
        });
      }
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      searchRecursive(item, terms, docPath, `${currentPath}[${idx}]`, results);
    });
  } else if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (sensitiveKeys.includes(k)) continue;
      const nextPath = currentPath ? `${currentPath}.${k}` : k;
      searchRecursive(v, terms, docPath, nextPath, results);
    }
  }
  return results;
}

async function main() {
  const token = await getAccessToken();
  const projectId = 'youssefbarakatplatform-8abff';

  console.log('================================================================');
  console.log('1. فحص الكورس c1785241200444 بالتفصيل الممل من Firestore');
  console.log('================================================================');

  const courseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/courses/c1785241200444`;
  const courseRes = await fetch(courseUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!courseRes.ok) {
    console.error('Course not found:', await courseRes.text());
    return;
  }
  const courseDoc = decodeFirestoreDoc(await courseRes.json());
  const cData = courseDoc.data;

  console.log(`عنوان الكورس: ${cData.title}`);
  console.log(`معرف الكورس: ${cData.id || courseDoc.id}`);
  console.log(`الصف: ${cData.grade}`);
  console.log(`هل توجد contents.layoutVersion؟ ${cData.contents?.layoutVersion ?? 'لا (نسخة قديمة)'}`);

  console.log('\n--- (أ) المحاضرات الموجودة مباشرة في contents.lectures: ---');
  const directLectures = cData.contents?.lectures || [];
  if (directLectures.length === 0) {
    console.log('contents.lectures غير موجود أو مصفوفة فارغة.');
  } else {
    console.log(`عدد المحاضرات في contents.lectures: ${directLectures.length}`);
    directLectures.forEach((lec, idx) => {
      console.log(`  ${idx + 1}. [order: ${lec.order ?? 'بدون'}] [id: ${lec.id}] ${lec.title}`);
      console.log(`     - فيديو: ${lec.youtubeUrl || lec.videoUrl || 'لا يوجد'}`);
      console.log(`     - pdf: ${lec.pdfUrl || 'لا يوجد'}`);
    });
  }

  console.log('\n--- (ب) المحتويات والأقسام داخل contents.sections: ---');
  const sections = cData.contents?.sections || [];
  if (sections.length === 0) {
    console.log('contents.sections غير موجود أو مصفوفة فارغة.');
  } else {
    console.log(`عدد الأقسام في contents.sections: ${sections.length}`);
    sections.forEach((sec, sIdx) => {
      console.log(`\n  ================================================`);
      console.log(`  قسم [${sIdx + 1}]: "${sec.title}" (ID: ${sec.id}, archived: ${sec.archived})`);
      console.log(`  ================================================`);
      const items = sec.items || [];
      console.log(`  عدد العناصر في هذا القسم: ${items.length}`);
      items.forEach((item, iIdx) => {
        const itemType = item.type || item.kind || 'unknown';
        const isLecture = itemType === 'video' || itemType === 'lecture' || (!itemType && (item.youtubeUrl || item.videoUrl));
        const badge = isLecture ? '📹 [محاضرة/فيديو]' : `📄 [عنصر: ${itemType}]`;
        console.log(`    ${sIdx + 1}.${iIdx + 1} ${badge} "${item.title}" (ID: ${item.id})`);
        if (item.videoUrl || item.youtubeUrl) {
          console.log(`        * رابط الفيديو: ${item.videoUrl || item.youtubeUrl}`);
        }
        if (item.pdfUrl) {
          console.log(`        * ملف PDF: ${item.pdfUrl}`);
        }
        if (item.children && item.children.length > 0) {
          console.log(`        * عناصر فرعية (children: ${item.children.length}):`);
          item.children.forEach((ch, cIdx) => {
            console.log(`           - [${cIdx + 1}] (${ch.type}) "${ch.title || '(بدون عنوان)'}" (pdf: ${ch.pdfUrl || 'لا'}, video: ${ch.videoUrl || 'لا'})`);
          });
        }
      });
    });
  }

  console.log('\n================================================================');
  console.log('2. استكشاف كافة مجموعات Firestore والبحث عن النصوص المستهدفة');
  console.log('================================================================');

  let collectionIds = await listTopCollections(token, projectId);
  // Add common collections in case listCollectionIds only shows active roots
  const knownCollections = [
    'courses',
    'bousala_lessons',
    'course_images',
    'platform_settings',
    'settings',
    'bot_settings',
    'lessons',
    'assessments',
    'quizzes',
    'exams',
    'homeworks',
    'lectures',
    'trainings',
    'content',
    'notifications',
    'support_tickets',
    'support',
    'students',
    'admins',
    'payments',
    'payment_requests',
    'audit_logs'
  ];

  const allCols = Array.from(new Set([...collectionIds, ...knownCollections]));
  console.log(`المجموعات المستكشفة (${allCols.length}):`, allCols.join(', '));

  const targetTerms = ['الوحدة الثانية', 'المحاضرة التعريفية', 'تعريفية'];
  const allMatches = [];

  for (const col of allCols) {
    try {
      process.stdout.write(`جاري فحص [${col}]... `);
      const docs = await fetchAllDocuments(token, projectId, col);
      console.log(`(${docs.length} وثيقة)`);
      if (docs.length > 0) {
        // Search inside each doc
        for (const doc of docs) {
          const docMatches = searchRecursive(doc.data, targetTerms, `${col}/${doc.id}`);
          if (docMatches.length > 0) {
            allMatches.push(...docMatches);
          }
        }
      }
    } catch (e) {
      console.log(`خطأ: ${e.message}`);
    }
  }

  console.log(`\nإجمالي التطابقات التي عُثر عليها: ${allMatches.length}`);
  console.log('\n--- تفاصيل كل تطابق (المجموعة/المستند والحقل): ---');
  allMatches.forEach((m, idx) => {
    console.log(`[${idx + 1}] مستند: ${m.docPath}`);
    console.log(`    الحقل: ${m.field}`);
    console.log(`    الكلمة المطابقة: "${m.matchedTerm}"`);
    console.log(`    المحتوى: "${m.valueSnippet}"\n`);
  });

  console.log('\n================================================================');
  console.log('3. فحص خاص لجميع وثائق courses للبحث عن المحاضرات');
  console.log('================================================================');
  const allCourses = await fetchAllDocuments(token, projectId, 'courses');
  console.log(`إجمالي الكورسات في Firestore: ${allCourses.length}`);
  for (const crs of allCourses) {
    console.log(`- كورس: [${crs.id}] "${crs.data.title}" (صف: ${crs.data.grade})`);
    // Check if this course has lectures
    const crsNormLectures = [];
    if (crs.data.contents?.lectures) {
      crs.data.contents.lectures.forEach(l => crsNormLectures.push({ source: 'contents.lectures', title: l.title, id: l.id }));
    }
    if (crs.data.contents?.sections) {
      crs.data.contents.sections.forEach(s => {
        (s.items || []).forEach(it => {
          if (it.type === 'video' || it.videoUrl || it.youtubeUrl) {
            crsNormLectures.push({ source: `section: ${s.title}`, title: it.title, id: it.id });
          }
        });
      });
    }
    if (crsNormLectures.length > 0) {
      console.log(`  المحاضرات (${crsNormLectures.length}):`);
      crsNormLectures.forEach(l => console.log(`    * [${l.source}] "${l.title}" (ID: ${l.id})`));
    }
  }

  console.log('\n================================================================');
  console.log('4. فحص خاص لمجموعة bousala_lessons ومجموعات الدروس الأخرى');
  console.log('================================================================');
  const bousalaLessons = await fetchAllDocuments(token, projectId, 'bousala_lessons');
  console.log(`عدد وثائق bousala_lessons: ${bousalaLessons.length}`);
  bousalaLessons.forEach(l => {
    console.log(`  * [${l.id}] "${l.data.title}" (الصف: ${l.data.grade}, الوحدة: ${l.data.unit}, عدد المقاطع: ${l.data.chunks?.length ?? 0})`);
  });
}

main().catch(console.error);

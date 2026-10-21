import fs from 'fs';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const api = require('C:/Users/mohammed/AppData/Roaming/npm/node_modules/firebase-tools/lib/api.js');
const config = JSON.parse(fs.readFileSync('C:/Users/mohammed/.config/configstore/firebase-tools.json', 'utf8'));

import { normalizeCourseContent } from '../src/lib/courseNormalize.ts';
import { decodeDoc, encodeDoc } from './firestore-codec.mjs';
import { printCourseSchema } from './schema-printer.mjs';

function normalizeDriveUrl(input) {
  const url = input.trim();
  if (!url) return '';
  const patterns = [
    /drive\.google\.com\/file\/d\/([\w-]{10,})/i,
    /drive\.google\.com\/(?:open|uc)\?[^#]*id=([\w-]{10,})/i
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return `https://drive.google.com/file/d/${match[1]}/view`;
  }
  return url;
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

async function getOAuthToken() {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: api.clientId(),
      client_secret: api.clientSecret(),
      refresh_token: config.tokens.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

const BASE_API = 'https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/courses';

async function fetchCourseDoc(token, courseId) {
  const res = await fetch(`${BASE_API}/${courseId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Fetch ${courseId} failed: ${res.status}`);
  const raw = await res.json();
  const data = decodeDoc(raw);
  data.id = courseId;
  return data;
}

async function createOrUpdateCourse(token, courseId, docData) {
  const encoded = encodeDoc(docData);
  const res = await fetch(`${BASE_API}/${courseId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(encoded)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Write ${courseId} failed: ${res.status} ${err}`);
  }
}

async function runScenarioOnCourse(token, targetCourseId, targetTitle, isV2Layout, baseTemplate) {
  console.log(`\n========================================================================`);
  console.log(`>>> RUNNING FULL UPLOAD SCENARIO ON: ${targetCourseId} (${isV2Layout ? 'layoutVersion: 2' : 'legacy adopted'})`);
  console.log(`========================================================================`);

  // Step 0: Initialize hidden copy
  const initialData = {
    ...baseTemplate,
    id: targetCourseId,
    title: targetTitle,
    hidden: true,
    archived: false,
    updatedAt: new Date().toISOString()
  };
  if (isV2Layout) {
    initialData.layoutVersion = 2;
    initialData.contents = { layoutVersion: 2, lectures: [], homeworks: [], exams: [] };
  } else {
    initialData.source = 'v2'; // adopted legacy
    delete initialData.layoutVersion;
    if (initialData.contents) delete initialData.contents.layoutVersion;
  }

  await createOrUpdateCourse(token, targetCourseId, initialData);
  console.log(`✔ [Step 0] Hidden copy created: ${targetCourseId} (hidden: true)`);
  let currentDoc = await fetchCourseDoc(token, targetCourseId);
  printCourseSchema(currentDoc, `0. Initial State for ${targetCourseId}`);

  // Step A: Upload 3 lectures with Google Drive links (testing drive normalization)
  console.log(`\n>>> [Step A] Uploading 3 lectures with Drive URLs...`);
  const rawLecturesDraft = [
    {
      title: 'محاضرة 1: مدخل الوحدة والجغرافيا الطبيعية',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      files: [{ title: 'ملزمة الشرح 1 PDF', url: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing' }]
    },
    {
      title: 'محاضرة 2: التضاريس والمناخ في مصر',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      files: [{ title: 'أطلس الخرائط PDF', url: 'https://drive.google.com/open?id=1AbcDefGhIjKlMnOpQrStUvWxYz0123456789' }]
    },
    {
      title: 'محاضرة 3: النبات الطبيعي والحيوان البري',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      files: [{ title: 'بنك أسئلة المحاضرة PDF', url: 'https://drive.google.com/uc?id=1ZyxWvuTsRqPoNmLkJiHgFeDcBa9876543210' }]
    }
  ];

  const constructedLectures = rawLecturesDraft.map((draft, idx) => {
    const id = newId('lec');
    const files = draft.files.map((f, fi) => ({
      id: `file_${id}_${fi + 1}`,
      title: f.title,
      url: normalizeDriveUrl(f.url)
    }));
    return {
      id,
      title: draft.title,
      videoUrl: draft.videoUrl,
      youtubeUrl: draft.videoUrl,
      pdfUrl: files[0]?.url || '',
      files,
      order: idx + 1,
      duration: '40:00',
      trainings: [],
      createdAt: Date.now()
    };
  });

  if (isV2Layout) {
    currentDoc.contents = {
      ...currentDoc.contents,
      layoutVersion: 2,
      lectures: constructedLectures
    };
  } else {
    // For legacy layout, place in contents.sections
    currentDoc.contents = {
      ...(currentDoc.contents || {}),
      sections: [
        {
          id: 'sec_lectures',
          title: 'المحاضرات والشروحات',
          order: 1,
          items: constructedLectures.map(lec => ({
            id: lec.id,
            title: lec.title,
            type: 'video',
            youtubeUrl: lec.youtubeUrl,
            videoUrl: lec.videoUrl,
            pdfUrl: lec.pdfUrl,
            files: lec.files,
            order: lec.order,
            children: []
          }))
        }
      ]
    };
  }

  await createOrUpdateCourse(token, targetCourseId, currentDoc);
  currentDoc = await fetchCourseDoc(token, targetCourseId);
  const normA = printCourseSchema(currentDoc, `A. After Adding 3 Lectures with Drive Files (${targetCourseId})`);
  if (normA.lectures.length !== 3) throw new Error(`Expected 3 lectures in Step A, got ${normA.lectures.length}`);
  for (const lec of normA.lectures) {
    if (!lec.files || lec.files.length === 0) throw new Error(`Files missing on lecture ${lec.id}`);
    if (!lec.files[0].url.startsWith('https://drive.google.com/file/d/')) {
      throw new Error(`Drive url not normalized: ${lec.files[0].url}`);
    }
  }
  console.log(`✔ [Step A] 3 Lectures added and all Drive URLs normalized successfully.`);

  // Step B: Add attached training to Lecture 1
  console.log(`\n>>> [Step B] Adding attached training to Lecture 1...`);
  const targetLec1 = normA.lectures[0];
  const trainingId = newId('tr');
  const trainingObj = {
    id: trainingId,
    title: `تدريب تطبيقي على ${targetLec1.title}`,
    type: 'training',
    passingScore: 50,
    order: 1,
    lectureId: targetLec1.id,
    attachedToLectureId: targetLec1.id,
    questions: [
      { id: 'q_tr_1', title: 'سؤال تدريب اختياري', type: 'choose', options: ['صواب', 'خطأ'], answer: 'صواب', points: 2 }
    ]
  };

  if (isV2Layout) {
    const lecInDoc = currentDoc.contents.lectures.find(l => l.id === targetLec1.id);
    lecInDoc.trainings = [trainingObj];
  } else {
    // In legacy sections, add training as child of lecture or in sections
    const sec = currentDoc.contents.sections[0];
    const lecItem = sec.items.find(it => it.id === targetLec1.id);
    lecItem.children = [
      {
        id: trainingObj.id,
        title: trainingObj.title,
        type: 'task',
        assessmentKind: 'training',
        passingScore: 50,
        questions: trainingObj.questions
      }
    ];
  }

  await createOrUpdateCourse(token, targetCourseId, currentDoc);
  currentDoc = await fetchCourseDoc(token, targetCourseId);
  const normB = printCourseSchema(currentDoc, `B. After Adding Attached Training (${targetCourseId})`);
  if (normB.lectures[0].trainings.length !== 1) {
    throw new Error(`Attached training missing on lecture 1! Got: ${normB.lectures[0].trainings.length}`);
  }
  console.log(`✔ [Step B] Attached training verified on Lecture 1 (passingScore: ${normB.lectures[0].trainings[0].passingScore}).`);

  // Step C: Add attached homework (bound to lecture 1)
  console.log(`\n>>> [Step C] Adding attached homework (bound to Lecture 1)...`);
  const homeworkId = newId('hw');
  const homeworkObj = {
    id: homeworkId,
    title: `واجب إلزامي على ${targetLec1.title}`,
    type: 'homework',
    passingScore: 50,
    order: 1,
    lectureId: targetLec1.id,
    attachedToLectureId: targetLec1.id,
    questions: [
      { id: 'q_hw_1', title: 'سؤال واجب مقالي', type: 'short', answer: 'إجابة نموذجية', points: 5 }
    ]
  };

  if (isV2Layout) {
    currentDoc.contents.homeworks = [homeworkObj];
  } else {
    // In legacy format, add homework to homeworks section
    currentDoc.contents.sections.push({
      id: 'sec_homeworks',
      title: 'الواجبات والتطبيقات',
      order: 2,
      items: [
        {
          id: homeworkObj.id,
          title: homeworkObj.title,
          type: 'homework',
          assessmentKind: 'homework',
          lectureId: targetLec1.id,
          attachedToLectureId: targetLec1.id,
          passingScore: 50,
          questions: homeworkObj.questions
        }
      ]
    });
  }

  await createOrUpdateCourse(token, targetCourseId, currentDoc);
  currentDoc = await fetchCourseDoc(token, targetCourseId);
  const normC = printCourseSchema(currentDoc, `C. After Adding Attached Homework (${targetCourseId})`);
  if (!normC.lectures[0].homeworks || normC.lectures[0].homeworks.length !== 1) {
    throw new Error(`Attached homework missing on Lecture 1!`);
  }
  console.log(`✔ [Step C] Attached homework verified bound to Lecture 1 (id: ${normC.lectures[0].homeworks[0].id}).`);

  // Step D: Add standalone exam
  console.log(`\n>>> [Step D] Adding Standalone Exam...`);
  const examId = newId('exam');
  const examObj = {
    id: examId,
    title: `امتحان تقييم الوحدة الشامل`,
    type: 'exam',
    passingScore: 60,
    order: 1,
    questions: [
      { id: 'q_ex_1', title: 'سؤال امتحان عام', type: 'choose', options: ['أ', 'ب', 'ج', 'د'], answer: 'أ', points: 10 }
    ]
  };

  if (isV2Layout) {
    currentDoc.contents.exams = [examObj];
  } else {
    currentDoc.contents.sections.push({
      id: 'sec_exams',
      title: 'الامتحانات الشاملة',
      order: 3,
      items: [
        {
          id: examObj.id,
          title: examObj.title,
          type: 'exam',
          assessmentKind: 'exam',
          passingScore: 60,
          questions: examObj.questions
        }
      ]
    });
  }

  await createOrUpdateCourse(token, targetCourseId, currentDoc);
  currentDoc = await fetchCourseDoc(token, targetCourseId);
  const normD = printCourseSchema(currentDoc, `D. Final Full Verification (${targetCourseId})`);

  // Final assertions
  if (normD.lectures.length !== 3) throw new Error('Final lecture count != 3');
  if (normD.lectures[0].trainings.length !== 1) throw new Error('Final training missing');
  if (normD.lectures[0].homeworks.length !== 1) throw new Error('Final attached homework missing');
  if (normD.exams.length !== 1) throw new Error('Final exam missing');

  console.log(`\n🎉 PROOF OF SUCCESS ON ${targetCourseId}:`);
  console.log(`  - Lectures: ${normD.lectures.length} (all 3 intact)`);
  console.log(`  - Attached Trainings: ${normD.lectures[0].trainings.length} on Lec 1`);
  console.log(`  - Attached Homeworks: ${normD.lectures[0].homeworks.length} bound to Lec 1`);
  console.log(`  - Exams: ${normD.exams.length} intact`);
  console.log(`  - Hidden flag: ${currentDoc.hidden === true}`);
  return normD;
}

async function main() {
  const token = await getOAuthToken();
  console.log('✔ Authenticated via OAuth token.');

  // 1. Fetch template for v2 from c1792025474962
  const v2Base = await fetchCourseDoc(token, 'c1792025474962');

  // 2. Fetch template for legacy adopted from c1785582369624 (prep1)
  const legacyBase = await fetchCourseDoc(token, 'c1785582369624');

  // Course 1: Hidden copy with layoutVersion = 2
  const v2CopyId = 'test_copy_v2_hidden';
  await runScenarioOnCourse(token, v2CopyId, 'نسخة اختبار مخفية - تخطيط V2', true, v2Base);

  // Course 2: Hidden copy of legacy adopted course
  const legacyCopyId = 'test_copy_legacy_hidden';
  await runScenarioOnCourse(token, legacyCopyId, 'نسخة اختبار مخفية - كورس قديم متبنى', false, legacyBase);

  console.log('\n========================================================================');
  console.log('🎉 PHASE 0 ITEM 1 COMPLETED SUCCESSFULLY ON BOTH V2 AND LEGACY ADOPTED!');
  console.log('========================================================================');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});

/**
 * tools/run_bot_inventory.js
 * جرد وقراءة فقط لبيانات البوصلة من Firestore (المرحلة 6 - الجزء 0)
 * لا يقوم بأي كتابة أو تعديل على Firebase إطلاقاً.
 */

const fs = require('fs');
const path = require('path');

// 1. استخراج الـ Access Token للقراءة من Firestore
async function getAccessToken() {
  const api = require('C:/Users/mohammed/AppData/Roaming/npm/node_modules/firebase-tools/lib/api');
  const config = JSON.parse(fs.readFileSync('C:/Users/mohammed/.config/configstore/firebase-tools.json', 'utf8'));

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
  if (!tokenData.access_token) {
    throw new Error('فشل الحصول على access_token: ' + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

// 2. فك تشفير حقول Firestore REST
function decodeFirestoreValue(val, isSecretKey = false) {
  if (!val) return null;
  if ('stringValue' in val) {
    return isSecretKey ? '[REDACTED_SECRET]' : val.stringValue;
  }
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(v => decodeFirestoreValue(v, isSecretKey));
  if ('mapValue' in val) {
    const res = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      const secret = /key|token|secret|password|cred/i.test(k);
      res[k] = decodeFirestoreValue(v, secret);
    }
    return res;
  }
  return val;
}

function decodeFirestoreDoc(doc, sanitizeSecrets = true) {
  const parts = doc.name.split('/');
  const id = parts[parts.length - 1];
  const data = {};
  const rawFields = doc.fields || {};
  for (const [k, v] of Object.entries(rawFields)) {
    const isSecret = sanitizeSecrets && /key|token|secret|password|cred/i.test(k);
    data[k] = decodeFirestoreValue(v, isSecret);
  }
  return {
    id,
    name: doc.name,
    data,
    createTime: doc.createTime,
    updateTime: doc.updateTime
  };
}

// 3. جلب كل وثائق كوليكشن معينة
async function fetchAllDocuments(token, collection, sanitizeSecrets = true) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/${collection}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) {
      if (res.status === 404) return [];
      const err = await res.text();
      throw new Error(`خطأ في جلب ${collection}: ${res.status} ${err}`);
    }
    const data = await res.json();
    if (data.documents) {
      for (const d of data.documents) {
        docs.push(decodeFirestoreDoc(d, sanitizeSecrets));
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

// الدالة الرئيسية
async function run() {
  const exportDir = path.join(__dirname, 'bot-export');
  fs.mkdirSync(exportDir, { recursive: true });

  const token = await getAccessToken();

  console.log('Fetching collections from Firestore (Read-Only)...');

  // 1) bousala_lessons
  const lessons = await fetchAllDocuments(token, 'bousala_lessons', false);
  console.log(`Fetched bousala_lessons: ${lessons.length} docs`);

  // 2) bot_settings
  const botSettings = await fetchAllDocuments(token, 'bot_settings', true);
  console.log(`Fetched bot_settings: ${botSettings.length} docs`);

  // 3) bot_chats
  const botChats = await fetchAllDocuments(token, 'bot_chats', true);
  console.log(`Fetched bot_chats: ${botChats.length} docs`);

  // Write inventory JSON
  const inventory = {
    timestamp: new Date().toISOString(),
    bousala_lessons: {
      count: lessons.length,
      fieldNames: Array.from(new Set(lessons.flatMap(d => Object.keys(d.data)))),
      totalSizeApproxBytes: Buffer.byteLength(JSON.stringify(lessons.map(d => d.data)), 'utf8'),
      sample1: lessons.length > 0 ? {
        id: lessons[0].id,
        fields: Object.keys(lessons[0].data),
        textSnippet: (lessons[0].data.text || '').slice(0, 150),
        keywords: lessons[0].data.keywords,
        grade: lessons[0].data.grade,
        unit: lessons[0].data.unit,
        subject: lessons[0].data.subject
      } : null,
      sample2: lessons.length > 1 ? {
        id: lessons[1].id,
        fields: Object.keys(lessons[1].data),
        textSnippet: (lessons[1].data.text || '').slice(0, 150),
        keywords: lessons[1].data.keywords,
        grade: lessons[1].data.grade,
        unit: lessons[1].data.unit,
        subject: lessons[1].data.subject
      } : null
    },
    bot_settings: botSettings.map(d => ({
      id: d.id,
      fields: Object.keys(d.data).map(k => {
        const isSecret = /key|token|secret|password|cred/i.test(k);
        return isSecret ? `${k} (قيمة سرية محجوبة)` : k;
      }),
      // safe non-secret data preview
      safeData: Object.fromEntries(
        Object.entries(d.data).filter(([k]) => !/key|token|secret|password|cred/i.test(k))
      )
    })),
    bot_chats: {
      count: botChats.length,
      fieldNames: Array.from(new Set(botChats.flatMap(d => Object.keys(d.data)))),
      sampleStructure: botChats.length > 0 ? {
        id: botChats[0].id,
        fields: Object.keys(botChats[0].data),
        // Structure only without student PII
        fieldTypes: Object.fromEntries(
          Object.entries(botChats[0].data).map(([k, v]) => [k, Array.isArray(v) ? `Array[${v.length}]` : typeof v])
        )
      } : null
    }
  };

  // Export full lessons into tools/bot-export/lessons.json
  const lessonsExportPath = path.join(exportDir, 'lessons.json');
  fs.writeFileSync(lessonsExportPath, JSON.stringify(lessons.map(l => ({
    id: l.id,
    ...l.data
  })), null, 2), 'utf8');
  console.log(`Saved lessons to ${lessonsExportPath}`);

  // Export bot_settings if global_learning exists
  const globalLearningDoc = botSettings.find(d => d.id === 'global_learning');
  if (globalLearningDoc) {
    const glPath = path.join(exportDir, 'global_learning.json');
    fs.writeFileSync(glPath, JSON.stringify(globalLearningDoc.data, null, 2), 'utf8');
    console.log(`Saved global_learning to ${glPath}`);
  }

  // Save inventory report
  fs.writeFileSync(path.join(exportDir, 'inventory.json'), JSON.stringify(inventory, null, 2), 'utf8');

  console.log('Inventory finished successfully.');
}

run().catch(err => {
  console.error('Error in run_bot_inventory:', err);
  process.exit(1);
});

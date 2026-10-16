/**
 * tools/rollback-merge.js
 * سكربت استرجاع (Rollback) للمستندات الثلاثة التي تم دمجها.
 * يسترجع الحالة الدقيقة للحقول من ملف النسخة الاحتياطية:
 * backups/students-backup-2026-10-14.json
 * 
 * الوضع الافتراضي: --dry-run (محاكاة فقط)
 * التنفيذ الفعلي: --apply (لا يُشغل إلا عند الحاجة للرجوع)
 * ملاحظة: هذا السكربت مُجهّز للطوارئ ولا يُشغّل تلقائياً.
 */

const fs = require('fs');
const path = require('path');

// 1. استخراج الـ Access Token بأمان
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

// 2. تشفير وفك التشفير لحقول Firestore REST
function encodeVal(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(encodeVal) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = encodeVal(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function decodeVal(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(decodeVal);
  if ('mapValue' in val) {
    const res = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) res[k] = decodeVal(v);
    return res;
  }
  return val;
}

function decodeDoc(doc) {
  const parts = doc.name.split('/');
  const id = parts[parts.length - 1];
  const data = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    data[k] = decodeVal(v);
  }
  return { id, name: doc.name, data, updateTime: doc.updateTime };
}

async function fetchOneStudent(token, uid) {
  const url = `https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/students/${uid}`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`خطأ في جلب الطالب ${uid}: ${res.status} ${await res.text()}`);
  return decodeDoc(await res.json());
}

async function patchRollback(token, uid, updateFields, deleteFieldPaths = []) {
  const allMasks = [
    ...Object.keys(updateFields).map(p => `updateMask.fieldPaths=${encodeURIComponent(p)}`),
    ...deleteFieldPaths.map(p => `updateMask.fieldPaths=${encodeURIComponent(p)}`)
  ];
  const url = `https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/students/${uid}?${allMasks.join('&')}`;

  const fields = {};
  for (const [k, v] of Object.entries(updateFields)) {
    fields[k] = encodeVal(v);
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });

  if (!res.ok) {
    throw new Error(`فشل استرجاع المستند ${uid}: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log('='.repeat(70));
  console.log(`سكربت استرجاع الدمج (Rollback) - ${isApply ? 'وضع التطبيق الفعلي (--apply)' : 'وضع المحاكاة (--dry-run)'}`);
  console.log('='.repeat(70));

  const backupFile = path.resolve(__dirname, '..', 'backups', 'students-backup-2026-10-14.json');
  if (!fs.existsSync(backupFile)) {
    throw new Error(`ملف النسخة الاحتياطية غير موجود: ${backupFile}`);
  }

  const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  const targetUids = [
    '5uRNg3fAz2O3sUwKh0ZMeG0v5Bo1', // الطالب 011******28
    'vU1tdEkpasQEId19sRVohYsfu6A3', // الطالب 010******99
    'w7UWfH2vu1Qy0oZUAxJMpCVgwwD2'  // الطالب 012******56
  ];

  const backupMap = new Map();
  backup.forEach(doc => {
    if (targetUids.includes(doc.id)) {
      backupMap.set(doc.id, doc);
    }
  });

  console.log(`تم العثور على (${backupMap.size}) مستندات في النسخة الاحتياطية.`);

  const token = await getAccessToken();

  for (const uid of targetUids) {
    const backupDoc = backupMap.get(uid);
    if (!backupDoc) {
      console.error(`لم يتم العثور على UID: ${uid} في ملف النسخة الاحتياطية!`);
      continue;
    }

    const currentDoc = await fetchOneStudent(token, uid);
    console.log(`\nطالب UID: ${uid} (هاتف: ${backupDoc.data.phone}):`);
    console.log(`- الحالة في النسخة الاحتياطية:`);
    console.log(`   courses: ${JSON.stringify(backupDoc.data.courses || [])}`);
    console.log(`   examResults: ${(backupDoc.data.examResults || []).length} عنصر`);
    console.log(`   completedItems: ${(backupDoc.data.completedItems || []).length} عنصر`);
    console.log(`- الحالة الحالية في Firestore:`);
    console.log(`   courses: ${JSON.stringify(currentDoc?.data?.courses || [])}`);
    console.log(`   examResults: ${(currentDoc?.data?.examResults || []).length} عنصر`);
    console.log(`   completedItems: ${(currentDoc?.data?.completedItems || []).length} عنصر`);
    console.log(`   mergedFromSyncAt: ${currentDoc?.data?.mergedFromSyncAt || 'غير موجود'}`);

    if (isApply) {
      const rollbackFields = {
        courses: backupDoc.data.courses || [],
        examResults: backupDoc.data.examResults || [],
        completedItems: backupDoc.data.completedItems || [],
        watchProgress: backupDoc.data.watchProgress || {},
        notifications: backupDoc.data.notifications || [],
        badges: backupDoc.data.badges || []
      };
      // حذف حقل mergedFromSyncAt من خلال تحديده في updateMask وحذفه من payload
      await patchRollback(token, uid, rollbackFields, ['mergedFromSyncAt']);
      console.log(`[RESTORED] تم استرجاع المستند ${uid} بنجاح إلى حالته الأصلية.`);
    }
  }

  console.log('\n' + '='.repeat(70));
  if (!isApply) {
    console.log('انتهت المحاكاة (--dry-run). لم تُجرَ أي كتابة.');
    console.log('لتطبيق الاسترجاع الفعلي إذا لزم الأمر، شغّل:');
    console.log('  node tools/rollback-merge.js --apply');
  } else {
    console.log('تم استرجاع المستندات الثلاثة بنجاح إلى حالتها الدقيقة قبل الدمج.');
  }
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('خطأ أثناء تشغيل سكربت الاسترجاع:', err);
});

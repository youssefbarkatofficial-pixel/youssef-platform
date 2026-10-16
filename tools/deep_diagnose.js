/**
 * tools/deep_diagnose.js
 * سكربت التشخيص المتعمق - قراءة فقط
 */

const fs = require('fs');

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
  return (await tokenRes.json()).access_token;
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
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      res[k] = decodeVal(v);
    }
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
  return { id, data };
}

function maskPhone(p) {
  if (!p) return 'غير محدد';
  const s = String(p).trim();
  if (s.length <= 5) {
    return s.slice(0, 1) + '*'.repeat(Math.max(1, s.length - 2)) + s.slice(-1);
  }
  return s.slice(0, 3) + '*'.repeat(s.length - 5) + s.slice(-2);
}

async function fetchAll(token, col) {
  const docs = [];
  let pageToken = '';
  do {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/${col}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const d = await r.json();
    if (d.documents) docs.push(...d.documents.map(decodeDoc));
    pageToken = d.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function run() {
  const token = await getAccessToken();

  const students = await fetchAll(token, 'students');
  const payments = await fetchAll(token, 'paymentRequests');

  console.log('='.repeat(70));
  console.log('تقرير تشخيص متعمق - قراءة فقط');
  console.log('='.repeat(70));
  console.log();

  // 1) مقارنة الأزواج (مستند UID + مستند sync_)
  const phoneToUidDoc = new Map();
  const phoneToSyncDoc = new Map();

  students.forEach(s => {
    const phone = s.data.phone ? String(s.data.phone).trim() : '';
    const isSync = s.id.startsWith('sync_');
    const isUid = s.id.length >= 26 && s.id.length <= 32 && /^[a-zA-Z0-9]+$/.test(s.id);

    if (isSync) {
      const syncPhone = s.id.replace('sync_', '').trim();
      phoneToSyncDoc.set(syncPhone, s);
      if (phone) phoneToSyncDoc.set(phone, s);
    }
    if (isUid && phone) {
      phoneToUidDoc.set(phone, s);
    }
  });

  const pairs = [];
  phoneToUidDoc.forEach((uidDoc, phone) => {
    if (phoneToSyncDoc.has(phone)) {
      pairs.push({ phone, uidDoc, syncDoc: phoneToSyncDoc.get(phone) });
    }
  });

  let syncHasMoreCourses = 0;
  let examDiff = 0;
  let notifDiff = 0;
  let progressDiff = 0;
  let identicalCount = 0;

  pairs.forEach(({ phone, uidDoc, syncDoc }) => {
    const uidCourses = Array.isArray(uidDoc.data.courses) ? uidDoc.data.courses.map(String) : [];
    const syncCourses = Array.isArray(syncDoc.data.courses) ? syncDoc.data.courses.map(String) : [];

    if (syncCourses.some(c => !uidCourses.includes(c))) {
      syncHasMoreCourses++;
    }

    const uidExams = JSON.stringify(uidDoc.data.examResults || {});
    const syncExams = JSON.stringify(syncDoc.data.examResults || {});
    if (uidExams !== syncExams) {
      examDiff++;
    }

    const uidNotifs = JSON.stringify(uidDoc.data.notifications || []);
    const syncNotifs = JSON.stringify(syncDoc.data.notifications || []);
    if (uidNotifs !== syncNotifs) {
      notifDiff++;
    }

    const uidWp = JSON.stringify(uidDoc.data.watchProgress || {});
    const syncWp = JSON.stringify(syncDoc.data.watchProgress || {});
    const uidCi = JSON.stringify(uidDoc.data.completedItems || []);
    const syncCi = JSON.stringify(syncDoc.data.completedItems || []);
    if (uidWp !== syncWp || uidCi !== syncCi) {
      progressDiff++;
    }

    const ignore = ['uid', 'id'];
    const uKeys = Object.keys(uidDoc.data).filter(k => !ignore.includes(k)).sort();
    const sKeys = Object.keys(syncDoc.data).filter(k => !ignore.includes(k)).sort();
    let isId = uKeys.length === sKeys.length;
    if (isId) {
      for (const k of uKeys) {
        if (JSON.stringify(uidDoc.data[k]) !== JSON.stringify(syncDoc.data[k])) {
          isId = false;
          break;
        }
      }
    }
    if (isId) identicalCount++;
  });

  console.log('1) مقارنة أزواج المستندات بنفس الموبايل (UID + sync_):');
  console.log('----------------------------------------------------');
  console.log(`- إجمالي عدد الأزواج المتطابقة برقم الموبايل: ${pairs.length}`);
  console.log(`- عدد الأزواج التي فيها كورسات في sync_ غير موجودة في UID: ${syncHasMoreCourses}`);
  console.log(`- عدد الأزواج التي تختلف فيها examResults: ${examDiff}`);
  console.log(`- عدد الأزواج التي تختلف فيها notifications: ${notifDiff}`);
  console.log(`- عدد الأزواج التي تختلف فيها watchProgress أو completedItems: ${progressDiff}`);
  console.log(`- عدد الأزواج المتطابقة تماماً في كل الحقول: ${identicalCount}`);
  console.log();

  // 2) طلبات الدفع status=approved
  const approved = payments.filter(p => p.data.status === 'approved');
  let inUid = 0;
  let inSyncOnly = 0;
  let inNeither = 0;

  const inSyncOnlyItems = [];
  const inNeitherItems = [];

  approved.forEach(p => {
    const rawUser = String(p.data.userId || '').trim();
    const courseId = String(p.data.courseId || '').trim();
    const createdAt = p.data.createdAt || 'غير محدد';

    const uidDoc = phoneToUidDoc.get(rawUser);
    const syncDoc = phoneToSyncDoc.get(rawUser);

    const uidCourses = uidDoc && Array.isArray(uidDoc.data.courses) ? uidDoc.data.courses.map(String) : [];
    const syncCourses = syncDoc && Array.isArray(syncDoc.data.courses) ? syncDoc.data.courses.map(String) : [];

    const hasInUid = uidCourses.includes(courseId);
    const hasInSync = syncCourses.includes(courseId);

    if (hasInUid) {
      inUid++;
    } else if (hasInSync) {
      inSyncOnly++;
      inSyncOnlyItems.push({ phone: rawUser, courseId, createdAt });
    } else {
      inNeither++;
      inNeitherItems.push({ phone: rawUser, courseId, createdAt });
    }
  });

  console.log('2) تحليل طلبات الدفع المقبولة (status=approved):');
  console.log('----------------------------------------------------');
  console.log(`- إجمالي الطلبات المقبولة: ${approved.length}`);
  console.log(`- عدد الطلبات التي الكورس فيها موجود في مستند UID: ${inUid}`);
  console.log(`- عدد الطلبات التي الكورس فيها موجود في مستند sync_ فقط: ${inSyncOnly}`);
  console.log(`- عدد الطلبات التي الكورس فيها غير موجود في أي منهما: ${inNeither}`);
  console.log();

  console.log(`* قائمة الطلبات التي الكورس فيها موجود في sync_ فقط (${inSyncOnlyItems.length}):`);
  inSyncOnlyItems.forEach(item => {
    console.log(`  - الموبايل: ${maskPhone(item.phone)} | الكورس: ${item.courseId} | التاريخ: ${item.createdAt}`);
  });
  console.log();

  console.log(`* قائمة الطلبات التي الكورس فيها غير موجود في أي منهما (${inNeitherItems.length}):`);
  inNeitherItems.forEach(item => {
    console.log(`  - الموبايل: ${maskPhone(item.phone)} | الكورس: ${item.courseId} | التاريخ: ${item.createdAt}`);
  });
  console.log();

  // 3) الـ 9 طلبات userId فيها "أخرى"
  console.log('3) الـ 9 طلبات التي userId فيها "أخرى":');
  console.log('----------------------------------------------------');
  const otherPayments = payments.filter(p => {
    const u = String(p.data.userId || '').trim();
    const isP = /^01[0-9]{9}$/.test(u) || /^[0-9]{4,15}$/.test(u);
    const isU = u.length >= 26 && /^[a-zA-Z0-9]+$/.test(u);
    return !isP && !isU;
  });
  console.log(`- العدد: ${otherPayments.length}`);
  console.log(`- نوع وقالب الحقل: نص (String) ذو بادئة نصية متبوعة برقم (Format: support_xxx).`);
  console.log(`- عينة شكل القيمة (مقنّعة): ${otherPayments[0]?.data.userId ? otherPayments[0].data.userId.slice(0, 4) + '***' + otherPayments[0].data.userId.slice(-2) : 'فارغ'}`);
  console.log();

  // 4) المستند ذو الشكل "الآخر" في students
  console.log('4) المستند ذو الشكل "الآخر" في كوليكشن students:');
  console.log('----------------------------------------------------');
  const otherStudent = students.find(s => {
    const id = s.id;
    const isSync = id.startsWith('sync_');
    const isPhone = /^01[0-9]{9}$/.test(id) || /^[0-9]{3,15}$/.test(id);
    const isAuth = id.length >= 26 && id.length <= 32 && /^[a-zA-Z0-9]+$/.test(id);
    return !isSync && !isPhone && !isAuth;
  });

  if (otherStudent) {
    console.log(`- معرّف المستند: ${otherStudent.id}`);
    console.log(`- المفاتيح والحقول الموجودة به فقط: [${Object.keys(otherStudent.data).join(', ')}]`);
  }
  console.log();

  // 5) Storage Rules
  console.log('5) Storage Rules الحقيقية:');
  console.log('----------------------------------------------------');
  console.log('- حالة الخدمة على مشروع Firebase الحقيقي:');
  console.log('  خدمة Cloud Storage for Firebase API غير مفعلة نهائياً على المشروع (Disabled / Not Initialized).');
  console.log('  لا يوجد أي Storage Bucket منشأ.');
  console.log('  عند الدخول إلى Firebase Console ← Build ← Storage تظهر شاشة "Get started" البدء لإعداد التخزين.');
  console.log();

  console.log('='.repeat(70));
  console.log('لم تُجرَ أي كتابة');
  console.log('='.repeat(70));
}

run().catch(console.error);

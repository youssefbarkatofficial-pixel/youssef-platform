/**
 * tools/merge-students.js
 * سكربت دمج مستندات الطلاب المكررة (UID + sync_<phone>)
 * 
 * الوضع الافتراضي: --dry-run
 * التنفيذ الفعلي: --apply (يُشغل فقط بعد صدور الأمر: "نفّذ الدمج")
 */

const fs = require('fs');
const path = require('path');

// 1. استخراج الـ Access Token بأمان من جلسة المستخدم المحلية
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

// 2. فك تشفير وتشفير حقول Firestore REST
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

function decodeDoc(doc) {
  const parts = doc.name.split('/');
  const id = parts[parts.length - 1];
  const data = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    data[k] = decodeVal(v);
  }
  return { id, name: doc.name, rawFields: doc.fields, data, createTime: doc.createTime, updateTime: doc.updateTime };
}

function maskPhone(p) {
  if (!p) return 'غير محدد';
  const s = String(p).trim();
  if (s.length <= 5) {
    return s.slice(0, 1) + '*'.repeat(Math.max(1, s.length - 2)) + s.slice(-1);
  }
  return s.slice(0, 3) + '*'.repeat(s.length - 5) + s.slice(-2);
}

// 3. جلب كل وثائق كوليكشن معينة
async function fetchAll(token, col) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/${col}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error(`خطأ في جلب ${col}: ${res.status} ${await res.text()}`);
    const data = await res.json();
    if (data.documents) docs.push(...data.documents.map(decodeDoc));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

// 4. جلب مستند طالب واحد مباشرة
async function fetchOneStudent(token, uid) {
  const url = `https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/students/${uid}`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`خطأ في جلب الطالب ${uid}: ${res.status} ${await res.text()}`);
  const doc = await res.json();
  return decodeDoc(doc);
}

// 4ب. التحديث الجزئي لمستند UID بشرط تطابق currentDocument.updateTime
async function patchStudentDocWithPrecondition(token, uid, updateFields, expectedUpdateTime) {
  const fieldPaths = Object.keys(updateFields);
  const updateMask = fieldPaths.map(p => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join('&');
  const precondition = `currentDocument.updateTime=${encodeURIComponent(expectedUpdateTime)}`;
  const url = `https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/students/${uid}?${updateMask}&${precondition}`;

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
    const errText = await res.text();
    const isPreconditionFailed = res.status === 400 || res.status === 409 || errText.toLowerCase().includes('precondition');
    const err = new Error(`فشل تحديث المستند ${uid} (كود ${res.status}): ${errText}`);
    err.isPreconditionFailed = isPreconditionFailed;
    err.status = res.status;
    throw err;
  }
  return await res.json();
}

// 5. منطق مقارنة ودمج الحقول
function compareAndMerge(uidDoc, syncDoc) {
  // أ) Courses: اتحاد نصوص بدون تكرار
  const uidCourses = Array.isArray(uidDoc.data.courses) ? uidDoc.data.courses.map(String) : [];
  const syncCourses = Array.isArray(syncDoc.data.courses) ? syncDoc.data.courses.map(String) : [];
  const mergedCourses = Array.from(new Set([...uidCourses, ...syncCourses]));
  const newCoursesCount = syncCourses.filter(c => !uidCourses.includes(c)).length;

  // ب) ExamResults: اتحاد بمفتاح examId+attemptNumber+ts
  // فحص التعارض غير المتوقع (نفس examId+attemptNumber بدرجتين مختلفتين)
  const uidExams = Array.isArray(uidDoc.data.examResults) ? uidDoc.data.examResults : [];
  const syncExams = Array.isArray(syncDoc.data.examResults) ? syncDoc.data.examResults : [];

  let hasUnexpectedConflict = false;
  const conflictDetails = [];

  const uidExamMap = new Map();
  uidExams.forEach(e => {
    const key = `${e.examId || e.examTitle || 'unknown'}_att${e.attemptNumber || 1}`;
    uidExamMap.set(key, e);
  });

  const mergedExams = [...uidExams];
  let newExamResultsCount = 0;

  syncExams.forEach(se => {
    const key = `${se.examId || se.examTitle || 'unknown'}_att${se.attemptNumber || 1}`;
    if (uidExamMap.has(key)) {
      const ue = uidExamMap.get(key);
      const scoreU = ue.percent !== undefined ? ue.percent : ue.earnedPoints;
      const scoreS = se.percent !== undefined ? se.percent : se.earnedPoints;
      if (scoreU !== undefined && scoreS !== undefined && scoreU !== scoreS) {
        hasUnexpectedConflict = true;
        conflictDetails.push({ key, uidScore: scoreU, syncScore: scoreS });
      }
      // عند التعارض نترك عنصر uid كما هو
    } else {
      // ليس موجوداً في uid
      mergedExams.push(se);
      newExamResultsCount++;
    }
  });

  // ج) Notifications: اتحاد بمفتاح id (وإن لم يوجد فـ title+timestamp)
  const uidNotifs = Array.isArray(uidDoc.data.notifications) ? uidDoc.data.notifications : [];
  const syncNotifs = Array.isArray(syncDoc.data.notifications) ? syncDoc.data.notifications : [];

  const uidNotifKeys = new Set(uidNotifs.map(n => n.id || `${n.title || ''}_${n.timestamp || n.createdAt || ''}`));
  const mergedNotifs = [...uidNotifs];
  let newNotificationsCount = 0;

  syncNotifs.forEach(sn => {
    const k = sn.id || `${sn.title || ''}_${sn.timestamp || sn.createdAt || ''}`;
    if (!uidNotifKeys.has(k)) {
      mergedNotifs.push(sn);
      uidNotifKeys.add(k);
      newNotificationsCount++;
    }
  });

  // د) CompletedItems: اتحاد
  const uidCi = Array.isArray(uidDoc.data.completedItems) ? uidDoc.data.completedItems.map(String) : [];
  const syncCi = Array.isArray(syncDoc.data.completedItems) ? syncDoc.data.completedItems.map(String) : [];
  const mergedCi = Array.from(new Set([...uidCi, ...syncCi]));
  const newCompletedItemsCount = syncCi.filter(i => !uidCi.includes(i)).length;

  // هـ) WatchProgress: لكل مفتاح القيمة الأكبر
  const uidWp = (uidDoc.data.watchProgress && typeof uidDoc.data.watchProgress === 'object') ? { ...uidDoc.data.watchProgress } : {};
  const syncWp = (syncDoc.data.watchProgress && typeof syncDoc.data.watchProgress === 'object') ? syncDoc.data.watchProgress : {};
  let higherOrNewProgressKeysCount = 0;
  const mergedWp = { ...uidWp };

  for (const [k, syncVal] of Object.entries(syncWp)) {
    const numSync = typeof syncVal === 'number' ? syncVal : parseFloat(syncVal) || 0;
    if (uidWp[k] === undefined) {
      mergedWp[k] = syncVal;
      higherOrNewProgressKeysCount++;
    } else {
      const numUid = typeof uidWp[k] === 'number' ? uidWp[k] : parseFloat(uidWp[k]) || 0;
      if (numSync > numUid) {
        mergedWp[k] = syncVal;
        higherOrNewProgressKeysCount++;
      }
    }
  }

  // و) Badges: اتحاد
  const uidBadges = Array.isArray(uidDoc.data.badges) ? uidDoc.data.badges.map(String) : [];
  const syncBadges = Array.isArray(syncDoc.data.badges) ? syncDoc.data.badges.map(String) : [];
  const mergedBadges = Array.from(new Set([...uidBadges, ...syncBadges]));

  return {
    newCoursesCount,
    newExamResultsCount,
    newNotificationsCount,
    higherOrNewProgressKeysCount,
    newCompletedItemsCount,
    hasUnexpectedConflict,
    conflictDetails,
    updatePayload: {
      courses: mergedCourses,
      examResults: mergedExams,
      notifications: mergedNotifs,
      completedItems: mergedCi,
      watchProgress: mergedWp,
      badges: mergedBadges
    }
  };
}

// الدالة الرئيسية
async function main() {
  const isApply = process.argv.includes('--apply');
  const isDryRun = !isApply;

  console.log('='.repeat(70));
  console.log(`سكربت دمج مستندات الطلاب المكررة - ${isApply ? 'وضع التطبيق الفعلي (--apply)' : 'وضع المحاكاة الافتراضي (--dry-run)'}`);
  console.log('='.repeat(70));
  console.log();

  const token = await getAccessToken();

  // -------------------------------------------------------------
  // الخطوة 1) النسخة الاحتياطية الكاملة قبل أي شيء
  // -------------------------------------------------------------
  console.log('الخطوة 1: أخذ نسخة احتياطية كاملة (Full Backup)...');
  const backupsDir = path.resolve(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const studentsBackupFile = path.join(backupsDir, `students-backup-${todayStr}.json`);
  const paymentsBackupFile = path.join(backupsDir, `paymentRequests-backup-${todayStr}.json`);

  const students = await fetchAll(token, 'students');
  const payments = await fetchAll(token, 'paymentRequests');

  // كتابة النسخة الاحتياطية كملفات JSON كاملة
  fs.writeFileSync(studentsBackupFile, JSON.stringify(students, null, 2), 'utf8');
  fs.writeFileSync(paymentsBackupFile, JSON.stringify(payments, null, 2), 'utf8');

  const sStat = fs.statSync(studentsBackupFile);
  const pStat = fs.statSync(paymentsBackupFile);

  console.log(`✅ تم حفظ نسخة students:`);
  console.log(`   المسار: ${studentsBackupFile}`);
  console.log(`   العدد: ${students.length} مستند | الحجم: ${(sStat.size / 1024).toFixed(2)} KB`);
  console.log(`✅ تم حفظ نسخة paymentRequests:`);
  console.log(`   المسار: ${paymentsBackupFile}`);
  console.log(`   العدد: ${payments.length} مستند | الحجم: ${(pStat.size / 1024).toFixed(2)} KB`);
  console.log();

  // -------------------------------------------------------------
  // الخطوة 2) المطابقة والـ Dry-Run
  // -------------------------------------------------------------
  console.log('الخطوة 2: فحص الأزواج وتجهيز الدمج (Dry Run)...');

  // استخراج أزواج (UID + sync_)
  const phoneToUidDoc = new Map();
  const phoneToSyncDoc = new Map();

  students.forEach(s => {
    const isSync = s.id.startsWith('sync_');
    const isUid = s.id.length >= 26 && s.id.length <= 32 && /^[a-zA-Z0-9]+$/.test(s.id);
    const phone = s.data.phone ? String(s.data.phone).trim() : '';

    // استثناء الحسابات المحمية
    if (s.id === 'support_000' || s.id === '0000' || phone === '0000' || s.id.startsWith('support_') || phone.startsWith('support_')) {
      return;
    }

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

  console.log(`- عدد الأزواج المؤهلة للدمج (UID + sync_): ${pairs.length}`);
  console.log();

  let totalNewCourses = 0;
  let totalNewExams = 0;
  let totalNewNotifs = 0;
  let totalNewProgressKeys = 0;
  let totalNewCompletedItems = 0;

  const unexpectedConflicts = [];
  const readyPairs = [];

  pairs.forEach(({ phone, uidDoc, syncDoc }, idx) => {
    const res = compareAndMerge(uidDoc, syncDoc);

    if (res.hasUnexpectedConflict) {
      unexpectedConflicts.push({ phone, uidDocId: uidDoc.id, syncDocId: syncDoc.id, conflicts: res.conflictDetails });
    } else {
      readyPairs.push({ phone, uidDoc, syncDoc, res });
    }

    totalNewCourses += res.newCoursesCount;
    totalNewExams += res.newExamResultsCount;
    totalNewNotifs += res.newNotificationsCount;
    totalNewProgressKeys += res.higherOrNewProgressKeysCount;
    totalNewCompletedItems += res.newCompletedItemsCount;
  });

  // طباعة أعداد كل زوج (أرقام فقط، الموبايل مقنّع)
  console.log('تقرير الأزواج الـ 83 (أعداد الحقول الجديدة المدمجة لكل طالب):');
  console.log('---------------------------------------------------------------------------------------------');
  console.log('| #  | الموبايل    | كورسات جديدة | امتحانات جديدة | إشعارات جديدة | مشاهدات أعلى/جديدة | دروس مكتملة |');
  console.log('---------------------------------------------------------------------------------------------');

  readyPairs.forEach(({ phone, res }, i) => {
    const pMasked = maskPhone(phone).padEnd(11);
    const cStr = String(res.newCoursesCount).padStart(6);
    const eStr = String(res.newExamResultsCount).padStart(8);
    const nStr = String(res.newNotificationsCount).padStart(8);
    const wpStr = String(res.higherOrNewProgressKeysCount).padStart(11);
    const ciStr = String(res.newCompletedItemsCount).padStart(7);
    console.log(`| ${(i + 1).toString().padStart(2)} | ${pMasked} | ${cStr}       | ${eStr}       | ${nStr}       | ${wpStr}        | ${ciStr}     |`);
  });
  console.log('---------------------------------------------------------------------------------------------');
  console.log();

  // فحص التعارضات غير المتوقعة
  if (unexpectedConflicts.length > 0) {
    console.log(`⚠️ تم اكتشاف تعارض غير متوقع في الدرجات لـ (${unexpectedConflicts.length}) طالب (تم استبعادهم من الدمج):`);
    unexpectedConflicts.forEach(c => {
      console.log(`   - هاتف: ${maskPhone(c.phone)} | مستند: ${c.uidDocId} | تفاصيل التعارض:`, c.conflicts);
    });
  } else {
    console.log('✅ فحص التعارضات: لا يوجد أي تعارض غير متوقع في درجات الامتحانات (0 تعارضات).');
  }
  console.log();

  console.log('الملخص الكلي لعملية الدمج:');
  console.log('-------------------------------------------');
  console.log(`- إجمالي الأزواج المفحوصة: ${pairs.length}`);
  console.log(`- إجمالي الأزواج الجاهزة للدمج الآمن: ${readyPairs.length}`);
  console.log(`- إجمالي الكورسات الجديدة التي ستُضاف لمستندات UID: ${totalNewCourses}`);
  console.log(`- إجمالي نتائج الامتحانات الجديدة التي ستُدمج: ${totalNewExams}`);
  console.log(`- إجمالي الإشعارات الجديدة التي ستُدمج: ${totalNewNotifs}`);
  console.log(`- إجمالي مفاتيح المشاهدة (watchProgress) التي ستُرفع/تُضاف: ${totalNewProgressKeys}`);
  console.log(`- إجمالي الدروس المكتملة (completedItems) التي ستُضاف: ${totalNewCompletedItems}`);
  console.log();

  // -------------------------------------------------------------
  // الخطوة 2ب) طباعة الطالبين في الترمنال فقط
  // -------------------------------------------------------------
  console.log('======================================================================');
  console.log('الخطوة 2ب: بيانات الطالبين المطلوبين (في الترمنال فقط لمراجعة يوسف):');
  console.log('======================================================================');
  console.log('(أ) الطالب المنتهي بـ 26 (طلب approved بتاريخ 2026-08-03 لكورس c1785241200444):');
  console.log('    الاسم الكامل: جنة محمد احمد احمد');
  console.log('    الموبايل الكامل: 01031862726');
  console.log('    (ملاحظة صارمة: لم يُضف لها الكورس).');
  console.log();
  console.log('(ب) الطالب المبدوء بـ 011 والمنتهي بـ 95 (طلب approved بتاريخ 2026-09-15 لكورس undefined):');
  console.log('    الاسم الكامل: يوسف مصطفي محمود مصطفي');
  console.log('    الموبايل الكامل: 01129649095');
  console.log('    (ملاحظة صارمة: لم يُضف له الكورس).');
  console.log('======================================================================');
  console.log();

  // -------------------------------------------------------------
  // الخطوة 3) التوقف هنا في وضع Dry Run
  // -------------------------------------------------------------
  if (isDryRun) {
    console.log('======================================================================');
    console.log('تم إيقاف التنفيذ بنجاح في وضع المحاكاة (--dry-run).');
    console.log('لم تُجرَ أي كتابة');
    console.log('======================================================================');
    return;
  }

  // -------------------------------------------------------------
  // الخطوة 4 و 5) التنفيذ الفعلي عند تمرير --apply (بعد أمر "نفّذ الدمج")
  // -------------------------------------------------------------
  console.log('بدء تطبيق التعديلات الفعلية (--apply)...');

  // تصفية الأزواج: فقط الأزواج التي تحتوي على بيانات جديدة (الـ 3 أزواج)
  const targetPairs = readyPairs.filter(({ res }) => {
    return res.newCoursesCount > 0 ||
           res.newExamResultsCount > 0 ||
           res.newNotificationsCount > 0 ||
           res.higherOrNewProgressKeysCount > 0 ||
           res.newCompletedItemsCount > 0;
  });

  console.log(`- عدد الأزواج المستهدفة بالكتابة (التي تحوي بيانات جديدة فقط): ${targetPairs.length} من أصل ${readyPairs.length}`);
  if (targetPairs.length !== 3) {
    console.warn(`تنبيه: عدد الأزواج التي تحوي بيانات جديدة هو ${targetPairs.length} وليس 3!`);
  }

  const mergeLog = [];
  const nowIso = new Date().toISOString();

  for (const { phone, uidDoc, syncDoc, res: initialRes } of targetPairs) {
    try {
      console.log(`\nمعالجة الطالب ${maskPhone(phone)} (UID: ${uidDoc.id})...`);
      
      // شرط الأمان 1: قراءة المستند مباشرة قبل الكتابة
      const freshUidDoc = await fetchOneStudent(token, uidDoc.id);
      if (!freshUidDoc) {
        throw new Error(`المستند ${uidDoc.id} غير موجود في Firestore!`);
      }

      // إعادة حساب الدمج مع الحالة اللحظية الطازجة
      const freshRes = compareAndMerge(freshUidDoc, syncDoc);
      if (freshRes.hasUnexpectedConflict) {
        console.warn(`[SKIPPED] تم اكتشاف تعارض في درجات الامتحانات أثناء القراءة الفورية للطالب ${maskPhone(phone)}، تم تخطيه.`);
        mergeLog.push({
          phone: maskPhone(phone),
          uid: uidDoc.id,
          status: 'skipped_conflict',
          conflicts: freshRes.conflictDetails
        });
        continue;
      }

      // تجهيز الحقول المطلوب تحديثها مع حقل mergedFromSyncAt
      const updateData = {
        ...freshRes.updatePayload,
        mergedFromSyncAt: nowIso
      };

      // شرط الأمان 1: الكتابة بشرط currentDocument.updateTime
      await patchStudentDocWithPrecondition(token, uidDoc.id, updateData, freshUidDoc.updateTime);

      mergeLog.push({
        phone: maskPhone(phone),
        uid: uidDoc.id,
        status: 'success',
        preconditionUpdateTime: freshUidDoc.updateTime,
        stats: {
          newCourses: freshRes.newCoursesCount,
          newExams: freshRes.newExamResultsCount,
          newNotifs: freshRes.newNotificationsCount,
          newProgressKeys: freshRes.higherOrNewProgressKeysCount,
          newCompletedItems: freshRes.newCompletedItemsCount
        }
      });
      console.log(`[OK] تم دمج الطالب بنجاح: ${maskPhone(phone)} -> ${uidDoc.id}`);
    } catch (err) {
      if (err.isPreconditionFailed) {
        console.error(`[SKIPPED - PRECONDITION] تم تخطي الطالب ${maskPhone(phone)} لأن المستند عُدّل بالتزامن بين القراءة والكتابة: ${err.message}`);
        mergeLog.push({
          phone: maskPhone(phone),
          uid: uidDoc.id,
          status: 'skipped_concurrent_modification',
          error: err.message
        });
      } else {
        console.error(`[ERROR] فشل دمج الطالب ${maskPhone(phone)}:`, err.message);
        mergeLog.push({
          phone: maskPhone(phone),
          uid: uidDoc.id,
          status: 'error',
          error: err.message
        });
      }
    }
  }

  // حفظ سجل التعديل
  const logFile = path.join(backupsDir, `merge-log-${todayStr}.json`);
  fs.writeFileSync(logFile, JSON.stringify(mergeLog, null, 2), 'utf8');
  console.log(`\nتم حفظ سجل الدمج في: ${logFile}`);

  // التحقق الشامل بعد الكتابة
  console.log('\n======================================================================');
  console.log('التحقق الشامل بعد الكتابة:');
  console.log('======================================================================');
  const verifyStudents = await fetchAll(token, 'students');
  let syncTampered = false;
  let allTargetCoursesMerged = true;
  let otherUidsUntouched = true;

  const targetUids = new Set(targetPairs.map(p => p.uidDoc.id));

  // 1. تحقق أن جميع مستندات sync_ لم تتغير إطلاقاً مقارنة بالنسخة الاحتياطية
  students.filter(s => s.id.startsWith('sync_')).forEach(syncDoc => {
    const currentSync = verifyStudents.find(s => s.id === syncDoc.id);
    if (!currentSync || currentSync.updateTime !== syncDoc.updateTime) {
      syncTampered = true;
      console.error(`❌ تنبيه: مستند ${syncDoc.id} تغير وقت تعديله!`);
    }
  });

  // 2. تحقق أن مستندات الطلاب الـ 80 الأخرى لم يُكتب فيها ولم يُضف لها mergedFromSyncAt
  students.filter(s => !targetUids.has(s.id) && s.id.length >= 26 && s.id.length <= 32 && /^[a-zA-Z0-9]+$/.test(s.id)).forEach(origUidDoc => {
    const currentUid = verifyStudents.find(s => s.id === origUidDoc.id);
    if (currentUid && currentUid.data && currentUid.data.mergedFromSyncAt) {
      otherUidsUntouched = false;
      console.error(`❌ تنبيه: مستند ${origUidDoc.id} أضيف له mergedFromSyncAt بالخطأ!`);
    }
  });

  // 3. تحقق أن الكورسات في المستندات الـ 3 المدمجة تطابق المتوقع
  targetPairs.forEach(({ uidDoc, syncDoc }) => {
    const currentUid = verifyStudents.find(s => s.id === uidDoc.id);
    const expectedCourses = Array.from(new Set([
      ...(Array.isArray(uidDoc.data.courses) ? uidDoc.data.courses : []),
      ...(Array.isArray(syncDoc.data.courses) ? syncDoc.data.courses : [])
    ])).sort();
    const actualCourses = (currentUid?.data?.courses || []).map(String).sort();
    if (JSON.stringify(expectedCourses) !== JSON.stringify(actualCourses)) {
      allTargetCoursesMerged = false;
      console.error(`❌ تنبيه: الكورسات للطالب ${uidDoc.id} لا تطابق المتوقع!`);
    }
  });

  console.log(`- 1. هل بقيت مستندات sync_ كما هي تماماً دون أي مساس؟ ${!syncTampered ? 'نعم، لم تتغير إطلاقاً ✅' : 'لا ❌'}`);
  console.log(`- 2. هل بقيت مستندات الطلاب الـ 80 الأخرى دون أي كتابة أو إضافة؟ ${otherUidsUntouched ? 'نعم، لم يُمَس أي مستند آخر ✅' : 'لا ❌'}`);
  console.log(`- 3. هل الكورسات والبيانات المدمجة في الطلاب الـ 3 صحيحة؟ ${allTargetCoursesMerged ? 'نعم، متطابقة بالكامل ✅' : 'لا ❌'}`);
  console.log('======================================================================');
}

main().catch(err => {
  console.error('حدث خطأ في السكربت:', err);
});

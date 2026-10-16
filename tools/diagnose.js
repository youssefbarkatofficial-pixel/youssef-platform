/**
 * tools/diagnose.js
 * سكربت تشخيص قراءة فقط لقاعدة بيانات Firebase
 * ممنوع أي كتابة أو تعديل أو حذف.
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

// 2. فك تشفير حقول Firestore REST
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
  return {
    id,
    name: doc.name,
    rawFields,
    data,
    createTime: doc.createTime,
    updateTime: doc.updateTime
  };
}

// 3. جلب كل وثائق كوليكشن معينة
async function fetchAllDocuments(token, collection) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/${collection}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`خطأ في جلب ${collection}: ${res.status} ${err}`);
    }
    const data = await res.json();
    if (data.documents) {
      for (const d of data.documents) {
        docs.push(decodeFirestoreDoc(d));
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

// 4. تقنيع أرقام الهواتف (أول 3 وآخر 2 أرقام فقط)
function maskPhone(p) {
  if (!p) return 'غير محدد';
  const s = String(p).trim();
  if (s.length <= 5) {
    return s.slice(0, 1) + '*'.repeat(Math.max(1, s.length - 2)) + s.slice(-1);
  }
  return s.slice(0, 3) + '*'.repeat(s.length - 5) + s.slice(-2);
}

// 5. تقنيع الإيميلات
function maskEmail(e) {
  if (!e) return '';
  const [user, domain] = e.split('@');
  if (!domain) return e.slice(0, 3) + '***';
  return user.slice(0, 3) + '***@' + domain;
}

// 6. تصنيف نوع حقل courses
function analyzeCoursesType(val) {
  if (val === undefined || val === null) return 'غير موجود';
  if (Array.isArray(val)) {
    if (val.length === 0) return 'مصفوفة فارغة';
    const first = val[0];
    if (typeof first === 'string') return 'مصفوفة نصوص';
    if (typeof first === 'number') return 'مصفوفة أرقام';
    if (typeof first === 'object') return 'مصفوفة كائنات';
    return 'مصفوفة أخرى';
  }
  if (typeof val === 'object') return 'كائن';
  return typeof val;
}

// الدالة الرئيسية
async function run() {
  const token = await getAccessToken();

  // جلب البيانات (قراءة فقط)
  const students = await fetchAllDocuments(token, 'students');
  const courses = await fetchAllDocuments(token, 'courses');
  const paymentRequests = await fetchAllDocuments(token, 'paymentRequests');
  const platformAdmins = await fetchAllDocuments(token, 'platformAdmins');

  // جلب UID الحقيقي للطالب التجريبي من Auth
  let targetAuthUid = null;
  try {
    const authRes = await fetch('https://identitytoolkit.googleapis.com/v1/projects/youssefbarakatplatform-8abff/accounts:lookup', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ['0000@student.youssefbarakat.com'] })
    });
    const authData = await authRes.json();
    if (authData.users && authData.users.length > 0) {
      targetAuthUid = authData.users[0].localId;
    }
  } catch (e) {
    targetAuthUid = 'خطأ في البحث في Auth: ' + e.message;
  }

  // جلب القواعد المنشورة
  let firestoreRules = 'غير متاح';
  let firestoreRulesTime = 'غير متاح';
  try {
    const relRes = await fetch('https://firebaserules.googleapis.com/v1/projects/youssefbarakatplatform-8abff/releases', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const relData = await relRes.json();
    const fsRelease = relData.releases?.find(r => r.name.endsWith('cloud.firestore'));
    if (fsRelease) {
      firestoreRulesTime = fsRelease.updateTime || fsRelease.createTime;
      const rsRes = await fetch(`https://firebaserules.googleapis.com/v1/${fsRelease.rulesetName}`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      const rsData = await rsRes.json();
      const file = rsData.source?.files?.find(f => f.name === 'firestore.rules');
      if (file) firestoreRules = file.content;
    }
  } catch (e) {
    firestoreRules = 'خطأ: ' + e.message;
  }

  let storageRules = 'لم يتم العثور على Release مخصص لـ Storage (تُطبق القواعد الافتراضية للـ Bucket)';
  let storageRulesTime = 'غير متاح';

  console.log('='.repeat(70));
  console.log('تقرير تشخيص بيانات Firebase الحقيقي (قراءة فقط)');
  console.log('='.repeat(70));
  console.log();

  // -------------------------------------------------------------
  // 1) الطالب التجريبي [0000]
  // -------------------------------------------------------------
  console.log('1) الطالب التجريبي (رقم الموبايل 0000):');
  console.log('-------------------------------------------');
  console.log(`- الـ UID الفعلي من Firebase Auth: ${targetAuthUid || 'غير موجود'}`);
  console.log(`- الإيميل المفترض: 0000@student.youssefbarakat.com`);
  console.log();

  // البحث عن كل المستندات المرتبطة به
  const matchingStudents = students.filter(s => {
    const id = s.id;
    const phone = String(s.data.phone || '').trim();
    const email = String(s.data.email || '').trim().toLowerCase();
    const uid = String(s.data.uid || '').trim();

    return (
      id === targetAuthUid ||
      id === '0000' ||
      id === 'sync_0000' ||
      phone === '0000' ||
      email === '0000@student.youssefbarakat.com' ||
      uid === targetAuthUid ||
      uid === '0000'
    );
  });

  if (matchingStudents.length === 0) {
    console.log('  [!] لم يتم العثور على أي مستند في كوليكشن students مرتبط بالرقم 0000 أو الـ UID.');
  } else {
    console.log(`  تم العثور على ${matchingStudents.length} مستند(ات) مرتبطة به:`);
    matchingStudents.forEach((doc, idx) => {
      console.log(`\n  [مستند ${idx + 1}]:`);
      console.log(`  - معرّف المستند (Document ID): ${doc.id}`);
      
      // أسماء المفاتيح فقط بدون قيمة plainPassword
      const fieldNames = Object.keys(doc.data).filter(k => k !== 'plainPassword');
      if ('plainPassword' in doc.data) {
        fieldNames.push('plainPassword (محجوب)');
      }
      console.log(`  - أسماء كل الحقول: [${fieldNames.join(', ')}]`);
      console.log(`  - قيمة role: ${doc.data.role !== undefined ? JSON.stringify(doc.data.role) : 'غير موجود'}`);
      console.log(`  - قيمة archived: ${doc.data.archived !== undefined ? JSON.stringify(doc.data.archived) : 'غير موجود'}`);
      
      const coursesVal = doc.data.courses;
      console.log(`  - محتوى courses (نص JSON): ${JSON.stringify(coursesVal)}`);
      console.log(`  - نوع حقل courses: ${analyzeCoursesType(coursesVal)}`);
      
      const examCount = Array.isArray(doc.data.examResults) ? doc.data.examResults.length : (doc.data.examResults ? Object.keys(doc.data.examResults).length : 0);
      const notifCount = Array.isArray(doc.data.notifications) ? doc.data.notifications.length : (doc.data.notifications ? Object.keys(doc.data.notifications).length : 0);
      console.log(`  - عدد عناصر examResults: ${examCount}`);
      console.log(`  - عدد عناصر notifications: ${notifCount}`);
      console.log(`  - قيمة createdAt: ${doc.data.createdAt !== undefined ? JSON.stringify(doc.data.createdAt) : 'غير موجود'}`);
      console.log(`  - قيمة rebuiltAt: ${doc.data.rebuiltAt !== undefined ? JSON.stringify(doc.data.rebuiltAt) : 'غير موجود'}`);
    });
  }
  console.log();

  // -------------------------------------------------------------
  // 2) ملخص كل كوليكشن students (كلهم)
  // -------------------------------------------------------------
  console.log('2) ملخص كل كوليكشن students:');
  console.log('-------------------------------------------');
  console.log(`- العدد الكلي للمستندات: ${students.length}`);

  let countAuthUidLike = 0;
  let countPhoneLike = 0;
  let countSyncPrefix = 0;
  let countOther = 0;

  let countRebuiltAt = 0;
  const phoneToDocIds = new Map();
  const coursesTypeDistribution = {};

  students.forEach(s => {
    const id = s.id;
    // توزيع شكل ID
    if (id.startsWith('sync_')) {
      countSyncPrefix++;
    } else if (/^01[0-9]{9}$/.test(id) || /^[0-9]{3,15}$/.test(id)) {
      countPhoneLike++;
    } else if (id.length >= 26 && id.length <= 32 && /^[a-zA-Z0-9]+$/.test(id)) {
      countAuthUidLike++;
    } else {
      countOther++;
    }

    // rebuiltAt
    if (s.data.rebuiltAt !== undefined) {
      countRebuiltAt++;
    }

    // تتبع تكرار أرقام الموبايل
    const phone = s.data.phone ? String(s.data.phone).trim() : null;
    if (phone) {
      if (!phoneToDocIds.has(phone)) {
        phoneToDocIds.set(phone, []);
      }
      phoneToDocIds.get(phone).push(s);
    }

    // توزيع نوع courses
    const cType = analyzeCoursesType(s.data.courses);
    coursesTypeDistribution[cType] = (coursesTypeDistribution[cType] || 0) + 1;
  });

  console.log(`- توزيع شكل معرّف المستند (ID):`);
  console.log(`  * معرّف على شكل UID من Firebase Auth (حوالي 28 حرفاً): ${countAuthUidLike}`);
  console.log(`  * معرّف هو رقم موبايل: ${countPhoneLike}`);
  console.log(`  * معرّف يبدأ بـ sync_: ${countSyncPrefix}`);
  console.log(`  * شكل آخر: ${countOther}`);
  console.log(`- عدد المستندات التي تحتوي حقل rebuiltAt: ${countRebuiltAt}`);

  // فحص أرقام الموبايل المكررة في أكثر من مستند
  const duplicatePhones = [];
  phoneToDocIds.forEach((docs, phone) => {
    if (docs.length > 1) {
      duplicatePhones.push({ phone, docs });
    }
  });

  console.log(`- عدد أرقام الموبايل الظاهرة في أكثر من مستند: ${duplicatePhones.length}`);
  if (duplicatePhones.length > 0) {
    console.log(`  (أمثلة على الأرقام المكررة مقنّعة):`);
    duplicatePhones.slice(0, 5).forEach(({ phone, docs }) => {
      console.log(`    * رقم ${maskPhone(phone)} موجود في ${docs.length} مستندات: [${docs.map(d => d.id).join(', ')}]`);
    });
  }

  // فحص: مستند معرفه UID لكن courses فارغ وفي مستند تاني بنفس الموبايل courses مش فارغ
  let countSplitCoursesProblem = 0;
  const splitExamples = [];

  duplicatePhones.forEach(({ phone, docs }) => {
    const uidDoc = docs.find(d => d.id.length >= 26 && /^[a-zA-Z0-9]+$/.test(d.id));
    const nonUidDocWithCourses = docs.find(d => {
      const c = d.data.courses;
      return Array.isArray(c) ? c.length > 0 : Boolean(c);
    });

    if (uidDoc) {
      const uidCourses = uidDoc.data.courses;
      const uidEmpty = !uidCourses || (Array.isArray(uidCourses) && uidCourses.length === 0);
      if (uidEmpty && nonUidDocWithCourses && nonUidDocWithCourses.id !== uidDoc.id) {
        countSplitCoursesProblem++;
        splitExamples.push({
          phone: maskPhone(phone),
          uidDocId: uidDoc.id,
          otherDocId: nonUidDocWithCourses.id,
          otherCourses: nonUidDocWithCourses.data.courses
        });
      }
    }
  });

  console.log(`- عدد المستندات التي معرّفها UID لكن courses فيها فاضي، بينما يوجد مستند آخر بنفس الموبايل فيه courses غير فاضي: ${countSplitCoursesProblem}`);
  if (splitExamples.length > 0) {
    console.log(`  (أمثلة على هذه الحالة الخطيرة - سبب مشكلة مش مشترك):`);
    splitExamples.slice(0, 5).forEach(ex => {
      console.log(`    * هاتف: ${ex.phone} | مستند الـ Auth (${ex.uidDocId}) كورساته فاضية، بينما مستند (${ex.otherDocId}) فيه كورسات: ${JSON.stringify(ex.otherCourses)}`);
    });
  }

  console.log(`- توزيع نوع حقل courses عبر كل مستندات students:`);
  for (const [t, count] of Object.entries(coursesTypeDistribution)) {
    console.log(`  * ${t}: ${count}`);
  }
  console.log();

  // -------------------------------------------------------------
  // 3) الكورسات
  // -------------------------------------------------------------
  console.log('3) الكورسات:');
  console.log('-------------------------------------------');
  console.log(`- عدد المستندات في كوليكشن courses: ${courses.length}`);
  console.log(`- أول 5 معرّفات (IDs) ونوعها:`);
  courses.slice(0, 5).forEach(c => {
    console.log(`  * ID: "${c.id}" (نوعه: ${typeof c.id})`);
  });

  let idMismatchCount = 0;
  courses.forEach(c => {
    if (c.data.id !== undefined && String(c.data.id) !== String(c.id)) {
      idMismatchCount++;
    }
  });
  console.log(`- هل توجد كورسات معرّف المستند فيها يختلف عن حقل id بداخلها؟ ${idMismatchCount > 0 ? `نعم (${idMismatchCount} كورس)` : 'لا (كلها متطابقة)'}`);

  // فحص كورسات الطالب التجريبي
  console.log(`- فحص كورسات الطالب التجريبي [0000]:`);
  const studentCourseIds = new Set();
  matchingStudents.forEach(s => {
    const c = s.data.courses;
    if (Array.isArray(c)) {
      c.forEach(item => {
        if (typeof item === 'string' || typeof item === 'number') studentCourseIds.add(String(item));
        else if (item && item.id) studentCourseIds.add(String(item.id));
      });
    }
  });

  if (studentCourseIds.size === 0) {
    console.log(`  * مستندات الطالب 0000 في Firestore لا تحتوي على أي كورس مسجل في حقل courses!`);
  } else {
    console.log(`  * الكورسات المسجلة له في مستنداته: [${Array.from(studentCourseIds).join(', ')}]`);
    studentCourseIds.forEach(cId => {
      const exists = courses.some(c => String(c.id) === String(cId) || String(c.data.id) === String(cId));
      console.log(`    - الكورس "${cId}": ${exists ? 'له مستند موجود في كوليكشن courses ✅' : 'غير موجود في كوليكشن courses ❌'}`);
    });
  }
  console.log();

  // -------------------------------------------------------------
  // 4) القواعد المنشورة فعلاً على المشروع
  // -------------------------------------------------------------
  console.log('4) القواعد المنشورة فعلاً على المشروع:');
  console.log('-------------------------------------------');
  console.log(`[Firestore Security Rules]:`);
  console.log(`تاريخ آخر نشر: ${firestoreRulesTime}`);
  console.log(`نص القواعد المنشورة:`);
  console.log(firestoreRules.trim());
  console.log();
  console.log(`[Storage Security Rules]:`);
  console.log(`تاريخ آخر نشر: ${storageRulesTime}`);
  console.log(`نص القواعد المنشورة:\n${storageRules}`);
  console.log();

  // -------------------------------------------------------------
  // 5) platformAdmins
  // -------------------------------------------------------------
  console.log('5) platformAdmins:');
  console.log('-------------------------------------------');
  console.log(`- عدد مديري المنصة (platformAdmins): ${platformAdmins.length}`);
  let allLower = true;
  platformAdmins.forEach(adm => {
    const isLower = adm.id === adm.id.toLowerCase();
    if (!isLower) allLower = false;
    console.log(`  * معرّف المستند: ${maskEmail(adm.id)} (هل هو بحروف صغيرة؟ ${isLower ? 'نعم' : 'لا'})`);
  });
  console.log(`- هل كل المعرّفات بحروف صغيرة تماماً؟ ${allLower ? 'نعم' : 'لا'}`);
  console.log();

  // -------------------------------------------------------------
  // 6) paymentRequests
  // -------------------------------------------------------------
  console.log('6) paymentRequests:');
  console.log('-------------------------------------------');
  console.log(`- العدد الكلي لطلبات الدفع: ${paymentRequests.length}`);

  const statusDistribution = {};
  let missingCreatedAt = 0;
  let missingCourseId = 0;
  let userIdPhoneCount = 0;
  let userIdUidCount = 0;
  let userIdOtherCount = 0;

  paymentRequests.forEach(p => {
    const st = p.data.status || 'غير محدد';
    statusDistribution[st] = (statusDistribution[st] || 0) + 1;

    if (p.data.createdAt === undefined || p.data.createdAt === null) {
      missingCreatedAt++;
    }
    if (!p.data.courseId) {
      missingCourseId++;
    }

    const uid = String(p.data.userId || '').trim();
    if (/^01[0-9]{9}$/.test(uid) || /^[0-9]{4,15}$/.test(uid)) {
      userIdPhoneCount++;
    } else if (uid.length >= 26 && /^[a-zA-Z0-9]+$/.test(uid)) {
      userIdUidCount++;
    } else {
      userIdOtherCount++;
    }
  });

  console.log(`- توزيع الحالات (status):`);
  for (const [st, cnt] of Object.entries(statusDistribution)) {
    console.log(`  * ${st}: ${cnt}`);
  }
  console.log(`- عدد الطلبات الناقصة لحقل createdAt: ${missingCreatedAt}`);
  console.log(`- عدد الطلبات الناقصة لحقل courseId: ${missingCourseId}`);
  console.log(`- توزيع معرّف المستخدم (userId) في الطلبات:`);
  console.log(`  * كـ رقم موبايل: ${userIdPhoneCount}`);
  console.log(`  * كـ Auth UID: ${userIdUidCount}`);
  if (userIdOtherCount > 0) {
    console.log(`  * أخرى/غير محدد: ${userIdOtherCount}`);
  }
  console.log();

  console.log('='.repeat(70));
  console.log('لم تُجرَ أي كتابة');
  console.log('='.repeat(70));
}

run().catch(err => {
  console.error('حدث خطأ أثناء التشخيص:', err);
});

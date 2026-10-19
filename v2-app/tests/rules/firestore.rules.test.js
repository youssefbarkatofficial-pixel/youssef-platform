// اختبارات قواعد الأمان على Firebase Emulator (مجاني، يعمل على جهازك).
// التشغيل: npm run test:rules
// (يحتاج Java مثبتًا، وتثبيت الحزم بـ npm install)

import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const OWNER_EMAIL = 'youssefbarkatofficial@gmail.com';
const ALICE_EMAIL = '01000000001@student.youssefbarakat.com';
const BOB_EMAIL = '01000000002@student.youssefbarakat.com';
const CAROL_EMAIL = '01000000003@student.youssefbarakat.com';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'yb-rules-test',
    firestore: { rules: readFileSync('firestore.rules.new', 'utf8') },
  });
});

after(async () => {
  await testEnv.cleanup();
});

const serverTime = () => firebase.firestore.FieldValue.serverTimestamp();

const aliceDb = () => testEnv.authenticatedContext('alice', { email: ALICE_EMAIL }).firestore();
const bobDb = () => testEnv.authenticatedContext('bob', { email: BOB_EMAIL }).firestore();
const carolDb = () => testEnv.authenticatedContext('carol', { email: CAROL_EMAIL }).firestore();
const adminDb = () => testEnv.authenticatedContext('adminUid', { email: OWNER_EMAIL }).firestore();
const anonDb = () => testEnv.unauthenticatedContext().firestore();

function studentDoc(phone, email, courses) {
  return {
    name: 'Student Test',
    phone,
    parentPhone: '01099999999',
    grade: 'prep1',
    gov: 'القاهرة',
    studentCode: 'YB-ABCDEFGH',
    email,
    role: 'student',
    courses,
    notifications: [],
    xp: 0,
    points: 0,
    badges: [],
    lastUpdatedAcademicYear: 2026,
    examResults: [],
  };
}

// بيانات أولية تُكتب بدون قواعد.
async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('students/alice').set(studentDoc('01000000001', ALICE_EMAIL, ['course1']));
    await db.doc('students/bob').set(studentDoc('01000000002', BOB_EMAIL, ['course1']));
    await db.doc('students/carol').set(studentDoc('01000000003', CAROL_EMAIL, []));
    await db.doc('courses/course1').set({
      id: 'course1',
      title: 'كورس',
      hidden: false,
      isFree: false,
      source: 'v2',
      image: '',
      contents: { sections: [] },
    });
    // كورس ثانٍ (للدفع) وكورس قديم بلا source (لاختبار التبنّي).
    await db.doc('courses/course2').set({ id: 'course2', title: 'كورس 2', hidden: false, isFree: false, source: 'v2', image: '', contents: { sections: [] } });
    await db.doc('courses/legacy1').set({ id: 'legacy1', title: 'قديم', hidden: false, isFree: false, image: '', contents: { lectures: [] } });
    await db.doc('examContent/exam1').set({ courseId: 'course1', title: 'E', kind: 'exam', questions: [] });
    await db.doc('examKeys/exam1').set({ courseId: 'course1', answers: [] });
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

function submission(attempt = 1, extra = {}) {
  return {
    courseId: 'course1',
    examId: 'exam1',
    examTitle: 'E',
    kind: 'exam',
    userId: 'alice',
    userName: 'Alice Test',
    attempt,
    answers: { q1: 'a' },
    autoSubmit: false,
    submittedAt: serverTime(),
    ...extra,
  };
}

function result(overrides = {}) {
  return {
    courseId: 'course1',
    examId: 'exam1',
    examTitle: 'E',
    percent: 80,
    earnedPoints: 8,
    totalPoints: 10,
    effectivePercent: 80,
    penalized: false,
    attemptNumber: 1,
    isOfficial: true,
    autoSubmit: false,
    ts: 1700000000000,
    details: [],
    isTraining: false,
    isHomework: false,
    needsReview: false,
    reviewReason: '',
    ...overrides,
  };
}

async function seedSubmission(attempt = 1) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`examSubmissions/alice_exam1_${attempt}`).set({
      courseId: 'course1',
      examId: 'exam1',
      examTitle: 'E',
      kind: 'exam',
      userId: 'alice',
      userName: 'Alice Test',
      attempt,
      answers: { q1: 'a' },
      autoSubmit: false,
      submittedAt: new Date(),
    });
  });
}

describe('محاولات الامتحان (examSubmissions)', () => {
  it('المحاولة 1 مسموحة', async () => {
    await assertSucceeds(aliceDb().doc('examSubmissions/alice_exam1_1').set(submission(1)));
  });

  it('المحاولة 2 بدون المحاولة 1 مرفوضة', async () => {
    await assertFails(aliceDb().doc('examSubmissions/alice_exam1_2').set(submission(2)));
  });

  it('المحاولات 1 و2 و3 مسموحة بالترتيب، والمحاولة 4 مرفوضة', async () => {
    const db = aliceDb();
    await assertSucceeds(db.doc('examSubmissions/alice_exam1_1').set(submission(1)));
    await assertSucceeds(db.doc('examSubmissions/alice_exam1_2').set(submission(2)));
    await assertSucceeds(db.doc('examSubmissions/alice_exam1_3').set(submission(3)));
    await assertFails(db.doc('examSubmissions/alice_exam1_4').set(submission(4)));
  });

  it('معرّف مستند لا يطابق uid_examId_n مرفوض', async () => {
    await assertFails(aliceDb().doc('examSubmissions/alice_exam1_9').set(submission(1)));
  });

  it('الطالب لا ينشئ تسليمًا باسم طالب آخر', async () => {
    await assertFails(bobDb().doc('examSubmissions/bob_exam1_1').set(submission(1, { userId: 'alice' })));
    await assertFails(bobDb().doc('examSubmissions/alice_exam1_1').set(submission(1)));
  });

  it('وقت التسليم لازم يكون وقت السيرفر', async () => {
    await assertFails(
      aliceDb().doc('examSubmissions/alice_exam1_1').set(submission(1, { submittedAt: new Date() })),
    );
  });

  it('طالب غير مشترك في الكورس لا يسلّم', async () => {
    await assertFails(
      carolDb()
        .doc('examSubmissions/carol_exam1_1')
        .set(submission(1, { userId: 'carol', userName: 'Carol' })),
    );
  });

  it('تعديل الإجابات بعد التسليم مرفوض', async () => {
    await seedSubmission(1);
    await assertFails(aliceDb().doc('examSubmissions/alice_exam1_1').update({ answers: { q1: 'b' } }));
  });

  it('كتابة result مرة واحدة مسموحة، ومرتين مرفوضة', async () => {
    await seedSubmission(1);
    const reference = aliceDb().doc('examSubmissions/alice_exam1_1');
    await assertSucceeds(reference.update({ result: result(), gradedAt: new Date().toISOString() }));
    await assertFails(
      reference.update({ result: result({ percent: 100 }), gradedAt: new Date().toISOString() }),
    );
  });

  it('result برقم محاولة خاطئ مرفوض', async () => {
    await seedSubmission(1);
    await assertFails(
      aliceDb()
        .doc('examSubmissions/alice_exam1_1')
        .update({ result: result({ attemptNumber: 2 }), gradedAt: new Date().toISOString() }),
    );
  });

  it('طالب آخر لا يكتب result في تسليم غيره', async () => {
    await seedSubmission(1);
    await assertFails(
      bobDb()
        .doc('examSubmissions/alice_exam1_1')
        .update({ result: result(), gradedAt: new Date().toISOString() }),
    );
  });

  it('طالب آخر لا يقرأ تسليم غيره، وصاحبه والأدمن يقرؤونه', async () => {
    await seedSubmission(1);
    await assertFails(bobDb().doc('examSubmissions/alice_exam1_1').get());
    await assertSucceeds(aliceDb().doc('examSubmissions/alice_exam1_1').get());
    await assertSucceeds(adminDb().doc('examSubmissions/alice_exam1_1').get());
  });
});

describe('مفاتيح الامتحان (examKeys)', () => {
  it('قراءة المفاتيح قبل التسليم مرفوضة', async () => {
    await assertFails(aliceDb().doc('examKeys/exam1').get());
  });

  it('قراءة المفاتيح بعد التسليم مسموحة لصاحب التسليم فقط', async () => {
    await seedSubmission(1);
    await assertSucceeds(aliceDb().doc('examKeys/exam1').get());
    await assertFails(bobDb().doc('examKeys/exam1').get());
  });

  it('الأدمن يقرأ ويكتب المفاتيح، والطالب لا يكتبها', async () => {
    await assertSucceeds(adminDb().doc('examKeys/exam1').get());
    await assertSucceeds(
      adminDb().doc('examKeys/exam1').set({ courseId: 'course1', answers: [{ id: 'q1', answer: 'a' }] }),
    );
    await seedSubmission(1);
    await assertFails(aliceDb().doc('examKeys/exam1').set({ courseId: 'course1', answers: [] }));
  });

  it('الطالب لا يعرض قائمة المفاتيح', async () => {
    await seedSubmission(1);
    await assertFails(aliceDb().collection('examKeys').get());
  });
});

describe('نسخة النتيجة في examResults', () => {
  async function gradeInTransaction(db, entry, submissionResult) {
    const submissionRef = db.doc('examSubmissions/alice_exam1_1');
    const studentRef = db.doc('students/alice');

    return db.runTransaction(async (transaction) => {
      await transaction.get(submissionRef);
      const studentSnapshot = await transaction.get(studentRef);
      const list = studentSnapshot.data().examResults || [];

      transaction.update(submissionRef, {
        result: submissionResult,
        gradedAt: new Date().toISOString(),
      });
      transaction.update(studentRef, { examResults: [...list, entry] });
    });
  }

  it('كتابة النتيجة ونسختها معًا في معاملة واحدة مسموحة', async () => {
    await seedSubmission(1);
    const value = result();
    await assertSucceeds(gradeInTransaction(aliceDb(), value, value));
  });

  it('نسخة examResults تخالف نتيجة التسليم مرفوضة', async () => {
    await seedSubmission(1);
    await assertFails(gradeInTransaction(aliceDb(), result({ percent: 100 }), result({ percent: 50 })));
  });

  it('إضافة نتيجة امتحان جديد في examResults بدون تسليم مرفوضة', async () => {
    await assertFails(aliceDb().doc('students/alice').update({ examResults: [result()] }));
  });

  it('إضافة نتيجة امتحان قديم (بدون examContent) مسموحة كما كانت', async () => {
    await assertSucceeds(
      aliceDb()
        .doc('students/alice')
        .update({ examResults: [result({ examId: 'legacyExam1', courseId: 'oldCourse' })] }),
    );
  });

  it('إضافة عنصرين دفعة واحدة مرفوضة', async () => {
    const legacy = result({ examId: 'legacyExam1', courseId: 'oldCourse' });
    await assertFails(
      aliceDb()
        .doc('students/alice')
        .update({ examResults: [legacy, { ...legacy, attemptNumber: 2 }] }),
    );
  });

  it('أول نتيجة امتحان لطالب (examResults فارغة مسبقاً) مسموحة في معاملة', async () => {
    await seedSubmission(1);
    const value = result();
    const doc = await aliceDb().doc('students/alice').get();
    assert.deepStrictEqual(doc.data().examResults, []);
    await assertSucceeds(gradeInTransaction(aliceDb(), value, value));
  });

  it('تعديل نتيجة قديمة مرفوض', async () => {
    const legacy = result({ examId: 'legacyExam1', courseId: 'oldCourse' });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('students/alice').update({ examResults: [legacy] });
    });

    // تعديل النتيجة مع الحفاظ على نفس الطول مرفوض
    await assertFails(
      aliceDb()
        .doc('students/alice')
        .update({
          examResults: [{ ...legacy, percent: 100 }],
        }),
    );

    // تعديل النتيجة مع إضافة عنصر جديد مرفوض
    await assertFails(
      aliceDb()
        .doc('students/alice')
        .update({
          examResults: [{ ...legacy, percent: 100 }, { ...legacy, attemptNumber: 2 }],
        }),
    );
  });
});

describe('مستند الطالب', () => {
  it('الطالب لا يعدّل كورساته ولا نقاطه', async () => {
    await assertFails(aliceDb().doc('students/alice').update({ courses: ['course1', 'course2'] }));
    await assertFails(aliceDb().doc('students/alice').update({ xp: 999 }));
    await assertFails(aliceDb().doc('students/alice').update({ points: 999 }));
  });

  it('الأدمن يضيف كورسًا لمستند الطالب', async () => {
    await assertSucceeds(
      adminDb().doc('students/carol').update({ courses: ['course1'] }),
    );
  });

  it('الطالب يقرأ مستنده فقط', async () => {
    await assertSucceeds(aliceDb().doc('students/alice').get());
    await assertFails(aliceDb().doc('students/bob').get());
  });

  it('الطالب يعدّل المسار بقيمة صالحة فقط', async () => {
    await assertSucceeds(aliceDb().doc('students/alice').update({ track: 'general' }));
    await assertSucceeds(aliceDb().doc('students/alice').update({ track: 'bacc' }));
    await assertFails(aliceDb().doc('students/alice').update({ track: 'invalid_track' }));
  });
});

describe('إيصالات الدفع (paymentProofs)', () => {
  const now = () => new Date().toISOString();

  function requestData(overrides = {}) {
    return {
      courseId: 'course2',
      courseName: 'كورس 2',
      userId: 'alice',
      userName: 'Alice Test',
      userPhone: '01000000001',
      userEmail: ALICE_EMAIL,
      proofImageKey: 'req1',
      proofImageUrl: '',
      proofImage: null,
      hasProofDoc: true,
      status: 'pending',
      createdAt: now(),
      method: 'vodafone',
      amount: 100,
      ...overrides,
    };
  }

  function proofData(overrides = {}) {
    return {
      userId: 'alice',
      dataUrl: `data:image/jpeg;base64,${'A'.repeat(1000)}`,
      mime: 'image/jpeg',
      bytes: 900,
      createdAt: now(),
      ...overrides,
    };
  }

  async function seedRequestAndProof() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('paymentRequests/req1').set(requestData());
      await db.doc('paymentProofs/req1').set(proofData());
    });
  }

  it('إنشاء الطلب مع الإيصال في دفعة واحدة مسموح', async () => {
    const db = aliceDb();
    const batch = db.batch();
    batch.set(db.doc('paymentRequests/req1'), requestData());
    batch.set(db.doc('paymentProofs/req1'), proofData());
    await assertSucceeds(batch.commit());
  });

  it('طلب بدون مستند الإيصال مرفوض', async () => {
    await assertFails(aliceDb().doc('paymentRequests/req1').set(requestData()));
  });

  it('إيصال أكبر من 160000 حرف مرفوض', async () => {
    const db = aliceDb();
    const batch = db.batch();
    batch.set(db.doc('paymentRequests/req1'), requestData());
    batch.set(
      db.doc('paymentProofs/req1'),
      proofData({ dataUrl: `data:image/jpeg;base64,${'A'.repeat(160000)}` }),
    );
    await assertFails(batch.commit());
  });

  it('طالب لا ينشئ إيصالًا لطلب غيره', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('paymentRequests/req1').set(requestData());
    });
    await assertFails(bobDb().doc('paymentProofs/req1').set(proofData({ userId: 'bob' })));
  });

  it('قراءة الإيصال: صاحبه والأدمن فقط', async () => {
    await seedRequestAndProof();
    await assertSucceeds(aliceDb().doc('paymentProofs/req1').get());
    await assertSucceeds(adminDb().doc('paymentProofs/req1').get());
    await assertFails(bobDb().doc('paymentProofs/req1').get());
  });

  it('لا تعديل ولا حذف للإيصال، ولا قائمة', async () => {
    await seedRequestAndProof();
    await assertFails(aliceDb().doc('paymentProofs/req1').update({ bytes: 1 }));
    await assertFails(aliceDb().doc('paymentProofs/req1').delete());
    await assertFails(adminDb().collection('paymentProofs').get());
  });

  it('الطالب لا يغيّر حالة طلبه، والأدمن يوافق', async () => {
    await seedRequestAndProof();
    await assertFails(aliceDb().doc('paymentRequests/req1').update({ status: 'approved' }));
    await assertSucceeds(
      adminDb()
        .doc('paymentRequests/req1')
        .update({ status: 'approved', reviewedAt: now(), reviewedBy: OWNER_EMAIL }),
    );
  });
});

describe('صور أغلفة الكورسات داخل المستند', () => {
  function newCourse(imageLength) {
    return {
      id: 'cNew',
      title: 'كورس جديد',
      hidden: true,
      source: 'v2',
      image: 'x'.repeat(imageLength),
      thumbnail: '',
    };
  }

  it('غلاف بحجم معقول مسموح للأدمن', async () => {
    await assertSucceeds(adminDb().doc('courses/cNew').set(newCourse(80000)));
  });

  it('غلاف أكبر من 100000 حرف مرفوض', async () => {
    await assertFails(adminDb().doc('courses/cNew').set(newCourse(100001)));
  });

  it('الطالب لا ينشئ كورسات', async () => {
    await assertFails(aliceDb().doc('courses/cNew').set(newCourse(10)));
  });
});

describe('تعديلات المراجعة: تقدم الطالب، كورس الدفع، التبنّي، الإعدادات', () => {
  const now = () => new Date().toISOString();

  it('الطالب يحدّث تقدمه (watchProgress وlastActive) ولا يلمس كورساته', async () => {
    await assertSucceeds(
      aliceDb().doc('students/alice').update({ watchProgress: { v1: 50 }, lastActive: now() }),
    );
    await assertFails(aliceDb().doc('students/alice').update({ courses: ['course1', 'course2'] }));
    await assertFails(aliceDb().doc('students/alice').update({ points: 999 }));
  });

  it('الطالب لا يضيف إشعارات لنفسه، لكن يستطيع الحذف أو التعليم', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('students/alice').update({ notifications: [{ id: 'n1', read: false }] });
    });
    await assertSucceeds(aliceDb().doc('students/alice').update({ notifications: [{ id: 'n1', read: true }] }));
    await assertFails(
      aliceDb().doc('students/alice').update({ notifications: [{ id: 'n1', read: true }, { id: 'n2', read: false }] }),
    );
  });

  it('طلب دفع لكورس غير موجود مرفوض', async () => {
    const data = {
      courseId: 'undefined',
      courseName: 'x',
      userId: 'carol',
      userName: 'Carol Test',
      userPhone: '01000000003',
      userEmail: CAROL_EMAIL,
      proofImageKey: 'reqX',
      proofImageUrl: '',
      proofImage: null,
      hasProofDoc: true,
      status: 'pending',
      createdAt: now(),
      method: 'vodafone',
      amount: 100,
    };
    const db = carolDb();
    const batch = db.batch();
    batch.set(db.doc('paymentRequests/reqX'), data);
    batch.set(db.doc('paymentProofs/reqX'), {
      userId: 'carol',
      dataUrl: `data:image/jpeg;base64,${'A'.repeat(1000)}`,
      mime: 'image/jpeg',
      bytes: 900,
      createdAt: now(),
    });
    await assertFails(batch.commit());
  });

  it('تبنّي كورس قديم: المالك فقط، وبتغيير source فقط، مع إمكانية التراجع', async () => {
    await assertFails(aliceDb().doc('courses/legacy1').update({ source: 'v2' }));
    await assertFails(adminDb().doc('courses/legacy1').update({ source: 'v2', title: 'غيّرت العنوان' }));
    await assertSucceeds(adminDb().doc('courses/legacy1').update({ source: 'v2' }));
    await assertSucceeds(
      adminDb().doc('courses/legacy1').update({ source: firebase.firestore.FieldValue.delete() }),
    );
  });

  it('إعدادات التسجيل العامة: قراءة للجميع وكتابة للأدمن فقط', async () => {
    await assertSucceeds(testEnv.unauthenticatedContext().firestore().doc('settings/generalSettings').get());
    await assertFails(aliceDb().doc('settings/generalSettings').set({ registrationLocked: true }));
    await assertSucceeds(adminDb().doc('settings/generalSettings').set({ registrationLocked: true }));
  });

  it('مجموعات المراحل القادمة ما زالت ممنوعة', async () => {
    await assertFails(aliceDb().doc('support_tickets/t1').set({ text: 'x' }));
    await assertFails(adminDb().doc('bot_chats/c1').set({ text: 'x' }));
  });
});

// ---------- المرحلة 5: أدوار الأدمن، تصفير الدخل، الدعم، الإشعارات ----------

describe('المرحلة 5: أدوار الأدمن والدعم والإشعارات وتصفير الدخل', () => {
  const ADMIN_EMAIL = 'full.admin@example.com';
  const ASSISTANT_EMAIL = 'assistant@example.com';
  const DISABLED_EMAIL = 'disabled@example.com';

  const fullAdminDb = () => testEnv.authenticatedContext('fullAdmin', { email: ADMIN_EMAIL }).firestore();
  const assistantDb = () => testEnv.authenticatedContext('assistantUid', { email: ASSISTANT_EMAIL }).firestore();
  const disabledDb = () => testEnv.authenticatedContext('disabledUid', { email: DISABLED_EMAIL }).firestore();

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc(`platformAdmins/${ADMIN_EMAIL}`).set({ name: 'A', email: ADMIN_EMAIL, role: 'admin' });
      await db.doc(`platformAdmins/${ASSISTANT_EMAIL}`).set({ name: 'B', email: ASSISTANT_EMAIL, role: 'assistant' });
      await db.doc(`platformAdmins/${DISABLED_EMAIL}`).set({ name: 'C', email: DISABLED_EMAIL, role: 'admin', active: false });
      await db.doc('paymentRequests/pay1').set({
        courseId: 'course1',
        courseName: 'كورس',
        userId: 'alice',
        userName: 'Alice',
        userPhone: '01000000001',
        userEmail: ALICE_EMAIL,
        status: 'approved',
        createdAt: '2026-10-01T10:00:00.000Z',
      });
      await db.doc('paymentRequests/pay2').set({
        courseId: 'course1',
        courseName: 'كورس',
        userId: 'bob',
        userName: 'Bob',
        userPhone: '01000000002',
        userEmail: BOB_EMAIL,
        status: 'pending',
        createdAt: '2026-10-02T10:00:00.000Z',
      });
      await db.doc('paymentRequests/pay3').set({
        courseId: 'course1',
        courseName: 'كورس',
        userId: 'carol',
        userName: 'Carol',
        userPhone: '01000000003',
        userEmail: CAROL_EMAIL,
        status: 'approved',
        createdAt: '2026-10-03T10:00:00.000Z',
      });
    });
  });

  function ticket(overrides = {}) {
    return {
      userId: 'alice',
      user: 'Alice Test',
      userPhone: '01000000001',
      message: 'عندي سؤال عن الكورس',
      ts: 1700000000000,
      status: 'open',
      replies: [],
      category: 'question',
      ...overrides,
    };
  }

  async function seedTicket(id = 't1', overrides = {}) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`support_tickets/${id}`).set(ticket(overrides));
    });
  }

  it('تصفير الدخل: المالك والأدمن الكامل فقط، وبحقل archived_revenue وحده، وعلى طلب موافق عليه', async () => {
    const mark = { archived_revenue: true };
    await assertFails(aliceDb().doc('paymentRequests/pay1').update(mark));
    await assertFails(assistantDb().doc('paymentRequests/pay1').update(mark));
    await assertFails(disabledDb().doc('paymentRequests/pay1').update(mark));
    await assertFails(fullAdminDb().doc('paymentRequests/pay1').update({ ...mark, status: 'rejected' }));
    await assertFails(fullAdminDb().doc('paymentRequests/pay2').update(mark));
    await assertSucceeds(fullAdminDb().doc('paymentRequests/pay1').update(mark));
    await assertSucceeds(adminDb().doc('paymentRequests/pay3').update(mark));
  });

  it('المساعد يراجع الدفع كالأدمن، والمعطّل لا يستطيع', async () => {
    const review = { status: 'rejected', rejectReason: 'x', reviewedAt: '2026-10-03', reviewedBy: 'a' };
    await assertFails(disabledDb().doc('paymentRequests/pay2').update(review));
    await assertSucceeds(assistantDb().doc('paymentRequests/pay2').update(review));
  });

  it('الدعم: الطالب ينشئ تذكرته هو فقط بالشكل المحدد', async () => {
    await assertSucceeds(aliceDb().doc('support_tickets/n1').set(ticket()));
    await assertFails(bobDb().doc('support_tickets/n2').set(ticket()));
    await assertFails(aliceDb().doc('support_tickets/n3').set(ticket({ status: 'closed' })));
    await assertFails(aliceDb().doc('support_tickets/n4').set(ticket({ category: 'other' })));
    await assertFails(aliceDb().doc('support_tickets/n5').set(ticket({ message: 'ab' })));
    await assertFails(aliceDb().doc('support_tickets/n6').set({ ...ticket(), isAdmin: true }));
  });

  it('الدعم: القراءة لصاحب التذكرة والأدمن الكامل فقط (المساعد محجوب)', async () => {
    await seedTicket();
    await assertSucceeds(aliceDb().doc('support_tickets/t1').get());
    await assertFails(bobDb().doc('support_tickets/t1').get());
    await assertFails(assistantDb().doc('support_tickets/t1').get());
    await assertSucceeds(fullAdminDb().doc('support_tickets/t1').get());
    await assertSucceeds(aliceDb().collection('support_tickets').where('userId', '==', 'alice').get());
    await assertFails(aliceDb().collection('support_tickets').get());
    await assertFails(assistantDb().collection('support_tickets').get());
    await assertSucceeds(fullAdminDb().collection('support_tickets').get());
  });

  it('الدعم: رد الأدمن يُضاف فقط، والطالب يتابع تذكرته ولا يعدّل القديم', async () => {
    await seedTicket();
    const arrayUnion = firebase.firestore.FieldValue.arrayUnion;

    await assertFails(
      assistantDb().doc('support_tickets/t1').update({
        replies: arrayUnion({ from: 'admin', text: 'رد', ts: 1 }),
        status: 'answered',
        updatedAt: 1,
      }),
    );
    await assertFails(
      fullAdminDb().doc('support_tickets/t1').update({ message: 'غيّرت الرسالة' }),
    );
    await assertSucceeds(
      fullAdminDb().doc('support_tickets/t1').update({
        replies: arrayUnion({ from: 'admin', text: 'رد', ts: 1 }),
        status: 'answered',
        updatedAt: 1,
      }),
    );

    await assertFails(
      bobDb().doc('support_tickets/t1').update({
        replies: arrayUnion({ from: 'student', text: 'x', ts: 2 }),
        status: 'open',
        updatedAt: 2,
      }),
    );
    await assertFails(
      aliceDb().doc('support_tickets/t1').update({
        replies: arrayUnion({ from: 'admin', text: 'انتحال', ts: 2 }),
        status: 'open',
        updatedAt: 2,
      }),
    );
    await assertSucceeds(
      aliceDb().doc('support_tickets/t1').update({
        replies: arrayUnion({ from: 'student', text: 'شكرًا', ts: 2 }),
        status: 'open',
        updatedAt: 2,
      }),
    );
  });

  it('أول رد أدمن على تذكرة دعم بدون ردود مسبقة مسموح', async () => {
    await seedTicket('t_empty', { replies: [] });
    await assertSucceeds(
      fullAdminDb().doc('support_tickets/t_empty').update({
        replies: [{ from: 'admin', text: 'أول رد من الأدمن', ts: 100 }],
        status: 'answered',
        updatedAt: 100,
      }),
    );
  });

  it('إضافة ردين دفعة واحدة في الدعم مرفوضة', async () => {
    await seedTicket('t_double', { replies: [] });
    await assertFails(
      fullAdminDb().doc('support_tickets/t_double').update({
        replies: [
          { from: 'admin', text: 'رد 1', ts: 100 },
          { from: 'admin', text: 'رد 2', ts: 101 },
        ],
        status: 'answered',
        updatedAt: 101,
      }),
    );
  });

  it('تعديل رد قديم في الدعم مرفوض', async () => {
    await seedTicket('t_edit', {
      replies: [{ from: 'admin', text: 'رد قديم', ts: 100 }],
    });
    await assertFails(
      fullAdminDb().doc('support_tickets/t_edit').update({
        replies: [{ from: 'admin', text: 'رد معدل', ts: 100 }],
        status: 'answered',
        updatedAt: 101,
      }),
    );
  });

  it('الدعم: لا رد من الطالب على تذكرة مغلقة، ولا حذف أبدًا', async () => {
    await seedTicket('closed1', { status: 'closed' });
    await assertFails(
      aliceDb().doc('support_tickets/closed1').update({
        replies: firebase.firestore.FieldValue.arrayUnion({ from: 'student', text: 'x', ts: 3 }),
        status: 'open',
        updatedAt: 3,
      }),
    );
    await assertFails(fullAdminDb().doc('support_tickets/closed1').delete());
  });

  it('الإشعارات: الأدمن (حتى المساعد) يضيف لمستند الطالب ويسجّل الإرسال، والطالب لا يضيف', async () => {
    const notification = { id: 'adm_1', title: 'تنبيه', message: 'نص', timestamp: '2026-10-15T10:00:00.000Z', read: false, courseId: '' };
    const arrayUnion = firebase.firestore.FieldValue.arrayUnion;

    await assertSucceeds(assistantDb().doc('students/alice').update({ notifications: arrayUnion(notification) }));
    await assertFails(aliceDb().doc('students/alice').update({ notifications: arrayUnion({ ...notification, id: 'adm_2' }) }));
    await assertFails(disabledDb().doc('students/bob').update({ notifications: arrayUnion(notification) }));

    const sent = { title: 'تنبيه', message: 'نص', target: 'all', recipients: 3, sentBy: ASSISTANT_EMAIL, sentAt: serverTime() };
    await assertSucceeds(assistantDb().collection('sent_notifications').add(sent));
    await assertFails(aliceDb().collection('sent_notifications').add(sent));
    await assertFails(assistantDb().collection('sent_notifications').add({ ...sent, extra: 1 }));
  });

  it('الطالب يعلّم إشعاراته مقروءة ويحذف منها دون أن يضيف', async () => {
    const notification = { id: 'adm_1', title: 'تنبيه', message: 'نص', timestamp: '2026-10-15T10:00:00.000Z', read: false, courseId: '' };
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('students/alice').update({ notifications: [notification] });
    });

    await assertSucceeds(aliceDb().doc('students/alice').update({ notifications: [{ ...notification, read: true }] }));
    await assertSucceeds(aliceDb().doc('students/alice').update({ notifications: [] }));
  });

  it('تقدم المشاهدة: الطالب يكتب watchProgress وcompletedItems وprogress فقط', async () => {
    await assertSucceeds(
      aliceDb().doc('students/alice').update({
        watchProgress: { v1: 100 },
        completedItems: ['v1'],
        progress: { course1: { done: ['v1'], lastWatchTime: 1700000000000 } },
        lastActive: '2026-10-15T10:00:00.000Z',
      }),
    );
    await assertFails(aliceDb().doc('students/alice').update({ courses: ['course1', 'course2'] }));
    await assertFails(aliceDb().doc('students/alice').update({ archived: false }));
  });

  it('أدوار الأدمن: المساعد والمعطّل لا يكتبان في platformAdmins، والمالك فقط يكتب', async () => {
    const record = { name: 'D', email: 'd@example.com', role: 'assistant', active: true };
    await assertFails(fullAdminDb().doc('platformAdmins/d@example.com').set(record));
    await assertFails(assistantDb().doc('platformAdmins/d@example.com').set(record));
    await assertSucceeds(adminDb().doc('platformAdmins/d@example.com').set(record));
    await assertSucceeds(adminDb().doc(`platformAdmins/${DISABLED_EMAIL}`).update({ active: true }));
  });

  it('المعطّل لا يرى قائمة الطلاب ولا يكتب في الإعدادات', async () => {
    await assertFails(disabledDb().collection('students').get());
    await assertFails(disabledDb().doc('settings/generalSettings').set({ allowRegistration: false }));
    await assertSucceeds(assistantDb().collection('students').get());
  });

  it('قفل التسجيل في generalSettings يمنع إنشاء مستند طالب جديد', async () => {
    const dave = () => testEnv.authenticatedContext('dave', { email: '01000000004@student.youssefbarakat.com' }).firestore();
    const newStudent = () => ({
      name: 'Dave Test',
      phone: '01000000004',
      parentPhone: '01099999999',
      grade: 'prep1',
      gov: 'القاهرة',
      studentCode: 'YB-ABCDEFGH',
      email: '01000000004@student.youssefbarakat.com',
      role: 'student',
      courses: [],
      notifications: [],
      xp: 0,
      points: 0,
      badges: [],
      lastUpdatedAcademicYear: 2026,
      createdAt: serverTime(),
    });

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('settings/generalSettings').set({ allowRegistration: false });
    });
    await assertFails(dave().doc('students/dave').set(newStudent()));

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('settings/generalSettings').set({ allowRegistration: true });
    });
    await assertSucceeds(dave().doc('students/dave').set(newStudent()));
  });

  describe('المهمة S: صور المنصة والهوية البصرية platform_media و platform_settings', () => {
    it('قراءة platform_settings/generalSettings و platform_media مسموحة للعامة والطلاب', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc('platform_settings/generalSettings').set({
          heroBgUrl: '/assets/images/ownerBgImage-legacy.webp',
          mediaVersions: { heroBg: 123 },
        });
        await db.doc('platform_media/heroBg').set({
          dataUrl: 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v39gAA=',
          version: 123,
          sizeBytes: 100,
        });
      });

      await assertSucceeds(anonDb().doc('platform_settings/generalSettings').get());
      await assertSucceeds(anonDb().doc('platform_media/heroBg').get());
      await assertSucceeds(aliceDb().doc('platform_media/heroBg').get());
    });

    it('طالب غير مصرح له لا يرفع صوراً إلى platform_media أو يعدل إعدادات الهوية', async () => {
      await assertFails(
        aliceDb().doc('platform_media/heroBg').set({
          dataUrl: 'data:image/webp;base64,1234',
          version: 1,
          sizeBytes: 10,
        }),
      );
      await assertFails(
        aliceDb().doc('platform_settings/generalSettings').set({
          heroBgUrl: 'https://evil.com/bg.png',
        }),
      );
    });

    it('أدمن يرفع صورة صالحة ضمن سقف الحجم بنجاح ويحدث نسختها', async () => {
      await assertSucceeds(
        adminDb().doc('platform_media/logo').set({
          dataUrl: 'data:image/webp;base64,' + 'A'.repeat(1000),
          version: 123456,
          sizeBytes: 800,
        }),
      );
      await assertSucceeds(
        adminDb().doc('platform_settings/generalSettings').set({
          mediaVersions: { logo: 123456 },
        }, { merge: true }),
      );
    });

    it('أدمن يرفع صورة تتجاوز سقف الحجم المسموح تُرفض فورًا', async () => {
      // سقف الشعار 45,000 حرف dataUrl
      await assertFails(
        adminDb().doc('platform_media/logo').set({
          dataUrl: 'data:image/webp;base64,' + 'A'.repeat(50000),
          version: 123456,
          sizeBytes: 40000,
        }),
      );
    });

    it('أدمن يسترجع الصورة الافتراضية بحذف مستند platform_media مسموح', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('platform_media/logo').set({
          dataUrl: 'data:image/webp;base64,123',
          version: 1,
        });
      });
      await assertSucceeds(adminDb().doc('platform_media/logo').delete());
    });
  });
});

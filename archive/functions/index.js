// دوال السيرفر لمنصة يوسف بركات.
// ملف فقط، غير منشور. يُنشر يوم التحويل النهائي بطلب من المالك.
//
// onPaymentRequestApproved: عند تحويل طلب الدفع إلى approved تضيف الكورس لقائمة courses عند الطالب
// (بشرط ألا يكون موجودًا) وتضيف له إشعارًا برقم ثابت مبني على رقم الطلب.
//
// gradeExamSubmission: عند إنشاء تسليم في examSubmissions تصحح الإجابات على السيرفر وتضيف المحاولة
// إلى examResults عند الطالب (بدون مسح أي محاولة سابقة)، وتكتب النتيجة في مستند التسليم.
// لا تمنح xp ولا نقاطًا (المنصة القديمة لم تكن تمنحها عن الامتحانات).

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const {
  MAX_ATTEMPTS,
  asArray,
  asString,
  buildAttemptResult,
  findAssessmentItem,
  isRecord,
  matchesAssessment,
  mergeKeys,
  parseQuestions,
  parseTime,
} = require('./grading');

initializeApp();
const db = getFirestore();

// غيّر المنطقة لتطابق موقع قاعدة Firestore قبل النشر.
const REGION = 'us-central1';

// ====================== الدفع ======================

// الحالة القديمة active تُعامل كأنها approved.
function isApproved(status) {
  const value = typeof status === 'string' ? status.trim().toLowerCase() : '';
  return value === 'approved' || value === 'active';
}

async function findStudentByPhone(phone) {
  const value = asString(phone).trim();
  if (!value) return null;

  const result = await db.collection('students').where('phone', '==', value).limit(1).get();
  return result.empty ? null : result.docs[0].ref;
}

// نفس ترتيب المنصة القديمة: students/{userId} ثم البحث بالموبايل بقيمة userId ثم بـ userPhone.
async function findStudentRef(request) {
  const userId = asString(request.userId).trim();

  if (userId && !userId.includes('/')) {
    const direct = db.collection('students').doc(userId);
    const snapshot = await direct.get();
    if (snapshot.exists) return direct;

    const byUserId = await findStudentByPhone(userId);
    if (byUserId) return byUserId;
  }

  const userPhone = asString(request.userPhone).trim();
  if (userPhone && userPhone !== userId) {
    return findStudentByPhone(userPhone);
  }

  return null;
}

async function grantCourse(requestId, request) {
  const courseId = asString(request.courseId).trim();
  if (!courseId) {
    logger.error('طلب الدفع بدون courseId', { requestId });
    return;
  }

  const studentRef = await findStudentRef(request);
  if (!studentRef) {
    logger.error('لم يتم العثور على الطالب', { requestId, userId: request.userId });
    return;
  }

  const notificationId = `pay_${requestId}`;
  const courseName = asString(request.courseName) || 'الكورس';

  const notification = {
    id: notificationId,
    title: 'تم تفعيل الكورس',
    message: `تم قبول طلب الدفع وتفعيل كورس "${courseName}". يمكنك الآن مشاهدة الحصص.`,
    timestamp: new Date().toISOString(),
    read: false,
    courseId,
    proofImageKey: asString(request.proofImageKey),
  };

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(studentRef);
    if (!snapshot.exists) {
      throw new Error('student-not-found');
    }

    const data = snapshot.data();
    const courses = Array.isArray(data.courses) ? data.courses : [];
    const notifications = Array.isArray(data.notifications) ? data.notifications : [];
    const updates = {};

    if (!courses.map(String).includes(courseId)) {
      updates.courses = [...courses, courseId];
    }

    const hasNotification = notifications.some(
      (item) => item && typeof item === 'object' && item.id === notificationId,
    );
    if (!hasNotification) {
      updates.notifications = [...notifications, notification];
    }

    if (Object.keys(updates).length > 0) {
      transaction.update(studentRef, updates);
    }
  });

  logger.info('تم تفعيل الكورس للطالب', { requestId, courseId });
}

exports.onPaymentRequestApproved = onDocumentUpdated(
  { document: 'paymentRequests/{requestId}', region: REGION },
  async (event) => {
    const before = event.data && event.data.before ? event.data.before.data() : null;
    const after = event.data && event.data.after ? event.data.after.data() : null;

    if (!before || !after) return;

    // نتحرك فقط عندما تتحول الحالة إلى approved لأول مرة.
    if (isApproved(before.status) || !isApproved(after.status)) return;

    await grantCourse(event.params.requestId, after);
  },
);

// ====================== الامتحانات ======================

async function rejectSubmission(submissionRef, reason) {
  await submissionRef.update({
    status: 'rejected',
    reason,
    gradedAt: new Date().toISOString(),
  });
}

// الأسئلة مع إجاباتها: من العنصر نفسه (الامتحانات القديمة)، وإلا من examContent + examKeys.
async function loadQuestionsWithKeys(raw, examId) {
  const inline = parseQuestions(raw.questions);
  if (inline.length > 0) return inline;

  const contentSnapshot = await db.collection('examContent').doc(examId).get();
  if (!contentSnapshot.exists) return [];

  const questions = parseQuestions(contentSnapshot.data().questions);
  if (questions.length === 0) return [];

  const keysSnapshot = await db.collection('examKeys').doc(examId).get();
  return keysSnapshot.exists ? mergeKeys(questions, keysSnapshot.data().answers) : questions;
}

exports.gradeExamSubmission = onDocumentCreated(
  { document: 'examSubmissions/{submissionId}', region: REGION },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const submissionId = event.params.submissionId;
    const submissionRef = snapshot.ref;
    const data = snapshot.data();

    if (data.status !== 'pending') return;

    const userId = asString(data.userId);
    const courseId = asString(data.courseId);
    const examId = asString(data.examId);
    const answers = isRecord(data.answers) ? data.answers : {};

    if (!userId || !courseId || !examId) {
      await rejectSubmission(submissionRef, 'not-found');
      return;
    }

    // وقت الاستلام الحقيقي من السيرفر (لا نثق بالوقت القادم من المتصفح).
    const submittedAt = snapshot.createTime ? snapshot.createTime.toMillis() : Date.now();

    const studentRef = db.collection('students').doc(userId);
    const studentSnapshot = await studentRef.get();
    if (!studentSnapshot.exists || studentSnapshot.data().archived === true) {
      await rejectSubmission(submissionRef, 'no-access');
      return;
    }

    const courseSnapshot = await db.collection('courses').doc(courseId).get();
    if (!courseSnapshot.exists) {
      await rejectSubmission(submissionRef, 'not-found');
      return;
    }

    const course = courseSnapshot.data();
    const ownedCourses = asArray(studentSnapshot.data().courses).map(String);
    if (!ownedCourses.includes(courseId) && course.isFree !== true) {
      await rejectSubmission(submissionRef, 'no-access');
      return;
    }

    const found = findAssessmentItem(course, examId);
    if (!found) {
      await rejectSubmission(submissionRef, 'not-found');
      return;
    }

    const { raw, kind } = found;
    const title = asString(raw.title) || asString(raw.name) || 'بدون عنوان';
    const availableFrom = parseTime(raw.availableFrom !== undefined ? raw.availableFrom : raw.availabilityDate);
    const availableUntil = parseTime(raw.availableUntil);
    const lockedUntilTrainingId = asString(raw.lockedUntilTrainingId);

    if (availableFrom !== null && submittedAt < availableFrom) {
      await rejectSubmission(submissionRef, 'not-available-yet');
      return;
    }

    const questions = await loadQuestionsWithKeys(raw, examId);
    if (questions.length === 0) {
      await rejectSubmission(submissionRef, 'not-found');
      return;
    }

    const outcome = await db.runTransaction(async (transaction) => {
      const freshStudent = await transaction.get(studentRef);
      if (!freshStudent.exists) return { rejected: 'no-access' };

      const results = asArray(freshStudent.data().examResults);

      // الواجب المقفول: لا يُفتح حتى يُنهي الطالب التدريب المطلوب.
      if (lockedUntilTrainingId) {
        const trainingDone = results.some(
          (item) => isRecord(item) && asString(item.examId) === lockedUntilTrainingId,
        );
        if (!trainingDone) return { rejected: 'locked' };
      }

      // لو سبق تصحيح هذا التسليم (إعادة تشغيل الدالة) لا نكرره.
      const alreadyGraded = results.some(
        (item) => isRecord(item) && asString(item.submissionId) === submissionId,
      );
      if (alreadyGraded) return { skipped: true };

      const attempts = results.filter((item) => matchesAssessment(item, courseId, examId, title));
      if (attempts.length >= MAX_ATTEMPTS) return { rejected: 'attempts-exhausted' };

      const result = buildAttemptResult({
        courseId,
        examId,
        examTitle: title,
        kind,
        questions,
        answers,
        attemptNumber: attempts.length + 1,
        autoSubmit: data.autoSubmit === true,
        submittedAt,
        availableUntil,
      });

      transaction.update(studentRef, { examResults: [...results, { ...result, submissionId }] });
      transaction.update(submissionRef, {
        status: 'graded',
        result,
        gradedAt: new Date().toISOString(),
      });

      return { graded: true };
    });

    if (outcome.rejected) {
      await rejectSubmission(submissionRef, outcome.rejected);
      return;
    }

    logger.info('تم تصحيح التسليم', { submissionId, courseId, examId });
  },
);

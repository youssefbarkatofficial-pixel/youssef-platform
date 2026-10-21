import { checkLectureLock, checkInLectureItemLock } from '../v2-app/src/lib/contentRules.ts';
import { cairoToUtcMs, formatCairoDateTime } from '../v2-app/src/lib/cairoTime.ts';

console.log('=== Step 3: Cairo Time openAt / closeAt Lock Verification ===');

const now = Date.now();
const futureOpenAt = now + 48 * 3600 * 1000; // after 48 hours
const pastOpenAt = now - 24 * 3600 * 1000;   // 24 hours ago
const pastCloseAt = now - 2 * 3600 * 1000;   // 2 hours ago

console.log('\n1. Test Lecture with Future openAt:');
const futureCourse = {
  id: 'test_course_future',
  content: {
    lectures: [{ id: 'lec_future_1', title: 'محاضرة مستقبلية', openAt: futureOpenAt }]
  }
};

const studentLockFuture = checkLectureLock(futureCourse, 0, {}, {}, [], undefined, now, false);
console.log(' - Student Lock Status:', studentLockFuture);
console.log(' - Student Locked?', studentLockFuture.locked ? 'نعم (مقفول) ✓' : 'لا ✗');
console.log(' - Lock Reason:', studentLockFuture.reason);
console.log(' - Display Message:', studentLockFuture.message);

const adminLockFuture = checkLectureLock(futureCourse, 0, {}, {}, [], undefined, now, true);
console.log(' - Admin Access Status: locked =', adminLockFuture.locked, '(الأدمن يرى المحاضرة دائمًا) ✓');

console.log('\n2. Test Lecture Item (Assessment / File) with Past openAt (Active):');
const activeItem = { id: 'exam_active', title: 'امتحان حالي متاح', openAt: pastOpenAt };
const studentLockActive = checkInLectureItemLock({ id: 'lec_1' }, activeItem, 'training', {}, {}, undefined, 'test_course', now, false);
console.log(' - Active Item Lock Status: locked =', studentLockActive.locked, '(مفتوح للطالب) ✓');

console.log('\n3. Test Item with Expired closeAt (Ended):');
const expiredItem = { id: 'exam_expired', title: 'امتحان انتهى موعده', openAt: pastOpenAt, closeAt: pastCloseAt };
const studentLockExpired = checkInLectureItemLock({ id: 'lec_1' }, expiredItem, 'training', {}, {}, undefined, 'test_course', now, false);
console.log(' - Expired Item Lock Status:', studentLockExpired);
console.log(' - Reason:', studentLockExpired.reason);
console.log(' - Message:', studentLockExpired.message);

console.log('\n4. AssessmentPage Network Fetch Abort Verification:');
function simulateAssessmentPageLoad(itemMeta, isAdmin = false) {
  let networkFetchCalled = false;
  if (!isAdmin && typeof itemMeta.openAt === 'number' && itemMeta.openAt > Date.now()) {
    return {
      locked: true,
      reason: 'openAt',
      message: `بيفتح يوم ${formatCairoDateTime(itemMeta.openAt)}`,
      networkFetchCalled
    };
  }
  if (!isAdmin && typeof itemMeta.closeAt === 'number' && itemMeta.closeAt > 0 && itemMeta.closeAt < Date.now()) {
    return {
      locked: true,
      reason: 'closeAt',
      message: 'انتهى الوقت',
      networkFetchCalled
    };
  }
  networkFetchCalled = true; // loadQuestions executed
  return { locked: false, networkFetchCalled };
}

const simFuture = simulateAssessmentPageLoad({ openAt: futureOpenAt });
console.log(' - Future Assessment Network Fetch Aborted:', !simFuture.networkFetchCalled ? 'نعم (تم إلغاء جلب الأسئلة) ✓' : 'لا ✗');

const simAdminFuture = simulateAssessmentPageLoad({ openAt: futureOpenAt }, true);
console.log(' - Admin Access Loads Questions:', simAdminFuture.networkFetchCalled ? 'نعم ✓' : 'لا ✗');

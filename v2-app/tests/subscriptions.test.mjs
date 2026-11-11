import test from 'node:test';
import assert from 'node:assert/strict';

// Import our TypeScript module via node --experimental-strip-types
import {
  getCourseAccessStatus,
  checkGrantItemLock,
  calculateMonthlyRenewal,
  BASE_MONTHLY_PRICE,
} from '../src/lib/subscriptions.ts';

const mockCourse = {
  id: 'c_geo_3sec',
  title: 'الجغرافيا السياسية - الصف الثالث الثانوي',
  isFree: false,
  content: {
    lectures: [
      { id: 'lec_1', title: 'المحاضرة الأولى: الدولة والحدود', order: 1 },
      { id: 'lec_2', title: 'المحاضرة الثانية: المقومات الطبيعية', order: 2 },
      { id: 'lec_3', title: 'المحاضرة الثالثة: المقومات البشرية', order: 3 },
      { id: 'lec_4', title: 'المحاضرة الرابعة: النظام السياسي والانتخابي', order: 4 },
    ],
    exams: [
      { id: 'exam_lec_3', title: 'امتحان المحاضرة الثالثة', raw: { lectureId: 'lec_3' } },
      { id: 'exam_lec_4', title: 'امتحان المحاضرة الرابعة', raw: { lectureId: 'lec_4' } },
    ],
  },
};

const baseStudent = {
  id: 'stu_123',
  name: 'أحمد محمود',
  phone: '01012345678',
  courses: ['c_geo_3sec'],
  archived: false,
  examResults: [],
};

test('1. التوافق العكسي: طالب مسجل قديم بدون حقل accessGrants يحصل على ترم كامل دائم', () => {
  const status = getCourseAccessStatus(mockCourse, baseStudent, false);
  assert.equal(status.hasAccess, true);
  assert.equal(status.plan, 'full_term');
  assert.equal(status.expired, false);

  // كل المحاضرات مفتوحة
  const lock1 = checkGrantItemLock({ id: 'lec_1', order: 1 }, status);
  assert.equal(lock1.locked, false);
  const lock4 = checkGrantItemLock({ id: 'lec_4', order: 4 }, status);
  assert.equal(lock4.locked, false);
});

test('2. الأدمن والكورس المجاني دائماً صلاحية كاملة مفتوحة', () => {
  const adminStatus = getCourseAccessStatus(mockCourse, null, true);
  assert.equal(adminStatus.hasAccess, true);
  assert.equal(adminStatus.plan, 'admin');

  const freeCourse = { ...mockCourse, isFree: true };
  const freeStatus = getCourseAccessStatus(freeCourse, baseStudent, false);
  assert.equal(freeStatus.hasAccess, true);
  assert.equal(freeStatus.plan, 'free');
});

test('3. اشتراك شهري نشط (خلال الـ 30 يوم): المحاضرات السابقة مقفولة والجديد مفتوح', () => {
  const now = 1700000000000;
  const studentWithMonthly = {
    ...baseStudent,
    accessGrants: {
      c_geo_3sec: {
        courseId: 'c_geo_3sec',
        type: 'monthly',
        grantedAt: now,
        expiresAt: now + (30 * 24 * 60 * 60 * 1000), // بعد 30 يوم
        startLectureOrder: 3, // اشترك عند المحاضرة الثالثة
      },
    },
  };

  // بعد 10 أيام من الاشتراك
  const checkTime = now + (10 * 24 * 60 * 60 * 1000);
  const status = getCourseAccessStatus(mockCourse, studentWithMonthly, false, checkTime);

  assert.equal(status.hasAccess, true);
  assert.equal(status.plan, 'monthly');
  assert.equal(status.expired, false);
  assert.equal(status.remainingDays, 20);

  // المحاضرة الأولى والثانية (السابقة للشهر) مقفولة
  const lock1 = checkGrantItemLock({ id: 'lec_1', order: 1 }, status);
  assert.equal(lock1.locked, true);
  assert.match(lock1.message, /محاضرة سابقة لبدء اشتراكك الشهري/);

  const lock2 = checkGrantItemLock({ id: 'lec_2', order: 2 }, status);
  assert.equal(lock2.locked, true);

  // المحاضرة الثالثة والرابعة (بدء الشهر والقادم) مفتوحة
  const lock3 = checkGrantItemLock({ id: 'lec_3', order: 3 }, status);
  assert.equal(lock3.locked, false);

  const lock4 = checkGrantItemLock({ id: 'lec_4', order: 4 }, status);
  assert.equal(lock4.locked, false);
});

test('4. اشتراك شهري منتهي (بعد الـ 30 يوم): يُقفل ويطلب التجديد مع الحفاظ على البيانات', () => {
  const now = 1700000000000;
  const studentWithMonthly = {
    ...baseStudent,
    accessGrants: {
      c_geo_3sec: {
        courseId: 'c_geo_3sec',
        type: 'monthly',
        grantedAt: now - (31 * 24 * 60 * 60 * 1000), // مرّ 31 يوم
        expiresAt: now - (1 * 24 * 60 * 60 * 1000),  // انتهى أمس
        startLectureOrder: 2,
      },
    },
  };

  const status = getCourseAccessStatus(mockCourse, studentWithMonthly, false, now);

  assert.equal(status.hasAccess, false);
  assert.equal(status.plan, 'monthly');
  assert.equal(status.expired, true);
  assert.match(status.message, /انتهت مدة اشتراكك الشهري/);

  // كل المحاضرات مقفولة بسبب انتهاء الصلاحية
  const lock3 = checkGrantItemLock({ id: 'lec_3', order: 3 }, status);
  assert.equal(lock3.locked, true);
});

test('5. محاضرة تجريبية مجانية نشطة (خلال الـ 7 أيام): المحاضرة المحددة فقط مفتوحة', () => {
  const now = 1700000000000;
  const studentTrial = {
    ...baseStudent,
    accessGrants: {
      c_geo_3sec: {
        courseId: 'c_geo_3sec',
        type: 'trial_lecture',
        grantedAt: now,
        expiresAt: now + (7 * 24 * 60 * 60 * 1000), // 7 أيام
        targetLectureId: 'lec_4',
        targetLectureOrder: 4,
      },
    },
  };

  const status = getCourseAccessStatus(mockCourse, studentTrial, false, now + (2 * 24 * 60 * 60 * 1000));
  assert.equal(status.hasAccess, true);
  assert.equal(status.plan, 'trial_lecture');
  assert.equal(status.expired, false);
  assert.equal(status.remainingDays, 5);

  // المحاضرة الرابعة المستهدفة مفتوحة
  const lock4 = checkGrantItemLock({ id: 'lec_4', order: 4 }, status);
  assert.equal(lock4.locked, false);

  // أي محاضرة أخرى مقفولة وموضح سبب القفل
  const lock1 = checkGrantItemLock({ id: 'lec_1', order: 1 }, status);
  assert.equal(lock1.locked, true);
  assert.match(lock1.message, /متاح لك فقط المحاضرة التجريبية/);
});

test('6. محاضرة تجريبية منتهية بمرور الـ 7 أيام تُقفل تماماً', () => {
  const now = 1700000000000;
  const studentTrial = {
    ...baseStudent,
    accessGrants: {
      c_geo_3sec: {
        courseId: 'c_geo_3sec',
        type: 'trial_lecture',
        grantedAt: now - (8 * 24 * 60 * 60 * 1000),
        expiresAt: now - (1 * 24 * 60 * 60 * 1000), // انتهت قبل يوم
        targetLectureId: 'lec_4',
        targetLectureOrder: 4,
      },
    },
  };

  const status = getCourseAccessStatus(mockCourse, studentTrial, false, now);
  assert.equal(status.hasAccess, false);
  assert.equal(status.expired, true);
  assert.match(status.message, /انتهت فترة المحاضرة التجريبية/);
});

test('7. محاضرة تجريبية أُنهي امتحانها ونزلت محاضرة جديدة تُقفل تلقائياً', () => {
  const now = 1700000000000;
  // الطالب واخد المحاضرة الثالثة، وامتحن امتحانها، والمحاضرة الرابعة نزلت
  const studentTrial = {
    ...baseStudent,
    examResults: [{ assessmentId: 'exam_lec_3', score: 90 }],
    accessGrants: {
      c_geo_3sec: {
        courseId: 'c_geo_3sec',
        type: 'trial_lecture',
        grantedAt: now,
        expiresAt: now + (5 * 24 * 60 * 60 * 1000), // لسه متبقي وقت
        targetLectureId: 'lec_3',
        targetLectureOrder: 3,
      },
    },
  };

  const status = getCourseAccessStatus(mockCourse, studentTrial, false, now + 1000);
  assert.equal(status.hasAccess, false);
  assert.equal(status.expired, true);
  assert.match(status.message, /تم إنهاء المحاضرة التجريبية ونزلت محاضرة جديدة/);
});

test('8. تجربة المحاضرة المجانية والاشتراك الشهري المسجل ذاتياً في progress معترف بهما بدون خطأ صلاحيات', () => {
  const now = 1700000000000;
  // طالب مسجل ذاتياً في progress وليس في accessGrants
  const selfClaimStudent = {
    ...baseStudent,
    courses: [], // ليس في كورسات فايرستور المباشرة
    accessGrants: undefined,
    progress: {
      trials: {
        c_geo_3sec: {
          courseId: 'c_geo_3sec',
          type: 'trial_lecture',
          claimedAt: now,
          expiresAt: now + (7 * 24 * 60 * 60 * 1000),
          targetLectureId: 'lec_4',
          targetLectureOrder: 4,
        },
      },
    },
  };

  const status = getCourseAccessStatus(mockCourse, selfClaimStudent, false, now + 1000);
  assert.equal(status.hasAccess, true);
  assert.equal(status.plan, 'trial_lecture');
  assert.equal(status.isSelfClaimed, true);
  assert.equal(status.targetLectureOrder, 4);

  // فحص القفل
  const lock4 = checkGrantItemLock({ id: 'lec_4', order: 4 }, status);
  assert.equal(lock4.locked, false);
  const lock1 = checkGrantItemLock({ id: 'lec_1', order: 1 }, status);
  assert.equal(lock1.locked, true);
});

test('9. التجديد الذكي للاشتراك الشهري: خصم 25% قبل 5 أيام وخصم 15% آخر يوم وإغلاق تام بعد الـ 30 يوم', () => {
  const now = 1700000000000;
  const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 يوماً

  // حالة 1: بعد 10 أيام (متبقي 20 يوماً) -> عادي بدون خصم
  const normalCheck = calculateMonthlyRenewal(expiresAt, now + (10 * 24 * 60 * 60 * 1000));
  assert.equal(normalCheck.canRenewMonthly, true);
  assert.equal(normalCheck.stage, 'normal');
  assert.equal(normalCheck.discountPercent, 0);
  assert.equal(normalCheck.renewalPrice, 110);

  // حالة 2: قبل 4 أيام من الانتهاء (أيام 25-29) -> خصم 25% (82.5 ج)
  const discount25Check = calculateMonthlyRenewal(expiresAt, expiresAt - (4 * 24 * 60 * 60 * 1000));
  assert.equal(discount25Check.canRenewMonthly, true);
  assert.equal(discount25Check.stage, 'discount_25');
  assert.equal(discount25Check.discountPercent, 25);
  assert.equal(discount25Check.renewalPrice, 82.5);

  // حالة 3: قبل 12 ساعة من الانتهاء (اليوم الأخير / آخر 24 ساعة) -> خصم 15% (93.5 ج) فرصة أخيرة
  const discount15Check = calculateMonthlyRenewal(expiresAt, expiresAt - (12 * 60 * 60 * 1000));
  assert.equal(discount15Check.canRenewMonthly, true);
  assert.equal(discount15Check.stage, 'discount_15');
  assert.equal(discount15Check.discountPercent, 15);
  assert.equal(discount15Check.renewalPrice, 93.5);

  // حالة 4: بعد انتهاء الـ 30 يوماً -> إغلاق التجديد الشهري تماماً وحصره في الترم كامل
  const expiredCheck = calculateMonthlyRenewal(expiresAt, expiresAt + 1000);
  assert.equal(expiredCheck.canRenewMonthly, false);
  assert.equal(expiredCheck.stage, 'expired_forced_term');
});

test('10. اشتراك شهري مسجل ذاتياً منتهي الصلاحية يقفل ويحظر التجديد الشهري تماماً', () => {
  const now = 1700000000000;
  const expiredPromoStudent = {
    ...baseStudent,
    courses: [],
    progress: {
      monthlyPromos: {
        c_geo_3sec: {
          courseId: 'c_geo_3sec',
          type: 'monthly',
          claimedAt: now - (31 * 24 * 60 * 60 * 1000),
          expiresAt: now - (1 * 24 * 60 * 60 * 1000),
          startLectureOrder: 2,
        },
      },
    },
  };

  const status = getCourseAccessStatus(mockCourse, expiredPromoStudent, false, now);
  assert.equal(status.hasAccess, false);
  assert.equal(status.expired, true);
  assert.equal(status.canRenewMonthly, false);
  assert.equal(status.renewalStage, 'expired_forced_term');
});

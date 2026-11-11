import type { Course } from '../services/courses';
import type { Student } from '../services/students';

export type CourseGrantType = 'full_term' | 'monthly' | 'trial_lecture';

export interface StudentGrant {
  courseId: string;
  type: CourseGrantType;
  grantedAt: number;
  expiresAt: number; // 0 for full_term
  targetLectureId?: string; // For trial_lecture
  targetLectureOrder?: number;
  startLectureOrder?: number; // For monthly
  isSelfClaimed?: boolean;
}

export type MonthlyRenewalStage = 'normal' | 'discount_25' | 'discount_15' | 'expired_forced_term';

export interface GrantAccessStatus {
  hasAccess: boolean;
  isEnrolled: boolean;
  plan: CourseGrantType | 'free' | 'admin' | 'none';
  expired: boolean;
  expiresAt?: number;
  remainingDays?: number;
  message?: string;
  startLectureOrder?: number;
  targetLectureId?: string;
  targetLectureOrder?: number;
  // تفاصيل التجديد الذكي للاشتراك الشهري
  canRenewMonthly?: boolean;
  renewalDiscountPercent?: number; // 25, 15, or 0
  renewalPrice?: number; // 82.5, 93.5, or 110
  renewalStage?: MonthlyRenewalStage;
  isSelfClaimed?: boolean;
}

export const BASE_MONTHLY_PRICE = 110;
export const TRIAL_DURATION_DAYS = 7;
export const MONTHLY_DURATION_DAYS = 30;

/**
 * حساب حالة التجديد الذكي والخصومات التنازلية للاشتراك الشهري
 * - قبل 5 أيام (اليوم 25-29): خصم 25% (82.5 ج) مع تحذير من إغلاق الشهري
 * - قبل 24 ساعة (اليوم 30): خصم 15% (93.5 ج) فرصة أخيرة
 * - بعد 30 يوم: إغلاق الشهري نهائياً وحصره في الترم كامل
 */
export function calculateMonthlyRenewal(
  expiresAt: number,
  now: number = Date.now(),
): {
  canRenewMonthly: boolean;
  remainingDays: number;
  remainingHours: number;
  discountPercent: number;
  renewalPrice: number;
  stage: MonthlyRenewalStage;
} {
  if (now >= expiresAt) {
    return {
      canRenewMonthly: false,
      remainingDays: 0,
      remainingHours: 0,
      discountPercent: 0,
      renewalPrice: BASE_MONTHLY_PRICE,
      stage: 'expired_forced_term',
    };
  }

  const diffMs = expiresAt - now;
  const remainingDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const remainingHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));

  // آخر 24 ساعة
  if (diffMs <= 24 * 60 * 60 * 1000) {
    return {
      canRenewMonthly: true,
      remainingDays,
      remainingHours,
      discountPercent: 15,
      renewalPrice: 93.5,
      stage: 'discount_15',
    };
  }

  // آخر 5 أيام (أيام 25-29)
  if (diffMs <= 5 * 24 * 60 * 60 * 1000) {
    return {
      canRenewMonthly: true,
      remainingDays,
      remainingHours,
      discountPercent: 25,
      renewalPrice: 82.5,
      stage: 'discount_25',
    };
  }

  return {
    canRenewMonthly: true,
    remainingDays,
    remainingHours,
    discountPercent: 0,
    renewalPrice: BASE_MONTHLY_PRICE,
    stage: 'normal',
  };
}

/**
 * استخراج أي صلاحية وصول خاصة بالكورس (سواء منحها الأدمن أو طالب فعل التجربة/الشهري بنفسه)
 */
export function extractStudentCourseGrant(
  student: Student | null,
  courseId: string,
): StudentGrant | null {
  if (!student) return null;

  // 1. صلاحية مباشرة منحها الأدمن
  if (student.accessGrants?.[courseId]) {
    return student.accessGrants[courseId];
  }

  // 2. اشتراك شهري مسجل ذاتياً في تقدم الطالب (Spark-compatible)
  const progress = student.progress as Record<string, unknown> | undefined;
  if (progress && typeof progress === 'object') {
    const monthlyPromos = progress.monthlyPromos as Record<string, unknown> | undefined;
    if (monthlyPromos && typeof monthlyPromos === 'object' && monthlyPromos[courseId]) {
      const item = monthlyPromos[courseId] as Record<string, unknown>;
      return {
        courseId,
        type: 'monthly',
        grantedAt: Number(item.claimedAt || item.grantedAt || 0),
        expiresAt: Number(item.expiresAt || 0),
        startLectureOrder: item.startLectureOrder !== undefined ? Number(item.startLectureOrder) : 1,
        isSelfClaimed: true,
      };
    }

    // 3. محاضرة تجريبية مسجلة ذاتياً في تقدم الطالب
    const trials = progress.trials as Record<string, unknown> | undefined;
    if (trials && typeof trials === 'object' && trials[courseId]) {
      const item = trials[courseId] as Record<string, unknown>;
      return {
        courseId,
        type: 'trial_lecture',
        grantedAt: Number(item.claimedAt || item.grantedAt || 0),
        expiresAt: Number(item.expiresAt || 0),
        targetLectureId: typeof item.targetLectureId === 'string' ? item.targetLectureId : undefined,
        targetLectureOrder: item.targetLectureOrder !== undefined ? Number(item.targetLectureOrder) : undefined,
        isSelfClaimed: true,
      };
    }
  }

  return null;
}

/**
 * تقييم صلاحية وصول الطالب للكورس وفقاً لنوع الاشتراك (ترم كامل / شهري 30 يوم / محاضرة تجريبية)
 */
export function getCourseAccessStatus(
  course: Course | null,
  student: Student | null,
  isAdmin: boolean,
  now: number = Date.now(),
): GrantAccessStatus {
  if (isAdmin) {
    return { hasAccess: true, isEnrolled: true, plan: 'admin', expired: false };
  }
  if (!course) {
    return { hasAccess: false, isEnrolled: false, plan: 'none', expired: false };
  }
  if (course.isFree) {
    return { hasAccess: true, isEnrolled: true, plan: 'free', expired: false };
  }
  if (!student || student.archived) {
    return { hasAccess: false, isEnrolled: false, plan: 'none', expired: false };
  }

  const grant = extractStudentCourseGrant(student, course.id);
  const isDirectlyEnrolled = student.courses.includes(course.id);

  // إذا لم يكن مشتركاً ولا يمتلك أي منحة وصول
  if (!grant && !isDirectlyEnrolled) {
    return { hasAccess: false, isEnrolled: false, plan: 'none', expired: false };
  }

  // إذا كان اشتراك ترم كامل دائم (بدون منحة مؤقتة أو بانتهاء = 0)
  if (!grant || grant.type === 'full_term' || !grant.expiresAt) {
    return { hasAccess: true, isEnrolled: true, plan: 'full_term', expired: false };
  }

  // 1. اشتراك شهري (30 يوم عد تنازلي مع خصومات تجديد وإغلاق نهائي بعد الانتهاء)
  if (grant.type === 'monthly') {
    const renewal = calculateMonthlyRenewal(grant.expiresAt, now);

    if (now >= grant.expiresAt) {
      return {
        hasAccess: false,
        isEnrolled: true,
        plan: 'monthly',
        expired: true,
        expiresAt: grant.expiresAt,
        canRenewMonthly: false,
        renewalStage: 'expired_forced_term',
        renewalDiscountPercent: 0,
        renewalPrice: BASE_MONTHLY_PRICE,
        isSelfClaimed: Boolean(grant.isSelfClaimed),
        message: 'انتهت مدة اشتراكك الشهري (30 يوماً). تم إغلاق التجديد الشهري، يمكنك الآن الاشتراك في الترم كامل.',
      };
    }

    return {
      hasAccess: true,
      isEnrolled: true,
      plan: 'monthly',
      expired: false,
      expiresAt: grant.expiresAt,
      remainingDays: renewal.remainingDays,
      startLectureOrder: grant.startLectureOrder || 1,
      canRenewMonthly: renewal.canRenewMonthly,
      renewalStage: renewal.stage,
      renewalDiscountPercent: renewal.discountPercent,
      renewalPrice: renewal.renewalPrice,
      isSelfClaimed: Boolean(grant.isSelfClaimed),
    };
  }

  // 2. محاضرة تجريبية مجانية (آخر محاضرة فقط + أقصى مدة 7 أيام وأقل مدة 6 أيام)
  if (grant.type === 'trial_lecture') {
    // التحقق من المدة الزمنية
    if (now >= grant.expiresAt) {
      return {
        hasAccess: false,
        isEnrolled: true,
        plan: 'trial_lecture',
        expired: true,
        expiresAt: grant.expiresAt,
        isSelfClaimed: Boolean(grant.isSelfClaimed),
        message: 'انتهت فترة المحاضرة التجريبية المجانية.. اشترك الآن لمتابعة المنهج بالكامل',
      };
    }

    // التحقق من شرط: حل الامتحان + نزول محاضرة أحدث
    const lectures = course.content?.lectures || [];
    const targetOrder = grant.targetLectureOrder || 0;
    const newerLecturesExist = lectures.some((l) => l.order > targetOrder);

    const examResults = (student.examResults || []) as Array<{
      assessmentId?: string;
      examId?: string;
      id?: string;
    }>;
    const targetLecture = lectures.find((l) => l.id === grant.targetLectureId);

    let examSubmitted = false;
    if (targetLecture) {
      const lectureExamIds = new Set<string>();
      (course.content?.exams || []).forEach((ex) => {
        const raw = (ex.raw || {}) as Record<string, unknown>;
        if (raw.lectureId === targetLecture.id || raw.attachedToLectureId === targetLecture.id) {
          lectureExamIds.add(ex.id);
        }
      });
      (targetLecture.homeworks || []).forEach((hw) => lectureExamIds.add(hw.id));

      examSubmitted = examResults.some((res) => {
        const aid = res.assessmentId || res.examId || res.id;
        return Boolean(aid && lectureExamIds.has(aid));
      });
    }

    if (examSubmitted && newerLecturesExist) {
      return {
        hasAccess: false,
        isEnrolled: true,
        plan: 'trial_lecture',
        expired: true,
        expiresAt: grant.expiresAt,
        isSelfClaimed: Boolean(grant.isSelfClaimed),
        message: 'تم إنهاء المحاضرة التجريبية ونزلت محاضرة جديدة.. اشترك الآن لمتابعة المنهج',
      };
    }

    const remainingDays = Math.max(1, Math.ceil((grant.expiresAt - now) / (1000 * 60 * 60 * 24)));
    return {
      hasAccess: true,
      isEnrolled: true,
      plan: 'trial_lecture',
      expired: false,
      expiresAt: grant.expiresAt,
      remainingDays,
      targetLectureId: grant.targetLectureId,
      targetLectureOrder: grant.targetLectureOrder,
      isSelfClaimed: Boolean(grant.isSelfClaimed),
    };
  }

  return { hasAccess: true, isEnrolled: true, plan: 'full_term', expired: false };
}

/**
 * فحص قفل المحاضرة المحددة حسب خطة الاشتراك (حظر ما قبل الشهر / حظر ما غير المحاضرة التجريبية)
 */
export function checkGrantItemLock(
  lecture: { id: string; order: number },
  status: GrantAccessStatus,
): { locked: boolean; message?: string } {
  if (!status.hasAccess) {
    return { locked: true, message: status.message || 'المحتوى مقفول' };
  }

  // في حالة المحاضرة التجريبية: متاح المحاضرة المحددة فقط
  if (status.plan === 'trial_lecture') {
    if (status.targetLectureId && lecture.id !== status.targetLectureId) {
      return {
        locked: true,
        message: `متاح لك فقط المحاضرة التجريبية (#${status.targetLectureOrder || ''})`,
      };
    }
  }

  // في حالة الاشتراك الشهري: المحاضرات السابقة لبداية الشهر تظل مقفولة
  if (status.plan === 'monthly' && typeof status.startLectureOrder === 'number') {
    if (lecture.order < status.startLectureOrder) {
      return {
        locked: true,
        message: `محاضرة سابقة لبدء اشتراكك الشهري (يبدأ من #${status.startLectureOrder})`,
      };
    }
  }

  return { locked: false };
}

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
}

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
  if (!student || student.archived || !student.courses.includes(course.id)) {
    return { hasAccess: false, isEnrolled: false, plan: 'none', expired: false };
  }

  const grant = student.accessGrants?.[course.id];
  if (!grant || grant.type === 'full_term' || !grant.expiresAt) {
    return { hasAccess: true, isEnrolled: true, plan: 'full_term', expired: false };
  }

  // 1. اشتراك شهري (30 يوم عد تنازلي)
  if (grant.type === 'monthly') {
    if (now >= grant.expiresAt) {
      return {
        hasAccess: false,
        isEnrolled: true,
        plan: 'monthly',
        expired: true,
        expiresAt: grant.expiresAt,
        message: 'انتهت مدة اشتراكك الشهري (30 يوم).. جدد الآن لمتابعة باقي المحاضرات',
      };
    }
    const remainingDays = Math.max(1, Math.ceil((grant.expiresAt - now) / (1000 * 60 * 60 * 24)));
    return {
      hasAccess: true,
      isEnrolled: true,
      plan: 'monthly',
      expired: false,
      expiresAt: grant.expiresAt,
      remainingDays,
      startLectureOrder: grant.startLectureOrder || 1,
    };
  }

  // 2. محاضرة تجريبية مجانية (آخر محاضرة فقط + أقصى مدة 7 أيام)
  if (grant.type === 'trial_lecture') {
    // التحقق من المدة الزمنية (7 أيام)
    if (now >= grant.expiresAt) {
      return {
        hasAccess: false,
        isEnrolled: true,
        plan: 'trial_lecture',
        expired: true,
        expiresAt: grant.expiresAt,
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

import { tzOffsetMs, cairoToUtcMs, cairoInputToUtcMs, formatCairoDateTime } from './cairoTime.ts';
export { tzOffsetMs, cairoToUtcMs, cairoInputToUtcMs, formatCairoDateTime };
import { WATCH_THRESHOLD } from './watchTracker.ts';
import { isFreePreview } from './marketing.ts';

export interface ContentRulesSettings {
  enabled: boolean;
  enabledAt: number | null;
  watchThreshold: number; // e.g. 0.95
}

export const DEFAULT_CONTENT_RULES: ContentRulesSettings = {
  enabled: false,
  enabledAt: null,
  watchThreshold: WATCH_THRESHOLD
};

export interface LockStatus {
  locked: boolean;
  reason?: 'prerequisite' | 'openAt' | 'closeAt' | 'watch' | 'notEnrolled';
  closeAt?: number;
  message?: string;
  openAt?: number;
}



/**
 * استخراج وقت التسجيل في كورس أو إنشاء حساب الطالب
 */
export function getStudentEnrollmentTimestamp(student: any, courseId?: string): number | null {
  if (!student) return null;

  // فحص وقت الاشتراك في الكورس المحدد إن وجد
  if (courseId && student.enrolledCourses) {
    const entry = student.enrolledCourses[courseId];
    if (typeof entry === 'number' && entry > 0) return entry;
    if (typeof entry === 'object' && entry !== null) {
      if (typeof entry.enrolledAt === 'number') return entry.enrolledAt;
      if (entry.enrolledAt?.toMillis) return entry.enrolledAt.toMillis();
      if (entry.createdAt?.toMillis) return entry.createdAt.toMillis();
      if (typeof entry.createdAt === 'number') return entry.createdAt;
    }
  }

  // فحص تاريخ إنشاء الحساب
  if (typeof student.createdAt === 'number') return student.createdAt;
  if (student.createdAt?.toMillis) return student.createdAt.toMillis();
  if (typeof student.joinedAt === 'number') return student.joinedAt;
  if (student.joinedAt?.toMillis) return student.joinedAt.toMillis();
  if (typeof student.registrationDate === 'number') return student.registrationDate;

  return null;
}

/**
 * 3.2 قاعدة استثناء الطلاب القدامى:
 * - الأدمن والمالك = معفي دائمًا
 * - القواعد غير مفعلة = معفي دائمًا
 * - تاريخ الاشتراك أو الحساب أقدم من enabledAt = معفي
 * - قاعدة أمان صارمة: المجهول أو غير المحدد = معفي!
 */
export function isStudentExempt(
  student: any,
  rules: ContentRulesSettings,
  courseId?: string,
  isAdminOrOwner: boolean = false
): boolean {
  if (isAdminOrOwner) return true;
  if (!rules || !rules.enabled || !rules.enabledAt) return true;

  const enrollmentTime = getStudentEnrollmentTimestamp(student, courseId);
  // قاعدة أمان: إن لم يوجد تاريخ (مجهول)، يعتبر الطالب معفيًا لعدم الإضرار به
  if (enrollmentTime === null || isNaN(enrollmentTime)) {
    return true;
  }

  return enrollmentTime < rules.enabledAt;
}

/**
 * فحص تسليم تمرين أو واجب في سجل نتائج الاختبارات
 */
export function isAssessmentSubmitted(assessmentId: string, examResults: any[] = []): boolean {
  if (!assessmentId || !Array.isArray(examResults)) return false;
  return examResults.some(res => {
    if (!res) return false;
    return res.assessmentId === assessmentId || res.examId === assessmentId || res.id === assessmentId;
  });
}

/**
 * فحص نسبة مشاهدة المحاضرة هل بلغت النسبة المطلوبة (≥95%)
 */
export function isLectureWatchCompleted(
  lectureId: string,
  watchProgress: Record<string, any> = {},
  threshold: number = WATCH_THRESHOLD
): boolean {
  if (!lectureId || !watchProgress) return false;
  const p = watchProgress[lectureId];
  if (p === undefined || p === null) return false;

  if (typeof p === 'number') {
    // إما نسبة مئوية (95) أو كسر (0.95)
    return p >= (threshold > 1 ? threshold : threshold * 100) || p >= threshold;
  }

  if (typeof p === 'object') {
    if (typeof p.completed === 'boolean') return p.completed;
    if (typeof p.coverage === 'number') return p.coverage >= threshold;
    if (typeof p.progress === 'number') return p.progress >= (threshold > 1 ? threshold : threshold * 100);
  }

  return false;
}

/**
 * 3.3 فحص قفل المحاضرة (التسلسل و openAt)
 */
export function checkLectureLock(
  course: any,
  lectureIndex: number,
  student: any,
  watchProgress: Record<string, any> = {},
  examResults: any[] = [],
  rules: ContentRulesSettings = DEFAULT_CONTENT_RULES,
  serverTime: number = Date.now(),
  isAdminOrOwner: boolean = false
): LockStatus {
  if (isAdminOrOwner) return { locked: false };

  const lectures = course?.content?.lectures || [];
  const currentLecture = lectures[lectureIndex];
  if (!currentLecture) return { locked: false };

  // فحص تاريخ الفتح openAt (يسري على الجميع حتى المعفيين إن كان درساً لم يحن موعده)
  if (typeof currentLecture.openAt === 'number' && currentLecture.openAt > serverTime) {
    return {
      locked: true,
      reason: 'openAt',
      message: `بيفتح يوم ${formatCairoDateTime(currentLecture.openAt)}`,
      openAt: currentLecture.openAt
    };
  }

  if (typeof currentLecture.closeAt === 'number' && currentLecture.closeAt > 0 && currentLecture.closeAt < serverTime) {
    return {
      locked: true,
      reason: 'closeAt',
      message: 'انتهى الوقت',
      closeAt: currentLecture.closeAt
    };
  }

  // فحص المعاينة المجانية: فتح الفيديو للمحاضرة
  if (isFreePreview(currentLecture)) {
    return { locked: false };
  }

  // إذا كان الطالب معفيًا، تفتح المحاضرة مباشرة
  if (isStudentExempt(student, rules, course?.id, isAdminOrOwner)) {
    return { locked: false };
  }

  // المحاضرة الأولى مفتوحة تلقائيًا
  if (lectureIndex === 0) {
    return { locked: false };
  }

  // فحص المحاضرة السابقة N-1
  const prevLecture = lectures[lectureIndex - 1];
  if (!prevLecture) return { locked: false };

  const prevWatchDone = isLectureWatchCompleted(prevLecture.id, watchProgress, rules.watchThreshold);
  if (!prevWatchDone) {
    return {
      locked: true,
      reason: 'prerequisite',
      message: 'خلّص المحاضرة اللي قبلها وحل تدريبها'
    };
  }

  // فحص تسليم تدريبات المحاضرة السابقة
  const prevTrainings = prevLecture.trainings || [];
  for (const tr of prevTrainings) {
    if (tr?.id && !isAssessmentSubmitted(tr.id, examResults)) {
      return {
        locked: true,
        reason: 'prerequisite',
        message: 'خلّص المحاضرة اللي قبلها وحل تدريبها'
      };
    }
  }

  // فحص تسليم واجبات المحاضرة السابقة
  const prevHomeworks = prevLecture.homeworks || [];
  for (const hw of prevHomeworks) {
    if (hw?.id && !isAssessmentSubmitted(hw.id, examResults)) {
      return {
        locked: true,
        reason: 'prerequisite',
        message: 'خلّص المحاضرة اللي قبلها وحل تدريبها'
      };
    }
  }

  return { locked: false };
}

/**
 * فحص قفل العناصر داخل المحاضرة (التدريبات، الواجبات، الملفات)
 */
export function checkInLectureItemLock(
  lecture: any,
  item: any,
  itemType: 'training' | 'homework' | 'file',
  student: any,
  watchProgress: Record<string, any> = {},
  rules: ContentRulesSettings = DEFAULT_CONTENT_RULES,
  courseId?: string,
  serverTime: number = Date.now(),
  isAdminOrOwner: boolean = false
): LockStatus {
  if (isAdminOrOwner) return { locked: false };

  // فحص openAt
  if (typeof item?.openAt === 'number' && item.openAt > serverTime) {
    return {
      locked: true,
      reason: 'openAt',
      message: `بيفتح يوم ${formatCairoDateTime(item.openAt)}`,
      openAt: item.openAt
    };
  }

  if (typeof item?.closeAt === 'number' && item.closeAt > 0 && item.closeAt < serverTime) {
    return {
      locked: true,
      reason: 'closeAt',
      message: 'انتهى الوقت',
      closeAt: item.closeAt
    };
  }

  // المعفي يتجاوز شرط المشاهدة
  if (isStudentExempt(student, rules, courseId, isAdminOrOwner)) {
    return { locked: false };
  }

  // اشتراط مشاهدة الفيديو ≥95%
  const watchDone = isLectureWatchCompleted(lecture?.id, watchProgress, rules.watchThreshold);
  if (!watchDone) {
    const label = itemType === 'file' ? 'لتحميل الملف' : itemType === 'training' ? 'لبدء التدريب' : 'لبدء الواجب';
    return {
      locked: true,
      reason: 'watch',
      message: `شاهد 95% من فيديو المحاضرة أولًا ${label}`
    };
  }

  return { locked: false };
}

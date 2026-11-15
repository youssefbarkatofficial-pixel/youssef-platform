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

export interface MissingRequirement {
  kind: 'watch' | 'training' | 'homework' | 'lockedTraining' | 'openAt' | 'closeAt' | 'notEnrolled' | 'grant';
  id: string;
  title: string;
  lectureId?: string;
  lectureTitle?: string;
  currentPercent?: number;
  requiredPercent?: number;
}

export interface LockStatus {
  locked: boolean;
  reason?: 'prerequisite' | 'openAt' | 'closeAt' | 'watch' | 'notEnrolled';
  closeAt?: number;
  message?: string;
  openAt?: number;
  detailedMessage?: string;
  missingItems?: MissingRequirement[];
}

export interface GrantAccessLike {
  hasAccess?: boolean;
  plan?: string;
  targetLectureId?: string;
  targetLectureOrder?: number;
  startLectureOrder?: number;
  message?: string;
}

export interface AssessmentDiagnosticsInput {
  course: { id?: string; sections?: any[]; content?: { lectures?: any[]; homeworks?: any[]; exams?: any[] } } | null | undefined;
  assessment: {
    id: string;
    title?: string;
    kind?: 'exam' | 'homework' | 'training';
    lockedUntilTrainingId?: string;
    availableFrom?: number | null;
    availableUntil?: number | null;
    openAt?: number | null;
    closeAt?: number | null;
    raw?: Record<string, any>;
  };
  student: any;
  watchProgress: Record<string, any>;
  examResults: any[];
  rules: ContentRulesSettings;
  serverTime?: number;
  isAdminOrOwner?: boolean;
  grantStatus?: GrantAccessLike;
}

export interface AssessmentPrerequisiteDiagnostics {
  locked: boolean;
  reason?: 'openAt' | 'closeAt' | 'lockedTraining' | 'prerequisite' | 'watch' | 'grant';
  message: string;
  missingItems: MissingRequirement[];
  linkedLecture?: { id: string; title: string; order?: number };
}

function extractTs(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val) && val > 0) return val;
  if (val && typeof val === 'object' && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
    const ms = (val as { toMillis: () => number }).toMillis();
    return typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? ms : null;
  }
  return null;
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

  // فحص المنح الزمنية والاشتراكات الحديثة (accessGrants / trials / monthlyPromos)
  if (courseId && student.accessGrants?.[courseId]) {
    const grant = student.accessGrants[courseId];
    const grantTs = extractTs(grant.grantedAt) ?? extractTs(grant.createdAt);
    if (grantTs !== null) return grantTs;
  }
  if (courseId && student.progress?.trials?.[courseId]) {
    const trialTs = extractTs(student.progress.trials[courseId].claimedAt);
    if (trialTs !== null) return trialTs;
  }
  if (courseId && student.progress?.monthlyPromos?.[courseId]) {
    const monthlyTs = extractTs(student.progress.monthlyPromos[courseId].claimedAt);
    if (monthlyTs !== null) return monthlyTs;
  }

  // فحص تاريخ إنشاء الحساب
  if (typeof student.createdAt === 'number') return student.createdAt;
  if (student.createdAt?.toMillis) return student.createdAt.toMillis();
  if (typeof student.createdAtMs === 'number' && Number.isFinite(student.createdAtMs) && student.createdAtMs > 0) {
    return student.createdAtMs;
  }
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

export function getRequiredWatchPercent(threshold: number = WATCH_THRESHOLD): number {
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold <= 0) {
    return 95;
  }
  return threshold <= 1 ? Math.round(threshold * 100) : Math.round(threshold);
}

/**
 * استخراج نسبة مشاهدة المحاضرة الحالية كعدد صحيح بين 0 و 100
 */
export function getLectureWatchPercent(
  lectureId: string,
  watchProgress: Record<string, any> = {}
): number {
  if (!lectureId || !watchProgress) return 0;
  const p = watchProgress[lectureId];
  if (p === undefined || p === null) return 0;

  if (typeof p === 'number') {
    if (!Number.isFinite(p) || p <= 0) return 0;
    const pct = p > 0 && p < 1 ? p * 100 : p;
    return Math.min(100, Math.max(0, Math.round(pct)));
  }

  if (typeof p === 'object') {
    if (p.completed === true) return 100;
    if (typeof p.coverage === 'number' && Number.isFinite(p.coverage)) {
      return Math.min(100, Math.max(0, Math.round(p.coverage * 100)));
    }
    if (typeof p.progress === 'number' && Number.isFinite(p.progress)) {
      const pct = p.progress > 0 && p.progress < 1 ? p.progress * 100 : p.progress;
      return Math.min(100, Math.max(0, Math.round(pct)));
    }
  }

  return 0;
}

export function formatMissingRequirementText(item: MissingRequirement): string {
  const lecLabel = item.lectureTitle ? ` (${item.lectureTitle})` : '';
  if (item.kind === 'watch') {
    const cur = typeof item.currentPercent === 'number' ? item.currentPercent : 0;
    const req = typeof item.requiredPercent === 'number' ? item.requiredPercent : 95;
    return `مشاهدة فيديو «${item.title}» (مشاهدتك الحالية ${cur}% من ${req}%)`;
  }
  if (item.kind === 'training') {
    return `حل تدريب «${item.title}»${lecLabel}`;
  }
  if (item.kind === 'homework') {
    return `حل واجب «${item.title}»${lecLabel}`;
  }
  if (item.kind === 'lockedTraining') {
    return `إنهاء التدريب المطلوب: «${item.title}»${lecLabel}`;
  }
  return item.title;
}

export function formatMissingRequirementsSummary(items: MissingRequirement[]): string {
  if (!items || items.length === 0) return '';
  if (items.length === 1) {
    return `متبقي: ${formatMissingRequirementText(items[0])}`;
  }
  return `متبقي: ${items.map(formatMissingRequirementText).join(' + ')}`;
}

function deduplicateMissing(items: MissingRequirement[]): MissingRequirement[] {
  const seen = new Set<string>();
  const out: MissingRequirement[] = [];
  for (const item of items) {
    const key = `${item.kind}:${item.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function isLectureBlockedByGrant(lecture: any, grantStatus?: GrantAccessLike): boolean {
  if (!lecture || !grantStatus) return false;
  if (grantStatus.hasAccess === false) return true;
  if (grantStatus.plan === 'trial_lecture' && grantStatus.targetLectureId) {
    return lecture.id !== grantStatus.targetLectureId;
  }
  if (grantStatus.plan === 'monthly' && typeof grantStatus.startLectureOrder === 'number') {
    return Number(lecture.order || 0) < grantStatus.startLectureOrder;
  }
  return false;
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

  const reqPct = getRequiredWatchPercent(threshold);

  if (typeof p === 'number') {
    if (!Number.isFinite(p) || p <= 0) return false;
    // الأرقام >= 1 تُفسَّر كنسبة مئوية (1..100)، بينما الكسور (< 1) تُفسَّر كتغطية (0..0.99)
    return p >= 1 ? p >= reqPct : p >= reqPct / 100;
  }

  if (typeof p === 'object') {
    if (typeof p.completed === 'boolean') return p.completed;
    if (typeof p.coverage === 'number') return p.coverage >= (threshold > 1 ? threshold / 100 : threshold);
    if (typeof p.progress === 'number') {
      if (!Number.isFinite(p.progress) || p.progress <= 0) return false;
      return p.progress >= 1 ? p.progress >= reqPct : p.progress >= reqPct / 100;
    }
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
      detailedMessage: `بيفتح يوم ${formatCairoDateTime(currentLecture.openAt)}`,
      openAt: currentLecture.openAt
    };
  }

  if (typeof currentLecture.closeAt === 'number' && currentLecture.closeAt > 0 && currentLecture.closeAt < serverTime) {
    return {
      locked: true,
      reason: 'closeAt',
      message: 'انتهى الوقت',
      detailedMessage: 'انتهى الوقت',
      closeAt: currentLecture.closeAt
    };
  }

  // المعاينة المجانية تفتح الفيديو للجميع دون اشتراك
  if (isFreePreview(currentLecture)) return { locked: false };

  // المعفيون يتجاوزون قفل التسلسل
  if (isStudentExempt(student, rules, course?.id, isAdminOrOwner)) {
    return { locked: false };
  }

  // المحاضرة الأولى مفتوحة تلقائيًا
  if (lectureIndex === 0) {
    return { locked: false };
  }

  // فحص المحاضرة السابقة N-1 مع حصر كل النواقص بدقة دون تعميم
  const prevLecture = lectures[lectureIndex - 1];
  if (!prevLecture) return { locked: false };

  const missingItems: MissingRequirement[] = [];
  const reqPct = getRequiredWatchPercent(rules?.watchThreshold);
  const prevWatchDone = isLectureWatchCompleted(prevLecture.id, watchProgress, rules.watchThreshold);
  if (!prevWatchDone) {
    missingItems.push({
      kind: 'watch',
      id: prevLecture.id,
      title: prevLecture.title || `المحاضرة ${prevLecture.order || lectureIndex}`,
      lectureId: prevLecture.id,
      lectureTitle: prevLecture.title,
      currentPercent: getLectureWatchPercent(prevLecture.id, watchProgress),
      requiredPercent: reqPct,
    });
  }

  // فحص تسليم تدريبات المحاضرة السابقة
  const prevTrainings = prevLecture.trainings || [];
  for (const tr of prevTrainings) {
    if (tr?.id && !isAssessmentSubmitted(tr.id, examResults)) {
      missingItems.push({
        kind: 'training',
        id: tr.id,
        title: tr.title || 'تدريب المحاضرة السابقة',
        lectureId: prevLecture.id,
        lectureTitle: prevLecture.title,
      });
    }
  }

  // فحص تسليم واجبات المحاضرة السابقة
  const prevHomeworks = prevLecture.homeworks || [];
  for (const hw of prevHomeworks) {
    if (hw?.id && !isAssessmentSubmitted(hw.id, examResults)) {
      missingItems.push({
        kind: 'homework',
        id: hw.id,
        title: hw.title || 'واجب المحاضرة السابقة',
        lectureId: prevLecture.id,
        lectureTitle: prevLecture.title,
      });
    }
  }

  if (missingItems.length > 0) {
    return {
      locked: true,
      reason: 'prerequisite',
      message: 'خلّص المحاضرة اللي قبلها وحل تدريبها',
      detailedMessage: formatMissingRequirementsSummary(missingItems),
      missingItems,
    };
  }

  return { locked: false };
}

/**
 * نسخة تفصيلية من فحص قفل المحاضرة للعرض المباشر في الواجهة:
 * - تعرض النواقص الفعلية الدقيقة من إحصائيات الطالب بدلاً من الرسالة العامة.
 * - لا تحجب أول محاضرة متاحة ضمن منحة التجريبي/الشهري بسبب محاضرة سابقة خارج المنحة.
 */
export function getDetailedLectureLock(
  course: any,
  lectureIndex: number,
  student: any,
  watchProgress: Record<string, any> = {},
  examResults: any[] = [],
  rules: ContentRulesSettings = DEFAULT_CONTENT_RULES,
  serverTime: number = Date.now(),
  isAdminOrOwner: boolean = false,
  grantStatus?: GrantAccessLike
): LockStatus {
  const lectures = course?.content?.lectures || [];
  const currentLecture = lectures[lectureIndex];
  if (!isAdminOrOwner && currentLecture && isLectureBlockedByGrant(currentLecture, grantStatus)) {
    const grantMsg =
      grantStatus?.hasAccess === false
        ? grantStatus.message || 'المحتوى مقفول'
        : grantStatus?.plan === 'trial_lecture'
          ? `متاح لك فقط المحاضرة التجريبية (#${grantStatus.targetLectureOrder || ''})`
          : grantStatus?.plan === 'monthly'
            ? `محاضرة سابقة لبدء اشتراكك الشهري (يبدأ من #${grantStatus.startLectureOrder || ''})`
            : 'المحتوى مقفول';
    return {
      locked: true,
      reason: 'notEnrolled',
      message: grantMsg,
      detailedMessage: grantMsg,
      missingItems: [
        {
          kind: 'grant',
          id: currentLecture.id || 'grant',
          title: grantMsg,
          lectureId: currentLecture.id,
          lectureTitle: currentLecture.title,
        },
      ],
    };
  }

  const base = checkLectureLock(
    course,
    lectureIndex,
    student,
    watchProgress,
    examResults,
    rules,
    serverTime,
    isAdminOrOwner
  );
  if (!base.locked) return base;

  // في التجريبي أو الشهري: لا تطالب الطالب بمحاضرة سابقة ممنوعة أصلاً عن خطته الحالية
  if (base.reason === 'prerequisite' && lectureIndex > 0 && grantStatus) {
    const prevLecture = lectures[lectureIndex - 1];
    if (prevLecture && isLectureBlockedByGrant(prevLecture, grantStatus)) {
      return { locked: false };
    }
  }

  return {
    ...base,
    message: base.detailedMessage || base.message,
  };
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
      detailedMessage: `بيفتح يوم ${formatCairoDateTime(item.openAt)}`,
      openAt: item.openAt
    };
  }

  if (typeof item?.closeAt === 'number' && item.closeAt > 0 && item.closeAt < serverTime) {
    return {
      locked: true,
      reason: 'closeAt',
      message: 'انتهى الوقت',
      detailedMessage: 'انتهى الوقت',
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
    const currentPercent = getLectureWatchPercent(lecture?.id, watchProgress);
    const requiredPercent = getRequiredWatchPercent(rules?.watchThreshold);
    const lecTitle = lecture?.title || 'فيديو المحاضرة';
    return {
      locked: true,
      reason: 'watch',
      message: `شاهد 95% من فيديو المحاضرة أولًا ${label}`,
      detailedMessage: `متبقي: مشاهدة فيديو «${lecTitle}» (مشاهدتك الحالية ${currentPercent}% من ${requiredPercent}%) ${label}`,
      missingItems: [
        {
          kind: 'watch',
          id: lecture?.id || 'lecture',
          title: lecTitle,
          lectureId: lecture?.id,
          lectureTitle: lecture?.title,
          currentPercent,
          requiredPercent,
        },
      ],
    };
  }

  return { locked: false };
}

/**
 * دمج فحص قفل المحاضرة + قفل العنصر الداخلي + قفل lockedUntilTrainingId لإظهار كل سبب حقيقي بدقة
 */
export function getDetailedInLectureItemLock(
  course: any,
  lectureIndex: number,
  lecture: any,
  item: any,
  itemType: 'training' | 'homework' | 'file',
  student: any,
  watchProgress: Record<string, any> = {},
  examResults: any[] = [],
  rules: ContentRulesSettings = DEFAULT_CONTENT_RULES,
  serverTime: number = Date.now(),
  isAdminOrOwner: boolean = false,
  grantStatus?: GrantAccessLike
): LockStatus {
  if (isAdminOrOwner) return { locked: false };

  const openAt = typeof item?.openAt === 'number' ? item.openAt : item?.availableFrom;
  if (typeof openAt === 'number' && openAt > serverTime) {
    const msg = `بيفتح يوم ${formatCairoDateTime(openAt)}`;
    return { locked: true, reason: 'openAt', message: msg, detailedMessage: msg, openAt };
  }

  const closeAt = typeof item?.closeAt === 'number' ? item.closeAt : item?.availableUntil;
  if (typeof closeAt === 'number' && closeAt > 0 && closeAt < serverTime) {
    return { locked: true, reason: 'closeAt', message: 'انتهى الوقت', detailedMessage: 'انتهى الوقت', closeAt };
  }

  const lecLock = getDetailedLectureLock(
    course,
    lectureIndex,
    student,
    watchProgress,
    examResults,
    rules,
    serverTime,
    isAdminOrOwner,
    grantStatus
  );

  if (lecLock.locked && lecLock.reason === 'notEnrolled') {
    return lecLock;
  }

  const itemLock = checkInLectureItemLock(
    lecture,
    item,
    itemType,
    student,
    watchProgress,
    rules,
    course?.id,
    serverTime,
    isAdminOrOwner
  );

  const missing: MissingRequirement[] = [];
  if (lecLock.locked && lecLock.missingItems) {
    missing.push(...lecLock.missingItems);
  }
  if (itemLock.locked && itemLock.missingItems) {
    missing.push(...itemLock.missingItems);
  }

  const lockedUntilTrainingId = item?.lockedUntilTrainingId || item?.raw?.lockedUntilTrainingId;
  if (typeof lockedUntilTrainingId === 'string' && lockedUntilTrainingId && !isAssessmentSubmitted(lockedUntilTrainingId, examResults)) {
    const allTrainings = (course?.content?.lectures || []).flatMap((l: any) =>
      (l.trainings || []).map((t: any) => ({ ...t, _lecTitle: l.title, _lecId: l.id }))
    );
    const reqTr = allTrainings.find((t: any) => t.id === lockedUntilTrainingId);
    missing.push({
      kind: 'lockedTraining',
      id: lockedUntilTrainingId,
      title: reqTr?.title || 'التدريب المطلوب',
      lectureId: reqTr?._lecId,
      lectureTitle: reqTr?._lecTitle,
    });
  }

  const uniqueMissing = deduplicateMissing(missing);
  if (uniqueMissing.length > 0) {
    const summary = formatMissingRequirementsSummary(uniqueMissing);
    return {
      locked: true,
      reason: uniqueMissing.every((m) => m.kind === 'watch') ? 'watch' : 'prerequisite',
      message: summary,
      detailedMessage: summary,
      missingItems: uniqueMissing,
    };
  }

  if (lecLock.locked) return lecLock;
  if (itemLock.locked) {
    return { ...itemLock, message: itemLock.detailedMessage || itemLock.message };
  }

  return { locked: false };
}

/**
 * تشخيص دقيق ومفصل لأي امتحان أو واجب أو تدريب مرتبط بمحاضرة أو مستقل:
 * يحدد بالضبط ما ينقص الطالب (نسبة المشاهدة الفعلية / التدريبات / الواجبات) دون أي رسائل عامة.
 */
export function getAssessmentPrerequisiteDiagnostics(
  input: AssessmentDiagnosticsInput
): AssessmentPrerequisiteDiagnostics {
  const {
    course,
    assessment,
    student,
    watchProgress = {},
    examResults = [],
    rules = DEFAULT_CONTENT_RULES,
    serverTime = Date.now(),
    isAdminOrOwner = false,
    grantStatus,
  } = input;

  if (isAdminOrOwner || !course || !assessment) {
    return { locked: false, message: '', missingItems: [] };
  }

  const raw = assessment.raw || {};
  const openAt =
    typeof assessment.openAt === 'number'
      ? assessment.openAt
      : typeof assessment.availableFrom === 'number'
        ? assessment.availableFrom
        : typeof raw.openAt === 'number'
          ? raw.openAt
          : null;
  if (typeof openAt === 'number' && openAt > serverTime) {
    const msg = `بيفتح يوم ${formatCairoDateTime(openAt)}`;
    return {
      locked: true,
      reason: 'openAt',
      message: msg,
      missingItems: [{ kind: 'openAt', id: assessment.id, title: msg }],
    };
  }

  const closeAt =
    typeof assessment.closeAt === 'number'
      ? assessment.closeAt
      : typeof assessment.availableUntil === 'number'
        ? assessment.availableUntil
        : typeof raw.closeAt === 'number'
          ? raw.closeAt
          : null;
  if (typeof closeAt === 'number' && closeAt > 0 && closeAt < serverTime) {
    return {
      locked: true,
      reason: 'closeAt',
      message: 'انتهى الوقت',
      missingItems: [{ kind: 'closeAt', id: assessment.id, title: 'انتهى الوقت' }],
    };
  }

  if (grantStatus && grantStatus.hasAccess === false) {
    const grantMsg = grantStatus.message || 'المحتوى مقفول';
    return {
      locked: true,
      reason: 'grant',
      message: grantMsg,
      missingItems: [{ kind: 'grant', id: assessment.id, title: grantMsg }],
    };
  }

  const lectures: any[] = course.content?.lectures || [];
  let linkedIdx = -1;

  // 1) البحث المباشر داخل تدريبات وواجبات المحاضرات
  for (let i = 0; i < lectures.length; i += 1) {
    const lec = lectures[i];
    if (
      lec.trainings?.some((t: any) => t?.id === assessment.id) ||
      lec.homeworks?.some((h: any) => h?.id === assessment.id)
    ) {
      linkedIdx = i;
      break;
    }
  }

  // 2) البحث عبر حقل الربط lectureId / attachedToLectureId / _parentLecId
  if (linkedIdx === -1) {
    const explicitLecId =
      (typeof (assessment as any).lectureId === 'string' && (assessment as any).lectureId) ||
      (typeof raw.lectureId === 'string' && raw.lectureId) ||
      (typeof raw.attachedToLectureId === 'string' && raw.attachedToLectureId) ||
      (typeof raw._parentLecId === 'string' && raw._parentLecId) ||
      '';
    if (explicitLecId) {
      linkedIdx = lectures.findIndex((l) => l.id === explicitLecId);
    }
  }

  // 3) البحث عبر lockedUntilTrainingId لتحديد التدريب المطلوب والمحاضرة الحاضنة له
  const lockedTrainingId =
    (typeof assessment.lockedUntilTrainingId === 'string' && assessment.lockedUntilTrainingId) ||
    (typeof raw.lockedUntilTrainingId === 'string' && raw.lockedUntilTrainingId) ||
    '';

  let lockedTrainingObj: { id: string; title: string; lecture?: any; lectureIdx?: number } | null = null;
  if (lockedTrainingId) {
    for (let i = 0; i < lectures.length; i += 1) {
      const tr = lectures[i].trainings?.find((t: any) => t?.id === lockedTrainingId);
      if (tr) {
        lockedTrainingObj = { id: tr.id, title: tr.title || 'التدريب المطلوب', lecture: lectures[i], lectureIdx: i };
        if (linkedIdx === -1) linkedIdx = i;
        break;
      }
    }
    if (!lockedTrainingObj && Array.isArray(course.sections)) {
      for (const sec of course.sections) {
        for (const it of sec.items || []) {
          if (it.id === lockedTrainingId) {
            lockedTrainingObj = { id: it.id, title: it.title || 'التدريب المطلوب' };
            break;
          }
          const child = it.children?.find((c: any) => c.id === lockedTrainingId);
          if (child) {
            lockedTrainingObj = { id: child.id, title: child.title || 'التدريب المطلوب' };
            break;
          }
        }
        if (lockedTrainingObj) break;
      }
    }
  }

  const linkedLecture = linkedIdx >= 0 ? lectures[linkedIdx] : undefined;

  if (linkedLecture && isLectureBlockedByGrant(linkedLecture, grantStatus)) {
    const grantMsg =
      grantStatus?.plan === 'trial_lecture'
        ? `متاح لك فقط المحاضرة التجريبية (#${grantStatus.targetLectureOrder || ''})`
        : grantStatus?.plan === 'monthly'
          ? `محاضرة سابقة لبدء اشتراكك الشهري (يبدأ من #${grantStatus.startLectureOrder || ''})`
          : 'المحتوى مقفول';
    return {
      locked: true,
      reason: 'grant',
      message: grantMsg,
      missingItems: [{ kind: 'grant', id: linkedLecture.id, title: grantMsg, lectureId: linkedLecture.id, lectureTitle: linkedLecture.title }],
      linkedLecture: { id: linkedLecture.id, title: linkedLecture.title || '', order: linkedLecture.order },
    };
  }

  const missingItems: MissingRequirement[] = [];

  if (lockedTrainingId && !isAssessmentSubmitted(lockedTrainingId, examResults)) {
    missingItems.push({
      kind: 'lockedTraining',
      id: lockedTrainingId,
      title: lockedTrainingObj?.title || 'التدريب المطلوب',
      lectureId: lockedTrainingObj?.lecture?.id,
      lectureTitle: lockedTrainingObj?.lecture?.title,
    });
  }

  const exempt = isStudentExempt(student, rules, course.id, isAdminOrOwner);
  if (!exempt && linkedLecture) {
    // نواقص المحاضرة السابقة (إن لم تكن خارج منحة التجريبي/الشهري)
    const prevLock = getDetailedLectureLock(
      course,
      linkedIdx,
      student,
      watchProgress,
      examResults,
      rules,
      serverTime,
      isAdminOrOwner,
      grantStatus
    );
    if (prevLock.locked && prevLock.missingItems) {
      missingItems.push(...prevLock.missingItems);
    }

    // شرط مشاهدة فيديو المحاضرة المرتبطة بنسبة >= 95%
    const watchDone = isLectureWatchCompleted(linkedLecture.id, watchProgress, rules.watchThreshold);
    if (!watchDone) {
      missingItems.push({
        kind: 'watch',
        id: linkedLecture.id,
        title: linkedLecture.title || 'فيديو المحاضرة',
        lectureId: linkedLecture.id,
        lectureTitle: linkedLecture.title,
        currentPercent: getLectureWatchPercent(linkedLecture.id, watchProgress),
        requiredPercent: getRequiredWatchPercent(rules.watchThreshold),
      });
    }

    // للامتحان المرتبط بمحاضرة: تأكد من حل تدريبات وواجبات هذه المحاضرة أيضاً إن لم تُحل بعد
    if (assessment.kind === 'exam') {
      for (const tr of linkedLecture.trainings || []) {
        if (tr?.id && tr.id !== lockedTrainingId && !isAssessmentSubmitted(tr.id, examResults)) {
          missingItems.push({
            kind: 'training',
            id: tr.id,
            title: tr.title || 'تدريب المحاضرة',
            lectureId: linkedLecture.id,
            lectureTitle: linkedLecture.title,
          });
        }
      }
      for (const hw of linkedLecture.homeworks || []) {
        if (hw?.id && !isAssessmentSubmitted(hw.id, examResults)) {
          missingItems.push({
            kind: 'homework',
            id: hw.id,
            title: hw.title || 'واجب المحاضرة',
            lectureId: linkedLecture.id,
            lectureTitle: linkedLecture.title,
          });
        }
      }
    }
  }

  const uniqueMissing = deduplicateMissing(missingItems);
  const lecMeta = linkedLecture
    ? { id: linkedLecture.id, title: linkedLecture.title || '', order: linkedLecture.order }
    : undefined;

  if (uniqueMissing.length === 0) {
    return { locked: false, message: '', missingItems: [], linkedLecture: lecMeta };
  }

  const reason: AssessmentPrerequisiteDiagnostics['reason'] = uniqueMissing.every((m) => m.kind === 'watch')
    ? 'watch'
    : uniqueMissing.every((m) => m.kind === 'lockedTraining')
      ? 'lockedTraining'
      : 'prerequisite';

  return {
    locked: true,
    reason,
    message: formatMissingRequirementsSummary(uniqueMissing),
    missingItems: uniqueMissing,
    linkedLecture: lecMeta,
  };
}

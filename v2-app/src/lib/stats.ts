import type { AttemptSummary } from '../services/assessments';
import type { Course, CourseItem, CourseSection } from '../services/courses';
import { getPriceInfo, getVisibleSections } from '../services/courses';
import type { PaymentRequest } from '../services/payments';

// ---------- المعادلات الرسمية من وثيقة التشريح (القسم 5) ----------

export type AssessmentGroup = 'exam' | 'homework' | 'training';

export const GROUP_LABELS: Record<AssessmentGroup, string> = {
  exam: 'الامتحانات',
  homework: 'الواجبات',
  training: 'التدريبات',
};

// أوزان المستوى العام: امتحانات 40% وواجبات 30% وتدريبات 20% ومشاهدة 10%.
const WEIGHTS = { exam: 0.4, homework: 0.3, training: 0.2, watch: 0.1 } as const;

export function groupOf(attempt: AttemptSummary): AssessmentGroup {
  if (attempt.isHomework) return 'homework';
  if (attempt.isTraining) return 'training';
  return 'exam';
}

export interface OfficialScore {
  key: string;
  courseId: string;
  title: string;
  group: AssessmentGroup;
  score: number;
  ts: number | null;
}

function attemptKey(attempt: AttemptSummary): string {
  const id = attempt.examId || attempt.examTitle;
  return `${attempt.courseId}|${id}`;
}

// الدرجة الرسمية لكل امتحان فريد = المحاولة الأولى فقط (الدرجة المعتمدة بعد أي غرامة).
export function getOfficialScores(attempts: AttemptSummary[]): OfficialScore[] {
  const best = new Map<string, AttemptSummary>();

  attempts.forEach((attempt) => {
    if (!attempt.examId && !attempt.examTitle) return;

    const key = attemptKey(attempt);
    const current = best.get(key);
    const isBetterOfficial =
      !current ||
      (attempt.isOfficial && !current.isOfficial) ||
      (attempt.isOfficial === current.isOfficial && attempt.attemptNumber < current.attemptNumber);

    if (isBetterOfficial) best.set(key, attempt);
  });

  return Array.from(best.entries()).map(([key, attempt]) => ({
    key,
    courseId: attempt.courseId,
    title: attempt.examTitle,
    group: groupOf(attempt),
    score: clampPercent(attempt.effectivePercent),
    ts: attempt.ts,
  }));
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// معدل الالتزام = round(مجموع الدرجات الرسمية ÷ عدد الامتحانات الفريدة).
export function calcCommitment(scores: OfficialScore[]): number | null {
  const mean = average(scores.map((item) => item.score));
  return mean === null ? null : Math.round(mean);
}

export function averageOf(scores: OfficialScore[], group: AssessmentGroup): number | null {
  const mean = average(scores.filter((item) => item.group === group).map((item) => item.score));
  return mean === null ? null : Math.round(mean);
}

export type LevelKey = 'top' | 'mid' | 'low';

export const LEVEL_LABELS: Record<LevelKey, string> = {
  top: 'متفوق',
  mid: 'متوسط',
  low: 'ضعيف',
};

export interface OverallLevel {
  exam: number | null;
  homework: number | null;
  training: number | null;
  watch: number | null;
  overall: number | null;
  level: LevelKey | null;
}

export function levelOf(overall: number): LevelKey {
  if (overall >= 80) return 'top';
  if (overall >= 50) return 'mid';
  return 'low';
}

// calcOverallLevel: 0.40 امتحانات + 0.30 واجبات + 0.20 تدريبات + 0.10 نسبة المشاهدة.
// لو لا توجد بيانات لأحد المكونات (مثلًا لم يسلّم الطالب أي تدريب) يُستبعد ويُعاد توزيع الأوزان،
// حتى لا يُظلم الطالب بصفر لشيء لم يُطلب منه بعد.
export function calcOverallLevel(scores: OfficialScore[], watchPercentValue: number | null): OverallLevel {
  const exam = averageOf(scores, 'exam');
  const homework = averageOf(scores, 'homework');
  const training = averageOf(scores, 'training');
  const watch = watchPercentValue === null ? null : Math.round(watchPercentValue);

  const parts: Array<{ value: number | null; weight: number }> = [
    { value: exam, weight: WEIGHTS.exam },
    { value: homework, weight: WEIGHTS.homework },
    { value: training, weight: WEIGHTS.training },
    { value: watch, weight: WEIGHTS.watch },
  ];

  const present = parts.filter((part): part is { value: number; weight: number } => part.value !== null);
  const totalWeight = present.reduce((sum, part) => sum + part.weight, 0);

  if (totalWeight === 0) {
    return { exam, homework, training, watch, overall: null, level: null };
  }

  const overall = Math.round(
    present.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight,
  );

  return { exam, homework, training, watch, overall, level: levelOf(overall) };
}

// ---------- نسبة المشاهدة ----------

function flattenItems(items: CourseItem[]): CourseItem[] {
  const result: CourseItem[] = [];
  items.forEach((item) => {
    result.push(item);
    if (item.children.length > 0) result.push(...flattenItems(item.children));
  });
  return result;
}

export function videoIdsOf(sections: CourseSection[]): string[] {
  const ids: string[] = [];
  getVisibleSections(sections).forEach((section) => {
    flattenItems(section.items).forEach((item) => {
      if (item.type === 'video' && !item.archived) ids.push(item.id);
    });
  });
  return ids;
}

export function videoIdsForStudent(courses: Course[], studentCourseIds: string[]): string[] {
  const ids: string[] = [];
  courses
    .filter((course) => studentCourseIds.includes(course.id))
    .forEach((course) => ids.push(...videoIdsOf(course.sections)));
  return ids;
}

// متوسط نسبة مشاهدة كل محاضرات كورسات الطالب (غير المشاهَد = 0). null لو لا توجد محاضرات.
export function calcWatchPercent(
  watchProgress: Record<string, number>,
  videoIds: string[],
): number | null {
  if (videoIds.length === 0) return null;
  const total = videoIds.reduce((sum, id) => sum + clampPercent(watchProgress[id] ?? 0), 0);
  return total / videoIds.length;
}

// ---------- الإيرادات ----------

// إيراد الطلب: المبلغ المسجل في الطلب (الطلبات الجديدة)، وإلا سعر الكورس وقت الطلب مع فحص الخصم.
export function revenueOf(request: PaymentRequest, course: Course | undefined): number {
  if (request.amount !== null) return request.amount;
  if (!course) return 0;
  return getPriceInfo(course, request.createdAtMs ?? Date.now()).price;
}

export function isCountedRevenue(request: PaymentRequest): boolean {
  return request.status === 'approved' && !request.archivedRevenue;
}

export function totalRevenue(requests: PaymentRequest[], courses: Course[]): number {
  const byId = new Map<string, Course>(courses.map((course): [string, Course] => [course.id, course]));
  return requests
    .filter(isCountedRevenue)
    .reduce((sum, request) => sum + revenueOf(request, byId.get(request.courseId)), 0);
}

export function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} ج.م`;
}

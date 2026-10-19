import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  MAX_ATTEMPTS,
  buildAttemptResult,
  hasAnswerKeys,
  parseAttemptResult,
  parseQuestions,
  sanitizeAttemptForStorage,
} from '../lib/grading';
import type { AssessmentKind, AttemptResult, Question } from '../lib/grading';
import type { CourseItem, CourseSection } from './courses';
import type { Student } from './students';

// خطة Spark المجانية: لا Cloud Functions. التصحيح يتم على جهاز الطالب بهذه الدورة:
// 1) الطالب ينشئ تسليمه examSubmissions/{uid}_{examId}_{n} (لا يتغير بعد إنشائه).
// 2) بعد وجود التسليم تسمح القواعد له بقراءة examKeys/{examId}.
// 3) يحسب النتيجة بنفس منطق grading.ts ويكتبها مرة واحدة في نفس مستند التسليم،
//    ويضيف نسخة في examResults عنده، كلاهما في معاملة (transaction) واحدة.
// الامتحانات القديمة (إجاباتها داخل مستند الكورس) تبقى تُصحَّح في المتصفح كما كانت.

// ---------- الأنواع ----------

export interface Assessment {
  id: string;
  courseId: string;
  title: string;
  kind: AssessmentKind;
  duration: number; // بالدقائق، 0 = مفتوح
  strictMode: boolean;
  availableFrom: number | null;
  availableUntil: number | null;
  lockedUntilTrainingId: string;
  // الأسئلة داخل العنصر نفسه (الامتحانات القديمة، ومعها الإجابات).
  inlineQuestions: Question[];
}

export interface AttemptSummary {
  courseId: string;
  examId: string;
  examTitle: string;
  percent: number;
  effectivePercent: number;
  penalized: boolean;
  attemptNumber: number;
  isOfficial: boolean;
  ts: number | null;
  needsReview: boolean;
  isTraining: boolean;
  isHomework: boolean;
}

export type AccessState = 'open' | 'not-yet' | 'locked-training' | 'attempts-exhausted';

export interface AssessmentAccess {
  state: AccessState;
  message: string;
  late: boolean;
  attemptsUsed: number;
}

export interface LoadedQuestions {
  questions: Question[];
  hasKeys: boolean;
}

export interface AssessmentListEntry {
  assessment: Assessment;
  sectionTitle: string;
}

// تسليم مخزن للامتحانات الجديدة.
export interface SubmissionRecord {
  attempt: number;
  submittedAtMs: number | null;
  answers: Record<string, string>;
  autoSubmit: boolean;
  result: AttemptResult | null;
}

// يُرمى لو أُنشئ التسليم لكن تعذر إكمال التصحيح (مثلًا انقطع الإنترنت)، ويمكن إكماله لاحقًا.
export class GradingPendingError extends Error {
  constructor() {
    super('grading-pending');
    this.name = 'GradingPendingError';
  }
}

// ---------- أدوات صغيرة ----------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function timestampToMillis(value: unknown): number | null {
  if (isRecord(value) && typeof value.toMillis === 'function') {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return null;
    }
  }
  return null;
}

// تاريخ ووقت بأرقام إنجليزية: YYYY-MM-DD HH:MM
export function formatDateTime(milliseconds: number): string {
  const date = new Date(milliseconds);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getAssessmentPath(courseId: string, itemId: string): string {
  return `/student/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(itemId)}`;
}

// ---------- تحويل عنصر الكورس إلى امتحان/تدريب/واجب ----------

export function toAssessment(courseId: string, item: CourseItem): Assessment | null {
  if (item.assessmentKind === null) return null;

  const raw = item.raw;

  return {
    id: item.id,
    courseId,
    title: item.title || 'بدون عنوان',
    kind: item.assessmentKind,
    duration: Math.max(0, asNumber(raw.duration)),
    strictMode: raw.strictMode === true,
    availableFrom: item.availableFrom,
    availableUntil: item.availableUntil,
    lockedUntilTrainingId: asString(raw.lockedUntilTrainingId),
    inlineQuestions: parseQuestions(raw.questions),
  };
}

// الامتحان الجديد: أسئلته في examContent وإجاباته في examKeys (وليس داخل مستند الكورس).
export function isNewStyleAssessment(assessment: Assessment): boolean {
  return assessment.inlineQuestions.length === 0;
}

export function findItem(sections: CourseSection[], itemId: string): CourseItem | null {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.id === itemId) return item;
      const child = item.children.find((candidate) => candidate.id === itemId);
      if (child) return child;
    }
  }
  return null;
}

// كل الامتحانات والتدريبات والواجبات في أقسام الكورس.
export function collectAssessments(courseId: string, sections: CourseSection[]): AssessmentListEntry[] {
  const entries: AssessmentListEntry[] = [];

  sections.forEach((section) => {
    section.items.forEach((item) => {
      [item, ...item.children].forEach((candidate) => {
        const assessment = toAssessment(courseId, candidate);
        if (assessment) entries.push({ assessment, sectionTitle: section.title });
      });
    });
  });

  return entries;
}

// ---------- محاولات الطالب (examResults) ----------

export function parseExamResults(value: unknown): AttemptSummary[] {
  if (!Array.isArray(value)) return [];

  const summaries: AttemptSummary[] = [];

  value.forEach((entry) => {
    if (!isRecord(entry)) return;

    const ts = typeof entry.ts === 'number' && Number.isFinite(entry.ts) ? entry.ts : null;
    const percent = asNumber(entry.percent);

    summaries.push({
      courseId: asString(entry.courseId),
      examId: asString(entry.examId),
      examTitle: asString(entry.examTitle),
      percent,
      effectivePercent:
        typeof entry.effectivePercent === 'number' ? entry.effectivePercent : percent,
      penalized: entry.penalized === true,
      attemptNumber: asNumber(entry.attemptNumber) || 1,
      isOfficial: entry.isOfficial === true || asNumber(entry.attemptNumber) === 1,
      ts,
      needsReview: entry.needsReview === true,
      isTraining: entry.isTraining === true,
      isHomework: entry.isHomework === true,
    });
  });

  return summaries;
}

// الربط بالامتحان يتم بـ examId، ولو غير موجود فبعنوان الامتحان.
export function getAttemptsFor(results: AttemptSummary[], assessment: Assessment): AttemptSummary[] {
  return results
    .filter((result) => {
      if (result.courseId && result.courseId !== assessment.courseId) return false;
      if (result.examId) return result.examId === assessment.id;
      return result.examTitle !== '' && result.examTitle === assessment.title;
    })
    .sort((a, b) => a.attemptNumber - b.attemptNumber);
}

export interface AssessmentStatus {
  label: string;
  variant: 'neutral' | 'gold' | 'success';
  official: AttemptSummary | null;
}

// الحالة للطالب: لم يُحل/لم يُسلَّم، سُلِّم (قيد التصحيح)، مُصحَّح/تم الحل.
export function getAssessmentStatus(
  assessment: Assessment,
  attempts: AttemptSummary[],
): AssessmentStatus {
  const isHomework = assessment.kind === 'homework';

  if (attempts.length === 0) {
    return { label: isHomework ? 'لم يُسلَّم' : 'لم يُحل', variant: 'neutral', official: null };
  }

  const official = attempts.find((attempt) => attempt.isOfficial) ?? attempts[0];

  if (official.needsReview) {
    return {
      label: isHomework ? 'سُلِّم (قيد التصحيح)' : 'تم الحل (قيد التصحيح)',
      variant: 'gold',
      official,
    };
  }

  return { label: isHomework ? 'مُصحَّح' : 'تم الحل', variant: 'success', official };
}

// ---------- الإتاحة والأقفال والمحاولات ----------

// attemptsOverride: عدد المحاولات المستخدمة للامتحانات الجديدة (من مستندات التسليم).
export function getAssessmentAccess(
  assessment: Assessment,
  sections: CourseSection[],
  results: AttemptSummary[],
  isAdmin: boolean,
  now: number = Date.now(),
  attemptsOverride?: number,
): AssessmentAccess {
  const attemptsUsed = attemptsOverride ?? getAttemptsFor(results, assessment).length;
  const late = assessment.availableUntil !== null && now > assessment.availableUntil;

  // معاينة الأدمن: بدون أي حد.
  if (isAdmin) {
    return { state: 'open', message: '', late: false, attemptsUsed: 0 };
  }

  if (assessment.availableFrom !== null && now < assessment.availableFrom) {
    return {
      state: 'not-yet',
      message: `يتاح في ${formatDateTime(assessment.availableFrom)}`,
      late,
      attemptsUsed,
    };
  }

  if (assessment.lockedUntilTrainingId) {
    const lockedId = assessment.lockedUntilTrainingId;
    const done = results.some((result) => result.examId === lockedId);

    if (!done) {
      const training = findItem(sections, lockedId);
      return {
        state: 'locked-training',
        message: `يُفتح بعد إنهاء التدريب: ${training?.title || 'التدريب المطلوب'}`,
        late,
        attemptsUsed,
      };
    }
  }

  if (attemptsUsed >= MAX_ATTEMPTS) {
    return {
      state: 'attempts-exhausted',
      message: `استنفدت المحاولات المسموحة (${MAX_ATTEMPTS})`,
      late,
      attemptsUsed,
    };
  }

  return { state: 'open', message: '', late, attemptsUsed };
}

// ---------- تحميل الأسئلة ----------

// يدمج الإجابات الصحيحة (من examKeys) مع الأسئلة العامة (من examContent).
function mergeAnswerKeys(questions: Question[], answersList: unknown[]): Question[] {
  const byId = new Map<string, { answer: string | null; altAnswers: string[] }>();

  answersList.forEach((entry) => {
    if (!isRecord(entry)) return;
    byId.set(asString(entry.id), {
      answer: entry.answer === undefined || entry.answer === null ? null : asString(entry.answer),
      altAnswers: Array.isArray(entry.altAnswers)
        ? entry.altAnswers.map(asString).filter((item) => item !== '')
        : [],
    });
  });

  return questions.map((question) => {
    const key = byId.get(question.id);
    return key ? { ...question, answer: key.answer, altAnswers: key.altAnswers } : question;
  });
}

// الأسئلة الجديدة (بدون إجابات) في examContent/{id}، وإجاباتها في examKeys/{id}.
// الأدمن يقرأ المفاتيح دائمًا. الطالب لا يقرؤها إلا بعد أن يسلّم (تفرضه القواعد).
export async function loadQuestions(
  assessment: Assessment,
  isAdmin: boolean,
): Promise<LoadedQuestions> {
  if (assessment.inlineQuestions.length > 0) {
    return {
      questions: assessment.inlineQuestions,
      hasKeys: hasAnswerKeys(assessment.inlineQuestions),
    };
  }

  const contentSnapshot = await getDoc(doc(db, 'examContent', assessment.id));
  let questions = contentSnapshot.exists() ? parseQuestions(contentSnapshot.data().questions) : [];

  if (isAdmin && questions.length > 0) {
    try {
      const keysSnapshot = await getDoc(doc(db, 'examKeys', assessment.id));
      const answersList: unknown[] =
        keysSnapshot.exists() && Array.isArray(keysSnapshot.data().answers)
          ? keysSnapshot.data().answers
          : [];
      questions = mergeAnswerKeys(questions, answersList);
    } catch {
      // لا مفاتيح: يبقى التصحيح الموضوعي غير متاح في المعاينة.
    }
  }

  return { questions, hasKeys: hasAnswerKeys(questions) };
}

// أسئلة الامتحان مع إجاباتها بعد التسليم (للتصحيح على جهاز الطالب).
async function loadQuestionsForGrading(assessment: Assessment): Promise<Question[]> {
  if (assessment.inlineQuestions.length > 0) return assessment.inlineQuestions;

  const [contentSnapshot, keysSnapshot] = await Promise.all([
    getDoc(doc(db, 'examContent', assessment.id)),
    getDoc(doc(db, 'examKeys', assessment.id)),
  ]);

  if (!contentSnapshot.exists() || !keysSnapshot.exists()) {
    throw new Error('keys-unavailable');
  }

  const answersList: unknown[] = Array.isArray(keysSnapshot.data().answers)
    ? keysSnapshot.data().answers
    : [];

  return mergeAnswerKeys(parseQuestions(contentSnapshot.data().questions), answersList);
}

// ---------- معاينة الأدمن ----------

// معاينة الأدمن: تصحيح محلي بدون حفظ (وبدون خصم تأخير).
export function gradeForPreview(
  assessment: Assessment,
  questions: Question[],
  answers: Record<string, string>,
  autoSubmit: boolean,
): AttemptResult {
  return buildAttemptResult({
    courseId: assessment.courseId,
    examId: assessment.id,
    examTitle: assessment.title,
    kind: assessment.kind,
    questions,
    answers,
    attemptNumber: 1,
    autoSubmit,
    submittedAt: Date.now(),
    availableUntil: null,
  });
}

// ---------- الامتحانات القديمة: التصحيح في المتصفح كما كان ----------

export interface LegacySubmitParams {
  student: Student;
  assessment: Assessment;
  questions: Question[];
  answers: Record<string, string>;
  autoSubmit: boolean;
}

// يصحح في المتصفح ويضيف المحاولة لمصفوفة examResults داخل معاملة (transaction)،
// فلا تُمسح أي محاولة سابقة ولا تُتجاوز المحاولات الثلاث.
export async function submitWithClientGrading(params: LegacySubmitParams): Promise<AttemptResult> {
  const { student, assessment, questions, answers, autoSubmit } = params;
  const studentRef = doc(db, 'students', student.id);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(studentRef);
    if (!snapshot.exists()) {
      throw new Error('student-not-found');
    }

    const existing = snapshot.data().examResults;
    const list: unknown[] = Array.isArray(existing) ? existing : [];

    const attempts = getAttemptsFor(parseExamResults(list), assessment);
    if (attempts.length >= MAX_ATTEMPTS) {
      throw new Error('attempts-exhausted');
    }

    const result = buildAttemptResult({
      courseId: assessment.courseId,
      examId: assessment.id,
      examTitle: assessment.title,
      kind: assessment.kind,
      questions,
      answers,
      attemptNumber: attempts.length + 1,
      autoSubmit,
      submittedAt: Date.now(),
      availableUntil: assessment.availableUntil,
    });

    const sanitized = sanitizeAttemptForStorage(result);
    transaction.update(studentRef, { examResults: [...list, sanitized] });
    return result;
  });
}

// ---------- الامتحانات الجديدة: تسليم ثم تصحيح على جهاز الطالب ----------

export function getSubmissionId(uid: string, examId: string, attempt: number): string {
  return `${uid}_${examId}_${attempt}`;
}

function parseSubmission(attempt: number, data: Record<string, unknown>): SubmissionRecord {
  const answers: Record<string, string> = {};
  if (isRecord(data.answers)) {
    Object.keys(data.answers).forEach((key) => {
      answers[key] = asString(data.answers && (data.answers as Record<string, unknown>)[key]);
    });
  }

  return {
    attempt,
    submittedAtMs: timestampToMillis(data.submittedAt),
    answers,
    autoSubmit: data.autoSubmit === true,
    result: parseAttemptResult(data.result),
  };
}

// تسليمات الطالب لهذا الامتحان (حتى 3 قراءات كحد أقصى، لأن المحاولة n لا تُنشأ بدون n-1).
export async function loadSubmissions(uid: string, examId: string): Promise<SubmissionRecord[]> {
  const records: SubmissionRecord[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const snapshot = await getDoc(doc(db, 'examSubmissions', getSubmissionId(uid, examId, attempt)));
    if (!snapshot.exists()) break;
    records.push(parseSubmission(attempt, snapshot.data()));
  }

  return records;
}

export interface GradeParams {
  student: Student;
  uid: string;
  assessment: Assessment;
  attempt: number;
}

// يقرأ المفاتيح (مسموح بعد وجود التسليم)، ويحسب النتيجة، ويكتبها مرة واحدة في مستند التسليم
// ويضيف نسخة في examResults عند الطالب. كل ذلك في معاملة واحدة.
export async function gradeSubmittedAttempt(params: GradeParams): Promise<AttemptResult> {
  const { student, uid, assessment, attempt } = params;

  const submissionRef = doc(db, 'examSubmissions', getSubmissionId(uid, assessment.id, attempt));
  const studentRef = doc(db, 'students', student.id);
  const questions = await loadQuestionsForGrading(assessment);

  return runTransaction(db, async (transaction) => {
    const submissionSnapshot = await transaction.get(submissionRef);
    if (!submissionSnapshot.exists()) {
      throw new Error('submission-not-found');
    }

    const data = submissionSnapshot.data();

    // سبق تصحيح هذه المحاولة: نرجع نتيجتها المخزنة ولا نكتب شيئًا.
    const existingResult = parseAttemptResult(data.result);
    if (existingResult) return existingResult;

    const studentSnapshot = await transaction.get(studentRef);
    if (!studentSnapshot.exists()) {
      throw new Error('student-not-found');
    }

    const answers: Record<string, string> = {};
    if (isRecord(data.answers)) {
      Object.keys(data.answers).forEach((key) => {
        answers[key] = asString((data.answers as Record<string, unknown>)[key]);
      });
    }

    // وقت التسليم الحقيقي من السيرفر (submittedAt = request.time)، لا من الساعة المحلية.
    const submittedAt = timestampToMillis(data.submittedAt) ?? Date.now();

    const result = buildAttemptResult({
      courseId: assessment.courseId,
      examId: assessment.id,
      examTitle: assessment.title,
      kind: assessment.kind,
      questions,
      answers,
      attemptNumber: attempt,
      autoSubmit: data.autoSubmit === true,
      submittedAt,
      availableUntil: assessment.availableUntil,
    });

    const existing = studentSnapshot.data().examResults;
    const list: unknown[] = Array.isArray(existing) ? existing : [];

    const sanitized = sanitizeAttemptForStorage(result);
    transaction.update(submissionRef, { result: sanitized, gradedAt: new Date().toISOString() });
    transaction.update(studentRef, { examResults: [...list, sanitized] });

    return result;
  });
}

export interface NewStyleSubmitParams extends GradeParams {
  answers: Record<string, string>;
  autoSubmit: boolean;
}

// ينشئ التسليم (لا يتغير بعد ذلك) ثم يصححه. لو فشل التصحيح يبقى التسليم محفوظًا ويمكن إكماله.
export async function submitNewStyleAttempt(params: NewStyleSubmitParams): Promise<AttemptResult> {
  const { student, uid, assessment, attempt, answers, autoSubmit } = params;

  if (attempt < 1 || attempt > MAX_ATTEMPTS) {
    throw new Error('attempts-exhausted');
  }

  const cleanAnswers: Record<string, string> = {};
  Object.keys(answers).forEach((key) => {
    cleanAnswers[key] = String(answers[key] ?? '').slice(0, 5000);
  });

  await setDoc(doc(db, 'examSubmissions', getSubmissionId(uid, assessment.id, attempt)), {
    courseId: assessment.courseId,
    examId: assessment.id,
    examTitle: assessment.title,
    kind: assessment.kind,
    userId: uid,
    userName: student.name.slice(0, 100),
    attempt,
    answers: cleanAnswers,
    autoSubmit,
    submittedAt: serverTimestamp(),
  });

  try {
    return await gradeSubmittedAttempt({ student, uid, assessment, attempt });
  } catch {
    throw new GradingPendingError();
  }
}

// ---------- رسائل الأخطاء ----------

export function getAssessmentErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';

  switch (message) {
    case 'attempts-exhausted':
      return `استنفدت المحاولات المسموحة (${MAX_ATTEMPTS}).`;
    case 'student-not-found':
      return 'لم نجد بيانات حسابك. أعد تسجيل الدخول.';
    case 'keys-unavailable':
      return 'تعذر تحميل مفاتيح التصحيح. حاول مرة أخرى بعد قليل.';
    default:
      return 'تعذر إرسال إجاباتك. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.';
  }
}

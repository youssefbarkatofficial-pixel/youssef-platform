// منطق تصحيح الامتحانات والتدريبات والواجبات.
// نفس القواعد مكتوبة في functions/grading.js (السيرفر)، فأي تعديل هنا يُعدَّل هناك أيضًا.

export const MAX_ATTEMPTS = 3; // المحاولة الأولى فقط هي الرسمية
export const LATE_PENALTY_PERCENT = 20; // خصم التسليم بعد availableUntil
export const DEFAULT_STRICT_MINUTES = 5; // مدة وضع منع الغش لو لم تُحدد مدة

export type AssessmentKind = 'exam' | 'training' | 'homework';

export type QuestionType =
  | 'choose'
  | 'tf'
  | 'explain'
  | 'result'
  | 'prove'
  | 'relation'
  | 'whatif'
  | 'meaning';

export type AnswerMode = 'choice' | 'tf' | 'text';

export const KIND_LABELS: Record<AssessmentKind, string> = {
  exam: 'امتحان',
  training: 'تدريب',
  homework: 'واجب',
};

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  points: number;
  options: Record<string, string> | null; // مفاتيحها a وb وc وd
  asMcq: boolean;
  // الإجابة النموذجية: مفتاح الخيار (a-d) أو صح/خطأ أو نص. تكون null لو مخفية عن الطالب.
  answer: string | null;
  altAnswers: string[];
}

export interface AnswerDetail {
  question: string;
  rawAnswer: string;
  score: number; // من 0 إلى 1
  pointsEarned: number;
  totalPoints: number;
  feedback: string;
  needsReview: boolean;
  method: string;
  options: Record<string, string> | null;
  correctAnswer: string | null;
}

export interface AttemptResult {
  courseId: string;
  examId: string;
  examTitle: string;
  percent: number;
  earnedPoints: number;
  totalPoints: number;
  effectivePercent: number;
  penalized: boolean;
  attemptNumber: number;
  isOfficial: boolean;
  autoSubmit: boolean;
  ts: number;
  details: AnswerDetail[];
  isTraining: boolean;
  isHomework: boolean;
  needsReview: boolean;
  reviewReason: string;
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
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const QUESTION_TYPES: QuestionType[] = [
  'choose',
  'tf',
  'explain',
  'result',
  'prove',
  'relation',
  'whatif',
  'meaning',
];

function isQuestionType(value: string): value is QuestionType {
  return (QUESTION_TYPES as string[]).includes(value);
}

function parseOptions(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;

  const options: Record<string, string> = {};
  for (const key of ['a', 'b', 'c', 'd']) {
    const text = asString(value[key]);
    if (text.trim() !== '') options[key] = text;
  }
  return Object.keys(options).length > 0 ? options : null;
}

// ---------- قراءة الأسئلة (متسامحة) ----------

export function parseQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];

  const questions: Question[] = [];

  value.forEach((entry, index) => {
    if (!isRecord(entry)) return;

    const options = parseOptions(entry.options);
    const typeText = asString(entry.type).trim().toLowerCase();
    const type: QuestionType = isQuestionType(typeText) ? typeText : options ? 'choose' : 'explain';

    const rawPoints = typeof entry.points === 'number' ? entry.points : Number(asString(entry.points));
    const points = Number.isFinite(rawPoints) && rawPoints > 0 ? rawPoints : 1;

    questions.push({
      id: asString(entry.id) || `q${index}`,
      type,
      text: asString(entry.text) || asString(entry.question),
      points,
      options,
      asMcq: entry.asMcq === true,
      answer: entry.answer === undefined || entry.answer === null ? null : asString(entry.answer),
      altAnswers: Array.isArray(entry.altAnswers)
        ? entry.altAnswers.map(asString).filter((item) => item !== '')
        : [],
    });
  });

  return questions;
}

// طريقة إجابة الطالب: اختيار أو صح/خطأ أو نص مقالي.
export function getAnswerMode(question: Question): AnswerMode {
  if (question.type === 'choose') return 'choice';
  if (question.type === 'tf') return 'tf';
  if (question.asMcq && question.options) return 'choice';
  return 'text';
}

// هل كل الأسئلة الموضوعية معها إجابتها؟ (غير ذلك لا يمكن التصحيح في المتصفح)
export function hasAnswerKeys(questions: Question[]): boolean {
  return questions.every((question) => getAnswerMode(question) === 'text' || question.answer !== null);
}

// ---------- وضع منع الغش والمدة ----------

// وضع منع الغش إجباري لأي امتحان حقيقي، واختياري للتدريب والواجب.
export function getEffectiveStrict(kind: AssessmentKind, strictMode: boolean): boolean {
  return kind === 'exam' || strictMode;
}

// المدة بالدقائق: 0 = مفتوح. ولو وضع منع الغش مفعّل بدون مدة فهي 5 دقائق.
export function getEffectiveDurationMinutes(
  kind: AssessmentKind,
  duration: number,
  strictMode: boolean,
): number {
  if (duration > 0) return duration;
  return getEffectiveStrict(kind, strictMode) ? DEFAULT_STRICT_MINUTES : 0;
}

// ---------- التصحيح ----------

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

function normalizeTf(value: string): 'صح' | 'خطأ' | '' {
  const text = normalizeText(value);
  if (['صح', 'صحيح', 'true', 't'].includes(text)) return 'صح';
  if (['خطا', 'خطاء', 'غلط', 'false', 'f'].includes(text)) return 'خطأ';
  return '';
}

function isTfCorrect(question: Question, given: string): boolean {
  const picked = normalizeTf(given);
  if (!picked || question.answer === null) return false;
  return [question.answer, ...question.altAnswers].some((item) => normalizeTf(item) === picked);
}

// الإجابة الصحيحة قد تكون مفتاح الخيار (a-d) أو نص الخيار نفسه.
function isChoiceCorrect(question: Question, given: string): boolean {
  const picked = given.trim().toLowerCase();
  if (!picked || question.answer === null) return false;

  const pickedText = question.options ? question.options[picked] : undefined;

  return [question.answer, ...question.altAnswers].some((item) => {
    if (item.trim().toLowerCase() === picked) return true;
    return pickedText !== undefined && normalizeText(pickedText) === normalizeText(item);
  });
}

export function gradeQuestion(question: Question, rawAnswer: string): AnswerDetail {
  const answer = rawAnswer.trim();
  const mode = getAnswerMode(question);

  const base = {
    question: question.text,
    rawAnswer: answer,
    totalPoints: question.points,
    options: question.options,
    correctAnswer: question.answer,
  };

  if (answer === '') {
    return {
      ...base,
      score: 0,
      pointsEarned: 0,
      feedback: 'لم تجب عن هذا السؤال',
      needsReview: false,
      method: 'unanswered',
    };
  }

  // الأسئلة المقالية لا تُصحح آليًا الآن (Gemini في المرحلة 6)، فتُعلَّم للمراجعة.
  if (mode === 'text') {
    return {
      ...base,
      score: 0,
      pointsEarned: 0,
      feedback: '',
      needsReview: true,
      method: 'needs_review',
    };
  }

  const correct = mode === 'tf' ? isTfCorrect(question, answer) : isChoiceCorrect(question, answer);

  return {
    ...base,
    score: correct ? 1 : 0,
    pointsEarned: correct ? question.points : 0,
    feedback: correct ? 'إجابة صحيحة' : 'إجابة خاطئة',
    needsReview: false,
    method: 'objective',
  };
}

export interface BuildResultInput {
  courseId: string;
  examId: string;
  examTitle: string;
  kind: AssessmentKind;
  questions: Question[];
  answers: Record<string, string>;
  attemptNumber: number;
  autoSubmit: boolean;
  submittedAt: number; // مللي ثانية
  availableUntil: number | null;
}

export function buildAttemptResult(input: BuildResultInput): AttemptResult {
  const details = input.questions.map((question) =>
    gradeQuestion(question, input.answers[question.id] ?? ''),
  );

  const totalPoints = round2(details.reduce((sum, item) => sum + item.totalPoints, 0));
  const earnedPoints = round2(details.reduce((sum, item) => sum + item.pointsEarned, 0));
  const percent = totalPoints > 0 ? round2((earnedPoints / totalPoints) * 100) : 0;

  // التسليم بعد availableUntil يخصم 20 نقطة مئوية.
  const penalized = input.availableUntil !== null && input.submittedAt > input.availableUntil;
  const effectivePercent = penalized ? Math.max(0, round2(percent - LATE_PENALTY_PERCENT)) : percent;

  const needsReview = details.some((item) => item.needsReview);

  return {
    courseId: input.courseId,
    examId: input.examId,
    examTitle: input.examTitle,
    percent,
    earnedPoints,
    totalPoints,
    effectivePercent,
    penalized,
    attemptNumber: input.attemptNumber,
    isOfficial: input.attemptNumber === 1,
    autoSubmit: input.autoSubmit,
    ts: input.submittedAt,
    details,
    isTraining: input.kind === 'training',
    isHomework: input.kind === 'homework',
    needsReview,
    reviewReason: needsReview ? 'essay-questions' : '',
  };
}

// ---------- قراءة النتيجة المخزنة (من السيرفر) ----------

function parseDetail(entry: unknown): AnswerDetail | null {
  if (!isRecord(entry)) return null;

  return {
    question: asString(entry.question),
    rawAnswer: asString(entry.rawAnswer),
    score: asNumber(entry.score),
    pointsEarned: asNumber(entry.pointsEarned),
    totalPoints: asNumber(entry.totalPoints),
    feedback: asString(entry.feedback),
    needsReview: entry.needsReview === true,
    method: asString(entry.method),
    options: parseOptions(entry.options),
    correctAnswer:
      entry.correctAnswer === undefined || entry.correctAnswer === null
        ? null
        : asString(entry.correctAnswer),
  };
}

export function parseAttemptResult(value: unknown): AttemptResult | null {
  if (!isRecord(value)) return null;

  const details: AnswerDetail[] = [];
  if (Array.isArray(value.details)) {
    value.details.forEach((entry) => {
      const detail = parseDetail(entry);
      if (detail) details.push(detail);
    });
  }

  return {
    courseId: asString(value.courseId),
    examId: asString(value.examId),
    examTitle: asString(value.examTitle),
    percent: asNumber(value.percent),
    earnedPoints: asNumber(value.earnedPoints),
    totalPoints: asNumber(value.totalPoints),
    effectivePercent: asNumber(value.effectivePercent),
    penalized: value.penalized === true,
    attemptNumber: asNumber(value.attemptNumber),
    isOfficial: value.isOfficial === true,
    autoSubmit: value.autoSubmit === true,
    ts: asNumber(value.ts),
    details,
    isTraining: value.isTraining === true,
    isHomework: value.isHomework === true,
    needsReview: value.needsReview === true,
    reviewReason: asString(value.reviewReason),
  };
}

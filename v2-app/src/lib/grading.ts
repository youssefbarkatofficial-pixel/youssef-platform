// منطق تصحيح الامتحانات والتدريبات والواجبات.
// متوافق مع معايير المنصات التعليمية المصرية، ويدعم التصحيح الموضوعي الحتمي، والتطبيع العربي، والدرجات الجزئية، ونظام مراجعة المقالي.

import {
  normalizeArabicForMatching,
  isEvidenceInAnswer,
  detectPromptInjection,
  isAcceptedAnswerMatch,
} from './arabicNormalize.ts';

export const MAX_ATTEMPTS = 3; // المحاولة الأولى فقط هي الرسمية افتراضيًا
export const LATE_PENALTY_PERCENT = 20; // خصم التسليم بعد availableUntil
export const DEFAULT_STRICT_MINUTES = 5; // مدة وضع منع الغش لو لم تُحدد مدة

export type AssessmentKind = 'exam' | 'training' | 'homework';

export type QuestionType =
  | 'choose'
  | 'tf'
  | 'multi_select'
  | 'fill'
  | 'short'
  | 'correct'
  | 'term'
  | 'who'
  | 'explain'
  | 'result'
  | 'prove'
  | 'compare'
  | 'similarities'
  | 'relation'
  | 'whatif'
  | 'meaning'
  | 'opinion';

export type AnswerMode = 'choice' | 'multi_choice' | 'tf' | 'fill' | 'text';

export const KIND_LABELS: Record<AssessmentKind, string> = {
  exam: 'امتحان',
  training: 'تدريب',
  homework: 'واجب',
};

export interface RubricPoint {
  id: string;
  text: string;
  weight: number;
  required?: boolean;
  criticalElements?: string[]; // عناصر حرجة: أسماء، تواريخ، أرقام
  synonyms?: string[];
}

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
  // الحقول المتقدمة للتصحيح الذكي والدرجات الجزئية
  correctOptions?: string[]; // للخيارات المتعددة: مثل ['a', 'c']
  allowPartialCredit?: boolean; // احتساب درجات جزئية للخيارات الصحيحة
  partialPenalty?: boolean; // خصم عند اختيار خيار خاطئ (لا ينزل تحت الصفر)
  acceptedAnswers?: string[]; // للإكمال والإجابة القصيرة
  rubricPoints?: RubricPoint[]; // نقاط تقييم السؤال المقالي
  rubricApproved?: boolean; // هل اعتمد المعلم معايير التقويم
  explanation?: string; // الشرح التوضيحي للسؤال
  sectionTitle?: string; // عنوان القسم (جغرافيا، تاريخ، مهارات عليا)
}

export interface DualJudgeResult {
  judge1: { present: boolean; evidence: string; confidence: number };
  judge2: { present: boolean; evidence: string; confidence: number };
  agreed: boolean;
  verifiableEvidence: boolean; // هل الاقتباس موجود حرفياً بنص الطالب
  shadowMode: boolean; // هل التقييم في وضع الظل التجريبي
  calculatedPoints: number;
  pointsEarned: number;
}

export interface AnswerDetail {
  question: string;
  questionId?: string;
  rawAnswer: string;
  score: number; // نسبة من 0 إلى 1
  pointsEarned: number;
  totalPoints: number;
  feedback: string;
  needsReview: boolean;
  reviewReason?: string;
  method: string;
  options: Record<string, string> | null;
  correctAnswer: string | null;
  explanation?: string;
  sectionTitle?: string;
  selectedOptions?: string[];
  correctOptions?: string[];
  rubricBreakdown?: {
    pointId: string;
    text: string;
    weight: number;
    awarded: boolean;
    evidence?: string;
    agreed: boolean;
    correct?: boolean;
}[];
  dualJudge?: DualJudgeResult;
  injectionDetected?: boolean;
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
  // تحسينات تقارير ودرجات الأقسام
  sectionScores?: Record<string, { earned: number; total: number; percent: number }>;
  objectiveOnlyPercent?: number;
  tabExitCount?: number;
  tabExitWarnings?: string[];
  displayReviewAt?: 'immediate' | 'after_due' | 'never';
  canShowReview?: boolean;
}

// ---------- أدوات مساعدة ----------

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
  'multi_select',
  'fill',
  'short',
  'correct',
  'term',
  'who',
  'explain',
  'result',
  'prove',
  'compare',
  'similarities',
  'relation',
  'whatif',
  'meaning',
  'opinion',
];

function isQuestionType(value: string): value is QuestionType {
  return (QUESTION_TYPES as string[]).includes(value);
}

function parseOptions(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;

  const options: Record<string, string> = {};
  for (const key of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const text = asString(value[key]);
    if (text.trim() !== '') options[key] = text;
  }
  return Object.keys(options).length > 0 ? options : null;
}

function parseRubricPoints(value: unknown): RubricPoint[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list: RubricPoint[] = [];
  value.forEach((item, idx) => {
    if (!isRecord(item)) return;
    const text = asString(item.text).trim();
    if (!text) return;
    list.push({
      id: asString(item.id) || `rubric_${idx + 1}`,
      text,
      weight: typeof item.weight === 'number' ? item.weight : 1,
      required: item.required === true,
      criticalElements: Array.isArray(item.criticalElements) ? item.criticalElements.map(asString) : undefined,
      synonyms: Array.isArray(item.synonyms) ? item.synonyms.map(asString) : undefined,
    });
  });
  return list.length > 0 ? list : undefined;
}

// ---------- قراءة الأسئلة (متسامحة ومتوافقة للخلف) ----------

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

    const correctOptions = Array.isArray(entry.correctOptions)
      ? entry.correctOptions.map(asString).filter((x) => x.trim() !== '')
      : undefined;

    const acceptedAnswers = Array.isArray(entry.acceptedAnswers)
      ? entry.acceptedAnswers.map(asString).filter((x) => x.trim() !== '')
      : undefined;

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
      correctOptions,
      allowPartialCredit: entry.allowPartialCredit === true,
      partialPenalty: entry.partialPenalty === true,
      acceptedAnswers,
      rubricPoints: parseRubricPoints(entry.rubricPoints),
      rubricApproved: entry.rubricApproved === true,
      explanation: asString(entry.explanation) || undefined,
      sectionTitle: asString(entry.sectionTitle) || undefined,
    });
  });

  return questions;
}

// طريقة إجابة الطالب
export function getAnswerMode(question: Question): AnswerMode {
  if (question.type === 'choose') return 'choice';
  if (question.type === 'multi_select') return 'multi_choice';
  if (question.type === 'tf') return 'tf';
  // سؤال محوّل إلى اختيار من متعدد (بقى نوعه الأصلي كما هو حتى يظهر عنوانه الصحيح)
  if (question.asMcq && question.options && Object.keys(question.options).length > 0) return 'choice';
  if (question.type === 'fill' || question.type === 'short') return 'fill';
  if (question.type === 'correct' || question.type === 'term' || question.type === 'who') return 'fill';
  return 'text';
}

// هل كل الأسئلة الموضوعية معها إجابتها؟
export function hasAnswerKeys(questions: Question[]): boolean {
  return questions.every((question) => {
    const mode = getAnswerMode(question);
    if (mode === 'text') return true;
    if (mode === 'multi_choice') return (question.correctOptions && question.correctOptions.length > 0) || question.answer !== null;
    return question.answer !== null;
  });
}

// ---------- وضع منع الغش والمدة ----------

export function getEffectiveStrict(kind: AssessmentKind, strictMode: boolean): boolean {
  return kind === 'exam' || strictMode;
}

export function getEffectiveDurationMinutes(
  kind: AssessmentKind,
  duration: number,
  strictMode: boolean,
): number {
  if (duration > 0) return duration;
  return getEffectiveStrict(kind, strictMode) ? DEFAULT_STRICT_MINUTES : 0;
}

// ---------- دوال التحقق الموضوعي الحتمي والتطبيع ----------

function normalizeTf(value: string): 'صح' | 'خطأ' | '' {
  const norm = normalizeArabicForMatching(value);
  if (['صح', 'صحيح', 'صواب', 'نعم', 'true', 't'].includes(norm)) return 'صح';
  if (['خطا', 'خطاء', 'خاطي', 'خاطئه', 'لا', 'غلط', 'false', 'f'].includes(norm)) return 'خطأ';
  return '';
}

function isTfCorrect(question: Question, given: string): boolean {
  const picked = normalizeTf(given);
  if (!picked || question.answer === null) return false;
  return [question.answer, ...(question.altAnswers || [])].some((item) => normalizeTf(item) === picked);
}

// مطابقة اختيار من متعدد (مفتاح خيار a-d أو نص الخيار نفسه)
function isChoiceCorrect(question: Question, given: string): boolean {
  const rawPicked = given.trim().toLowerCase();
  if (!rawPicked || question.answer === null) return false;

  const pickedText = question.options ? question.options[rawPicked] : undefined;
  const normGivenText = normalizeArabicForMatching(pickedText || rawPicked);

  return [question.answer, ...(question.altAnswers || [])].some((item) => {
    if (item.trim().toLowerCase() === rawPicked) return true;
    const normItem = normalizeArabicForMatching(item);
    return normItem !== '' && normGivenText === normItem;
  });
}

// مطابقة الاختيار متعدد الإجابات مع حساب الدرجة الجزئية
export function gradeMultiSelect(
  question: Question,
  givenRaw: string
): { score: number; pointsEarned: number; feedback: string; selected: string[]; correct: string[] } {
  let selected: string[] = [];
  try {
    if (givenRaw.startsWith('[') && givenRaw.endsWith(']')) {
      selected = JSON.parse(givenRaw).map((x: any) => String(x).trim().toLowerCase());
    } else {
      selected = givenRaw.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    }
  } catch {
    selected = [givenRaw.trim().toLowerCase()].filter(Boolean);
  }

  // مفاتيح الإجابة الصحيحة
  let correctKeys: string[] = [];
  if (question.correctOptions && question.correctOptions.length > 0) {
    correctKeys = question.correctOptions.map((x) => x.trim().toLowerCase());
  } else if (question.answer) {
    correctKeys = question.answer.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  }

  const correctSet = new Set(correctKeys);
  const selectedSet = new Set(selected);

  if (correctSet.size === 0) {
    return { score: 0, pointsEarned: 0, feedback: 'لم يُحدد مفتاح إجابة للاختيارات المتعددة', selected, correct: correctKeys };
  }

  let truePositives = 0;
  let falsePositives = 0;

  for (const s of selectedSet) {
    if (correctSet.has(s)) {
      truePositives += 1;
    } else {
      falsePositives += 1;
    }
  }

  if (!question.allowPartialCredit) {
    // درجة كلية فقط: يجب اختيار كل الصحيح وبلا أي اختيار خاطئ
    const allCorrect = truePositives === correctSet.size && falsePositives === 0;
    return {
      score: allCorrect ? 1 : 0,
      pointsEarned: allCorrect ? question.points : 0,
      feedback: allCorrect ? 'إجابة صحيحة بالكامل' : 'إجابة غير مكتملة أو خاطئة',
      selected,
      correct: correctKeys,
    };
  }

  // احتساب الدرجة الجزئية
  let netRatio = truePositives / correctSet.size;
  if (question.partialPenalty && falsePositives > 0) {
    netRatio -= falsePositives / correctSet.size;
  }
  netRatio = Math.max(0, Math.min(1, netRatio));

  const pointsEarned = round2(netRatio * question.points);
  let feedback = '';
  if (netRatio === 1) {
    feedback = 'إجابة صحيحة بالكامل';
  } else if (netRatio > 0) {
    feedback = `درجة جزئية: تم تحديد ${truePositives} من ${correctSet.size} خيارات صحيحة`;
  } else {
    feedback = 'إجابة خاطئة';
  }

  return {
    score: round2(netRatio),
    pointsEarned,
    feedback,
    selected,
    correct: correctKeys,
  };
}

// مطابقة سؤال الإكمال أو الإجابة القصيرة
function gradeFillQuestion(
  question: Question,
  givenRaw: string
): { score: number; pointsEarned: number; feedback: string } {
  const candidateList = [
    question.answer,
    ...(question.acceptedAnswers || []),
    ...(question.altAnswers || []),
  ].filter((x): x is string => typeof x === 'string' && x.trim().length > 0);

  const matchRes = isAcceptedAnswerMatch(givenRaw, candidateList);
  if (matchRes.matched) {
    return {
      score: 1,
      pointsEarned: question.points,
      feedback: 'إجابة صحيحة ومطابقة للنموذج',
    };
  }

  return {
    score: 0,
    pointsEarned: 0,
    feedback: 'إجابة غير مطابقة للنموذج المعتمد',
  };
}

// ---------- محرك تصحيح السؤال المنفرد ----------

export interface DualJudgeInput {
  judge1: { present: boolean; evidence: string; confidence: number };
  judge2: { present: boolean; evidence: string; confidence: number };
  shadowMode?: boolean;
}

export function gradeQuestion(
  question: Question,
  rawAnswer: string,
  dualJudgeInput?: DualJudgeInput
): AnswerDetail {
  const answer = rawAnswer.trim();
  const mode = getAnswerMode(question);

  const base: AnswerDetail = {
    question: question.text,
    questionId: question.id,
    rawAnswer: answer,
    score: 0,
    pointsEarned: 0,
    totalPoints: question.points,
    options: question.options,
    correctAnswer: question.answer,
    explanation: question.explanation,
    sectionTitle: question.sectionTitle,
    needsReview: false,
    method: 'objective',
    feedback: '',
  };

  // إجابة فارغة
  if (answer === '') {
    return {
      ...base,
      feedback: 'لم تجب عن هذا السؤال',
      method: 'unanswered',
    };
  }

  // 1. صح أو خطأ
  if (mode === 'tf') {
    const correct = isTfCorrect(question, answer);
    return {
      ...base,
      score: correct ? 1 : 0,
      pointsEarned: correct ? question.points : 0,
      feedback: correct ? 'إجابة صحيحة' : 'إجابة خاطئة',
      method: 'objective',
    };
  }

  // 2. اختيار من متعدد فردي
  if (mode === 'choice') {
    const correct = isChoiceCorrect(question, answer);
    return {
      ...base,
      score: correct ? 1 : 0,
      pointsEarned: correct ? question.points : 0,
      feedback: correct ? 'إجابة صحيحة' : 'إجابة خاطئة',
      method: 'objective',
    };
  }

  // 3. اختيار متعدد الإجابات بدرجة جزئية
  if (mode === 'multi_choice') {
    const res = gradeMultiSelect(question, answer);
    return {
      ...base,
      score: res.score,
      pointsEarned: res.pointsEarned,
      feedback: res.feedback,
      selectedOptions: res.selected,
      correctOptions: res.correct,
      method: question.allowPartialCredit ? 'partial_objective' : 'objective',
    };
  }

  // 4. إكمال أو إجابة قصيرة مع قائمة إجابات مقبولة وتطبيع عربي
  if (mode === 'fill') {
    const res = gradeFillQuestion(question, answer);
    return {
      ...base,
      score: res.score,
      pointsEarned: res.pointsEarned,
      feedback: res.feedback,
      method: 'fill',
    };
  }

  // 5. السؤال المقالي (كتابي)
  // كشف محاولة حقن التعليمات في إجابة الطالب
  if (detectPromptInjection(answer)) {
    return {
      ...base,
      score: 0,
      pointsEarned: 0,
      feedback: 'تم رصد محاولة مخاطبة النظام أو تخطي التعليمات. الإجابة معلّقة للمراجعة اليدوية للمعلم.',
      needsReview: true,
      reviewReason: 'prompt-injection-attempt',
      injectionDetected: true,
      method: 'security_flag',
    };
  }

  // نظام القاضيين المزدوج إن قُدمت مدخلات الذكاء الاصطناعي
  if (dualJudgeInput && question.rubricPoints && question.rubricPoints.length > 0 && question.rubricApproved) {
    const { judge1, judge2, shadowMode } = dualJudgeInput;

    // شرط حديدي: الدليل يجب أن يكون اقتباسًا حرفيًا موجودًا بنص الطالب
    const ev1Valid = isEvidenceInAnswer(judge1.evidence, answer);
    const ev2Valid = isEvidenceInAnswer(judge2.evidence, answer);
    const judgesAgreed = judge1.present === judge2.present && Math.abs(judge1.confidence - judge2.confidence) < 0.35;
    const highConfidence = judge1.confidence >= 0.75 && judge2.confidence >= 0.75;

    // حساب الدرجة بالكود فقط من أوزان النقاط
    const totalRubricWeight = question.rubricPoints.reduce((s, p) => s + p.weight, 0);
    const pointsRatio = totalRubricWeight > 0 ? question.points / totalRubricWeight : 1;
    let earnedRubric = 0;

    const breakdown = question.rubricPoints.map((point) => {
      // مطابقة مبسطة للنقطة عبر القضاة
      const awarded = judge1.present && judge2.present && ev1Valid && ev2Valid;
      if (awarded) earnedRubric += point.weight;
      return {
        pointId: point.id,
        text: point.text,
        weight: point.weight,
        awarded,
        evidence: judge1.evidence || judge2.evidence,
        agreed: judgesAgreed,
      };
    });

    const calculatedEarned = round2(earnedRubric * pointsRatio);

    // في وضع الظل (Shadow mode) أو عند أي اختلاف أو ثقة منخفضة:
    // يُسجل التقدير ويظل السؤال معلقًا لمراجعة المعلم
    const shouldHoldForReview = shadowMode || !judgesAgreed || !highConfidence || !ev1Valid || !ev2Valid;

    const dualResult: DualJudgeResult = {
      judge1,
      judge2,
      agreed: judgesAgreed,
      verifiableEvidence: ev1Valid && ev2Valid,
      shadowMode: shadowMode === true,
      calculatedPoints: calculatedEarned,
      pointsEarned: shouldHoldForReview ? 0 : calculatedEarned,
    };

    return {
      ...base,
      score: shouldHoldForReview ? 0 : round2(calculatedEarned / question.points),
      pointsEarned: shouldHoldForReview ? 0 : calculatedEarned,
      feedback: shouldHoldForReview
        ? 'تم تقييم الإجابة بانتظار مراجعة المعلم واعتماد الدرجة النهائية'
        : 'تم تقييم الإجابة بنجاح وفق معايير الإجابة المعتمدة',
      needsReview: true, // أي سؤال مقالي يظل في وضع المراجعة لحين اعتماد المعلم
      reviewReason: shadowMode ? 'shadow-mode-evaluation' : !judgesAgreed ? 'judge-disagreement' : 'essay-questions',
      method: shadowMode ? 'shadow_review' : 'dual_judge',
      rubricBreakdown: breakdown,
      dualJudge: dualResult,
    };
  }

  // الافتراضي للمقالي بدون نموذج: علامة مراجعة للمعلم
  return {
    ...base,
    score: 0,
    pointsEarned: 0,
    feedback: 'سؤال مقالي قيد مراجعة وتقييم معلم المادة',
    needsReview: true,
    reviewReason: 'essay-questions',
    method: 'needs_review',
  };
}

// ---------- بناء وحساب نتيجة الاختبار الإجمالية ----------

export interface BuildResultInput {
  courseId: string;
  examId: string;
  examTitle: string;
  kind: AssessmentKind;
  questions: Question[];
  answers: Record<string, string>;
  attemptNumber: number;
  autoSubmit: boolean;
  submittedAt: number; // بالمللي ثانية
  availableUntil: number | null;
  dualJudgesMap?: Record<string, DualJudgeInput>;
  tabExitCount?: number;
  displayReviewAt?: 'immediate' | 'after_due' | 'never';
}

export function buildAttemptResult(input: BuildResultInput): AttemptResult {
  const details = input.questions.map((question) => {
    const rawAnswer = input.answers[question.id] ?? '';
    const judgeInput = input.dualJudgesMap ? input.dualJudgesMap[question.id] : undefined;
    const graded = gradeQuestion(question, rawAnswer, judgeInput);
    return { ...graded, correct: graded.score >= 1 && !graded.needsReview };
  });

  const totalPoints = round2(details.reduce((sum, item) => sum + item.totalPoints, 0));
  const earnedPoints = round2(details.reduce((sum, item) => sum + item.pointsEarned, 0));
  const percent = totalPoints > 0 ? round2((earnedPoints / totalPoints) * 100) : 0;

  // درجة الأسئلة الموضوعية فقط (المستثناة من المراجعة)
  const objDetails = details.filter((d) => !d.needsReview);
  const objTotal = round2(objDetails.reduce((sum, d) => sum + d.totalPoints, 0));
  const objEarned = round2(objDetails.reduce((sum, d) => sum + d.pointsEarned, 0));
  const objectiveOnlyPercent = objTotal > 0 ? round2((objEarned / objTotal) * 100) : 0;

  // التسليم بعد availableUntil يخصم 20 نقطة مئوية
  const penalized = input.availableUntil !== null && input.submittedAt > input.availableUntil;
  const effectivePercent = penalized ? Math.max(0, round2(percent - LATE_PENALTY_PERCENT)) : percent;

  const needsReview = details.some((item) => item.needsReview);

  // حساب درجات الأقسام (تاريخ، جغرافيا، إلخ)
  const sectionScores: Record<string, { earned: number; total: number; percent: number }> = {};
  for (const detail of details) {
    const sec = detail.sectionTitle || 'عام';
    if (!sectionScores[sec]) {
      sectionScores[sec] = { earned: 0, total: 0, percent: 0 };
    }
    sectionScores[sec].total = round2(sectionScores[sec].total + detail.totalPoints);
    sectionScores[sec].earned = round2(sectionScores[sec].earned + detail.pointsEarned);
  }
  for (const sec of Object.keys(sectionScores)) {
    const s = sectionScores[sec];
    s.percent = s.total > 0 ? round2((s.earned / s.total) * 100) : 0;
  }

  // تحديد هل يحق للطالب رؤية المراجعة التفصيلية الآن
  const displayReviewAt = input.displayReviewAt || 'immediate';
  let canShowReview = true;
  if (displayReviewAt === 'never') {
    canShowReview = false;
  } else if (displayReviewAt === 'after_due') {
    canShowReview = input.availableUntil === null || input.submittedAt >= input.availableUntil;
  }

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
    sectionScores,
    objectiveOnlyPercent,
    tabExitCount: input.tabExitCount || 0,
    displayReviewAt,
    canShowReview,
  };
}

/**
 * تنقية النتيجة قبل تخزينها في Firestore لتطابق قواعد الأمان (hasOnly) بدقة 100%.
 */
function sanitizeDetailForStorage(detail: AnswerDetail): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detail)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean;
}

export function sanitizeAttemptForStorage(result: AttemptResult): Record<string, unknown> {
  return {
    courseId: result.courseId,
    examId: result.examId,
    examTitle: result.examTitle,
    percent: result.percent,
    earnedPoints: result.earnedPoints,
    totalPoints: result.totalPoints,
    effectivePercent: result.effectivePercent,
    penalized: result.penalized,
    attemptNumber: result.attemptNumber,
    isOfficial: result.isOfficial,
    autoSubmit: result.autoSubmit,
    ts: result.ts,
    details: result.details.map(sanitizeDetailForStorage),
    isTraining: result.isTraining,
    isHomework: result.isHomework,
    needsReview: result.needsReview,
    reviewReason: result.reviewReason,
  };
}

// ---------- قراءة النتيجة المخزنة (متوافقة للخلف) ----------

function parseDetail(entry: unknown): AnswerDetail | null {
  if (!isRecord(entry)) return null;

  return {
    question: asString(entry.question),
    questionId: asString(entry.questionId) || undefined,
    rawAnswer: asString(entry.rawAnswer),
    score: asNumber(entry.score),
    pointsEarned: asNumber(entry.pointsEarned),
    totalPoints: asNumber(entry.totalPoints),
    feedback: asString(entry.feedback),
    needsReview: entry.needsReview === true,
    reviewReason: asString(entry.reviewReason) || undefined,
    method: asString(entry.method),
    options: parseOptions(entry.options),
    correctAnswer:
      entry.correctAnswer === undefined || entry.correctAnswer === null
        ? null
        : asString(entry.correctAnswer),
    explanation: asString(entry.explanation) || undefined,
    sectionTitle: asString(entry.sectionTitle) || undefined,
    selectedOptions: Array.isArray(entry.selectedOptions) ? entry.selectedOptions.map(asString) : undefined,
    correctOptions: Array.isArray(entry.correctOptions) ? entry.correctOptions.map(asString) : undefined,
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
    objectiveOnlyPercent: typeof value.objectiveOnlyPercent === 'number' ? value.objectiveOnlyPercent : undefined,
    tabExitCount: typeof value.tabExitCount === 'number' ? value.tabExitCount : 0,
    canShowReview: value.canShowReview !== false,
  };
}

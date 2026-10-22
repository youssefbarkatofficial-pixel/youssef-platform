import type { Question, QuestionType } from './grading';

// مسودة سؤال في لوحة الأدمن (تحتوي الإجابة الصحيحة). لا تُرسل للطالب أبدًا بهذا الشكل.

export interface RubricItem {
  concept: string;
  weight: number;
}

export interface QuestionDraft {
  id: string;
  type: QuestionType;
  text: string;
  points: number;
  // للاختيار من متعدد فقط (مفاتيحها a وb وc وd، وقد تكون فارغة)
  options: Record<string, string> | null;
  // مفتاح الخيار (a-d) أو صح/خطأ أو الإجابة النموذجية للمقالي
  answer: string;
  altAnswers: string[];
  // بنود التقييم للأسئلة المقالية
  rubric: RubricItem[];
  // علامة للمسودة إذا كانت تحتاج مراجعة المعلم وتحديد إجابة
  needsReview?: boolean;
  // السؤال معروض للطالب كاختيار من متعدد مع الاحتفاظ بصيغته الأصلية (بم تفسر، أكمل، ...)
  asMcq?: boolean;
}

// الجزء الذي يراه الطالب (بدون answer وaltAnswers وrubric).
export interface PublicQuestion {
  id: string;
  type: QuestionType;
  text: string;
  points: number;
  options?: Record<string, string>;
  asMcq?: boolean;
}

// الجزء المغلق (للأدمن والسيرفر فقط).
export interface KeyEntry {
  id: string;
  answer: string;
  altAnswers: string[];
  rubric: RubricItem[];
}

export const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

// صيغ الأسئلة المعتمدة = نفس صيغ النموذج الرسمي (exam-template-v1) بالترتيب، بلا زيادة أو نقص.
export const QUESTION_FORMATS: QuestionType[] = [
  'choose',
  'tf',
  'fill',
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

// كل الأنواع الداخلية (تشمل أنواعًا قديمة محفوظة في بيانات سابقة، لا تظهر في قائمة الاختيار).
export const QUESTION_TYPES: QuestionType[] = [
  ...QUESTION_FORMATS,
  'short',
  'multi_select',
];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  choose: 'اختر الإجابة الصحيحة',
  tf: 'صح أو خطأ',
  fill: 'أكمل العبارات',
  correct: 'صوب ما تحته خط',
  term: 'اكتب ما تشير إليه العبارة',
  who: 'من هو؟',
  explain: 'بم تفسر',
  result: 'ما النتائج المترتبة على',
  prove: 'دلل تاريخياً',
  compare: 'قارن بين',
  similarities: 'أوجه الشبه والاختلاف',
  relation: 'ما العلاقة بين',
  whatif: 'ماذا يحدث إذا',
  meaning: 'ما المقصود',
  opinion: 'ما رأيك في',
  short: 'إجابة قصيرة',
  multi_select: 'اختيار متعدد الإجابات',
};

export function isQuestionType(value: string): value is QuestionType {
  return (QUESTION_TYPES as string[]).includes(value);
}

export function isEssayType(type: QuestionType): boolean {
  return type !== 'choose' && type !== 'multi_select' && type !== 'tf' && type !== 'fill' && type !== 'short' && type !== 'correct' && type !== 'term' && type !== 'who';
}

/**
 * تنسيق صيغة السؤال عند العرض للطلاب وفي المراجعة.
 * إذا كان السؤال من نوع (بم تفسر، ما النتائج، دلل...) والنص لا يبدأ بالصيغة،
 * يُرجع البادئة منفصلة ليتم إبرازها للطالب بشكل واضح ومفهوم.
 */
export function formatQuestionPrompt(
  text: string,
  type?: string
): { prefix: string | null; body: string } {
  const trimmed = (text || '').trim();
  if (!type || type === 'choose' || type === 'tf' || type === 'unknown') {
    return { prefix: null, body: trimmed };
  }
  const label = (QUESTION_TYPE_LABELS[type as QuestionType] || type).trim();
  const cleanLabel = label.replace(/[؟?:]/g, '').trim();

  if (trimmed.startsWith(label) || trimmed.startsWith(cleanLabel)) {
    return { prefix: null, body: trimmed };
  }

  return { prefix: label, body: trimmed };
}

export function newQuestionId(): string {
  return `q_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function emptyOptions(): Record<string, string> {
  return { a: '', b: '', c: '', d: '' };
}

export function createEmptyDraft(type: QuestionType = 'choose', asMcq = false): QuestionDraft {
  return {
    id: newQuestionId(),
    type,
    text: '',
    points: 1,
    options: type === 'choose' || (asMcq && type !== 'tf') ? emptyOptions() : null,
    answer: type === 'tf' ? 'صح' : '',
    altAnswers: [],
    rubric: [],
    asMcq: asMcq && type !== 'choose' ? true : undefined,
  };
}

// تغيير نوع السؤال مع ضبط الحقول المناسبة للنوع الجديد.
export function changeDraftType(draft: QuestionDraft, type: QuestionType): QuestionDraft {
  const wasAnswerable = !isEssayType(draft.type);
  const isAnswerable = !isEssayType(type);
  const asMcq = draft.asMcq === true;
  const needsOptions = type === 'choose' || (asMcq && type !== 'tf');

  return {
    ...draft,
    type,
    options: needsOptions ? (draft.options ?? emptyOptions()) : null,
    answer: type === 'tf' ? (draft.answer === 'خطأ' ? 'خطأ' : 'صح') : isAnswerable && wasAnswerable ? draft.answer : '',
    altAnswers: isAnswerable && wasAnswerable ? draft.altAnswers : [],
    rubric: isEssayType(type) && !asMcq ? draft.rubric : [],
  };
}

/**
 * تفعيل/إلغاء وضع "كل الأسئلة اختيار من متعدد" لسؤال واحد.
 * عند التفعيل: يبقى نوع السؤال الأصلي (بم تفسر، من هو؟ ...) لكن الطالب يختار من خيارات.
 * صح/خطأ يظل اختيارين فقط (صح / خطأ) ولا يحتاج خيارات.
 */
export function applyMcqToDraft(draft: QuestionDraft, enabled: boolean): QuestionDraft {
  if (draft.type === 'tf') {
    return { ...draft, options: null, asMcq: undefined };
  }
  if (draft.type === 'choose') {
    return { ...draft, asMcq: undefined };
  }

  if (!enabled) {
    // عند الإلغاء يرجع الطالب يكتب بنفسه، ونحتفظ بنص الإجابة النموذجية
    const answerText =
      draft.options && /^[a-f]$/.test(draft.answer)
        ? (draft.options[draft.answer] ?? '')
        : draft.answer;
    return {
      ...draft,
      asMcq: undefined,
      answer: answerText,
      options: null,
      rubric: isEssayType(draft.type) ? draft.rubric : [],
    };
  }

  const options = { ...(draft.options ?? emptyOptions()) };
  const answerKeyValid = /^[a-f]$/.test(draft.answer) && (options[draft.answer] ?? '').trim() !== '';

  if (!answerKeyValid) {
    const text = draft.answer.trim();
    if (text !== '' && !OPTION_KEYS.some((key) => (options[key] ?? '').trim() === text)) {
      options.a = text;
    }
  }

  const answer = answerKeyValid ? draft.answer : (options.a ?? '').trim() !== '' ? 'a' : '';

  return {
    ...draft,
    asMcq: true,
    options,
    answer,
    rubric: [],
  };
}

/** تحويل قائمة أسئلة كاملة إلى وضع الاختيار من متعدد أو إلغاؤه. */
export function applyMcqToQuestions(questions: QuestionDraft[], enabled: boolean): QuestionDraft[] {
  return questions.map((draft) => applyMcqToDraft(draft, enabled));
}

/** هل السؤال يُعرض للطالب كاختيار من متعدد؟ */
export function isChoiceQuestion(draft: Pick<QuestionDraft, 'type' | 'asMcq' | 'options'>): boolean {
  if (draft.type === 'tf') return false;
  if (draft.type === 'choose') return true;
  return draft.asMcq === true && !!draft.options;
}

export function getFilledOptionKeys(draft: QuestionDraft): string[] {
  if (!draft.options) return [];
  const options = draft.options;
  return OPTION_KEYS.filter((key) => (options[key] ?? '').trim() !== '');
}

export function cleanRubric(rubric: RubricItem[]): RubricItem[] {
  return rubric
    .filter((item) => item.concept.trim() !== '')
    .map((item) => ({
      concept: item.concept.trim(),
      weight: Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 1,
    }));
}

// يرجع نص الخطأ، أو نصًا فارغًا لو المسودة سليمة.
export function validateDraft(draft: QuestionDraft, isDraftMode: boolean = false): string {
  if (draft.text.trim() === '') return 'اكتب نص السؤال.';
  if (!Number.isFinite(draft.points) || draft.points <= 0) return 'اكتب درجة صحيحة للسؤال.';

  if (isChoiceQuestion(draft)) {
    const keys = getFilledOptionKeys(draft);
    if (keys.length < 2) return 'اكتب خيارين على الأقل.';
    if (!isDraftMode && !draft.needsReview && !keys.includes(draft.answer)) {
      return 'اختر الإجابة الصحيحة من الخيارات المكتوبة.';
    }
    return '';
  }

  if (draft.type === 'tf') {
    if (!isDraftMode && !draft.needsReview && draft.answer !== 'صح' && draft.answer !== 'خطأ') {
      return 'اختر الإجابة الصحيحة (صح أو خطأ).';
    }
    return '';
  }

  if (isEssayType(draft.type)) {
    if (!isDraftMode && !draft.needsReview && draft.answer.trim() === '') {
      return 'اكتب الإجابة النموذجية.';
    }
    return '';
  }

  if (!isDraftMode && !draft.needsReview && draft.answer.trim() === '') {
    return 'اكتب الإجابة النموذجية.';
  }
  return '';
}

export function toPublicQuestion(draft: QuestionDraft): PublicQuestion {
  const base: PublicQuestion = {
    id: draft.id,
    type: draft.type,
    text: draft.text.trim(),
    points: draft.points,
  };

  if (draft.type === 'choose' && draft.options) {
    return { ...base, options: filledOptions(draft.options) };
  }

  if (draft.asMcq === true && draft.options) {
    return { ...base, options: filledOptions(draft.options), asMcq: true };
  }

  return base;
}

function filledOptions(options: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  OPTION_KEYS.forEach((key) => {
    const text = (options[key] ?? '').trim();
    if (text !== '') result[key] = text;
  });
  return result;
}

export function toKeyEntry(draft: QuestionDraft): KeyEntry {
  return {
    id: draft.id,
    answer: draft.answer.trim(),
    altAnswers: draft.altAnswers.map((item) => item.trim()).filter((item) => item !== ''),
    rubric: isEssayType(draft.type) && !isChoiceQuestion(draft) ? cleanRubric(draft.rubric) : [],
  };
}

export function parseRubric(value: unknown): RubricItem[] {
  if (!Array.isArray(value)) return [];

  const items: RubricItem[] = [];
  value.forEach((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return;

    const record = entry as Record<string, unknown>;
    const concept = typeof record.concept === 'string' ? record.concept : '';
    const weight = typeof record.weight === 'number' && record.weight > 0 ? record.weight : 1;
    if (concept.trim() !== '') items.push({ concept, weight });
  });
  return items;
}

// من سؤال مقروء (Question) إلى مسودة قابلة للتعديل.
export function draftFromQuestion(question: Question): QuestionDraft {
  const needsOptions = question.type === 'choose' || (question.asMcq === true && question.type !== 'tf');
  return {
    id: question.id,
    type: question.type,
    text: question.text,
    points: question.points,
    options: needsOptions
      ? {
          a: question.options?.a ?? '',
          b: question.options?.b ?? '',
          c: question.options?.c ?? '',
          d: question.options?.d ?? '',
          ...(question.options?.e ? { e: question.options.e } : {}),
          ...(question.options?.f ? { f: question.options.f } : {}),
        }
      : null,
    answer: question.answer ?? '',
    altAnswers: [...question.altAnswers],
    rubric: [],
    asMcq: question.asMcq === true && question.type !== 'choose' && question.type !== 'tf' ? true : undefined,
  };
}

// نسخة من المسودة برقم جديد (عند إضافة سؤال من البنك إلى امتحان).
export function cloneDraft(draft: QuestionDraft): QuestionDraft {
  return {
    ...draft,
    id: newQuestionId(),
    options: draft.options ? { ...draft.options } : null,
    altAnswers: [...draft.altAnswers],
    rubric: draft.rubric.map((item) => ({ ...item })),
  };
}

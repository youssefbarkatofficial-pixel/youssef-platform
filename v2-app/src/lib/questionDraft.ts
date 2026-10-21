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
}

// الجزء الذي يراه الطالب (بدون answer وaltAnswers وrubric).
export interface PublicQuestion {
  id: string;
  type: QuestionType;
  text: string;
  points: number;
  options?: Record<string, string>;
}

// الجزء المغلق (للأدمن والسيرفر فقط).
export interface KeyEntry {
  id: string;
  answer: string;
  altAnswers: string[];
  rubric: RubricItem[];
}

export const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

export const QUESTION_TYPES: QuestionType[] = [
  'choose',
  'multi_select',
  'tf',
  'fill',
  'short',
  'explain',
  'result',
  'prove',
  'relation',
  'whatif',
  'meaning',
];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  choose: 'اختيار من متعدد',
  multi_select: 'اختيار متعدد الإجابات',
  tf: 'صح أو خطأ',
  fill: 'أكمل الفراغ',
  short: 'إجابة قصيرة',
  explain: 'اشرح / بم تفسر',
  result: 'ما النتائج المترتبة',
  prove: 'دلل / أثبت',
  relation: 'ما العلاقة بين',
  whatif: 'ماذا يحدث إذا',
  meaning: 'ما المقصود بـ',
};

export function isEssayType(type: QuestionType): boolean {
  return type !== 'choose' && type !== 'multi_select' && type !== 'tf' && type !== 'fill' && type !== 'short';
}

export function newQuestionId(): string {
  return `q_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function emptyOptions(): Record<string, string> {
  return { a: '', b: '', c: '', d: '' };
}

export function createEmptyDraft(type: QuestionType = 'choose'): QuestionDraft {
  return {
    id: newQuestionId(),
    type,
    text: '',
    points: 1,
    options: type === 'choose' ? emptyOptions() : null,
    answer: type === 'tf' ? 'صح' : '',
    altAnswers: [],
    rubric: [],
  };
}

// تغيير نوع السؤال مع ضبط الحقول المناسبة للنوع الجديد.
export function changeDraftType(draft: QuestionDraft, type: QuestionType): QuestionDraft {
  const wasEssay = isEssayType(draft.type);
  const isEssay = isEssayType(type);

  return {
    ...draft,
    type,
    options: type === 'choose' ? (draft.options ?? emptyOptions()) : null,
    answer: type === 'tf' ? 'صح' : isEssay && wasEssay ? draft.answer : '',
    altAnswers: isEssay && wasEssay ? draft.altAnswers : [],
    rubric: isEssay ? draft.rubric : [],
  };
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

  if (draft.type === 'choose') {
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
    const options: Record<string, string> = {};
    getFilledOptionKeys(draft).forEach((key) => {
      options[key] = (draft.options?.[key] ?? '').trim();
    });
    return { ...base, options };
  }

  return base;
}

export function toKeyEntry(draft: QuestionDraft): KeyEntry {
  return {
    id: draft.id,
    answer: draft.answer.trim(),
    altAnswers: draft.altAnswers.map((item) => item.trim()).filter((item) => item !== ''),
    rubric: isEssayType(draft.type) ? cleanRubric(draft.rubric) : [],
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
  return {
    id: question.id,
    type: question.type,
    text: question.text,
    points: question.points,
    options:
      question.type === 'choose'
        ? {
            a: question.options?.a ?? '',
            b: question.options?.b ?? '',
            c: question.options?.c ?? '',
            d: question.options?.d ?? '',
          }
        : null,
    answer: question.answer ?? '',
    altAnswers: [...question.altAnswers],
    rubric: [],
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

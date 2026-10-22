import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { CheckCircle2, ListChecks, Plus, Trash2 } from 'lucide-react';
import { Button, Input, Select } from '../ui';
import { cn } from '../ui/cn';
import { GRADE_OPTIONS, isGradeCode } from '../../lib/grades';
import type { QuestionType } from '../../lib/grading';
import { toEnglishDigits } from '../../lib/phone';
import {
  OPTION_KEYS,
  QUESTION_FORMATS,
  QUESTION_TYPE_LABELS,
  applyMcqToDraft,
  changeDraftType,
  createEmptyDraft,
  isChoiceQuestion,
  isQuestionType,
  validateDraft,
} from '../../lib/questionDraft';
import type { QuestionDraft } from '../../lib/questionDraft';
import type { BankMeta } from '../../services/questionBank';

interface QuestionFormProps {
  initial?: QuestionDraft | null;
  // إظهار حقلَي الصف والموضوع (عند التعامل مع بنك الأسئلة)
  showBankMeta?: boolean;
  initialMeta?: BankMeta;
  submitLabel: string;
  submitting?: boolean;
  // عنصر إضافي قبل زر الحفظ (مثل خيار «احفظه في البنك»)
  extra?: ReactNode;
  onSubmit: (draft: QuestionDraft, meta: BankMeta) => Promise<void> | void;
  onCancel?: () => void;
}

const OPTION_LABELS: Record<string, string> = { a: 'أ', b: 'ب', c: 'ج', d: 'د', e: 'هـ', f: 'و' };

const GRADE_FILTER_OPTIONS = [{ value: '', label: 'بدون صف محدد' }, ...GRADE_OPTIONS];

const textareaClass =
  'w-full rounded-xl border border-navy-700 bg-navy-900 px-3 py-2.5 text-white placeholder:text-slate-500 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40';

function numberText(value: string): string {
  return toEnglishDigits(value).replace(/[^0-9.]/g, '');
}

function findType(value: string): QuestionType | null {
  return isQuestionType(value) ? value : null;
}

export default function QuestionForm({
  initial = null,
  showBankMeta = false,
  initialMeta,
  submitLabel,
  submitting = false,
  extra,
  onSubmit,
  onCancel,
}: QuestionFormProps) {
  const [draft, setDraft] = useState<QuestionDraft>(initial ?? createEmptyDraft('choose'));
  const [pointsText, setPointsText] = useState(String(initial?.points ?? 1));
  const [grade, setGrade] = useState<string>(initialMeta?.grade ?? '');
  const [topic, setTopic] = useState(initialMeta?.topic ?? '');
  const [error, setError] = useState('');
  const [optionCount, setOptionCount] = useState<number>(() => {
    if (!initial?.options) return 4;
    const filled = Object.entries(initial.options).filter(([, value]) => (value ?? '').trim() !== '');
    return Math.max(2, Math.min(6, filled.length || 4));
  });

  const update = (patch: Partial<QuestionDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setError('');
  };

  const setOption = (key: string, value: string) => {
    update({ options: { ...(draft.options ?? {}), [key]: value } });
  };

  const setRubric = (index: number, patch: Partial<{ concept: string; weight: number }>) => {
    update({
      rubric: draft.rubric.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const candidate: QuestionDraft = { ...draft, points: Number(pointsText) };
    const message = validateDraft(candidate);
    if (message) {
      setError(message);
      return;
    }

    setError('');
    await onSubmit(candidate, { grade: isGradeCode(grade) ? grade : '', topic });
  };

  // صيغ الأسئلة المعتمدة فقط (+ النوع الحالي لو كان نوعًا قديمًا محفوظًا في بيانات سابقة)
  const typeOptions = [
    ...QUESTION_FORMATS.map((type) => ({ value: type, label: QUESTION_TYPE_LABELS[type] })),
    ...(QUESTION_FORMATS.includes(draft.type)
      ? []
      : [{ value: draft.type, label: QUESTION_TYPE_LABELS[draft.type] || draft.type }]),
  ];

  const choiceQuestion = isChoiceQuestion(draft);
  const isTf = draft.type === 'tf';
  const essay = !choiceQuestion && !isTf && !['fill', 'correct', 'term', 'who', 'short'].includes(draft.type);
  const canToggleMcq = draft.type !== 'choose' && !isTf;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Select
            label="نوع السؤال (صيغة السؤال)"
            options={typeOptions}
            value={draft.type}
            onChange={(event) => {
              const type = findType(event.target.value);
              if (type) {
                setDraft((previous) => changeDraftType(previous, type));
                setError('');
              }
            }}
          />
        </div>
        <Input
          label="الدرجة"
          dir="ltr"
          inputMode="decimal"
          value={pointsText}
          onChange={(event) => {
            setPointsText(numberText(event.target.value));
            setError('');
          }}
        />
      </div>

      {canToggleMcq && (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition-all',
            draft.asMcq
              ? 'border-emerald-500/50 bg-emerald-950/30 ring-1 ring-emerald-500/20'
              : 'border-navy-700 bg-navy-950/60'
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-xl border mt-0.5',
                draft.asMcq
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                  : 'border-navy-600 bg-navy-900 text-slate-400'
              )}
            >
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">
                نظام الإجابة: تحويل السؤال إلى اختيار من متعدد (MCQ)
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                عند التفعيل، يختار الطالب الإجابة من بين بدائل (أ، ب، ج، د) بدل كتابتها يدوياً، مع الحفاظ على صيغة السؤال ({QUESTION_TYPE_LABELS[draft.type]}).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setDraft((previous) => applyMcqToDraft(previous, !previous.asMcq));
              setError('');
            }}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-sm',
              draft.asMcq
                ? 'bg-emerald-500 text-white hover:bg-emerald-400 ring-2 ring-emerald-400/30'
                : 'bg-navy-800 text-gold-400 hover:bg-navy-700 border border-gold-500/30'
            )}
          >
            {draft.asMcq ? '✓ مفعّل بنظام الاختيار من متعدد' : 'تفعيل الاختيار من متعدد لهذا السؤال'}
          </button>
        </div>
      )}

      <div className="w-full">
        <label htmlFor="question-text" className="mb-1.5 block text-sm font-medium text-slate-300">
          نص السؤال
        </label>
        <textarea
          id="question-text"
          rows={3}
          value={draft.text}
          onChange={(event) => update({ text: event.target.value })}
          className={textareaClass}
        />
      </div>

      {choiceQuestion && (
        <fieldset className="space-y-3">
          <div className="flex items-center justify-between">
            <legend className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              الخيارات ({optionCount} خيارات — اختر الإجابة الصحيحة بالدائرة)
            </legend>
            <div className="flex items-center gap-2">
              {optionCount < 6 && (
                <button
                  type="button"
                  onClick={() => setOptionCount((count) => Math.min(6, count + 1))}
                  className="rounded-lg bg-navy-800 px-2.5 py-1 text-xs font-bold text-gold-400 hover:bg-navy-700"
                >
                  + إضافة خيار
                </button>
              )}
              {optionCount > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const removeKey = OPTION_KEYS[optionCount - 1];
                    setOptionCount((count) => Math.max(2, count - 1));
                    if (draft.options) {
                      const next = { ...draft.options };
                      delete next[removeKey];
                      update({ options: next, answer: draft.answer === removeKey ? 'a' : draft.answer });
                    }
                  }}
                  className="rounded-lg bg-navy-800 px-2.5 py-1 text-xs font-bold text-rose-400 hover:bg-navy-700"
                >
                  - حذف خيار
                </button>
              )}
            </div>
          </div>
          {OPTION_KEYS.slice(0, optionCount).map((key) => (
            <div key={key} className="flex items-end gap-3">
              <label
                className={cn(
                  'mb-0.5 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border',
                  draft.answer === key
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-navy-700 bg-navy-900 text-slate-400',
                )}
              >
                <input
                  type="radio"
                  name="correct-option"
                  checked={draft.answer === key}
                  onChange={() => update({ answer: key })}
                  className="sr-only"
                  aria-label={`الإجابة الصحيحة هي الخيار ${OPTION_LABELS[key]}`}
                />
                <span className="font-bold">{OPTION_LABELS[key]}</span>
              </label>
              <div className="flex-1">
                <Input
                  aria-label={`الخيار ${OPTION_LABELS[key]}`}
                  value={draft.options?.[key] ?? ''}
                  onChange={(event) => setOption(key, event.target.value)}
                />
              </div>
            </div>
          ))}
        </fieldset>
      )}

      {isTf && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-slate-300">الإجابة الصحيحة</legend>
          <div className="grid grid-cols-2 gap-3">
            {['صح', 'خطأ'].map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => update({ answer: choice })}
                className={cn(
                  'rounded-xl border px-4 py-3 font-bold transition-colors',
                  draft.answer === choice
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-navy-700 bg-navy-900 text-slate-300 hover:border-navy-500',
                )}
              >
                {choice}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {!choiceQuestion && !isTf && !essay && (
        <div className="w-full">
          <label htmlFor="question-answer-short" className="mb-1.5 block text-sm font-medium text-slate-300">
            الإجابة النموذجية
          </label>
          <Input
            id="question-answer-short"
            value={draft.answer}
            placeholder="اكتب الإجابة الصحيحة كما يكتبها الطالب..."
            onChange={(event) => update({ answer: event.target.value })}
          />
          <p className="mt-1.5 text-sm text-slate-500">تُصحح آليًا بعد تطبيع الهمزات والتشكيل والمسافات.</p>
        </div>
      )}

      {essay && (
        <div className="space-y-4">
          <div className="w-full">
            <label htmlFor="question-answer" className="mb-1.5 block text-sm font-medium text-slate-300">
              الإجابة النموذجية
            </label>
            <textarea
              id="question-answer"
              rows={4}
              value={draft.answer}
              onChange={(event) => update({ answer: event.target.value })}
              className={textareaClass}
            />
            <p className="mt-1.5 text-sm text-slate-500">
              الأسئلة المقالية لا تُصحح آليًا الآن، وتظهر للمراجعة.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">بنود التقييم (اختياري)</p>
            {draft.rubric.map((item, index) => (
              <div key={index} className="flex items-end gap-3">
                <div className="flex-1">
                  <Input
                    aria-label="بند التقييم"
                    placeholder="المفهوم المطلوب في الإجابة"
                    value={item.concept}
                    onChange={(event) => setRubric(index, { concept: event.target.value })}
                  />
                </div>
                <div className="w-20">
                  <Input
                    aria-label="وزن البند"
                    dir="ltr"
                    inputMode="decimal"
                    value={String(item.weight)}
                    onChange={(event) =>
                      setRubric(index, { weight: Number(numberText(event.target.value)) || 0 })
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="حذف البند"
                  onClick={() =>
                    update({ rubric: draft.rubric.filter((_, position) => position !== index) })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => update({ rubric: [...draft.rubric, { concept: '', weight: 1 }] })}
            >
              <Plus className="h-4 w-4" />
              إضافة بند
            </Button>
          </div>
        </div>
      )}

      {showBankMeta && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="الصف (اختياري)"
            options={GRADE_FILTER_OPTIONS}
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
          />
          <Input
            label="الموضوع أو الدرس (اختياري)"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          />
        </div>
      )}

      {extra}

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            إلغاء
          </Button>
        )}
      </div>
    </form>
  );
}

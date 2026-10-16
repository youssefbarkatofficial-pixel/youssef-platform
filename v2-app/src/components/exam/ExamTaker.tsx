import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, ShieldAlert } from 'lucide-react';
import { Badge, Button, Card } from '../ui';
import { cn } from '../ui/cn';
import { getAnswerMode } from '../../lib/grading';
import type { Question } from '../../lib/grading';

interface ExamTakerProps {
  questions: Question[];
  // بالثواني، 0 = وقت مفتوح
  durationSeconds: number;
  // وضع منع الغش: الخروج من الصفحة يسلّم الإجابات تلقائيًا
  strict: boolean;
  // معاينة الأدمن: بدون تسليم تلقائي عند الخروج
  previewMode: boolean;
  submitting: boolean;
  // يرجع true عند نجاح التسليم، وfalse عند الفشل (ليتمكن الطالب من المحاولة مرة أخرى)
  onSubmit: (answers: Record<string, string>, autoSubmit: boolean) => Promise<boolean>;
}

const OPTION_LABELS: Record<string, string> = { a: 'أ', b: 'ب', c: 'ج', d: 'د' };

const textareaClass =
  'w-full rounded-xl border border-navy-700 bg-navy-900 px-3 py-2.5 text-white placeholder:text-slate-500 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40';

function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export default function ExamTaker({
  questions,
  durationSeconds,
  strict,
  previewMode,
  submitting,
  onSubmit,
}: ExamTakerProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(
    durationSeconds > 0 ? durationSeconds : null,
  );
  const [leftPage, setLeftPage] = useState(false);

  const answersRef = useRef<Record<string, string>>({});
  const submittedRef = useRef(false);
  const onSubmitRef = useRef(onSubmit);
  const endAtRef = useRef(Date.now() + durationSeconds * 1000);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  });

  const triggerSubmit = useCallback(async (auto: boolean) => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const ok = await onSubmitRef.current(answersRef.current, auto);
    if (!ok) submittedRef.current = false;
  }, []);

  // المؤقت: عند انتهاء الوقت يُسلَّم الاختبار تلقائيًا.
  useEffect(() => {
    if (durationSeconds <= 0) return;

    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);

      if (left <= 0) {
        window.clearInterval(timer);
        void triggerSubmit(true);
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [durationSeconds, triggerSubmit]);

  // ترك الصفحة: تسليم تلقائي في وضع منع الغش، وتنبيه فقط في الوضع العادي.
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) return;

      if (strict && !previewMode) {
        void triggerSubmit(true);
      } else {
        setLeftPage(true);
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [strict, previewMode, triggerSubmit]);

  const setAnswer = (questionId: string, value: string) => {
    const next = { ...answersRef.current, [questionId]: value };
    answersRef.current = next;
    setAnswers(next);
  };

  const handleFinish = () => {
    const unanswered = questions.filter(
      (question) => (answersRef.current[question.id] ?? '').trim() === '',
    ).length;

    if (unanswered > 0 && !window.confirm(`لم تجب عن ${unanswered} سؤال. هل تريد التسليم؟`)) {
      return;
    }

    void triggerSubmit(false);
  };

  const question = questions[index];
  const mode = getAnswerMode(question);
  const value = answers[question.id] ?? '';
  const lowTime = remaining !== null && remaining <= 60;

  let input;
  if (mode === 'choice' && question.options) {
    input = (
      <div className="space-y-2.5">
        {Object.keys(question.options).map((key) => {
          const selected = value.trim().toLowerCase() === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setAnswer(question.id, key)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-start transition-colors',
                selected
                  ? 'border-gold-500 bg-gold-500/15 text-white'
                  : 'border-navy-700 bg-navy-900 text-slate-200 hover:border-navy-500',
              )}
            >
              <span
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold',
                  selected ? 'bg-gold-500 text-navy-950' : 'bg-navy-800 text-slate-300',
                )}
              >
                {OPTION_LABELS[key] ?? key}
              </span>
              <span className="flex-1 leading-relaxed">{question.options?.[key]}</span>
            </button>
          );
        })}
      </div>
    );
  } else if (mode === 'tf') {
    input = (
      <div className="grid grid-cols-2 gap-3">
        {['صح', 'خطأ'].map((choice) => {
          const selected = value === choice;
          return (
            <button
              key={choice}
              type="button"
              onClick={() => setAnswer(question.id, choice)}
              className={cn(
                'rounded-xl border px-4 py-4 text-lg font-bold transition-colors',
                selected
                  ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                  : 'border-navy-700 bg-navy-900 text-slate-200 hover:border-navy-500',
              )}
            >
              {choice}
            </button>
          );
        })}
      </div>
    );
  } else {
    input = (
      <textarea
        rows={6}
        value={value}
        placeholder="اكتب إجابتك هنا..."
        onChange={(event) => setAnswer(question.id, event.target.value)}
        className={textareaClass}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white">
            السؤال {index + 1} من {questions.length}
          </span>
          {previewMode && <Badge variant="info">معاينة الأدمن</Badge>}
        </div>

        {remaining !== null && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-1.5 font-bold',
              lowTime ? 'bg-red-500/15 text-red-300' : 'bg-navy-800 text-gold-400',
            )}
          >
            <Clock className="h-5 w-5" />
            <span dir="ltr">{formatClock(remaining)}</span>
          </div>
        )}
      </Card>

      {strict && !previewMode && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-300">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          وضع منع الغش مفعّل: الخروج من هذه الصفحة أو تغيير التبويب يسلّم إجاباتك تلقائيًا.
        </div>
      )}

      {leftPage && !strict && (
        <div className="flex items-start gap-2.5 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3.5 py-3 text-sm text-gold-200">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          غادرت هذه الصفحة أثناء الاختبار. من فضلك ابقَ في الصفحة حتى تنتهي.
        </div>
      )}

      <Card className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="whitespace-pre-line text-lg font-bold leading-relaxed text-white">
            {question.text || 'سؤال بدون نص'}
          </h2>
          <Badge variant="neutral">{question.points} درجة</Badge>
        </div>

        {input}

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            variant="secondary"
            disabled={index === 0}
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
          >
            <ChevronRight className="h-5 w-5" />
            السابق
          </Button>
          <Button
            variant="secondary"
            disabled={index === questions.length - 1}
            onClick={() => setIndex((current) => Math.min(questions.length - 1, current + 1))}
          >
            التالي
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
      </Card>

      <Card className="space-y-4">
        <p className="text-sm font-bold text-slate-300">الأسئلة</p>
        <div className="flex flex-wrap gap-2">
          {questions.map((item, position) => {
            const answered = (answers[item.id] ?? '').trim() !== '';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(position)}
                aria-label={`السؤال ${position + 1}`}
                className={cn(
                  'h-9 w-9 rounded-lg text-sm font-bold transition-colors',
                  position === index
                    ? 'bg-gold-500 text-navy-950'
                    : answered
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-navy-800 text-slate-300 hover:bg-navy-700',
                )}
              >
                {position + 1}
              </button>
            );
          })}
        </div>

        <Button size="lg" fullWidth loading={submitting} onClick={handleFinish}>
          إنهاء وتسليم
        </Button>
      </Card>
    </div>
  );
}

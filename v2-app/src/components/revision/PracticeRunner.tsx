import { useMemo, useRef, useState } from 'react';
import type { AnswerEvent, Plan } from '../../lib/revision/index';

export interface PracticeQuestion {
  id: string;
  skillId: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

interface Props {
  plan: Plan;
  getQuestion: (id: string) => PracticeQuestion | undefined;
  /** يُستدعى فور كل إجابة، احفظ الحدث (مثلًا عبر createLocalStore().append). */
  onAnswer: (event: AnswerEvent) => void;
  onFinish: (result: { correct: number; total: number }) => void;
}

export default function PracticeRunner({ plan, getQuestion, onAnswer, onFinish }: Props) {
  const questions = useMemo(
    () => plan.items.map((i) => getQuestion(i.questionId)).filter((q): q is PracticeQuestion => !!q),
    [plan, getQuestion],
  );
  const missing = plan.items.length - questions.length;

  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const shownAt = useRef(Date.now());

  if (questions.length === 0) {
    return (
      <p className="rounded-3xl bg-theme-surface p-6 text-theme-text shadow-soft">
        الأسئلة المختارة غير متاحة حاليًا. جرّب مرة أخرى بعد قليل.
      </p>
    );
  }

  if (done) {
    return (
      <div className="rounded-3xl bg-theme-surface p-6 text-center shadow-soft">
        <h2 className="text-lg font-bold text-theme-text">انتهت جلسة المراجعة</h2>
        <p className="mt-2 font-num text-3xl font-extrabold text-theme-gold">
          {correct} / {questions.length}
        </p>
      </div>
    );
  }

  const q = questions[idx];
  const answered = chosen !== null;

  const emit = (outcome: AnswerEvent['outcome']) =>
    onAnswer({
      questionId: q.id,
      skillId: q.skillId,
      outcome,
      at: Date.now(),
      timeMs: Date.now() - shownAt.current,
      source: 'practice',
    });

  const choose = (i: number) => {
    if (answered) return;
    const ok = i === q.correctIndex;
    setChosen(i);
    if (ok) setCorrect((c) => c + 1);
    emit(ok ? 'correct' : 'wrong');
  };

  const next = (skipped: boolean) => {
    if (skipped) emit('skipped');
    if (idx + 1 >= questions.length) {
      setDone(true);
      onFinish({ correct, total: questions.length });
      return;
    }
    setIdx(idx + 1);
    setChosen(null);
    shownAt.current = Date.now();
  };

  return (
    <div className="rounded-3xl bg-theme-surface p-6 shadow-soft">
      <p className="text-sm text-theme-text/70">
        سؤال {idx + 1} من {questions.length}
      </p>
      {missing > 0 && (
        <p className="mt-1 text-xs text-theme-text/60">تعذّر تحميل {missing} سؤالًا من الجلسة.</p>
      )}
      <h2 className="mt-3 text-lg font-bold leading-relaxed text-theme-text">{q.text}</h2>

      <div className="mt-4 space-y-3">
        {q.options.map((opt, i) => {
          const isRight = answered && i === q.correctIndex;
          const isWrong = answered && i === chosen && i !== q.correctIndex;
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={answered}
              className={`min-h-[44px] w-full rounded-2xl border px-4 py-3 text-start text-theme-text ${
                isRight
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : isWrong
                    ? 'border-rose-400 bg-rose-400/10'
                    : 'border-black/10'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="mt-4 text-sm text-theme-text/80">
        {answered && (
          <>
            <p className="font-bold">{chosen === q.correctIndex ? 'إجابة صحيحة' : 'إجابة غير صحيحة'}</p>
            {q.explanation && <p className="mt-1">{q.explanation}</p>}
          </>
        )}
      </div>

      <div className="mt-5 flex gap-3">
        {answered ? (
          <button
            type="button"
            onClick={() => next(false)}
            className="min-h-[44px] rounded-2xl bg-theme-gold px-6 font-bold text-black"
          >
            {idx + 1 >= questions.length ? 'إنهاء' : 'السؤال التالي'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => next(true)}
            className="min-h-[44px] rounded-2xl border border-black/10 px-6 text-theme-text"
          >
            تخطّي
          </button>
        )}
      </div>
    </div>
  );
}

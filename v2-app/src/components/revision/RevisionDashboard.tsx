import { useMemo } from 'react';
import { buildPlan, computeMastery, predictScore, weeklySummary } from '../../lib/revision/index';
import type { AnswerEvent, Plan, QuestionMeta, SkillMastery } from '../../lib/revision/index';

export interface SkillInfo {
  id: string;
  /** اسم المهارة كما يراه الطالب، مثل عنوان الدرس. */
  name: string;
  /** وزن المهارة في الامتحان (اختياري، الافتراضي 1). */
  weight?: number;
}

interface Props {
  skills: SkillInfo[];
  questions: QuestionMeta[];
  events: AnswerEvent[];
  onStart: (plan: Plan) => void;
  now?: number;
}

const STATUS_LABEL: Record<SkillMastery['status'], string> = {
  unknown: 'لم تبدأ',
  weak: 'تحتاج مراجعة',
  learning: 'قيد التعلّم',
  strong: 'متمكّن',
};

const STATUS_BAR: Record<SkillMastery['status'], string> = {
  unknown: 'bg-slate-300',
  weak: 'bg-rose-400',
  learning: 'bg-amber-400',
  strong: 'bg-emerald-500',
};

const pct = (x: number) => Math.round(x * 100);

export default function RevisionDashboard({ skills, questions, events, onStart, now }: Props) {
  const t = useMemo(() => now ?? Date.now(), [now, events]);
  const mastery = useMemo(() => computeMastery(events, t), [events, t]);
  const plan = useMemo(() => buildPlan(questions, events, t), [questions, events, t]);
  const names = useMemo(() => Object.fromEntries(skills.map((s) => [s.id, s.name])), [skills]);
  const prediction = useMemo(
    () => predictScore(skills.map((s) => ({ skillId: s.id, weight: s.weight ?? 1 })), mastery),
    [skills, mastery],
  );
  const week = useMemo(() => weeklySummary(events, names, t), [events, names, t]);

  const hasEstimate = prediction.coverage >= 0.3;

  return (
    <div className="space-y-5">
      <section
        aria-labelledby="rev-estimate"
        className="rounded-3xl bg-theme-surface p-6 shadow-soft"
      >
        <h2 id="rev-estimate" className="text-lg font-bold text-theme-text">
          مستواك الحالي
        </h2>
        {hasEstimate ? (
          <>
            <p className="mt-2 font-num text-4xl font-extrabold text-theme-gold">
              {pct(prediction.expected)}%
            </p>
            <p className="mt-1 text-sm text-theme-text/70">
              تقدير مبني على إجاباتك، يتراوح غالبًا بين {pct(prediction.low)}% و{pct(prediction.high)}%.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-theme-text/70">
            أجب عن عدة أسئلة وسنقدّر مستواك في كل درس.
          </p>
        )}
        {week.answered > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-theme-text/80">
            {week.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="rev-today" className="rounded-3xl bg-theme-surface p-6 shadow-soft">
        <h2 id="rev-today" className="text-lg font-bold text-theme-text">
          مراجعة اليوم
        </h2>
        {plan.items.length > 0 ? (
          <>
            <p className="mt-2 text-sm text-theme-text/70">
              {plan.items.length} أسئلة مختارة لك
              {plan.dueCount > 0 ? `، منها ${Math.min(plan.dueCount, plan.items.length)} حان وقت مراجعتها` : ''}.
            </p>
            <button
              type="button"
              onClick={() => onStart(plan)}
              className="mt-4 min-h-[44px] rounded-2xl bg-theme-gold px-6 font-bold text-black motion-reduce:transition-none"
            >
              ابدأ المراجعة
            </button>
          </>
        ) : (
          <p className="mt-2 text-sm text-theme-text/70">
            لا توجد أسئلة تحتاج مراجعة الآن. ارجع لاحقًا أو ابدأ درسًا جديدًا.
          </p>
        )}
      </section>

      <section aria-labelledby="rev-skills" className="rounded-3xl bg-theme-surface p-6 shadow-soft">
        <h2 id="rev-skills" className="text-lg font-bold text-theme-text">
          دروسك
        </h2>
        <ul className="mt-4 space-y-4">
          {skills.map((s) => {
            const m = mastery.get(s.id);
            const status = m ? m.status : 'unknown';
            const value = m ? m.mastery : 0;
            return (
              <li key={s.id}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-theme-text">{s.name}</span>
                  <span className="text-theme-text/70">{STATUS_LABEL[status]}</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={s.name}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={m ? pct(value) : 0}
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10"
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${STATUS_BAR[status]}`}
                    style={{ width: `${m ? pct(value) : 0}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

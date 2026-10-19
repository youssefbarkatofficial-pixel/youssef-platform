import type { AnswerEvent, Plan, PlanItem, PlanOptions, QuestionMeta } from './types.ts';
import { computeMastery, DAY_MS } from './mastery.ts';
import { reviewCards } from './scheduler.ts';

interface Cand extends PlanItem {
  priority: number;
}

function byPriority(a: Cand, b: Cand): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  return a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0;
}

/** يوزّع المهارات بحيث لا تتجاور نفس المهارة إلا عند الضرورة. */
function interleave(list: Cand[]): PlanItem[] {
  const rest = [...list];
  const out: PlanItem[] = [];
  while (rest.length) {
    const last = out.length ? out[out.length - 1].skillId : null;
    let idx = rest.findIndex((c) => c.skillId !== last);
    if (idx === -1) idx = 0;
    const [c] = rest.splice(idx, 1);
    out.push({ questionId: c.questionId, skillId: c.skillId, reason: c.reason });
  }
  return out;
}

/**
 * يبني جلسة مراجعة اليوم: المستحق أولًا، ثم نقاط الضعف، ثم أسئلة جديدة بحد أقصى.
 * حتمي: نفس المدخلات تعطي نفس الجلسة دائمًا.
 */
export function buildPlan(
  questions: QuestionMeta[],
  events: AnswerEvent[],
  now: number,
  opts: PlanOptions = {},
): Plan {
  const size = Math.max(1, opts.size ?? 10);
  const maxNew = Math.max(0, opts.maxNew ?? 3);
  const focus = opts.focusSkillIds && opts.focusSkillIds.length ? new Set(opts.focusSkillIds) : null;

  const cards = reviewCards(events);
  const mastery = computeMastery(events, now);
  const reviews: Cand[] = [];
  const fresh: Cand[] = [];

  for (const q of questions) {
    if (focus && !focus.has(q.skillId)) continue;
    const m = mastery.get(q.skillId);
    const mv = m ? m.mastery : 0.5;
    const card = cards.get(q.id);

    if (!card) {
      fresh.push({ questionId: q.id, skillId: q.skillId, reason: 'new', priority: 0.5 + (1 - mv) * 1.5 });
    } else if (card.dueAt <= now) {
      const overdue = (now - card.dueAt) / DAY_MS;
      reviews.push({
        questionId: q.id,
        skillId: q.skillId,
        reason: 'due',
        priority: 2 + overdue / Math.max(1, card.intervalDays) + (1 - mv) * 2 + card.lapses * 0.3,
      });
    } else if (m && m.status === 'weak' && card.lapses > 0) {
      reviews.push({
        questionId: q.id,
        skillId: q.skillId,
        reason: 'weak',
        priority: 1 + (1 - mv) * 2 + card.lapses * 0.3,
      });
    }
  }

  reviews.sort(byPriority);
  fresh.sort(byPriority);

  const newTarget = Math.min(fresh.length, maxNew, size);
  const reviewTake = Math.min(reviews.length, size - newTarget);
  const extraNew = Math.min(fresh.length - newTarget, Math.max(0, size - reviewTake - newTarget));
  const picked = [...reviews.slice(0, reviewTake), ...fresh.slice(0, newTarget + extraNew)].sort(byPriority);

  return {
    items: interleave(picked),
    dueCount: reviews.filter((r) => r.reason === 'due').length,
    weakCount: reviews.filter((r) => r.reason === 'weak').length,
    newCount: fresh.length,
  };
}

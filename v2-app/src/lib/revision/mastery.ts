import type { AnswerEvent, SkillMastery } from './types.ts';

export const DAY_MS = 86_400_000;

const PRIOR_A = 2;
const PRIOR_B = 2;
const CONFIDENCE_K = 3;

export interface MasteryOptions {
  /** نصف عمر الدليل بالأيام: الإجابة القديمة يقلّ وزنها تدريجيًا. */
  halfLifeDays?: number;
}

export function eventWeight(at: number, now: number, halfLifeDays: number): number {
  const ageDays = Math.max(0, (now - at) / DAY_MS);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

export function statusOf(
  attempts: number,
  mastery: number,
  confidence: number,
): SkillMastery['status'] {
  if (attempts === 0) return 'unknown';
  if (confidence >= 0.3 && mastery < 0.5) return 'weak';
  if (confidence >= 0.4 && mastery >= 0.8) return 'strong';
  return 'learning';
}

export function emptyMastery(skillId: string): SkillMastery {
  return {
    skillId,
    mastery: PRIOR_A / (PRIOR_A + PRIOR_B),
    confidence: 0,
    attempts: 0,
    lastAt: null,
    status: 'unknown',
    alpha: PRIOR_A,
    beta: PRIOR_B,
  };
}

/**
 * إتقان كل مهارة بنموذج بيتا بتحيّز أولي محافظ، مع وزن زمني للإجابات.
 * الإجابة "تخطّي" تُحسب كخطأ.
 */
export function computeMastery(
  events: AnswerEvent[],
  now: number,
  opts: MasteryOptions = {},
): Map<string, SkillMastery> {
  const half = opts.halfLifeDays ?? 21;
  const acc = new Map<string, { a: number; b: number; w: number; n: number; last: number }>();

  for (const e of events) {
    if (e.at > now) continue;
    const w = eventWeight(e.at, now, half);
    const cur = acc.get(e.skillId) ?? { a: 0, b: 0, w: 0, n: 0, last: 0 };
    if (e.outcome === 'correct') cur.a += w;
    else cur.b += w;
    cur.w += w;
    cur.n += 1;
    if (e.at > cur.last) cur.last = e.at;
    acc.set(e.skillId, cur);
  }

  const out = new Map<string, SkillMastery>();
  for (const [skillId, v] of acc) {
    const alpha = PRIOR_A + v.a;
    const beta = PRIOR_B + v.b;
    const mastery = alpha / (alpha + beta);
    const confidence = v.w / (v.w + CONFIDENCE_K);
    out.set(skillId, {
      skillId,
      mastery,
      confidence,
      attempts: v.n,
      lastAt: v.last,
      status: statusOf(v.n, mastery, confidence),
      alpha,
      beta,
    });
  }
  return out;
}

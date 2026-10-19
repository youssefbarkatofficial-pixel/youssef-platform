import type { SkillMastery } from './types.ts';
import { emptyMastery } from './mastery.ts';

export interface SkillWeight {
  skillId: string;
  weight: number;
}

export interface Prediction {
  expected: number;
  low: number;
  high: number;
  /** نسبة وزن المهارات التي لها بيانات فعلية (0..1). */
  coverage: number;
}

/**
 * تقدير الدرجة المتوقعة (0..1) مع نطاق ثقة تقريبي 90%
 * من التوزيع اللاحق لكل مهارة، بافتراض استقلال المهارات.
 */
export function predictScore(
  weights: SkillWeight[],
  masteries: Map<string, SkillMastery>,
): Prediction {
  let total = 0;
  let mean = 0;
  let variance = 0;
  let covered = 0;

  for (const { skillId, weight } of weights) {
    if (!(weight > 0)) continue;
    const m = masteries.get(skillId) ?? emptyMastery(skillId);
    const n = m.alpha + m.beta;
    const mu = m.alpha / n;
    const v = (m.alpha * m.beta) / (n * n * (n + 1));
    total += weight;
    mean += weight * mu;
    variance += weight * weight * v;
    if (m.attempts > 0) covered += weight;
  }

  if (total === 0) return { expected: 0.5, low: 0, high: 1, coverage: 0 };
  const expected = mean / total;
  const sd = Math.sqrt(variance) / total;
  return {
    expected,
    low: Math.max(0, expected - 1.64 * sd),
    high: Math.min(1, expected + 1.64 * sd),
    coverage: covered / total,
  };
}

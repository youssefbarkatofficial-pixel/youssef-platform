import type { AnswerEvent, CardState } from './types.ts';
import { DAY_MS } from './mastery.ts';

const MAX_INTERVAL_DAYS = 180;

/** جودة الإجابة على مقياس SM-2 (0..5). */
export function qualityOf(e: AnswerEvent): number {
  if (e.outcome !== 'correct') return 1;
  if (e.timeMs !== undefined && e.timeMs < 8000) return 5;
  return 4;
}

/**
 * يعيد تشغيل تاريخ الإجابات ويبني حالة التكرار المتباعد لكل سؤال (SM-2).
 * الحالة مشتقة بالكامل من الأحداث، فلا حاجة لتخزين إضافي ولا لتعديل قواعد Firestore.
 */
export function reviewCards(events: AnswerEvent[]): Map<string, CardState> {
  const sorted = [...events].sort((x, y) => x.at - y.at);
  const cards = new Map<string, CardState>();

  for (const e of sorted) {
    const s: CardState = cards.get(e.questionId) ?? {
      questionId: e.questionId,
      skillId: e.skillId,
      ease: 2.5,
      intervalDays: 0,
      reps: 0,
      lapses: 0,
      dueAt: e.at,
      lastAt: e.at,
      seen: 0,
    };
    const q = qualityOf(e);

    if (q < 3) {
      s.reps = 0;
      s.lapses += 1;
      s.intervalDays = 1;
    } else {
      s.reps += 1;
      s.intervalDays =
        s.reps === 1 ? 1 : s.reps === 2 ? 3 : Math.max(1, Math.round(s.intervalDays * s.ease));
      s.intervalDays = Math.min(MAX_INTERVAL_DAYS, s.intervalDays);
    }
    s.ease = Math.max(1.3, Math.min(3.0, s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))));
    s.dueAt = e.at + s.intervalDays * DAY_MS;
    s.lastAt = e.at;
    s.skillId = e.skillId;
    s.seen += 1;
    cards.set(e.questionId, s);
  }
  return cards;
}

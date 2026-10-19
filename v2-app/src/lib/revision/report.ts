import type { AnswerEvent } from './types.ts';
import { DAY_MS } from './mastery.ts';

export interface WeeklySummary {
  answered: number;
  correct: number;
  accuracy: number | null;
  streakDays: number;
  strongestSkillId: string | null;
  weakestSkillId: string | null;
  lines: string[];
}

function dayKey(at: number, tzOffsetMinutes: number): number {
  return Math.floor((at + tzOffsetMinutes * 60_000) / DAY_MS);
}

export function streakDays(events: AnswerEvent[], now: number, tzOffsetMinutes: number): number {
  const days = new Set(events.filter((e) => e.at <= now).map((e) => dayKey(e.at, tzOffsetMinutes)));
  const today = dayKey(now, tzOffsetMinutes);
  let cursor = days.has(today) ? today : days.has(today - 1) ? today - 1 : null;
  if (cursor === null) return 0;
  let n = 0;
  while (days.has(cursor)) {
    n += 1;
    cursor -= 1;
  }
  return n;
}

/** ملخص أسبوعي (للطالب أو لولي الأمر)، نصوصه عربية بسيطة. */
export function weeklySummary(
  events: AnswerEvent[],
  skillNames: Record<string, string>,
  now: number,
  tzOffsetMinutes: number = -new Date(now).getTimezoneOffset(),
): WeeklySummary {
  const week = events.filter((e) => e.at > now - 7 * DAY_MS && e.at <= now);
  const correct = week.filter((e) => e.outcome === 'correct').length;
  const accuracy = week.length ? correct / week.length : null;
  const streak = streakDays(events, now, tzOffsetMinutes);

  const per = new Map<string, { n: number; c: number }>();
  for (const e of week) {
    const cur = per.get(e.skillId) ?? { n: 0, c: 0 };
    cur.n += 1;
    if (e.outcome === 'correct') cur.c += 1;
    per.set(e.skillId, cur);
  }
  const eligible = [...per.entries()]
    .filter(([, v]) => v.n >= 3)
    .map(([id, v]) => ({ id, acc: v.c / v.n, n: v.n }))
    .sort((a, b) => b.acc - a.acc || b.n - a.n || (a.id < b.id ? -1 : 1));

  const strongest = eligible.length ? eligible[0] : null;
  const weakest =
    eligible.length > 1 && eligible[eligible.length - 1].acc < 0.7 ? eligible[eligible.length - 1] : null;
  const name = (id: string) => skillNames[id] ?? id;

  const lines: string[] = [];
  if (week.length === 0) {
    lines.push('لا يوجد نشاط مراجعة هذا الأسبوع.');
  } else {
    lines.push(`أجاب ${week.length} سؤالًا هذا الأسبوع بنسبة صحة ${Math.round((accuracy ?? 0) * 100)}%.`);
    if (streak >= 2) lines.push(`يراجع بانتظام منذ ${streak} أيام متتالية.`);
    if (strongest) lines.push(`أقوى مهارة: ${name(strongest.id)}.`);
    if (weakest) lines.push(`تحتاج مزيدًا من المراجعة: ${name(weakest.id)}.`);
  }

  return {
    answered: week.length,
    correct,
    accuracy,
    streakDays: streak,
    strongestSkillId: strongest ? strongest.id : null,
    weakestSkillId: weakest ? weakest.id : null,
    lines,
  };
}

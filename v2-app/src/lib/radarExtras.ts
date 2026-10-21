// غير مختبر. فوق radar.ts الموجود؛ بدون كتابة جديدة ولا حقول جديدة.
import { messageFor, type RadarRow, type RadarSegment } from './radar.ts';

const DAY = 86_400_000;

export type CommitmentColor = 'green' | 'amber' | 'red';

/** لون الالتزام من درجة الخطورة الموجودة (0-100، الأعلى = أخطر). العتبات قابلة للضبط. */
export function commitmentLevel(row: Pick<RadarRow, 'risk'>, amberAt = 30, redAt = 60): CommitmentColor {
  return row.risk >= redAt ? 'red' : row.risk >= amberAt ? 'amber' : 'green';
}

const has = (row: Pick<RadarRow, 'segment' | 'smartSegments'>, s: RadarSegment) =>
  row.segment === s || row.smartSegments.includes(s);

export function dailyAtRiskSummary(rows: RadarRow[]) {
  const ids = rows.filter((r) => has(r, 'at_risk')).map((r) => r.id);
  return { count: ids.length, total: rows.length, ids };
}

export function dueFollowUps(rows: Pick<RadarRow, 'id' | 'followUpDate'>[], now: number): string[] {
  return rows.filter((r) => typeof r.followUpDate === 'number' && r.followUpDate <= now).map((r) => r.id);
}

/** حد رسالة واحدة/أسبوع افتراضيًا، من lastNotifiedMs الموجود. */
export function canMessageThisWeek(row: Pick<RadarRow, 'lastNotifiedMs'>, now: number, cooldownDays = 7): boolean {
  return row.lastNotifiedMs == null || now - row.lastNotifiedMs >= cooldownDays * DAY;
}

/** رسالة تشجيع للملتزم (star) أو للي رجع بعد التصفير (recovered)؛ غير كده null. */
export function encouragementFor(row: Pick<RadarRow, 'name' | 'segment' | 'smartSegments'>): string | null {
  if (has(row, 'recovered')) return messageFor('recovered', row.name);
  if (has(row, 'star')) return messageFor('star', row.name);
  return null;
}

/** محاضرات فتحها طلاب ومكملوهاش (0 < progress < 95)، الأكثر توقفًا أولًا. */
export function stuckLessons(
  rows: Pick<RadarRow, 'latestLectureWatch'>[],
  topN = 5,
): { lectureId: string; stuckCount: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const w = r.latestLectureWatch;
    if (w && w.progress > 0 && w.progress < 95) m.set(w.lectureId, (m.get(w.lectureId) ?? 0) + 1);
  }
  return [...m.entries()].map(([lectureId, stuckCount]) => ({ lectureId, stuckCount }))
    .sort((a, b) => b.stuckCount - a.stuckCount).slice(0, topN);
}

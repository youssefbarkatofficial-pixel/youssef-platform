import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreStudent } from '../src/lib/radar.ts';
import { commitmentLevel, dailyAtRiskSummary, dueFollowUps, canMessageThisWeek, encouragementFor, stuckLessons } from '../src/lib/radarExtras.ts';

const now = 1792400000000;
const D = 86_400_000;
const base = {
  id: 'a', name: 'طالب تجريبي', phone: '01000000000', parentPhone: '01100000000', courseCount: 1,
  lastActiveMs: now - D, createdAtMs: now - 60 * D, watchPercent: 80, avgScore: 85, examCount: 3, archived: false,
};

test('لون الالتزام من risk', () => {
  assert.equal(commitmentLevel({ risk: 10 }), 'green');
  assert.equal(commitmentLevel({ risk: 40 }), 'amber');
  assert.equal(commitmentLevel({ risk: 80 }), 'red');
});
test('ملخص الخطر + تشجيع + تتبع', () => {
  const ok = scoreStudent(base, now);
  const bad = scoreStudent({ ...base, id: 'b', lastActiveMs: now - 40 * D, avgScore: 30 }, now);
  const s = dailyAtRiskSummary([ok, bad]);
  assert.equal(s.total, 2);
  assert.ok(commitmentLevel(bad) !== 'green');
  assert.ok(s.ids.every((id) => ['a', 'b'].includes(id)));
  const enc = encouragementFor({ name: 'طالب تجريبي', segment: 'star', smartSegments: [] });
  assert.ok(enc && enc.includes('طالب'));
  assert.equal(encouragementFor({ name: 'x', segment: 'ok', smartSegments: [] }), null);
});
test('متابعة + حد الرسائل + الدروس الواقف عندها', () => {
  assert.deepEqual(dueFollowUps([{ id: 'a', followUpDate: now - 1 }, { id: 'b', followUpDate: now + D }, { id: 'c' }], now), ['a']);
  assert.equal(canMessageThisWeek({ lastNotifiedMs: now - 2 * D }, now), false);
  assert.equal(canMessageThisWeek({ lastNotifiedMs: now - 8 * D }, now), true);
  assert.equal(canMessageThisWeek({ lastNotifiedMs: null }, now), true);
  const rows = [{ latestLectureWatch: { lectureId: 'L1', progress: 40 } }, { latestLectureWatch: { lectureId: 'L1', progress: 10 } }, { latestLectureWatch: { lectureId: 'L2', progress: 99 } }, {}];
  assert.deepEqual(stuckLessons(rows), [{ lectureId: 'L1', stuckCount: 2 }]);
});

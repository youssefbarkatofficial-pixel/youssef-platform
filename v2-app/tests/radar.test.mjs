import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreStudent,
  buildRadar,
  weakAssessments,
  toWhatsappNumber,
  whatsappLink,
} from '../src/lib/radar.ts';

const now = Date.now();
const D = 86_400_000;
const base = {
  id: 'a',
  name: 'أحمد علي',
  phone: '01012345678',
  parentPhone: '',
  courseCount: 1,
  lastActiveMs: now - 1 * D,
  createdAtMs: now - 40 * D,
  watchPercent: 80,
  avgScore: 90,
  examCount: 3,
  archived: false,
};

test('1. radar segment: star for active student with high score', () => {
  assert.equal(scoreStudent(base, now).segment, 'star');
});

test('2. radar segment: stopped for inactive >= 7 days', () => {
  assert.equal(scoreStudent({ ...base, lastActiveMs: now - 10 * D }, now).segment, 'stopped');
});

test('3. radar segment: weak for low average score', () => {
  assert.equal(scoreStudent({ ...base, avgScore: 40 }, now).segment, 'weak');
});

test('4. radar segment: lagging for low watch percent after 14 days', () => {
  assert.equal(scoreStudent({ ...base, avgScore: 70, watchPercent: 10 }, now).segment, 'lagging');
});

test('5. buildRadar filters non-enrolled, archived, and sorts by risk descending', () => {
  const result = buildRadar(
    [
      base,
      { ...base, id: 'b', courseCount: 0 },
      { ...base, id: 'c', archived: true },
      { ...base, id: 'd', lastActiveMs: now - 40 * D },
    ],
    now
  ).map((r) => r.id);
  assert.deepEqual(result, ['d', 'a']);
});

test('6. risk score is capped at 100', () => {
  assert.equal(scoreStudent({ ...base, lastActiveMs: now - 40 * D, avgScore: 30 }, now).risk, 100);
});

test('7. weakAssessments computes averages and fail rates', () => {
  const stats = weakAssessments([
    { key: 'x', title: 'X', courseId: 'c', score: 30 },
    { key: 'x', title: 'X', courseId: 'c', score: 40 },
    { key: 'x', title: 'X', courseId: 'c', score: 80 },
    { key: 'y', title: 'Y', courseId: 'c', score: 10 },
  ]).map((s) => [s.key, s.avg, s.failRate]);
  assert.deepEqual(stats, [['x', 50, 67]]);
});

test('8. toWhatsappNumber normalizes Arabic and standard digits', () => {
  assert.equal(toWhatsappNumber('٠١٠١٢٣٤٥٦٧٨'), '201012345678');
  assert.equal(toWhatsappNumber('01012345678'), '201012345678');
});

test('9. whatsappLink generates correct wa.me link with encoded text', () => {
  assert.equal(whatsappLink('01012345678', 'hi'), 'https://wa.me/201012345678?text=hi');
});

test('10. whatsappLink returns empty string for empty number', () => {
  assert.equal(whatsappLink('', ''), '');
});

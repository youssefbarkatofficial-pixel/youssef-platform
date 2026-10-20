import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreStudent,
  buildRadar,
  weakAssessments,
  toWhatsappNumber,
  whatsappLink,
  applyBaseline,
  revertBaseline,
  getCairoWeekBoundaries,
  calculateWeeklyStatus,
  generateWhatsAppTemplate,
} from '../src/lib/radar.ts';

const now = 1792400000000;
const D = 86_400_000;
const base = {
  id: 'a',
  name: 'أحمد علي',
  phone: '01012345678',
  parentPhone: '01123456789',
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

// ==========================================
// V2 RADAR TESTS
// ==========================================

test('11. Baseline Reset: applies baselineAt, note, history and calculates risk from baseline', () => {
  const student = { ...base, lastActiveMs: now - 20 * D };
  const resetTime = now - 2 * D;
  const resetStudent = applyBaseline(student, 'تم الاتفاق مع ولي الأمر', now + 5 * D, 'youssef', resetTime);

  assert.equal(resetStudent.baselineAt, resetTime);
  assert.equal(resetStudent.baselineNote, 'تم الاتفاق مع ولي الأمر');
  assert.equal(resetStudent.resetHistory?.length, 1);
  assert.equal(resetStudent.resetHistory?.[0].setBy, 'youssef');

  // Days inactive should now be counted from baseline (2 days instead of 20 days)
  const scored = scoreStudent(resetStudent, now);
  assert.equal(scored.daysInactive, 2);

  // Test Revert baseline
  const reverted = revertBaseline(resetStudent);
  assert.equal(reverted.baselineAt, null);
  assert.equal(reverted.resetHistory?.length, 0);
});

test('12. Smart Segments: correctly identifies unwatched, incomplete, and pending states', () => {
  // Unwatched video
  const unwatched = scoreStudent({
    ...base,
    latestLectureWatch: { lectureId: 'lec_1', progress: 0 }
  }, now);
  assert.ok(unwatched.smartSegments.includes('unwatched_video'));

  // Incomplete video (watched 45%)
  const incomplete = scoreStudent({
    ...base,
    latestLectureWatch: { lectureId: 'lec_1', progress: 45 }
  }, now);
  assert.ok(incomplete.smartSegments.includes('incomplete_video'));

  // Training done, Homework pending
  const trDone = scoreStudent({
    ...base,
    latestTrainingSubmitted: true,
    latestHomeworkSubmitted: false
  }, now);
  assert.ok(trDone.smartSegments.includes('training_done_hw_pending'));

  // Homework done, Exam pending
  const hwDone = scoreStudent({
    ...base,
    latestTrainingSubmitted: true,
    latestHomeworkSubmitted: true,
    latestExamSubmitted: false
  }, now);
  assert.ok(hwDone.smartSegments.includes('hw_done_exam_pending'));

  // Recovered after baseline
  const recovered = scoreStudent({
    ...base,
    baselineAt: now - 5 * D,
    lastActiveMs: now - 1 * D
  }, now);
  assert.ok(recovered.smartSegments.includes('recovered'));
});

test('13. Cairo Weekly Schedule: boundaries, missed full week, and homework warning', () => {
  const boundaries = getCairoWeekBoundaries(now);
  assert.ok(boundaries.thursdayMidnightMs <= boundaries.thursday9pmMs);
  assert.ok(boundaries.thursday9pmMs < boundaries.tuesdayDeadlineMs);
  assert.ok(boundaries.tuesdayDeadlineMs < boundaries.wednesdayDeadlineMs);

  // Missed full week if inactive before Thursday midnight
  const missedStudent = {
    ...base,
    lastActiveMs: boundaries.thursdayMidnightMs - 1000
  };
  const status = calculateWeeklyStatus(missedStudent, now);
  assert.equal(status.isMissedFullWeek, true);
});

test('14. Sorting: alphabetical, newest, and lastActive sorting', () => {
  const s1 = { ...base, id: '1', name: 'أحمد زكي', createdAtMs: now - 10 * D, lastActiveMs: now - 5 * D };
  const s2 = { ...base, id: '2', name: 'محمود حسن', createdAtMs: now - 20 * D, lastActiveMs: now - 1 * D };
  const s3 = { ...base, id: '3', name: 'إبراهيم سمير', createdAtMs: now - 5 * D, lastActiveMs: now - 10 * D };

  // Alphabetical
  const alpha = buildRadar([s1, s2, s3], now, 'alphabetical').map(r => r.name);
  assert.deepEqual(alpha, ['إبراهيم سمير', 'أحمد زكي', 'محمود حسن']);

  // Newest
  const newest = buildRadar([s1, s2, s3], now, 'newest').map(r => r.id);
  assert.deepEqual(newest, ['3', '1', '2']);

  // Last Active
  const lastActive = buildRadar([s1, s2, s3], now, 'lastActive').map(r => r.id);
  assert.deepEqual(lastActive, ['2', '1', '3']);
});

test('15. WhatsApp template generator replaces variables correctly', () => {
  const template = 'أهلًا {studentName}، باقي درس {lectureTitle} متأخر {lateDays} أيام.';
  const vars = { studentName: 'يوسف', lectureTitle: 'المناخ في مصر', lateDays: '3' };
  const result = generateWhatsAppTemplate(template, vars);
  assert.equal(result, 'أهلًا يوسف، باقي درس المناخ في مصر متأخر 3 أيام.');
});

test('16. smart segment: fast_or_skipped when speed exceeded or seek count >= 3', () => {
  // Speed exceeded
  const fastStudent = scoreStudent({
    ...base,
    latestLectureWatch: { lectureId: 'lec_1', progress: 95, speedExceeded: true }
  }, now);
  assert.ok(fastStudent.smartSegments.includes('fast_or_skipped'));

  // Seek count >= 3
  const skippedStudent = scoreStudent({
    ...base,
    latestLectureWatch: { lectureId: 'lec_1', progress: 80, seeks: 4 }
  }, now);
  assert.ok(skippedStudent.smartSegments.includes('fast_or_skipped'));
});

test('17. smart segment: file_downloaded when student has downloaded >= 1 file', () => {
  const downloaded = scoreStudent({
    ...base,
    downloadedFilesCount: 3
  }, now);
  assert.ok(downloaded.smartSegments.includes('file_downloaded'));

  const none = scoreStudent({
    ...base,
    downloadedFilesCount: 0
  }, now);
  assert.ok(!none.smartSegments.includes('file_downloaded'));
});

test('18. smart segment: notified when student received broadcast within 7 days', () => {
  const notified = scoreStudent({
    ...base,
    lastNotifiedMs: now - 2 * D
  }, now);
  assert.ok(notified.smartSegments.includes('notified'));

  // Older than 7 days is not considered recently notified
  const oldNotified = scoreStudent({
    ...base,
    lastNotifiedMs: now - 10 * D
  }, now);
  assert.ok(!oldNotified.smartSegments.includes('notified'));
});

test('19. smart segment: recovered when student is active after baseline reset', () => {
  const recovered = scoreStudent({
    ...base,
    baselineAt: now - 5 * D,
    lastActiveMs: now - 1 * D
  }, now);
  assert.ok(recovered.smartSegments.includes('recovered'));

  // If last active was before baseline, not recovered
  const unrecovered = scoreStudent({
    ...base,
    baselineAt: now - 2 * D,
    lastActiveMs: now - 6 * D
  }, now);
  assert.ok(!unrecovered.smartSegments.includes('recovered'));
});

test('20. Cairo weekly schedule boundaries and missed_full_week detection', () => {
  const boundaries = getCairoWeekBoundaries(now);
  // Verify strict chronologic order of Cairo weekly rhythm
  assert.ok(boundaries.thursdayMidnightMs <= boundaries.thursday9pmMs);
  assert.ok(boundaries.thursday9pmMs < boundaries.tuesdayDeadlineMs);
  assert.ok(boundaries.tuesdayDeadlineMs < boundaries.wednesdayDeadlineMs);

  // Student inactive since before Thursday midnight is tagged as missed_full_week
  const missed = scoreStudent({
    ...base,
    lastActiveMs: boundaries.thursdayMidnightMs - 10_000
  }, now);
  assert.ok(missed.smartSegments.includes('missed_full_week'));

  // Active student during the current Cairo week is NOT missed_full_week
  const activeStudent = scoreStudent({
    ...base,
    lastActiveMs: boundaries.thursday9pmMs + 3600_000
  }, now);
  assert.ok(!activeStudent.smartSegments.includes('missed_full_week'));
});

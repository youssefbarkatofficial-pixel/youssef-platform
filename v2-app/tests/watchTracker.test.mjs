import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeIntervals,
  calculateCoveredSeconds,
  createWatchState,
  processPlaybackTick,
  updatePlayerStatus
} from '../src/lib/watchTracker.ts';

test('1. mergeIntervals: دمج الفترات المتداخلة والمتلاصقة بدقة ثانية', () => {
  const input = [
    { start: 0, end: 10 },
    { start: 5, end: 15 },
    { start: 16, end: 25 },
    { start: 30, end: 40 },
    { start: 35, end: 45 }
  ];

  const merged = mergeIntervals(input);
  assert.deepEqual(merged, [
    { start: 0, end: 25 },
    { start: 30, end: 45 }
  ]);

  const covered = calculateCoveredSeconds(merged, 100);
  assert.equal(covered, 25 + 15); // 40 ثانية
});

test('2. Anti-Seek: القفز للأمام (Forward Seek) لا يضيف أي تغطية', () => {
  let state = createWatchState('lec-1', 100);
  state = updatePlayerStatus(state, { isPlaying: true, isTabVisible: true, playbackRate: 1.0 });

  // تشغيل ثانية واحدة طبيعية (من 0 إلى 1 خلال 1000ms)
  let t = 1000;
  state = processPlaybackTick(state, 0, t);
  t += 1000;
  state = processPlaybackTick(state, 1, t);
  assert.equal(state.coveredSeconds, 1);

  // قفز للأمام فجأة إلى 80 ثانية خلال 500ms
  t += 500;
  state = processPlaybackTick(state, 80, t);

  // يجب ألا تُحتسب الثواني المقفوزة (من 1 إلى 80)
  assert.equal(state.coveredSeconds, 1);
  assert.equal(state.completed, false);
});

test('3. Backward Seek: الرجوع للخلف لا ينقص التغطية السابقة', () => {
  let state = createWatchState('lec-1', 100);
  state = updatePlayerStatus(state, { isPlaying: true, isTabVisible: true, playbackRate: 1.0 });

  let t = 1000;
  state = processPlaybackTick(state, 0, t);
  t += 10000;
  state = processPlaybackTick(state, 10, t);
  assert.equal(state.coveredSeconds, 10);

  // رجوع للخلف إلى 2 ثانية
  t += 200;
  state = processPlaybackTick(state, 2, t);
  // التغطية لا تنقص
  assert.equal(state.coveredSeconds, 10);
});

test('4. Speed Limit: السرعة أكبر من 2x (مثل 3x) لا تحتسب أي تقدم', () => {
  let state = createWatchState('lec-1', 100);
  state = updatePlayerStatus(state, { isPlaying: true, isTabVisible: true, playbackRate: 3.0 });

  let t = 1000;
  state = processPlaybackTick(state, 0, t);
  t += 3000;
  state = processPlaybackTick(state, 9, t);

  // لا يحتسب أي تقدم بالسرعة غير القانونية 3x
  assert.equal(state.coveredSeconds, 0);
  assert.equal(state.coverage, 0);
});

test('5. Tab Visibility: التبويب المخفي لا يحتسب أي تقدم', () => {
  let state = createWatchState('lec-1', 100);
  // التبويب غير ظاهر
  state = updatePlayerStatus(state, { isPlaying: true, isTabVisible: false, playbackRate: 1.0 });

  let t = 1000;
  state = processPlaybackTick(state, 0, t);
  t += 5000;
  state = processPlaybackTick(state, 5, t);

  assert.equal(state.coveredSeconds, 0);

  // عندما يصبح التبويب ظاهراً يبدأ الاحتساب
  state = updatePlayerStatus(state, { isTabVisible: true, currentTime: 5 });
  t += 5000;
  state = processPlaybackTick(state, 10, t);
  assert.equal(state.coveredSeconds, 5);
});

test('6. Two Sessions & Resume: جلستان متفرقتان تكمّلان 95%', () => {
  // الجلسة 1: شاهد من 0 إلى 50 ثانية
  const session1Intervals = [{ start: 0, end: 50 }];
  let state = createWatchState('lec-1', 100, session1Intervals);
  assert.equal(state.coveredSeconds, 50);
  assert.equal(state.coverage, 0.50);
  assert.equal(state.completed, false);

  // الجلسة 2: استئناف من 45 ومشاهدة حتى 96 ثانية
  state = updatePlayerStatus(state, { isPlaying: true, isTabVisible: true, playbackRate: 1.0, currentTime: 45 });
  let t = 1000;
  state = processPlaybackTick(state, 45, t);
  for (let sec = 46; sec <= 96; sec++) {
    t += 1000;
    state = processPlaybackTick(state, sec, t);
  }

  // التغطية المدمجة: [0, 50] + [45, 96] = [0, 96] = 96%
  assert.equal(state.coveredSeconds, 96);
  assert.equal(state.coverage, 0.96);
  assert.equal(state.completed, true);
});

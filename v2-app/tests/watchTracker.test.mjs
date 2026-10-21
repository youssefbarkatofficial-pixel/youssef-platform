import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeIntervals,
  calculateCoveredSeconds,
  createWatchState,
  processPlaybackTick,
  updatePlayerStatus,
  mergeWatchStates,
  shouldFlush,
  WATCH_MILESTONES,
  FALLBACK_HEARTBEAT_MS,
} from '../src/lib/watchTracker.ts';

test('1. mergeIntervals: دمج الفترات المتداخلة والمتلاصقة بدقة ثانية', () => {
  const input = [
    { start: 0, end: 10 },
    { start: 5, end: 15 },
    { start: 16, end: 25 },
    { start: 30, end: 40 },
    { start: 35, end: 45 },
  ];

  const merged = mergeIntervals(input);
  assert.deepEqual(merged, [
    { start: 0, end: 25 },
    { start: 30, end: 45 },
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
  assert.equal(state.coverage, 0.5);
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

test('7. shouldFlush: الأحداث الصريحة (Pause, Ended, VisibilityChange, PageHide)', () => {
  const baseContext = {
    trigger: 'pause',
    currentCoverage: 0.15,
    lastFlushedCoverage: 0.1,
    lastFlushTimeMs: 1000,
    nowMs: 15000,
    passedMilestones: [],
  };

  // إيقاف الفيديو (Pause) مع وجود تقدم
  const pauseRes = shouldFlush({ ...baseContext, trigger: 'pause' });
  assert.equal(pauseRes.shouldFlush, true);
  assert.equal(pauseRes.reason, 'pause');

  // نهاية الفيديو (Ended)
  const endedRes = shouldFlush({ ...baseContext, trigger: 'ended' });
  assert.equal(endedRes.shouldFlush, true);
  assert.equal(endedRes.reason, 'ended');

  // إخفاء التبويب (visibility_hidden)
  const visRes = shouldFlush({ ...baseContext, trigger: 'visibility_hidden' });
  assert.equal(visRes.shouldFlush, true);
  assert.equal(visRes.reason, 'visibility_hidden');

  // الخروج من الصفحة (pagehide)
  const phRes = shouldFlush({ ...baseContext, trigger: 'pagehide' });
  assert.equal(phRes.shouldFlush, true);
  assert.equal(phRes.reason, 'pagehide');
});

test('8. shouldFlush: عبور فواصل النسب المئوية (25%, 50%, 75%, و95% فوراً)', () => {
  const passedMilestones = [];

  // قبل 25% (مثلاً 20%) -> لا كتابة بسبب الفاصل
  let res = shouldFlush({
    trigger: 'milestone',
    currentCoverage: 0.2,
    lastFlushedCoverage: 0.1,
    lastFlushTimeMs: 1000,
    nowMs: 5000,
    passedMilestones,
  });
  assert.equal(res.shouldFlush, false);

  // عبور 25% -> كتابة فورية
  res = shouldFlush({
    trigger: 'milestone',
    currentCoverage: 0.25,
    lastFlushedCoverage: 0.1,
    lastFlushTimeMs: 1000,
    nowMs: 6000,
    passedMilestones,
  });
  assert.equal(res.shouldFlush, true);
  assert.equal(res.milestoneCrossed, 0.25);
  passedMilestones.push(0.25);

  // عند 26% والفاسل 25% سبق اجتيازه -> لا إعادة كتابة
  res = shouldFlush({
    trigger: 'milestone',
    currentCoverage: 0.26,
    lastFlushedCoverage: 0.25,
    lastFlushTimeMs: 6000,
    nowMs: 7000,
    passedMilestones,
  });
  assert.equal(res.shouldFlush, false);

  // عبور 50% -> كتابة
  res = shouldFlush({
    trigger: 'milestone',
    currentCoverage: 0.51,
    lastFlushedCoverage: 0.25,
    lastFlushTimeMs: 6000,
    nowMs: 15000,
    passedMilestones,
  });
  assert.equal(res.shouldFlush, true);
  assert.equal(res.milestoneCrossed, 0.5);
  passedMilestones.push(0.5);

  // عبور 75% -> كتابة
  res = shouldFlush({
    trigger: 'milestone',
    currentCoverage: 0.75,
    lastFlushedCoverage: 0.5,
    lastFlushTimeMs: 15000,
    nowMs: 25000,
    passedMilestones,
  });
  assert.equal(res.shouldFlush, true);
  assert.equal(res.milestoneCrossed, 0.75);
  passedMilestones.push(0.75);

  // عبور 95% -> كتابة فورية لفتح الدرس التالي دون تأخير
  res = shouldFlush({
    trigger: 'milestone',
    currentCoverage: 0.951,
    lastFlushedCoverage: 0.75,
    lastFlushTimeMs: 25000,
    nowMs: 35000,
    passedMilestones,
  });
  assert.equal(res.shouldFlush, true);
  assert.equal(res.milestoneCrossed, 0.95);
});

test('9. shouldFlush: النبضة الاحتياطية (كل 5 دقائق بدون أي حدث)', () => {
  const lastFlush = 100000;

  // تشغيل متواصل لمدة 4 دقائق (240,000ms) -> لا كتابة
  let res = shouldFlush({
    trigger: 'fallback_heartbeat',
    currentCoverage: 0.18,
    lastFlushedCoverage: 0.1,
    lastFlushTimeMs: lastFlush,
    nowMs: lastFlush + 240000,
    passedMilestones: [],
  });
  assert.equal(res.shouldFlush, false);

  // تشغيل متواصل لمدة 5 دقائق كاملة (300,000ms) -> كتابة احتياطية واحدة
  res = shouldFlush({
    trigger: 'fallback_heartbeat',
    currentCoverage: 0.22,
    lastFlushedCoverage: 0.1,
    lastFlushTimeMs: lastFlush,
    nowMs: lastFlush + 300000,
    passedMilestones: [],
  });
  assert.equal(res.shouldFlush, true);
  assert.equal(res.reason, 'fallback_heartbeat_5min');
});

test('10. mergeWatchStates: دمج مشاهدات جهازين مختلفين بدون ضياع فترات', () => {
  // جهاز 1 (الموبايل): شاهد الدقائق الأولى [0, 40] من فيديو مدته 100 ثانية
  const deviceA = createWatchState('lec-unit2', 100, [{ start: 0, end: 40 }]);
  assert.equal(deviceA.coverage, 0.4);

  // جهاز 2 (الكمبيوتر): شاهد فترات لاحقة [35, 96]
  const deviceB = createWatchState('lec-unit2', 100, [{ start: 35, end: 96 }]);
  assert.equal(deviceB.coverage, 0.61);

  // الدمج الموحد
  const merged = mergeWatchStates(deviceA, deviceB);
  assert.ok(merged);
  assert.equal(merged.totalDuration, 100);
  assert.deepEqual(merged.intervals, [{ start: 0, end: 96 }]);
  assert.equal(merged.coveredSeconds, 96);
  assert.equal(merged.coverage, 0.96);
  assert.equal(merged.completed, true);
});

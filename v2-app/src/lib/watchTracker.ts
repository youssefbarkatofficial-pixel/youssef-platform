export interface TimeInterval {
  start: number;
  end: number;
}

export interface WatchState {
  itemId: string;
  totalDuration: number;
  intervals: TimeInterval[];
  coveredSeconds: number;
  coverage: number; // 0.0 to 1.0
  lastPosition: number;
  completed: boolean;
  lastTickTime: number | null;
  isPlaying: boolean;
  playbackRate: number;
  isTabVisible: boolean;
}

export const WATCH_THRESHOLD = 0.95;
export const MAX_PLAYBACK_RATE = 2.0;
export const MAX_STORED_INTERVALS = 200;

// فواصل وثوابت كتابة تقدم المشاهدة (مغلقة في هذا الملف)
export const WATCH_MILESTONES = [0.25, 0.50, 0.75, 0.95] as const;
export const FALLBACK_HEARTBEAT_MS = 5 * 60 * 1000; // كتابة احتياطية واحدة كل 5 دقائق لو شغال بلا أي حدث
export const LAST_ACTIVE_THROTTLE_MS = 10 * 60 * 1000; // كتابة lastActiveMs مرة واحدة كل 10 دقائق على الأكثر

export type FlushTrigger =
  | 'pause'
  | 'ended'
  | 'visibility_hidden'
  | 'pagehide'
  | 'milestone'
  | 'fallback_heartbeat'
  | 'manual';

export interface FlushDecisionContext {
  trigger: FlushTrigger;
  currentCoverage: number;
  lastFlushedCoverage: number;
  lastFlushTimeMs: number;
  nowMs: number;
  passedMilestones: number[];
  isCompleted?: boolean;
}

export interface FlushDecisionResult {
  shouldFlush: boolean;
  milestoneCrossed?: number;
  reason: string;
}

/**
 * دالة قرار الكتابة إلى Firestore (shouldFlush).
 * تلغي الحفظ الدوري وتقتصر فقط على الأحداث:
 * - إيقاف الفيديو
 * - نهاية الفيديو
 * - الخروج أو إخفاء التبويب
 * - عبور 25% و 50% و 75%
 * - عبور 95% فورًا
 * - نبضة احتياطية واحدة كل 5 دقائق لو الفيديو مستمر بلا أحداث
 */
export function shouldFlush(context: FlushDecisionContext): FlushDecisionResult {
  const { trigger, currentCoverage, lastFlushTimeMs, nowMs, passedMilestones } = context;

  // 1. فحص عبور فواصل النسب المئوية (25%, 50%, 75%, 95%)
  for (const m of WATCH_MILESTONES) {
    if (currentCoverage >= m && !passedMilestones.includes(m)) {
      return {
        shouldFlush: true,
        milestoneCrossed: m,
        reason: `milestone_${Math.round(m * 100)}%`,
      };
    }
  }

  // 2. أحداث دورة الحياة المحددة صراحة
  if (
    trigger === 'pause' ||
    trigger === 'ended' ||
    trigger === 'visibility_hidden' ||
    trigger === 'pagehide' ||
    trigger === 'manual'
  ) {
    // نكتب لو فيه تقدم فعلي منذ آخر حفظ أو انتهى الفيديو
    const diff = Math.abs(currentCoverage - context.lastFlushedCoverage);
    if (trigger === 'ended' || diff >= 0.005 || (currentCoverage >= WATCH_THRESHOLD && !context.isCompleted)) {
      return { shouldFlush: true, reason: trigger };
    }
  }

  // 3. النبضة الاحتياطية (كل 5 دقائق بدون أي حدث)
  if (trigger === 'fallback_heartbeat') {
    if (nowMs - lastFlushTimeMs >= FALLBACK_HEARTBEAT_MS) {
      return { shouldFlush: true, reason: 'fallback_heartbeat_5min' };
    }
  }

  return { shouldFlush: false, reason: 'no_condition_met' };
}

/**
 * دمج حالتي مشاهدة (محلي + سحابي، أو جهازين مختلفين)
 * بأخذ الاتحاد الرياضي للفترات المشاهدة والأكبر في المدة والنسبة والموضع.
 */
export function mergeWatchStates(
  local: WatchState | null | undefined,
  remote: WatchState | null | undefined
): WatchState | null {
  if (!local && !remote) return null;
  if (!local) return remote!;
  if (!remote) return local!;

  const itemId = local.itemId || remote.itemId;
  const totalDuration = Math.max(local.totalDuration, remote.totalDuration);
  const mergedIntervals = mergeIntervals([...(local.intervals || []), ...(remote.intervals || [])]);
  const covered = calculateCoveredSeconds(mergedIntervals, totalDuration);
  const coverage =
    totalDuration > 0
      ? Math.min(1.0, covered / totalDuration)
      : Math.max(local.coverage || 0, remote.coverage || 0);
  const completed = coverage >= WATCH_THRESHOLD || local.completed || remote.completed;
  const lastPosition = Math.max(local.lastPosition || 0, remote.lastPosition || 0);

  return {
    itemId,
    totalDuration,
    intervals: mergedIntervals,
    coveredSeconds: covered,
    coverage,
    lastPosition,
    completed,
    lastTickTime: null,
    isPlaying: local.isPlaying || remote.isPlaying,
    playbackRate: local.playbackRate || remote.playbackRate || 1.0,
    isTabVisible: local.isTabVisible && remote.isTabVisible,
  };
}

/**
 * دمج الفترات الزمنية المتداخلة أو المتلاصقة بدقة ثانية واحدة.
 */
export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (!intervals || intervals.length === 0) return [];

  // ترتيب حسب البداية
  const sorted = intervals
    .map((iv) => ({
      start: Math.max(0, Math.floor(iv.start)),
      end: Math.max(0, Math.floor(iv.end)),
    }))
    .filter((iv) => iv.end > iv.start)
    .sort((a, b) => a.start - b.start);

  if (sorted.length === 0) return [];

  const merged: TimeInterval[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end + 1) {
      // تداخل أو تلاصق
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  // تقليم الفترات لو زادت عن الحد الأقصى عبر دمج الفترات الأقرب
  if (merged.length > MAX_STORED_INTERVALS) {
    return merged.slice(0, MAX_STORED_INTERVALS);
  }

  return merged;
}

/**
 * حساب إجمالي الثواني المغطاة من الفترات المدمجة.
 */
export function calculateCoveredSeconds(intervals: TimeInterval[], maxDuration?: number): number {
  const merged = mergeIntervals(intervals);
  let total = 0;
  for (const iv of merged) {
    const s = iv.start;
    const e = typeof maxDuration === 'number' && maxDuration > 0 ? Math.min(iv.end, maxDuration) : iv.end;
    if (e > s) total += e - s;
  }
  return total;
}

/**
 * إنشاء حالة تتبع مشاهدة أولية
 */
export function createWatchState(
  itemId: string,
  totalDuration: number = 0,
  initialIntervals: TimeInterval[] = [],
  threshold: number = WATCH_THRESHOLD
): WatchState {
  const merged = mergeIntervals(initialIntervals);
  const covered = calculateCoveredSeconds(merged, totalDuration);
  const coverage = totalDuration > 0 ? Math.min(1.0, covered / totalDuration) : 0;

  return {
    itemId,
    totalDuration: Math.max(0, Math.floor(totalDuration)),
    intervals: merged,
    coveredSeconds: covered,
    coverage,
    lastPosition: 0,
    completed: totalDuration > 0 && coverage >= threshold,
    lastTickTime: null,
    isPlaying: false,
    playbackRate: 1.0,
    isTabVisible: true,
  };
}

/**
 * تسجيل نبضة زمنية (tick) أثناء تشغيل الفيديو.
 * الشروط الصارمة لاحتساب الوقت:
 * 1. الحالة PLAYING
 * 2. التبويب ظاهر (isTabVisible === true)
 * 3. سرعة التشغيل <= 2.0x
 * 4. موضع التشغيل يتقدم بنسق مع الوقت الحقيقي (seek للأمام لا يحتسب).
 */
export function processPlaybackTick(
  state: WatchState,
  currentMediaTime: number,
  systemTimestamp: number = Date.now(),
  threshold: number = WATCH_THRESHOLD
): WatchState {
  const pos = Math.max(0, Math.floor(currentMediaTime));
  const newState: WatchState = { ...state, lastPosition: pos };

  if (newState.totalDuration <= 0) {
    newState.lastTickTime = systemTimestamp;
    return newState;
  }

  // لو المشغّل ليس في وضع التشغيل أو التبويب مخفي أو السرعة تزيد عن 2x
  if (
    !newState.isPlaying ||
    !newState.isTabVisible ||
    newState.playbackRate > MAX_PLAYBACK_RATE ||
    newState.playbackRate <= 0
  ) {
    newState.lastTickTime = systemTimestamp;
    return newState;
  }

  if (newState.lastTickTime === null) {
    newState.lastTickTime = systemTimestamp;
    return newState;
  }

  const deltaRealSec = (systemTimestamp - newState.lastTickTime) / 1000;
  newState.lastTickTime = systemTimestamp;

  // لو الفاصل غير منطقي (مثل توقف طويل للجهاز أو خمول)
  if (deltaRealSec <= 0 || deltaRealSec > 10) {
    return newState;
  }

  // الحد الأقصى لما يمكن تقدمه بالوسائط خلال deltaRealSec
  const maxAdvance = deltaRealSec * newState.playbackRate + 1.0;
  const previousPos = state.lastPosition;

  // إذا حدث seek للأمام (قفزة أكبر من الوقت المسموح به)
  if (pos > previousPos + maxAdvance) {
    // قفزة للأمام: لا نحسب الفجوة المقفوزة
    return newState;
  }

  // إذا تقدم الموضع للأمام ضمن النطاق الطبيعي
  if (pos > previousPos) {
    const segmentStart = Math.max(0, previousPos);
    const segmentEnd = Math.min(newState.totalDuration, pos);

    if (segmentEnd > segmentStart) {
      const updatedIntervals = mergeIntervals([...newState.intervals, { start: segmentStart, end: segmentEnd }]);
      const covered = calculateCoveredSeconds(updatedIntervals, newState.totalDuration);
      const coverage = Math.min(1.0, covered / newState.totalDuration);

      newState.intervals = updatedIntervals;
      newState.coveredSeconds = covered;
      newState.coverage = coverage;
      newState.completed = coverage >= threshold;
    }
  }

  return newState;
}

/**
 * تحديث حالة المشغل (Play/Pause/Rate/Visibility)
 */
export function updatePlayerStatus(
  state: WatchState,
  updates: {
    isPlaying?: boolean;
    playbackRate?: number;
    isTabVisible?: boolean;
    totalDuration?: number;
    currentTime?: number;
  },
  threshold: number = WATCH_THRESHOLD
): WatchState {
  const next = { ...state };

  if (
    typeof updates.totalDuration === 'number' &&
    updates.totalDuration > 0 &&
    updates.totalDuration !== next.totalDuration
  ) {
    next.totalDuration = Math.max(0, Math.floor(updates.totalDuration));
    next.coveredSeconds = calculateCoveredSeconds(next.intervals, next.totalDuration);
    next.coverage = next.totalDuration > 0 ? Math.min(1.0, next.coveredSeconds / next.totalDuration) : 0;
    next.completed = next.totalDuration > 0 && next.coverage >= threshold;
  }

  if (typeof updates.currentTime === 'number') {
    next.lastPosition = Math.max(0, Math.floor(updates.currentTime));
  }

  if (typeof updates.isPlaying === 'boolean') {
    next.isPlaying = updates.isPlaying;
    if (!updates.isPlaying) {
      next.lastTickTime = null; // إعادة ضبط وقت النبضة عند التوقف
    }
  }

  if (typeof updates.playbackRate === 'number') {
    next.playbackRate = updates.playbackRate;
  }

  if (typeof updates.isTabVisible === 'boolean') {
    next.isTabVisible = updates.isTabVisible;
    if (!updates.isTabVisible) {
      next.lastTickTime = null; // لا نبضة أثناء الاختفاء
    }
  }

  return next;
}

import { doc, getDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  createWatchState,
  mergeIntervals,
  calculateCoveredSeconds,
  mergeWatchStates,
  WATCH_THRESHOLD,
  LAST_ACTIVE_THROTTLE_MS,
} from '../lib/watchTracker.ts';
import type { WatchState, TimeInterval } from '../lib/watchTracker.ts';

const QUEUE_KEY = 'yb_watch_queue_v1';
const LOCAL_STATE_PREFIX = 'yb_watch_state_';
const LAST_ACTIVE_PREFIX = 'yb_last_active_written_';

export interface QueuedWatchSync {
  id: string;
  studentId: string;
  itemId: string;
  state: WatchState;
  meta?: { maxPlaybackRate?: number; seekCount?: number };
  queuedAt: number;
}

function getLocalStorageSafely(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {}
  return null;
}

export function getLocalWatchState(studentId: string, itemId: string): WatchState | null {
  const storage = getLocalStorageSafely();
  if (!storage || !studentId || !itemId) return null;

  try {
    const raw = storage.getItem(`${LOCAL_STATE_PREFIX}${studentId}_${itemId}`);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        const intervals: TimeInterval[] = Array.isArray(data.intervals) ? data.intervals : [];
        const totalDuration = typeof data.totalDuration === 'number' ? data.totalDuration : 0;
        const state = createWatchState(itemId, totalDuration, intervals, WATCH_THRESHOLD);
        if (typeof data.lastPosition === 'number') state.lastPosition = data.lastPosition;
        if (typeof data.completed === 'boolean') state.completed = data.completed;
        if (typeof data.coverage === 'number') state.coverage = data.coverage;
        return state;
      }
    }
  } catch (err) {
    console.warn('Error reading local watch state:', err);
  }
  return null;
}

export function saveLocalWatchState(studentId: string, state: WatchState): void {
  const storage = getLocalStorageSafely();
  if (!storage || !studentId || !state.itemId) return;

  try {
    const key = `${LOCAL_STATE_PREFIX}${studentId}_${state.itemId}`;
    storage.setItem(
      key,
      JSON.stringify({
        itemId: state.itemId,
        totalDuration: state.totalDuration,
        intervals: state.intervals,
        coveredSeconds: state.coveredSeconds,
        coverage: state.coverage,
        lastPosition: state.lastPosition,
        completed: state.completed,
        updatedAt: Date.now(),
      }),
    );
  } catch (err) {
    console.warn('Error saving local watch state:', err);
  }
}

export function getAllLocalWatchProgress(studentId: string): Record<string, number> {
  const storage = getLocalStorageSafely();
  const result: Record<string, number> = {};
  if (!storage || !studentId) return result;

  try {
    const prefix = `${LOCAL_STATE_PREFIX}${studentId}_`;
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(prefix)) {
        const itemId = k.substring(prefix.length);
        const raw = storage.getItem(k);
        if (raw) {
          const data = JSON.parse(raw);
          if (typeof data.coverage === 'number') {
            result[itemId] = Math.round(data.coverage * 100);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error scanning local watch progress:', err);
  }
  return result;
}

function getSyncQueue(): QueuedWatchSync[] {
  const storage = getLocalStorageSafely();
  if (!storage) return [];
  try {
    const raw = storage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSyncQueue(queue: QueuedWatchSync[]): void {
  const storage = getLocalStorageSafely();
  if (!storage) return;
  try {
    storage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

function enqueueSync(item: QueuedWatchSync): void {
  const queue = getSyncQueue();
  // إزالة أي طلب قديم لنفس العنصر والطالب لتجنب التكرار
  const filtered = queue.filter((q) => !(q.studentId === item.studentId && q.itemId === item.itemId));
  filtered.push(item);
  saveSyncQueue(filtered);
}

/**
 * مزامنة قائمة الانتظار المحلية مع Firestore (في أول فتح تالي أو عند عودة الاتصال)
 */
export async function flushPendingWatchQueue(studentId?: string): Promise<number> {
  const queue = getSyncQueue();
  if (queue.length === 0) return 0;

  let syncedCount = 0;
  const remaining: QueuedWatchSync[] = [];

  for (const item of queue) {
    if (studentId && item.studentId !== studentId) {
      remaining.push(item);
      continue;
    }

    try {
      await writeToFirestore(item.studentId, item.state, item.meta);
      syncedCount++;
    } catch {
      // لو فشلت المزامنة تظل في القائمة للمحاولة القادمة
      remaining.push(item);
    }
  }

  saveSyncQueue(remaining);
  return syncedCount;
}

/**
 * استرجاع تقدم المشاهدة:
 * يدمج المحلي (في الذاكرة / التخزين المحلي) مع سحابة Firestore بأخذ الأكبر ودمج الفترات
 */
export async function getStoredWatchProgress(studentId: string, itemId: string): Promise<WatchState | null> {
  if (!studentId || !itemId) return null;

  // 1. قراءة الحالة المحلية فوراً
  const localState = getLocalWatchState(studentId, itemId);

  // مزامنة أي طلبات معلقة لنفس الطالب إن وجدت
  void flushPendingWatchQueue(studentId);

  try {
    // 2. قراءة الحالة من Firestore
    const snap = await getDoc(doc(db, 'students', studentId, 'watchProgress', itemId));
    let remoteState: WatchState | null = null;

    if (snap.exists()) {
      const data = snap.data();
      const intervals: TimeInterval[] = Array.isArray(data.intervals) ? data.intervals : [];
      const totalDuration = typeof data.totalDuration === 'number' ? data.totalDuration : 0;
      remoteState = createWatchState(itemId, totalDuration, intervals, WATCH_THRESHOLD);
      if (typeof data.lastPosition === 'number') {
        remoteState.lastPosition = data.lastPosition;
      }
      if (typeof data.completed === 'boolean') {
        remoteState.completed = data.completed;
      }
      if (typeof data.coverage === 'number') {
        remoteState.coverage = data.coverage;
      }
    } else {
      // fallback: قراءة من حقل watchProgress في مستند الطالب الرئيسي
      const studentSnap = await getDoc(doc(db, 'students', studentId));
      if (studentSnap.exists()) {
        const studentData = studentSnap.data();
        const legacyVal = studentData.watchProgress?.[itemId];
        if (typeof legacyVal === 'number' && legacyVal > 0) {
          remoteState = createWatchState(itemId, 100, [{ start: 0, end: Math.min(100, legacyVal) }]);
          remoteState.completed = legacyVal >= 95;
        }
      }
    }

    // 3. دمج الفترات وحساب النتيجة المشتركة (الاتحاد الرياضي للأجهزة المتعددة والمحلي)
    const merged = mergeWatchStates(localState, remoteState);
    if (merged) {
      saveLocalWatchState(studentId, merged);
      return merged;
    }

    return localState || null;
  } catch (err) {
    console.warn('Could not read watch progress from Firestore, falling back to local:', err);
    return localState || null;
  }
}

async function writeToFirestore(
  studentId: string,
  state: WatchState,
  meta?: { maxPlaybackRate?: number; seekCount?: number }
): Promise<void> {
  const merged = mergeIntervals(state.intervals);
  const covered = calculateCoveredSeconds(merged, state.totalDuration);
  const coverage = Math.min(1.0, state.totalDuration > 0 ? covered / state.totalDuration : 0);
  const completed = coverage >= WATCH_THRESHOLD;

  const payload: Record<string, unknown> = {
    itemId: state.itemId,
    coveredSeconds: covered,
    totalDuration: state.totalDuration,
    coverage: Math.round(coverage * 1000) / 1000,
    intervals: merged.map((iv) => ({ start: iv.start, end: iv.end })),
    lastPosition: state.lastPosition,
    completed,
    updatedAt: serverTimestamp(),
  };

  if (meta?.maxPlaybackRate !== undefined) payload.maxPlaybackRate = meta.maxPlaybackRate;
  if (meta?.seekCount !== undefined) payload.seekCount = meta.seekCount;

  // 1. حفظ المستند التفصيلي في subcollection
  await setDoc(doc(db, 'students', studentId, 'watchProgress', state.itemId), payload, { merge: true });

  // 2. تحديث الحقل المقتضب في مستند الطالب مع خنق lastActiveMs (مرة كل 10 دقائق على الأكثر)
  const storage = getLocalStorageSafely();
  const lastActiveKey = `${LAST_ACTIVE_PREFIX}${studentId}`;
  const now = Date.now();
  let shouldWriteLastActive = true;

  if (storage) {
    const lastWritten = Number(storage.getItem(lastActiveKey)) || 0;
    if (now - lastWritten < LAST_ACTIVE_THROTTLE_MS) {
      shouldWriteLastActive = false;
    }
  }

  const studentDocPayload: Record<string, unknown> = {
    [`watchProgress.${state.itemId}`]: Math.round(coverage * 100),
    updatedAt: serverTimestamp(),
  };

  if (shouldWriteLastActive) {
    studentDocPayload.lastActiveMs = now;
    if (storage) {
      storage.setItem(lastActiveKey, String(now));
    }
  }

  await setDoc(doc(db, 'students', studentId), studentDocPayload, { merge: true });
}

/**
 * حفظ تقدم المشاهدة:
 * يُخزن محلياً فوراً، ويحاول الإرسال إلى Firestore.
 * في حال الفشل أو انقطاع الاتصال يُضاف لقائمة الانتظار المحلية دون فقدان أي ثانية.
 */
export async function persistWatchProgress(
  studentId: string,
  state: WatchState,
  meta?: { maxPlaybackRate?: number; seekCount?: number }
): Promise<void> {
  if (!studentId || !state.itemId || state.totalDuration <= 0) return;

  // حفظ محلي فوري
  saveLocalWatchState(studentId, state);

  try {
    await writeToFirestore(studentId, state, meta);
  } catch (err) {
    console.warn('Could not save watch progress to Firestore, queued locally:', err);
    enqueueSync({
      id: `${studentId}_${state.itemId}_${Date.now()}`,
      studentId,
      itemId: state.itemId,
      state,
      meta,
      queuedAt: Date.now(),
    });
  }
}

/**
 * تسجيل نقرة تحميل ملف المحاضرة
 */
export async function recordDownloadClick(
  studentId: string,
  courseId: string,
  lectureId: string,
  fileId: string
): Promise<void> {
  if (!studentId || !fileId) return;

  try {
    const clickDoc = {
      courseId,
      lectureId,
      fileId,
      clickedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'students', studentId, 'downloadClicks', fileId), clickDoc, { merge: true });
    await setDoc(
      doc(db, 'students', studentId),
      {
        downloadedFilesCount: increment(1),
        lastActiveMs: Date.now(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn('Could not record download click:', err);
  }
}

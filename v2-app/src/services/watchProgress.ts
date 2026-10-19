import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createWatchState, mergeIntervals, calculateCoveredSeconds, WATCH_THRESHOLD } from '../lib/watchTracker.ts';
import type { WatchState, TimeInterval } from '../lib/watchTracker.ts';

export async function getStoredWatchProgress(studentId: string, itemId: string): Promise<WatchState | null> {
  if (!studentId || !itemId) return null;

  try {
    const snap = await getDoc(doc(db, 'students', studentId, 'watchProgress', itemId));
    if (snap.exists()) {
      const data = snap.data();
      const intervals: TimeInterval[] = Array.isArray(data.intervals) ? data.intervals : [];
      const totalDuration = typeof data.totalDuration === 'number' ? data.totalDuration : 0;
      const state = createWatchState(itemId, totalDuration, intervals, WATCH_THRESHOLD);
      if (typeof data.lastPosition === 'number') {
        state.lastPosition = data.lastPosition;
      }
      return state;
    }

    // fallback: قراءة من حقل watchProgress في مستند الطالب الرئيسي
    const studentSnap = await getDoc(doc(db, 'students', studentId));
    if (studentSnap.exists()) {
      const studentData = studentSnap.data();
      const legacyVal = studentData.watchProgress?.[itemId];
      if (typeof legacyVal === 'number' && legacyVal > 0) {
        const state = createWatchState(itemId, 100, [{ start: 0, end: Math.min(100, legacyVal) }]);
        state.completed = legacyVal >= 95;
        return state;
      }
    }

    return null;
  } catch (err) {
    console.warn('Could not read watch progress:', err);
    return null;
  }
}

export async function persistWatchProgress(studentId: string, state: WatchState): Promise<void> {
  if (!studentId || !state.itemId || state.totalDuration <= 0) return;

  const merged = mergeIntervals(state.intervals);
  const covered = calculateCoveredSeconds(merged, state.totalDuration);
  const coverage = Math.min(1.0, covered / state.totalDuration);
  const completed = coverage >= WATCH_THRESHOLD;

  const payload = {
    itemId: state.itemId,
    coveredSeconds: covered,
    totalDuration: state.totalDuration,
    coverage: Math.round(coverage * 1000) / 1000,
    intervals: merged.map(iv => ({ start: iv.start, end: iv.end })),
    lastPosition: state.lastPosition,
    completed,
    updatedAt: serverTimestamp()
  };

  try {
    // 1. حفظ المستند التفصيلي في subcollection
    await setDoc(doc(db, 'students', studentId, 'watchProgress', state.itemId), payload, { merge: true });

    // 2. تحديث الحقل المقتضب في مستند الطالب للتوافق مع شاشات الإحصائيات
    await setDoc(doc(db, 'students', studentId), {
      [`watchProgress.${state.itemId}`]: Math.round(coverage * 100),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('Could not save watch progress to Firestore:', err);
  }
}

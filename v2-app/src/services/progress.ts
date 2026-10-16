import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// الطالب يعلّم المحاضرة "تمت مشاهدتها". نكتب الحقول الثلاثة المسموحة في القواعد فقط:
// watchProgress[itemId] = 100، وcompletedItems، وprogress[courseId] = { done, lastWatchTime }.
export async function markVideoWatched(uid: string, courseId: string, itemId: string): Promise<void> {
  const reference = doc(db, 'students', uid);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('student-not-found');

    const data = snapshot.data();

    const watchProgress = isObject(data.watchProgress) ? { ...data.watchProgress } : {};
    watchProgress[itemId] = 100;

    const completed: string[] = Array.isArray(data.completedItems)
      ? data.completedItems.filter((value): value is string => typeof value === 'string')
      : [];
    if (!completed.includes(itemId)) completed.push(itemId);

    const progress = isObject(data.progress) ? { ...data.progress } : {};
    const entry = isObject(progress[courseId]) ? (progress[courseId] as Record<string, unknown>) : {};
    const done: string[] = Array.isArray(entry.done)
      ? entry.done.filter((value): value is string => typeof value === 'string')
      : [];
    if (!done.includes(itemId)) done.push(itemId);
    progress[courseId] = { done, lastWatchTime: Date.now() };

    transaction.update(reference, {
      watchProgress,
      completedItems: completed,
      progress,
      lastActive: new Date().toISOString(),
    });
  });
}

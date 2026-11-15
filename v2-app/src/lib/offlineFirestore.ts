import {
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
} from 'firebase/firestore';
import type {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Query,
  QuerySnapshot,
} from 'firebase/firestore';

export function isNavigatorOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * قراءة مستند مع اعتماد الكاش المحلي تلقائياً عند انقطاع الإنترنت.
 * عند توفر الاتصال يُقرأ من السيرفر مباشرة ويُحدّث الكاش دون زيادة استهلاك Firebase.
 */
export async function getDocOfflineFirst<T = DocumentData>(
  ref: DocumentReference<T>,
): Promise<DocumentSnapshot<T>> {
  if (isNavigatorOffline()) {
    try {
      const cached = await getDocFromCache(ref);
      if (cached.exists()) return cached;
    } catch {
      // سيعيد المحاولة من السيرفر إن أمكن أو يرمي خطأ الشبكة المعتاد
    }
  }

  try {
    return await getDoc(ref);
  } catch (err) {
    try {
      const fallback = await getDocFromCache(ref);
      if (fallback.exists()) return fallback;
    } catch {
      // لا يوجد في الكاش
    }
    throw err;
  }
}

/**
 * قراءة استعلام مع اعتماد الكاش المحلي تلقائياً عند انقطاع الإنترنت.
 */
export async function getDocsOfflineFirst<T = DocumentData>(
  q: Query<T>,
): Promise<QuerySnapshot<T>> {
  if (isNavigatorOffline()) {
    try {
      const cached = await getDocsFromCache(q);
      if (!cached.empty) return cached;
    } catch {
      // تجاهل وانتقل لمحاولة الشبكة
    }
  }

  try {
    return await getDocs(q);
  } catch (err) {
    try {
      const fallback = await getDocsFromCache(q);
      if (!fallback.empty) return fallback;
    } catch {
      // لا يوجد في الكاش
    }
    throw err;
  }
}

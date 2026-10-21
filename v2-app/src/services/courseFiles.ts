// جلب الروابط الحساسة عند فتح الكورس (get واحد/كورس).
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface ProtectedFiles {
  pdfUrl: string;
  files: { id: string; title: string; url: string }[];
}
export type CourseFilesMap = Record<string, ProtectedFiles>;

export async function loadCourseFiles(courseId: string): Promise<{ map: CourseFilesMap; denied: boolean }> {
  try {
    const snap = await getDoc(doc(db, 'courseFiles', courseId));
    return { map: snap.exists() ? ((snap.data().items as CourseFilesMap) ?? {}) : {}, denied: false };
  } catch (e) {
    return { map: {}, denied: (e as { code?: string })?.code === 'permission-denied' };
  }
}

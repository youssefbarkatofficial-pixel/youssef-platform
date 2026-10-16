import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// settings/generalSettings = { allowRegistration, welcomeMessage, courseStatus } (نفس شكل المنصة القديمة).
export interface GeneralSettings {
  allowRegistration: boolean;
  welcomeMessage: string;
  courseStatus: string;
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  allowRegistration: true,
  welcomeMessage: '',
  courseStatus: '',
};

// لو المستند غير موجود أو فشلت القراءة: التسجيل مفتوح (لا نقفل الموقع بسبب خطأ شبكة).
export async function getGeneralSettings(): Promise<GeneralSettings> {
  try {
    const snapshot = await getDoc(doc(db, 'settings', 'generalSettings'));
    if (!snapshot.exists()) return DEFAULT_GENERAL_SETTINGS;

    const data = snapshot.data();
    return {
      allowRegistration: data.allowRegistration !== false,
      welcomeMessage: typeof data.welcomeMessage === 'string' ? data.welcomeMessage : '',
      courseStatus: typeof data.courseStatus === 'string' ? data.courseStatus : '',
    };
  } catch {
    return DEFAULT_GENERAL_SETTINGS;
  }
}

export async function saveGeneralSettings(values: GeneralSettings): Promise<void> {
  await setDoc(
    doc(db, 'settings', 'generalSettings'),
    {
      allowRegistration: values.allowRegistration,
      welcomeMessage: values.welcomeMessage.trim().slice(0, 500),
      courseStatus: values.courseStatus.trim().slice(0, 100),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

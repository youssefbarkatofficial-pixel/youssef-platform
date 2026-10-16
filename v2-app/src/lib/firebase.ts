import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// المشروع على خطة Spark المجانية: Authentication وFirestore فقط (بدون Storage وبدون Functions).
// كل القيم تأتي من ملف .env فقط (متغيرات VITE_FIREBASE_*).
const env = import.meta.env;

// هل ملف .env مكتمل؟ (نستخدمه لعرض رسالة واضحة بدل شاشة فارغة)
export const isFirebaseConfigured = Boolean(
  env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID,
);

// قيم مؤقتة عند غياب .env حتى لا يتوقف الموقع عن العمل أثناء التحميل.
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'missing-api-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'missing-project-id',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID || 'missing-app-id',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;

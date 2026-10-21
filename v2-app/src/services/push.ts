import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import { doc, setDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import app, { db } from '../lib/firebase';

const LS_KEY = 'yb_push_token';
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;

export async function pushSupported(): Promise<boolean> {
  return typeof Notification !== 'undefined' && 'serviceWorker' in navigator && !!VAPID_KEY && (await isSupported());
}

export async function enablePush(uid: string): Promise<{ ok: boolean; reason?: string }> {
  if (!(await pushSupported())) return { ok: false, reason: 'unsupported' }; // iPhone: لازم PWA متثبّت
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/firebase-cloud-messaging-push-scope', // نطاق منفصل عن sw.js الحالي
  });
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) return { ok: false, reason: 'no-token' };
  await setDoc(doc(db, 'pushTokens', uid), { tokens: arrayUnion(token), enabled: true, updatedAt: serverTimestamp() }, { merge: true });
  localStorage.setItem(LS_KEY, token);
  return { ok: true };
}

export async function disablePush(uid: string): Promise<void> {
  const token = localStorage.getItem(LS_KEY);
  const patch: Record<string, unknown> = { enabled: false, updatedAt: serverTimestamp() };
  if (token) patch.tokens = arrayRemove(token);
  await setDoc(doc(db, 'pushTokens', uid), patch, { merge: true });
  try { await deleteToken(getMessaging(app)); } catch { /* تجاهل */ }
  localStorage.removeItem(LS_KEY);
}

export function isPushOnLocally(): boolean {
  return !!localStorage.getItem(LS_KEY) && typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

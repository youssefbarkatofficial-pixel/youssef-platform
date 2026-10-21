import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { GradeCode } from '../lib/grades';
import { listStudents } from './students';
import type { Student } from './students';

export type NotificationCategory = 'platformUpdates' | 'curriculumUpdates' | 'laggingWarnings';

export interface NotificationSwitches {
  platformUpdates: boolean;
  curriculumUpdates: boolean;
  laggingWarnings: boolean;
}

export const DEFAULT_NOTIFICATION_SWITCHES: NotificationSwitches = {
  platformUpdates: true,
  curriculumUpdates: true,
  laggingWarnings: true,
};

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  timestamp: string;
  timestampMs: number;
  read: boolean;
  courseId?: string;
  lectureId?: string;
  openAt?: number | null;
  targetType: 'all' | 'grade' | 'course' | 'student';
  targetValue?: string;
}

export interface BroadcastNotificationInput {
  title: string;
  message: string;
  category: NotificationCategory;
  targetType: 'all' | 'grade' | 'course' | 'student';
  targetValue?: string;
  courseId?: string;
  lectureId?: string;
  openAt?: number | null;
  sentBy: string;
}

export interface StudentNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  timestampMs: number | null;
  read: boolean;
  courseId: string;
}

export type NotificationTarget =
  | { type: 'all' }
  | { type: 'grade'; grade: GradeCode }
  | { type: 'course'; courseId: string };

export interface SendNotificationInput {
  title: string;
  message: string;
  target: NotificationTarget;
  sentBy: string;
}

export interface SentNotification {
  id: string;
  title: string;
  message: string;
  target: string;
  recipients: number;
  sentAtMs: number | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

// -----------------------------------------------------------------
// البث الخفيف (Spark-Friendly Broadcast System)
// -----------------------------------------------------------------

export async function getNotificationSwitches(): Promise<NotificationSwitches> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'notificationSwitches'));
    if (snap.exists()) {
      const data = snap.data();
      return {
        platformUpdates: data.platformUpdates !== false,
        curriculumUpdates: data.curriculumUpdates !== false,
        laggingWarnings: data.laggingWarnings !== false,
      };
    }
  } catch (err) {
    console.warn('Could not read notification switches:', err);
  }
  return DEFAULT_NOTIFICATION_SWITCHES;
}

export async function updateNotificationSwitches(
  switches: Partial<NotificationSwitches>
): Promise<void> {
  await setDoc(doc(db, 'settings', 'notificationSwitches'), switches, { merge: true });
}

export async function sendBroadcastNotification(
  input: BroadcastNotificationInput
): Promise<string> {
  const title = input.title.trim();
  const message = input.message.trim();
  if (!title) throw new Error('invalid-title');
  if (!message) throw new Error('invalid-message');

  const id = `notif_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();

  const docData = {
    id,
    title,
    message,
    category: input.category,
    targetType: input.targetType,
    targetValue: input.targetValue || '',
    courseId: input.courseId || '',
    lectureId: input.lectureId || '',
    openAt: input.openAt ?? null,
    sentBy: input.sentBy,
    createdAt: serverTimestamp(),
    createdAtMs: now,
  };

  await setDoc(doc(db, 'broadcast_notifications', id), docData);
  return id;
}

export async function listNotificationsForStudent(
  student: Student | null,
  max = 30
): Promise<AppNotification[]> {
  const switches = await getNotificationSwitches();

  try {
    const q = query(
      collection(db, 'broadcast_notifications'),
      orderBy('createdAtMs', 'desc'),
      limit(max)
    );
    const snap = await getDocs(q);

    const readKey = student?.id ? `read_notifs_${student.id}` : 'read_notifs_guest';
    let readIds: string[] = [];
    try {
      const stored = localStorage.getItem(readKey);
      if (stored) readIds = JSON.parse(stored);
    } catch {}

    const notifications: AppNotification[] = [];

    snap.docs.forEach((d) => {
      const data = d.data();
      const cat = (data.category || 'platformUpdates') as NotificationCategory;

      if (!switches[cat]) return;

      const targetType = data.targetType || 'all';
      const targetValue = data.targetValue || '';

      if (targetType === 'grade' && student && student.grade !== targetValue) return;
      if (targetType === 'course' && student && !student.courses.includes(targetValue)) return;
      if (targetType === 'student' && student && student.id !== targetValue) return;

      const notifId = asString(data.id) || d.id;
      notifications.push({
        id: notifId,
        title: asString(data.title),
        message: asString(data.message),
        category: cat,
        timestamp: new Date(data.createdAtMs || Date.now()).toISOString(),
        timestampMs: data.createdAtMs || Date.now(),
        read: readIds.includes(notifId),
        courseId: asString(data.courseId) || undefined,
        lectureId: asString(data.lectureId) || undefined,
        openAt: typeof data.openAt === 'number' ? data.openAt : null,
        targetType,
        targetValue,
      });
    });

    return notifications;
  } catch (err) {
    console.warn('Error reading broadcast notifications:', err);
    return [];
  }
}

export function markNotificationAsRead(studentUid: string, notificationId: string): void {
  const readKey = studentUid ? `read_notifs_${studentUid}` : 'read_notifs_guest';
  try {
    const stored = localStorage.getItem(readKey);
    const list: string[] = stored ? JSON.parse(stored) : [];
    if (!list.includes(notificationId)) {
      list.push(notificationId);
      localStorage.setItem(readKey, JSON.stringify(list));
    }
  } catch {}
}

export function markAllNotificationsAsRead(studentUid: string, allIds: string[]): void {
  const readKey = studentUid ? `read_notifs_${studentUid}` : 'read_notifs_guest';
  try {
    localStorage.setItem(readKey, JSON.stringify(allIds));
  } catch {}
}

// -----------------------------------------------------------------
// التوافق مع النظام القديم (Legacy Student Subdocument Notifications)
// -----------------------------------------------------------------

export function parseNotifications(value: unknown[]): StudentNotification[] {
  if (!Array.isArray(value)) return [];
  const items: StudentNotification[] = [];

  value.forEach((entry, index) => {
    if (!isObject(entry)) return;
    const timestamp = asString(entry.timestamp);
    const parsed = Date.parse(timestamp);
    items.push({
      id: asString(entry.id) || `legacy_${index}`,
      title: asString(entry.title),
      message: asString(entry.message),
      timestamp,
      timestampMs: Number.isNaN(parsed) ? null : parsed,
      read: entry.read === true,
      courseId: asString(entry.courseId),
    });
  });

  return items.sort((a, b) => (b.timestampMs ?? 0) - (a.timestampMs ?? 0));
}

async function rewriteNotifications(
  uid: string,
  transform: (list: unknown[]) => unknown[]
): Promise<void> {
  const reference = doc(db, 'students', uid);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('student-not-found');

    const existing = snapshot.data().notifications;
    const list: unknown[] = Array.isArray(existing) ? existing : [];
    transaction.update(reference, { notifications: transform(list) });
  });
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  await rewriteNotifications(uid, (list) =>
    list.map((entry) => (isObject(entry) ? { ...entry, read: true } : entry))
  );
}

export async function deleteNotification(uid: string, notificationId: string): Promise<void> {
  await rewriteNotifications(uid, (list) =>
    list.filter((entry) => !(isObject(entry) && entry.id === notificationId))
  );
}

function targetLabel(target: NotificationTarget): string {
  if (target.type === 'grade') return `grade:${target.grade}`;
  if (target.type === 'course') return `course:${target.courseId}`;
  return 'all';
}

export async function sendNotification(input: SendNotificationInput): Promise<number> {
  const title = input.title.trim();
  const message = input.message.trim();
  if (title.length === 0 || title.length > 100) throw new Error('invalid-title');
  if (message.length === 0 || message.length > 500) throw new Error('invalid-message');

  const { students } = await listStudents();
  const recipients = students.filter((student) => {
    if (student.archived) return false;
    if (input.target.type === 'grade') return student.grade === input.target.grade;
    if (input.target.type === 'course') return student.courses.includes(input.target.courseId);
    return true;
  });

  if (recipients.length === 0) throw new Error('no-recipients');

  const notification = {
    id: `adm_${Date.now().toString(36)}`,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
    courseId: input.target.type === 'course' ? input.target.courseId : '',
  };

  const CHUNK = 400;
  for (let start = 0; start < recipients.length; start += CHUNK) {
    const batch = writeBatch(db);
    recipients.slice(start, start + CHUNK).forEach((student) => {
      batch.update(doc(db, 'students', student.id), { notifications: arrayUnion(notification) });
    });
    await batch.commit();
  }

  await addDoc(collection(db, 'sent_notifications'), {
    title,
    message,
    target: targetLabel(input.target),
    recipients: recipients.length,
    sentBy: input.sentBy,
    sentAt: serverTimestamp(),
  });

  return recipients.length;
}

export async function listSentNotifications(max = 20): Promise<SentNotification[]> {
  const snapshot = await getDocs(
    query(collection(db, 'sent_notifications'), orderBy('sentAt', 'desc'), limit(max))
  );

  return snapshot.docs.map((item) => {
    const data = item.data();
    const sentAt = data.sentAt;
    const sentAtMs =
      typeof sentAt === 'object' && sentAt !== null && 'toMillis' in sentAt
        ? (sentAt as { toMillis: () => number }).toMillis()
        : null;
    return {
      id: item.id,
      title: asString(data.title),
      message: asString(data.message),
      target: asString(data.target),
      recipients: typeof data.recipients === 'number' ? data.recipients : 0,
      sentAtMs,
    };
  });
}

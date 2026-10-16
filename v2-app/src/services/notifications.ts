import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { listStudents } from './students';
import type { GradeCode } from '../lib/grades';

// إشعارات الطالب مصفوفة داخل مستنده: [{ id, title, message, timestamp, read, courseId }].
// الطالب يعلّم المقروء أو يحذف من إشعاراته (القواعد تمنعه من إضافة إشعارات جديدة)،
// والأدمن يضيف. بلا Cloud Functions وبلا Push (يحتاج سيرفرًا، مرحلة لاحقة).

export interface StudentNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  timestampMs: number | null;
  read: boolean;
  courseId: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

// الأحدث أولًا.
export function parseNotifications(value: unknown[]): StudentNotification[] {
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
  transform: (list: unknown[]) => unknown[],
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
    list.map((entry) => (isObject(entry) ? { ...entry, read: true } : entry)),
  );
}

export async function deleteNotification(uid: string, notificationId: string): Promise<void> {
  await rewriteNotifications(uid, (list) =>
    list.filter((entry) => !(isObject(entry) && entry.id === notificationId)),
  );
}

// ---------- إرسال الأدمن ----------

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

function targetLabel(target: NotificationTarget): string {
  if (target.type === 'grade') return `grade:${target.grade}`;
  if (target.type === 'course') return `course:${target.courseId}`;
  return 'all';
}

// يرسل لكل الطلاب (أو صف أو كورس) بدفعات batch (≤ 400 كتابة)، بـ arrayUnion ومعرّف واحد للإشعار.
// الطلاب المؤرشفون يُستثنون. يرجع عدد المستلمين.
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

export interface SentNotification {
  id: string;
  title: string;
  message: string;
  target: string;
  recipients: number;
  sentAtMs: number | null;
}

export async function listSentNotifications(max = 20): Promise<SentNotification[]> {
  const snapshot = await getDocs(
    query(collection(db, 'sent_notifications'), orderBy('sentAt', 'desc'), limit(max)),
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

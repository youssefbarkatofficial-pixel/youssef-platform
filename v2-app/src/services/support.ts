import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Student } from './students';

// support_tickets/{id}: { userId (=uid), user, userPhone, message, ts, status, replies, category }.
// التذاكر القديمة قد يكون userId فيها رقم الموبايل: الأدمن يراها، والطالب يرى تذاكره الجديدة فقط.

export type TicketStatus = 'open' | 'answered' | 'closed';
export type TicketCategory = 'question' | 'complaint';

export interface TicketReply {
  from: 'student' | 'admin';
  text: string;
  ts: number | null;
}

export interface Ticket {
  id: string;
  userId: string;
  user: string;
  userPhone: string;
  message: string;
  ts: number | null;
  status: TicketStatus;
  category: TicketCategory;
  replies: TicketReply[];
}

export const MAX_TICKET_TEXT = 2000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

function toMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (isObject(value) && typeof value.seconds === 'number') return value.seconds * 1000;
  return null;
}

function parseReply(value: unknown): TicketReply | null {
  if (typeof value === 'string') return value.trim() ? { from: 'admin', text: value, ts: null } : null;
  if (!isObject(value)) return null;

  const text = asString(value.text) || asString(value.message);
  if (!text.trim()) return null;

  const sender = asString(value.from) || asString(value.sender) || asString(value.by);
  return {
    from: sender === 'student' ? 'student' : 'admin',
    text,
    ts: toMillis(value.ts ?? value.timestamp),
  };
}

function parseTicket(id: string, data: Record<string, unknown>): Ticket {
  const rawStatus = asString(data.status).toLowerCase();
  const status: TicketStatus =
    rawStatus === 'closed' || rawStatus === 'resolved'
      ? 'closed'
      : rawStatus === 'answered' || rawStatus === 'replied'
        ? 'answered'
        : 'open';

  const replies = Array.isArray(data.replies)
    ? data.replies.map(parseReply).filter((item): item is TicketReply => item !== null)
    : [];

  return {
    id,
    userId: asString(data.userId),
    user: asString(data.user),
    userPhone: asString(data.userPhone),
    message: asString(data.message),
    ts: toMillis(data.ts),
    status,
    category: data.category === 'complaint' ? 'complaint' : 'question',
    replies,
  };
}

function sortNewest(items: Ticket[]): Ticket[] {
  return items.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
}

export async function listMyTickets(uid: string): Promise<Ticket[]> {
  const snapshot = await getDocs(
    query(collection(db, 'support_tickets'), where('userId', '==', uid), limit(50)),
  );
  return sortNewest(snapshot.docs.map((item) => parseTicket(item.id, item.data())));
}

export async function listAllTickets(max = 200): Promise<Ticket[]> {
  const snapshot = await getDocs(query(collection(db, 'support_tickets'), limit(max)));
  return sortNewest(snapshot.docs.map((item) => parseTicket(item.id, item.data())));
}

export async function createTicket(
  student: Student,
  message: string,
  category: TicketCategory,
): Promise<void> {
  const text = message.trim();
  if (text.length < 3 || text.length > MAX_TICKET_TEXT) throw new Error('invalid-message');

  const reference = doc(collection(db, 'support_tickets'));
  await setDoc(reference, {
    userId: student.id,
    user: student.name,
    userPhone: student.phone,
    message: text,
    ts: Date.now(),
    status: 'open',
    replies: [],
    category,
  });
}

export async function replyAsStudent(ticketId: string, text: string): Promise<void> {
  const value = text.trim();
  if (value.length < 1 || value.length > MAX_TICKET_TEXT) throw new Error('invalid-message');

  await updateDoc(doc(db, 'support_tickets', ticketId), {
    replies: arrayUnion({ from: 'student', text: value, ts: Date.now() }),
    status: 'open',
    updatedAt: Date.now(),
  });
}

export async function replyAsAdmin(ticketId: string, text: string): Promise<void> {
  const value = text.trim();
  if (value.length < 1 || value.length > MAX_TICKET_TEXT) throw new Error('invalid-message');

  await updateDoc(doc(db, 'support_tickets', ticketId), {
    replies: arrayUnion({ from: 'admin', text: value, ts: Date.now() }),
    status: 'answered',
    updatedAt: Date.now(),
  });
}

export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  await updateDoc(doc(db, 'support_tickets', ticketId), { status, updatedAt: Date.now() });
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'مفتوحة',
  answered: 'تم الرد',
  closed: 'مغلقة',
};

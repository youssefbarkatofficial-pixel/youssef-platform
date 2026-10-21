// صادق: بيانات الطالب الفعلية فقط، بدون أرقام أو عدّادات مخترعة.
import { generateWhatsAppTemplate } from './radar.ts';

export const UPGRADE_AFTER_FIRST_EXAM =
  'مبروك يا {studentName} على أول امتحان! نتيجتك {score}. لو عايز تكمّل باقي المحاضرات والتدريبات بنفس المستوى تقدر تشترك من هنا: {link}';
export const WIN_BACK =
  'وحشتنا يا {studentName}! آخر حاجة كنت فيها: {lectureTitle}. تعالى كمّل من نفس المكان، وأنا موجود لو احتجت أي حاجة.';
export const FRIEND_INVITE = 'تعالى ذاكر معايا على منصة يوسف بركات! استخدم كودي {code} وقت التسجيل.';

export const upgradeMessage = (studentName: string, score: string, link: string) =>
  generateWhatsAppTemplate(UPGRADE_AFTER_FIRST_EXAM, { studentName, score, link });
export const winBackMessage = (studentName: string, lectureTitle: string) =>
  generateWhatsAppTemplate(WIN_BACK, { studentName, lectureTitle });
export const inviteMessage = (code: string) => generateWhatsAppTemplate(FRIEND_INVITE, { code });

/** معاينة مجانية: الفيديو فقط. الدالة دي بتتستخدم داخل checkLectureLock الحالية، مش بديل عنها. */
export function isFreePreview(lecture: { freePreview?: unknown }): boolean {
  return lecture?.freePreview === true;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateCode(len = 8, rand: (n: number) => number = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n): string {
  return Array.from({ length: len }, () => ALPHABET[rand(ALPHABET.length)]).join('');
}
export const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

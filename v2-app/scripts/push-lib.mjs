export const CATEGORIES = ['platformUpdates', 'curriculumUpdates', 'laggingWarnings'];

export function cairoHour(now) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: 'numeric', hourCycle: 'h23' }).format(now));
}
export function isQuietHour(now) { const h = cairoHour(now); return h >= 22 || h < 8; }

export function categoryAllowed(category, switches) {
  if (!CATEGORIES.includes(category)) return false;      // فئة مجهولة ما تتبعتش
  return (switches?.[category] ?? true) !== false;       // نفس الافتراضي: مفتوحة
}

// نفس قيد قاعدة broadcast_notifications: ممنوع أرقام موبايل مصرية داخل النص
export function hasPhoneNumber(text) { return /01[0-9]{9}/.test(String(text ?? '')); }

export function validateQueueItem(q) {
  if (!q || typeof q.uid !== 'string' || !q.uid) return 'no-uid';
  if (!CATEGORIES.includes(q.category)) return 'bad-category';
  if (!q.title || String(q.title).length > 100) return 'bad-title';
  if (!q.body || String(q.body).length > 500) return 'bad-body';
  if (hasPhoneNumber(q.title) || hasPhoneNumber(q.body)) return 'phone-in-text';
  return null;
}

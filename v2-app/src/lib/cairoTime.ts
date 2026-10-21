/**
 * cairoTime.ts
 * دوال تحويل وحساب توقيت القاهرة والتعامل مع التوقيت الصيفي في مصر
 */

export function tzOffsetMs(utcMs: number, tz = "Africa/Cairo"): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  })
    .formatToParts(new Date(utcMs))
    .reduce((a: any, x) => {
      a[x.type] = +x.value;
      return a;
    }, {});
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
}

export function cairoToUtcMs(y: number, m: number, d: number, h = 0, min = 0): number {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let ms = guess - tzOffsetMs(guess);
  ms = guess - tzOffsetMs(ms); // تصحيح ثاني حول تغيّر التوقيت الصيفي
  return ms;
}

/**
 * تحويل نص datetime-local (مثل 2026-10-25T21:00) بتوقيت القاهرة إلى UTC ms
 */
export function cairoInputToUtcMs(cairoInput: string): number | null {
  if (!cairoInput || !cairoInput.trim()) return null;
  const match = cairoInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  const h = parseInt(match[4], 10);
  const min = parseInt(match[5], 10);
  return cairoToUtcMs(y, m, d, h, min);
}

/**
 * تحويل UTC ms إلى نص بتنسيق datetime-local (yyyy-MM-ddThh:mm) بتوقيت القاهرة
 */
export function utcMsToCairoInput(utcMs: number): string {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .formatToParts(new Date(utcMs))
    .reduce((a: any, x) => {
      a[x.type] = x.value;
      return a;
    }, {});
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * تنسيق الوقت بتوقيت القاهرة باللغة العربية
 */
export function formatCairoDateTime(timestampMs: number): string {
  try {
    const date = new Date(timestampMs);
    const dateStr = date.toLocaleDateString('ar-EG', {
      timeZone: 'Africa/Cairo',
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
    const timeStr = date.toLocaleTimeString('ar-EG', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${dateStr} الساعة ${timeStr}`;
  } catch {
    return new Date(timestampMs).toLocaleString('ar-EG');
  }
}

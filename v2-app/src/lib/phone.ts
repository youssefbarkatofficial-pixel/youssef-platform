export const STUDENT_EMAIL_DOMAIN = 'student.youssefbarakat.com';

// تحويل الأرقام العربية والفارسية إلى أرقام إنجليزية (0-9).
export function toEnglishDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}

export function normalizePhone(value: string): string {
  return toEnglishDigits(value).replace(/[\s-]/g, '');
}

// رقم موبايل مصري: 11 رقمًا يبدأ بـ 01.
export function isValidEgyptPhone(value: string): boolean {
  return /^01[0-9]{9}$/.test(normalizePhone(value));
}

// نفس شكل الدخول القديم: رقم_الموبايل@student.youssefbarakat.com
export function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@${STUDENT_EMAIL_DOMAIN}`;
}

export function isStudentEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${STUDENT_EMAIL_DOMAIN}`);
}

// ---------- صيغ الدخول القديمة (للطلاب المسجّلين قبل المنصة الجديدة) ----------
// المنصة القديمة كانت تقبل الرقم بصيغ مختلفة (+20 أو 0020 أو بدون الصفر)،
// وبعض الحسابات القديمة مسجّلة في Firebase Auth بإحدى هذه الصيغ.
export function normalizeLoginPhone(value: string): string {
  let phone = toEnglishDigits(value).replace(/[\s\-().]/g, '');
  phone = phone.replace(/^\+?20/, '0').replace(/^0020/, '0');
  if (/^1[0125][0-9]{8}$/.test(phone)) phone = `0${phone}`;
  return phone;
}

// كل الإيميلات المحتملة للحساب، بنفس ترتيب المنصة القديمة، بدون تكرار.
export function loginEmailCandidates(identifier: string): string[] {
  const raw = identifier.trim();
  if (raw.includes('@')) return [raw.toLowerCase()];

  const phone = normalizeLoginPhone(raw);
  const withoutZero = phone.replace(/^0/, '');
  const forms = [phone, withoutZero, `20${withoutZero}`, `+20${withoutZero}`, raw];

  return Array.from(
    new Set(forms.filter(Boolean).map((form) => `${form}@${STUDENT_EMAIL_DOMAIN}`.toLowerCase())),
  );
}


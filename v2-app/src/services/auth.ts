import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { loginEmailCandidates, normalizePhone, phoneToEmail } from '../lib/phone';
import { createStudentProfile } from './students';
import type { GradeCode, GradeTrack } from '../lib/grades';

export interface RegisterInput {
  name: string;
  phone: string;
  parentPhone: string;
  grade: GradeCode;
  track?: GradeTrack | null;
  gov: string;
  password: string;
}

export class ProfileCreationError extends Error {
  constructor() {
    super('profile-creation-failed');
    this.name = 'ProfileCreationError';
  }
}

// تسجيل طالب جديد: حساب في Firebase Auth ثم مستند في students/{uid}.
export async function registerStudent(input: RegisterInput): Promise<void> {
  const email = phoneToEmail(input.phone);
  const credential = await createUserWithEmailAndPassword(auth, email, input.password);

  try {
    await createStudentProfile({
      uid: credential.user.uid,
      name: input.name,
      phone: normalizePhone(input.phone),
      parentPhone: normalizePhone(input.parentPhone),
      grade: input.grade,
      track: input.track,
      gov: input.gov,
      email,
    });
  } catch {
    await signOut(auth);
    throw new ProfileCreationError();
  }
}

// لو كُتب إيميل (فيه @) نستخدمه كما هو، وإلا نعتبره رقم موبايل ونجرّب كل صيغ الإيميل المحتملة
// (نفس منطق المنصة القديمة) حتى يدخل الطلاب القدام مهما كانت صيغة تسجيلهم.
export function resolveLoginEmail(identifier: string): string {
  return loginEmailCandidates(identifier)[0];
}

const STOP_CODES = ['auth/too-many-requests', 'auth/network-request-failed', 'auth/user-disabled'];

export async function loginWithIdentifier(identifier: string, password: string): Promise<void> {
  const candidates = loginEmailCandidates(identifier);
  let bestError: unknown = null;

  for (const email of candidates) {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return;
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code: unknown }).code)
          : '';
      if (STOP_CODES.includes(code)) throw error;
      if (bestError === null || code === 'auth/wrong-password') bestError = error;
    }
  }

  throw bestError ?? new Error('login-failed');
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export async function sendResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export function getAuthErrorMessage(error: unknown, identifier?: string): string {
  if (error instanceof ProfileCreationError) {
    return 'تم إنشاء حسابك لكن تعذر حفظ بياناتك. تواصل مع إدارة المنصة.';
  }

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  const isEmail = typeof identifier === 'string' && identifier.includes('@');

  switch (code) {
    case 'auth/email-already-in-use':
      return isEmail
        ? 'البريد الإلكتروني هذا مسجّل بالفعل. جرّب تسجيل الدخول.'
        : 'رقم الموبايل هذا مسجّل بالفعل. جرّب تسجيل الدخول.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return isEmail
        ? 'اتأكد إن الإيميل مكتوب صح بدون مسافات أو حروف كبيرة، أو استخدم نسيت كلمة المرور.'
        : 'رقم الموبايل أو كلمة المرور غير صحيحة.';
    case 'auth/too-many-requests':
      return 'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالإنترنت. تأكد من اتصالك ثم حاول مرة أخرى.';
    case 'auth/user-disabled':
      return 'هذا الحساب موقوف. تواصل مع إدارة المنصة.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة. اختر كلمة مرور أقوى.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'إعدادات Firebase غير صحيحة. راجع ملف .env.';
    default:
      return 'حدث خطأ غير متوقع. حاول مرة أخرى.';
  }
}

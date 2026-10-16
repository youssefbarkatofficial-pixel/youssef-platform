import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isStudentEmail } from '../lib/phone';

// المالك الأساسي للمنصة.
export const OWNER_EMAIL = 'youssefbarkatofficial@gmail.com';

// owner: المالك. admin: أدمن كامل. assistant: مساعد (محجوب عنه الدعم الفني والبوصلة وتصفير الدخل وإدارة المشرفين).
export type AdminRole = 'owner' | 'admin' | 'assistant';

export interface AdminRecord {
  email: string;
  name: string;
  role: 'admin' | 'assistant';
  active: boolean;
}

// نفس منطق القواعد: الدور الناقص يعني admin (للتوافق مع المستندات القديمة)، وأي قيمة غير admin تُعامل كمساعد.
// هذا الفحص لإظهار الواجهة المناسبة فقط، والحماية الحقيقية في firestore.rules.new.
export async function getAdminRole(email: string | null | undefined): Promise<AdminRole | null> {
  if (!email) return null;

  const normalized = email.trim().toLowerCase();
  if (normalized === OWNER_EMAIL) return 'owner';
  if (isStudentEmail(normalized)) return null;

  try {
    const snapshot = await getDoc(doc(db, 'platformAdmins', normalized));
    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    if (data.active === false) return null;

    const role = typeof data.role === 'string' ? data.role : 'admin';
    return role === 'admin' ? 'admin' : 'assistant';
  } catch {
    return null;
  }
}

export async function checkIsAdmin(email: string | null | undefined): Promise<boolean> {
  return (await getAdminRole(email)) !== null;
}

export async function listAdmins(): Promise<AdminRecord[]> {
  const snapshot = await getDocs(collection(db, 'platformAdmins'));

  return snapshot.docs
    .map((item) => {
      const data = item.data();
      return {
        email: item.id,
        name: typeof data.name === 'string' ? data.name : '',
        role: data.role === 'assistant' ? ('assistant' as const) : ('admin' as const),
        active: data.active !== false,
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
}

// المالك فقط (القواعد). لا حذف: التعطيل بحقل active.
export async function saveAdmin(record: AdminRecord): Promise<void> {
  const email = record.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid-email');
  if (email === OWNER_EMAIL) throw new Error('owner-email');

  await setDoc(
    doc(db, 'platformAdmins', email),
    { name: record.name.trim(), email, role: record.role, active: record.active },
    { merge: true },
  );
}

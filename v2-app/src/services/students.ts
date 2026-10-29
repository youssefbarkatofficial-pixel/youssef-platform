import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getAcademicYear, parseAcademicYear } from '../lib/dates';
import { normalizeGrade } from '../lib/grades';
import { isIgnoredStudentId } from '../lib/studentIds';
import type { GradeCode, GradeTrack } from '../lib/grades';

export interface Student {
  id: string;
  name: string;
  phone: string;
  parentPhone: string;
  plainPassword?: string;
  grade: GradeCode | null;
  track?: GradeTrack | null;
  rawGrade: string;
  gov: string;
  studentCode: string;
  email: string;
  role: string;
  courses: string[];
  notifications: unknown[];
  badges: unknown[];
  progress: unknown;
  // مصفوفة محاولات الامتحانات (كل محاولة عنصر).
  examResults: unknown[];
  watchProgress: Record<string, number>;
  completedItems: string[];
  lastActiveMs: number | null;
  createdAtMs: number | null;
  xp: number;
  points: number;
  archived: boolean;
  lastUpdatedAcademicYear: number | null;
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    const candidate = (value as { toMillis: () => number }).toMillis;
    if (typeof candidate === 'function') return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

function asProgressMap(value: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return result;
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    if (typeof entry === 'number' && Number.isFinite(entry)) result[key] = entry;
  });
  return result;
}

function asTrack(value: unknown): GradeTrack | null {
  if (value === 'general' || value === 'bacc') return value;
  return null;
}

// قراءة متسامحة: أي حقل ناقص يأخذ قيمة افتراضية.
// نختار الحقول المسموحة بالاسم فقط، ولا نقرأ حقل كلمة المرور القديم أبدًا.
function toStudent(id: string, data: DocumentData): Student {
  return {
    id,
    name: asString(data.name),
    phone: asString(data.phone),
    parentPhone: asString(data.parentPhone),
    plainPassword: asString(data.plainPassword) || asString(data.password) || undefined,
    grade: normalizeGrade(data.grade),
    track: asTrack(data.track),
    rawGrade: asString(data.grade),
    gov: asString(data.gov),
    studentCode: asString(data.studentCode),
    email: asString(data.email),
    role: asString(data.role) || 'student',
    courses: asStringList(data.courses),
    notifications: asList(data.notifications),
    badges: asList(data.badges),
    progress: data.progress,
    examResults: asList(data.examResults),
    watchProgress: asProgressMap(data.watchProgress),
    completedItems: asStringList(data.completedItems),
    lastActiveMs: toMillis(data.lastActive),
    createdAtMs: toMillis(data.createdAt),
    xp: asNumber(data.xp),
    points: asNumber(data.points),
    archived: data.archived === true,
    lastUpdatedAcademicYear: parseAcademicYear(data.lastUpdatedAcademicYear),
  };
}

export async function getStudent(uid: string): Promise<Student | null> {
  const snapshot = await getDoc(doc(db, 'students', uid));
  if (!snapshot.exists()) return null;
  const student = toStudent(snapshot.id, snapshot.data());
  if ((!student.plainPassword || student.plainPassword === 'مخفية') && student.phone) {
    try {
      const syncDoc = await getDoc(doc(db, 'students', 'sync_' + student.phone));
      if (syncDoc.exists()) {
        const syncData = syncDoc.data();
        const pwd = asString(syncData.plainPassword) || asString(syncData.password);
        if (pwd) {
          student.plainPassword = pwd;
        }
      }
    } catch {
      // Best-effort
    }
  }
  return student;
}

// كود الطالب الجديد: YB- ثم 8 رموز عشوائية.
// الكود القديم 10 رموز بدون شرطة، فلا يمكن أن يتطابق مع أي كود جديد.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 رمزًا

export function generateStudentCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  let code = '';
  bytes.forEach((byte) => {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  });

  return `YB-${code}`;
}

// فحص التكرار قدر الإمكان. لو منعت قواعد الأمان هذا الاستعلام للطالب،
// نعتمد على العشوائية الكبيرة (أكثر من تريليون احتمال).
async function isCodeTaken(code: string): Promise<boolean> {
  try {
    const result = await getDocs(
      query(collection(db, 'students'), where('studentCode', '==', code), limit(1)),
    );
    return !result.empty;
  } catch {
    return false;
  }
}

async function createUniqueStudentCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateStudentCode();
    if (!(await isCodeTaken(code))) return code;
  }
  throw new Error('student-code-generation-failed');
}

export interface NewStudentInput {
  uid: string;
  name: string;
  phone: string;
  parentPhone: string;
  grade: GradeCode;
  track?: GradeTrack | null;
  gov: string;
  email: string;
}

// ينشئ مستند طالب جديد فقط. لا يكتب فوق أي مستند موجود، ولا يغيّر كود أي طالب.
export async function createStudentProfile(input: NewStudentInput): Promise<void> {
  const reference = doc(db, 'students', input.uid);

  const existing = await getDoc(reference);
  if (existing.exists()) {
    throw new Error('student-document-exists');
  }

  const studentCode = await createUniqueStudentCode();

  const data: Record<string, unknown> = {
    name: input.name,
    phone: input.phone,
    parentPhone: input.parentPhone,
    grade: input.grade,
    gov: input.gov,
    studentCode,
    email: input.email,
    role: 'student',
    courses: [],
    notifications: [],
    xp: 0,
    points: 0,
    badges: [],
    lastUpdatedAcademicYear: getAcademicYear(),
    createdAt: serverTimestamp(),
  };

  if (input.track) {
    data.track = input.track;
  }

  await setDoc(reference, data);
}

// التحديث السنوي للصف: يعدّل حقلين أو ثلاثة في مستند الطالب نفسه.
export async function updateStudentGrade(
  uid: string,
  grade: GradeCode,
  academicYear: number = getAcademicYear(),
  track?: GradeTrack | null,
): Promise<void> {
  const updates: Record<string, unknown> = {
    grade,
    lastUpdatedAcademicYear: academicYear,
  };
  if (track !== undefined) {
    updates.track = track;
  }
  await updateDoc(doc(db, 'students', uid), updates);
}

// تحديث مسار الطالب الثانوي.
export async function updateStudentTrack(
  uid: string,
  track: GradeTrack,
): Promise<void> {
  await updateDoc(doc(db, 'students', uid), { track });
}

// تحديث بيانات الملف الشخصي المسموحة للطالب.
export async function updateStudentProfile(
  uid: string,
  data: {
    name?: string;
    parentPhone?: string;
    grade?: GradeCode;
    track?: GradeTrack | null;
  },
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.parentPhone !== undefined) updates.parentPhone = data.parentPhone;
  if (data.grade !== undefined) updates.grade = data.grade;
  if (data.track !== undefined) updates.track = data.track;
  await updateDoc(doc(db, 'students', uid), updates);
}


// ---------- للأدمن ----------

export const STUDENTS_LIST_LIMIT = 1500;

let cachedStudentsResult: { students: Student[]; truncated: boolean; timestamp: number } | null = null;
const STUDENTS_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// قائمة الطلاب الحقيقيين فقط (بدون التوائم sync_* وحساب الدعم). حد أقصى لحماية حصة القراءة في Spark مع كاش ذاكرة SWR.
export async function listStudents(options?: { forceRefresh?: boolean }): Promise<{ students: Student[]; truncated: boolean }> {
  if (!options?.forceRefresh && cachedStudentsResult && Date.now() - cachedStudentsResult.timestamp < STUDENTS_CACHE_TTL_MS) {
    return { students: cachedStudentsResult.students, truncated: cachedStudentsResult.truncated };
  }

  const snapshot = await getDocs(query(collection(db, 'students'), limit(STUDENTS_LIST_LIMIT)));

  // استخراج كلمات المرور القديمة من المستندات التوأم sync_<phone>
  const syncPasswords = new Map<string, string>();
  snapshot.docs.forEach((item) => {
    if (item.id.startsWith('sync_')) {
      const data = item.data();
      const pwd = asString(data.plainPassword) || asString(data.password);
      if (pwd) {
        const phone = item.id.replace('sync_', '').trim();
        syncPasswords.set(phone, pwd);
      }
    }
  });

  const students = snapshot.docs
    .filter((item) => !isIgnoredStudentId(item.id))
    .map((item) => {
      const student = toStudent(item.id, item.data());
      if ((!student.plainPassword || student.plainPassword === 'مخفية') && student.phone && syncPasswords.has(student.phone)) {
        student.plainPassword = syncPasswords.get(student.phone);
      }
      return student;
    });

  const result = { students, truncated: snapshot.size >= STUDENTS_LIST_LIMIT };
  cachedStudentsResult = { ...result, timestamp: Date.now() };
  return result;
}

// تجميد الحساب بدل الحذف: الطالب المؤرشف لا يكتب شيئًا (القواعد)، والبيانات كلها تبقى.
export async function setStudentArchived(uid: string, archived: boolean): Promise<void> {
  await updateDoc(doc(db, 'students', uid), { archived });
}

// آخر ظهور: كتابة واحدة في الجلسة (تُستدعى من لوحة الطالب). الفشل لا يظهر للطالب.
export async function touchLastActive(uid: string): Promise<void> {
  await updateDoc(doc(db, 'students', uid), { lastActive: new Date().toISOString() });
}

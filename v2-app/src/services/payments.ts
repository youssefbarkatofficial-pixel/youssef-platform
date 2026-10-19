import {
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
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { DocumentData, DocumentReference } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getImageErrorMessage } from '../lib/image';
import type { CompressedImage } from '../lib/image';
import { isIgnoredStudentId } from '../lib/studentIds';
import type { Course } from './courses';
import type { Student } from './students';

// خطة Spark المجانية: إيصال الدفع يُخزَّن كنص داخل مستند منفصل paymentProofs/{requestId}
// (حتى لا تثقل قوائم الطلبات)، والموافقة والرفض من لوحة الأدمن مباشرة (بدون Cloud Functions).

// ---------- الأنواع ----------

export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'other';
export type PaymentMethod = 'vodafone' | 'fawry';

export interface PaymentRequest {
  id: string;
  courseId: string;
  courseName: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail: string;
  proofImageKey: string;
  // صورة الإثبات القديمة فقط (رابط أو data:image داخل الطلب). الجديدة تُحمَّل عند الطلب.
  proofSrc: string;
  // الطلبات الجديدة: صورة الإثبات في paymentProofs/{id}
  hasProofDoc: boolean;
  status: PaymentStatus;
  rawStatus: string;
  createdAt: string;
  createdAtMs: number | null;
  method: PaymentMethod | null;
  amount: number | null;
  rejectReason: string;
  reviewedBy: string;
  // true لو صُفّر الدخل (الطلب يبقى كما هو ولا يُحسب في الإيرادات).
  archivedRevenue: boolean;
  // للأدمن: هل يمكن الموافقة أو الرفض؟ (معلّق وفيه courseId و userId أو userPhone)
  actionable: boolean;
}

export interface StatusInfo {
  label: string;
  variant: 'gold' | 'success' | 'danger' | 'neutral';
}

export interface PaymentSettings {
  vCashNum: string;
  paymentInstructions: string;
  enableFawry: boolean;
  // false لو الإعدادات غير موجودة أو فشل تحميلها: يتوقف الدفع برسالة بدل عرض رقم قديم.
  available: boolean;
}

// لا نضع رقمًا ثابتًا هنا: لو فشل تحميل الإعدادات يتوقف الدفع (available: false)
// ولا يرى الطالب رقمًا قد يكون قديمًا. المالك يحدد الرقم من صفحة المدفوعات.
export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  vCashNum: '',
  paymentInstructions:
    'حوّل المبلغ المطلوب إلى الرقم الموضح، ثم ارفع صورة إيصال التحويل واضغط إرسال. سيتم تفعيل الكورس بعد مراجعة طلبك.',
  enableFawry: false,
  available: false,
};

// أقصى طول لنص صورة الإيصال (أقل من حد قاعدة الأمان 160000).
const MAX_PROOF_TEXT_LENGTH = 158000;

// ---------- أدوات القراءة المتسامحة ----------

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// الحالات: pending وapproved وrejected وcancelled، والقديمة active تُعامل كأنها approved.
export function normalizePaymentStatus(value: unknown): PaymentStatus {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';

  if (status === 'pending') return 'pending';
  if (status === 'approved' || status === 'active') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  return 'other';
}

export function getStatusInfo(status: PaymentStatus): StatusInfo {
  switch (status) {
    case 'pending':
      return { label: 'قيد المراجعة', variant: 'gold' };
    case 'approved':
      return { label: 'تم التفعيل', variant: 'success' };
    case 'rejected':
      return { label: 'مرفوض', variant: 'danger' };
    case 'cancelled':
      return { label: 'ملغي', variant: 'neutral' };
    default:
      return { label: 'غير معروفة', variant: 'neutral' };
  }
}

function isDisplayableImage(value: string): boolean {
  return value.startsWith('https://') || value.startsWith('data:image/');
}

function parseRequest(id: string, data: DocumentData): PaymentRequest {
  const status = normalizePaymentStatus(data.status);
  const courseId = asString(data.courseId);
  const userId = asString(data.userId);
  const userPhone = asString(data.userPhone);
  const createdAt = asString(data.createdAt);
  const parsedTime = Date.parse(createdAt);

  const urlCandidate = asString(data.proofImageUrl);
  const imageCandidate = asString(data.proofImage);
  const proofSrc = isDisplayableImage(urlCandidate)
    ? urlCandidate
    : isDisplayableImage(imageCandidate)
      ? imageCandidate
      : '';

  // الطلبات القديمة قد تحمل paymentMethod (vodafone_cash | fawry | wallet) بدل method.
  const rawMethod = asString(data.method) || asString(data.paymentMethod);
  const method: PaymentMethod | null =
    rawMethod === 'fawry' ? 'fawry' : rawMethod === 'vodafone' || rawMethod === 'vodafone_cash' ? 'vodafone' : null;

  return {
    id,
    courseId,
    courseName: asString(data.courseName),
    userId,
    userName: asString(data.userName),
    userPhone,
    userEmail: asString(data.userEmail),
    proofImageKey: asString(data.proofImageKey),
    proofSrc,
    hasProofDoc: data.hasProofDoc === true,
    status,
    rawStatus: asString(data.status),
    createdAt,
    createdAtMs: Number.isNaN(parsedTime) ? null : parsedTime,
    method,
    amount: typeof data.amount === 'number' && Number.isFinite(data.amount) ? data.amount : null,
    rejectReason: asString(data.rejectReason),
    reviewedBy: asString(data.reviewedBy),
    archivedRevenue: data.archived_revenue === true,
    actionable: status === 'pending' && courseId !== '' && (userId !== '' || userPhone !== ''),
  };
}

// تاريخ ووقت بأرقام إنجليزية: YYYY-MM-DD HH:MM
export function formatRequestDate(request: PaymentRequest): string {
  if (request.createdAtMs === null) return request.createdAt || '-';

  const date = new Date(request.createdAtMs);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ---------- إعدادات الدفع ----------

// المستند settings/paymentSettings: لو غير موجود أو فشلت قراءته أو بلا رقم، يتوقف الدفع (available: false).
export async function getPaymentSettings(): Promise<PaymentSettings> {
  try {
    const snapshot = await getDoc(doc(db, 'settings', 'paymentSettings'));
    if (!snapshot.exists()) return DEFAULT_PAYMENT_SETTINGS;

    const data = snapshot.data();
    const vCashNum = asString(data.vCashNum).trim();
    return {
      vCashNum,
      paymentInstructions:
        asString(data.paymentInstructions) || DEFAULT_PAYMENT_SETTINGS.paymentInstructions,
      enableFawry: data.enableFawry === true,
      available: vCashNum.length > 0,
    };
  } catch {
    return DEFAULT_PAYMENT_SETTINGS;
  }
}

// حفظ إعدادات الدفع (الأدمن فقط حسب القواعد).
export async function savePaymentSettings(
  values: { vCashNum: string; paymentInstructions: string; enableFawry: boolean },
): Promise<void> {
  const vCashNum = values.vCashNum.trim();
  if (!/^01[0-9]{9}$/.test(vCashNum)) {
    throw new Error('invalid-cash-number');
  }
  await setDoc(
    doc(db, 'settings', 'paymentSettings'),
    {
      vCashNum,
      paymentInstructions: values.paymentInstructions.trim(),
      enableFawry: values.enableFawry,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// ---------- قراءة الطلبات ----------

// طلبات الطالب الجديدة (userId = uid). الطلبات القديمة (userId = رقم الموبايل) لا تظهر هنا.
export async function listMyPaymentRequests(uid: string): Promise<PaymentRequest[]> {
  const snapshot = await getDocs(
    query(collection(db, 'paymentRequests'), where('userId', '==', uid), limit(100)),
  );

  return snapshot.docs
    .map((item) => parseRequest(item.id, item.data()))
    .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
}

const requestsCache = new Map<number, { data: PaymentRequest[]; timestamp: number }>();
const REQUESTS_CACHE_TTL_MS = 60 * 1000; // 1 minute

// للأدمن: أحدث الطلبات أولًا، بعدد محدود مع كاش ذاكرة SWR لتسريع لوحة الإدارة.
export async function listPaymentRequests(
  max: number,
  options?: { forceRefresh?: boolean },
): Promise<PaymentRequest[]> {
  const cached = requestsCache.get(max);
  if (
    !options?.forceRefresh &&
    cached &&
    Date.now() - cached.timestamp < REQUESTS_CACHE_TTL_MS
  ) {
    return cached.data;
  }

  const snapshot = await getDocs(
    query(collection(db, 'paymentRequests'), orderBy('createdAt', 'desc'), limit(max)),
  );

  const data = snapshot.docs.map((item) => parseRequest(item.id, item.data()));
  requestsCache.set(max, { data, timestamp: Date.now() });
  return data;
}

// صورة الإيصال الجديدة: تُحمَّل عند الطلب فقط (زر عرض الإيصال)، ولا تدخل في القوائم.
export async function getPaymentProof(requestId: string): Promise<string> {
  const snapshot = await getDoc(doc(db, 'paymentProofs', requestId));
  if (!snapshot.exists()) return '';

  const dataUrl = asString(snapshot.data().dataUrl);
  return dataUrl.startsWith('data:image/') ? dataUrl : '';
}

// ---------- إرسال طلب دفع (الطالب) ----------

export interface SubmitPaymentInput {
  student: Student;
  course: Course;
  amount: number;
  method: PaymentMethod;
  // صورة الإيصال بعد ضغطها في المتصفح (≤ 117,000 بايت)
  proof: CompressedImage;
}

// ينشئ الطلب ومستند الإيصال معًا في دفعة واحدة (batch)، فلا يبقى طلب بلا إيصال ولا العكس.
export async function submitPaymentRequest(input: SubmitPaymentInput): Promise<string> {
  const { student, course, proof } = input;

  if (student.courses.includes(course.id)) {
    throw new Error('already-owned');
  }

  if (proof.dataUrl.length > MAX_PROOF_TEXT_LENGTH) {
    throw new Error('image-too-detailed');
  }

  const mine = await listMyPaymentRequests(student.id);
  if (mine.some((item) => item.courseId === course.id && item.status === 'pending')) {
    throw new Error('duplicate-pending');
  }

  const now = new Date().toISOString();
  const requestRef = doc(collection(db, 'paymentRequests'));
  const proofRef = doc(db, 'paymentProofs', requestRef.id);

  const batch = writeBatch(db);

  batch.set(requestRef, {
    courseId: course.id,
    courseName: course.title,
    userId: student.id,
    userName: student.name,
    userPhone: student.phone,
    userEmail: student.email,
    proofImageKey: requestRef.id,
    proofImageUrl: '',
    proofImage: null,
    hasProofDoc: true,
    status: 'pending',
    createdAt: now,
    method: input.method,
    amount: input.amount,
  });

  batch.set(proofRef, {
    userId: student.id,
    dataUrl: proof.dataUrl,
    mime: proof.mime,
    bytes: proof.bytes,
    createdAt: now,
  });

  await batch.commit();
  return requestRef.id;
}

// ---------- مراجعة الطلب (الأدمن) ----------

// يتجاهل التوائم القديمة sync_<phone> وحساب support_000، فالطلاب الحقيقيون مستندات uid فقط.
async function findStudentByPhone(phone: string): Promise<DocumentReference | null> {
  const value = phone.trim();
  if (!value) return null;

  const result = await getDocs(
    query(collection(db, 'students'), where('phone', '==', value), limit(10)),
  );

  const match = result.docs.find((item) => !isIgnoredStudentId(item.id));
  return match ? match.ref : null;
}

// نفس ترتيب المنصة القديمة: students/{userId} ثم البحث بالموبايل بقيمة userId ثم بـ userPhone.
async function findStudentRef(request: PaymentRequest): Promise<DocumentReference | null> {
  const userId = request.userId.trim();

  if (userId && !userId.includes('/') && !isIgnoredStudentId(userId)) {
    const direct = doc(db, 'students', userId);
    const snapshot = await getDoc(direct);
    if (snapshot.exists()) return direct;

    const byUserId = await findStudentByPhone(userId);
    if (byUserId) return byUserId;
  }

  if (request.userPhone && request.userPhone.trim() !== userId) {
    return findStudentByPhone(request.userPhone);
  }

  return null;
}

interface StudentNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  courseId: string;
  proofImageKey: string;
}

function buildNotification(
  id: string,
  title: string,
  message: string,
  request: PaymentRequest,
): StudentNotification {
  return {
    id,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
    courseId: request.courseId,
    proofImageKey: request.proofImageKey,
  };
}

// معاملة واحدة: تضيف الكورس لو غير موجود (includes)، وتضيف الإشعار لو رقمه غير موجود.
// بهذا لا يتكرر أي منهما لو نُفّذت العملية مرتين.
async function updateStudentAfterReview(
  studentRef: DocumentReference,
  notification: StudentNotification,
  courseIdToGrant: string | null,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(studentRef);
    if (!snapshot.exists()) {
      throw new Error('student-not-found');
    }

    const data = snapshot.data();
    const courses: unknown[] = Array.isArray(data.courses) ? data.courses : [];
    const notifications: unknown[] = Array.isArray(data.notifications) ? data.notifications : [];
    const updates: Record<string, unknown> = {};

    if (courseIdToGrant && !courses.map(String).includes(courseIdToGrant)) {
      updates.courses = [...courses, courseIdToGrant];
    }

    const hasNotification = notifications.some(
      (item) => isObject(item) && item.id === notification.id,
    );
    if (!hasNotification) {
      updates.notifications = [...notifications, notification];
    }

    if (Object.keys(updates).length > 0) {
      transaction.update(studentRef, updates);
    }
  });
}

export async function approvePaymentRequest(
  request: PaymentRequest,
  adminEmail: string,
): Promise<void> {
  if (!request.actionable) {
    throw new Error('request-not-actionable');
  }

  // لا نوافق على طلب كورسه غير موجود في قائمة الكورسات.
  const courseSnapshot = await getDoc(doc(db, 'courses', request.courseId));
  if (!courseSnapshot.exists()) {
    throw new Error('course-not-found');
  }

  const studentRef = await findStudentRef(request);
  if (!studentRef) {
    throw new Error('student-not-found');
  }

  const name = request.courseName || 'الكورس';
  const notification = buildNotification(
    `pay_${request.id}`,
    'تم تفعيل الكورس',
    `تم قبول طلب الدفع وتفعيل كورس "${name}". يمكنك الآن مشاهدة الحصص.`,
    request,
  );

  // معاملة واحدة على المستندين: إما يُفعَّل الكورس وتتغير حالة الطلب معًا، أو لا يحدث شيء.
  const requestRef = doc(db, 'paymentRequests', request.id);
  await runTransaction(db, async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists() || requestSnapshot.data().status !== 'pending') {
      throw new Error('request-not-actionable');
    }

    const studentSnapshot = await transaction.get(studentRef);
    if (!studentSnapshot.exists()) {
      throw new Error('student-not-found');
    }

    const data = studentSnapshot.data();
    const courses: unknown[] = Array.isArray(data.courses) ? data.courses : [];
    const notifications: unknown[] = Array.isArray(data.notifications) ? data.notifications : [];
    const updates: Record<string, unknown> = {};

    if (!courses.map(String).includes(request.courseId)) {
      updates.courses = [...courses, request.courseId];
    }
    if (!notifications.some((item) => isObject(item) && item.id === notification.id)) {
      updates.notifications = [...notifications, notification];
    }
    if (Object.keys(updates).length > 0) {
      transaction.update(studentRef, updates);
    }

    transaction.update(requestRef, {
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: adminEmail,
    });
  });
}

export async function rejectPaymentRequest(
  request: PaymentRequest,
  reason: string,
  adminEmail: string,
): Promise<void> {
  if (!request.actionable) {
    throw new Error('request-not-actionable');
  }

  const cleanReason = reason.trim();

  await updateDoc(doc(db, 'paymentRequests', request.id), {
    status: 'rejected',
    rejectReason: cleanReason,
    reviewedAt: new Date().toISOString(),
    reviewedBy: adminEmail,
  });

  // إشعار الطالب بالرفض (محاولة فقط، فعدم نجاحه لا يلغي الرفض).
  try {
    const studentRef = await findStudentRef(request);
    if (studentRef) {
      const name = request.courseName || 'الكورس';
      await updateStudentAfterReview(
        studentRef,
        buildNotification(
          `payrej_${request.id}`,
          'تم رفض طلب الدفع',
          `تم رفض طلب الدفع لكورس "${name}". السبب: ${cleanReason}`,
          request,
        ),
        null,
      );
    }
  } catch {
    // لا شيء.
  }
}

// ---------- رسائل الأخطاء ----------

export function getPaymentErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';

  switch (message) {
    case 'invalid-cash-number':
      return 'رقم فودافون كاش غير صحيح (11 رقمًا يبدأ بـ 01).';
    case 'already-owned':
      return 'أنت مشترك في هذا الكورس بالفعل.';
    case 'duplicate-pending':
      return 'لديك طلب معلّق لهذا الكورس بالفعل. انتظر مراجعته.';
    case 'invalid-image-type':
    case 'image-source-too-large':
    case 'image-read-failed':
    case 'image-compress-failed':
    case 'image-too-detailed':
      return getImageErrorMessage(error);
    case 'student-not-found':
      return 'لم نجد حساب الطالب الخاص بهذا الطلب (مستند uid).';
    case 'course-not-found':
      return 'هذا الكورس غير موجود في قائمة الكورسات، فلا يمكن الموافقة على الطلب.';
    case 'request-not-actionable':
      return 'هذا الطلب لا يمكن الموافقة عليه أو رفضه (بياناته ناقصة).';
    default:
      return 'تعذر تنفيذ العملية. تأكد من اتصالك وصلاحياتك وحاول مرة أخرى.';
  }
}


// ---------- تصفير الدخل (المالك والأدمن الكامل فقط) ----------

// لا حذف أبدًا: نضع archived_revenue = true على الطلبات الموافق عليها فقط، فتخرج من حساب الإيرادات.
// القواعد تسمح بهذا الحقل وحده، ولمن دوره admin أو المالك.
export async function archiveRevenue(requestIds: string[]): Promise<number> {
  const CHUNK = 400;
  let done = 0;

  for (let start = 0; start < requestIds.length; start += CHUNK) {
    const batch = writeBatch(db);
    requestIds.slice(start, start + CHUNK).forEach((id) => {
      batch.update(doc(db, 'paymentRequests', id), { archived_revenue: true });
    });
    await batch.commit();
    done += Math.min(CHUNK, requestIds.length - start);
  }

  return done;
}

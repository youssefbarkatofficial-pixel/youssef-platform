import {
  deleteField,
  runTransaction,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizeGrade } from '../lib/grades';
import type { GradeCode } from '../lib/grades';
import type { AssessmentKind } from '../lib/grading';
import { getVideoSource } from '../lib/media';
import type { Student } from './students';
import type {
  NormalizedTraining,
  NormalizedLecture,
  NormalizedAssessment,
  NormalizedCourseContent,
} from '../lib/courseNormalize';
import {
  normalizeCourseContent,
  buildSectionsFromContent,
} from '../lib/courseNormalize';

export type {
  NormalizedTraining,
  NormalizedLecture,
  NormalizedAssessment,
  NormalizedCourseContent,
};
export { normalizeCourseContent, buildSectionsFromContent };

// ---------- الأنواع ----------

export type CourseItemType = 'video' | 'pdf' | 'header' | 'task' | 'quiz' | 'other';

type RawObject = Record<string, unknown>;

export interface CourseItem {
  id: string;
  type: CourseItemType;
  // للامتحان والتدريب والواجب فقط (type يكون quiz أو task)، وإلا null.
  assessmentKind: AssessmentKind | null;
  title: string;
  videoUrl: string; // youtubeUrl أو videoUrl
  pdfUrl: string;
  duration: string;
  archived: boolean;
  availableFrom: number | null;
  availableUntil: number | null;
  children: CourseItem[];
  // الشكل الأصلي للعنصر كما هو في قاعدة البيانات، حتى لا نفقد أي حقل لا نعرفه.
  raw: RawObject;
}

export interface CourseSection {
  id: string;
  title: string;
  archived: boolean;
  items: CourseItem[];
  raw: RawObject;
}

export interface Course {
  id: string;
  title: string;
  desc: string;
  image: string;
  price: number;
  grade: GradeCode | null;
  rawGrade: string;
  hidden: boolean;
  finished: boolean;
  isFree: boolean;
  hasDiscount: boolean;
  discountPrice: number;
  discountExpiry: number | null;
  order: number | null;
  sections: CourseSection[];
  content: NormalizedCourseContent;
  // true لو الأقسام محوّلة في الواجهة فقط من الشكل الأقدم (lectures وhomeworks...).
  sectionsDerived: boolean;
  // true للكورسات التي أُنشئت من المنصة الجديدة (وحدها يمكن تعديلها كاملة).
  isV2: boolean;
}

// ---------- أدوات القراءة المتسامحة ----------

function isObject(value: unknown): value is RawObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// تاريخ بأي صيغة محتملة (نص أو رقم بالمللي ثانية أو Timestamp) إلى مللي ثانية.
function parseDateValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  if (typeof value === 'string') {
    const text = value.trim();
    const source = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(text) ? `${text}T23:59:59` : text;
    const parsed = Date.parse(source);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (isObject(value)) {
    if (typeof value.toMillis === 'function') {
      try {
        return (value as { toMillis: () => number }).toMillis();
      } catch {
        return null;
      }
    }
    if (typeof value.seconds === 'number') return value.seconds * 1000;
  }

  return null;
}

function formatDate(milliseconds: number): string {
  const date = new Date(milliseconds);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// ---------- تحويل العناصر والأقسام ----------

// نوع الامتحان/التدريب/الواجب (يشمل الأسماء العربية القديمة).
// defaultKind: النوع الافتراضي للعناصر القادمة من المصفوفات القديمة exams وtrainings وhomeworks.
function detectAssessmentKind(
  raw: RawObject,
  defaultKind: AssessmentKind | null,
): AssessmentKind | null {
  const type = asString(raw.type).trim().toLowerCase();

  if (type === 'video' || type === 'pdf' || type === 'header') return null;
  if (type === 'training' || type === 'تدريب') return 'training';
  if (type === 'homework' || type === 'task' || type === 'واجب') return 'homework';
  if (type === 'exam' || type === 'quiz' || type === 'امتحان') return 'exam';

  if (Array.isArray(raw.questions)) return defaultKind ?? 'exam';

  const hasMedia =
    asString(raw.youtubeUrl) !== '' || asString(raw.videoUrl) !== '' || asString(raw.pdfUrl) !== '';
  if (defaultKind !== null && !hasMedia) return defaultKind;

  return null;
}

function detectItemType(raw: RawObject, kind: AssessmentKind | null): CourseItemType {
  if (kind !== null) return kind === 'homework' ? 'task' : 'quiz';

  const type = asString(raw.type).toLowerCase();
  if (type === 'video' || type === 'pdf' || type === 'header') return type;

  if (asString(raw.youtubeUrl) || asString(raw.videoUrl)) return 'video';
  if (asString(raw.pdfUrl)) return 'pdf';

  const url = asString(raw.url);
  if (url) {
    if (/\.pdf($|\?)/i.test(url)) return 'pdf';
    if (getVideoSource(url).kind !== 'unknown') return 'video';
  }

  return 'other';
}

function parseItem(
  value: unknown,
  fallbackId: string,
  depth: number,
  defaultKind: AssessmentKind | null,
): CourseItem | null {
  if (!isObject(value)) return null;

  const kind = detectAssessmentKind(value, defaultKind);
  const type = detectItemType(value, kind);
  const id = asString(value.id) || fallbackId;
  const legacyUrl = asString(value.url);

  const children =
    depth < 1 && Array.isArray(value.children)
      ? parseItems(value.children, `${id}_c`, depth + 1, null)
      : [];

  return {
    id,
    type,
    assessmentKind: kind,
    title: asString(value.title) || asString(value.name),
    videoUrl:
      asString(value.youtubeUrl) || asString(value.videoUrl) || (type === 'video' ? legacyUrl : ''),
    pdfUrl: asString(value.pdfUrl) || (type === 'pdf' ? legacyUrl : ''),
    duration: type === 'video' ? asString(value.duration) : '',
    archived: value.archived === true,
    availableFrom: parseDateValue(value.availableFrom ?? value.availabilityDate),
    availableUntil: parseDateValue(value.availableUntil),
    children,
    raw: value,
  };
}

function parseItems(
  value: unknown,
  prefix: string,
  depth: number,
  defaultKind: AssessmentKind | null,
): CourseItem[] {
  if (!Array.isArray(value)) return [];

  const items: CourseItem[] = [];
  value.forEach((entry, index) => {
    const item = parseItem(entry, `${prefix}${index}`, depth, defaultKind);
    if (item) items.push(item);
  });
  return items;
}

function parseSection(value: unknown, fallbackId: string): CourseSection | null {
  if (!isObject(value)) return null;

  return {
    id: asString(value.id) || fallbackId,
    title: asString(value.title) || asString(value.name) || 'قسم',
    archived: value.archived === true,
    items: parseItems(value.items, `${fallbackId}_i`, 0, null),
    raw: value,
  };
}

function parseCourse(id: string, data: DocumentData): Course {
  const content = normalizeCourseContent(data);
  const sections = buildSectionsFromContent(content);
  const isLayoutV2 = isObject(data.contents) && data.contents.layoutVersion === 2;

  return {
    id,
    title: asString(data.title),
    desc: asString(data.desc) || asString(data.description),
    image: asString(data.image) || asString(data.thumbnail),
    price: asNumber(data.price),
    grade: normalizeGrade(data.grade),
    rawGrade: asString(data.grade),
    hidden: data.hidden === true,
    finished: data.finished === true,
    isFree: data.isFree === true,
    hasDiscount: data.hasDiscount === true,
    discountPrice: asNumber(data.discountPrice),
    discountExpiry: parseDateValue(data.discountExpiry),
    order: asOptionalNumber(data.order),
    sections,
    content,
    sectionsDerived: !isLayoutV2,
    isV2: data.source === 'v2' || isLayoutV2,
  };
}

function compareCourses(a: Course, b: Course): number {
  if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order;
  if (a.order !== null && b.order === null) return -1;
  if (a.order === null && b.order !== null) return 1;
  return a.title.localeCompare(b.title, 'ar');
}

// ---------- القراءة من Firestore (مع تخزين مؤقت لتوفير حصة القراءات المجانية) ----------

const CACHE_TTL_MS = 60 * 1000; // دقيقة واحدة
const MAX_COURSES = 300;

let coursesCache: { at: number; data: Course[] } | null = null;

// تُستدعى بعد أي كتابة على الكورسات حتى تظهر النتيجة فورًا في القوائم.
export function invalidateCoursesCache(): void {
  coursesCache = null;
}

export async function listCourses(): Promise<Course[]> {
  if (coursesCache && Date.now() - coursesCache.at < CACHE_TTL_MS) {
    return coursesCache.data;
  }

  const snapshot = await getDocs(query(collection(db, 'courses'), limit(MAX_COURSES)));
  const data = snapshot.docs
    .map((item) => parseCourse(item.id, item.data()))
    .sort(compareCourses);

  coursesCache = { at: Date.now(), data };
  return data;
}

// قراءة كورس واحد دائمًا طازجة (قراءة واحدة)، لأن صفحات الأدمن تبني عليها كتابات.
export async function getCourse(courseId: string): Promise<Course | null> {
  const snapshot = await getDoc(doc(db, 'courses', courseId));
  if (!snapshot.exists()) return null;
  return parseCourse(snapshot.id, snapshot.data());
}

// ---------- السعر والصلاحيات والعرض ----------

export interface PriceInfo {
  price: number;
  original: number | null;
  discounted: boolean;
}

export function getPriceInfo(course: Course, now: number = Date.now()): PriceInfo {
  const active =
    course.hasDiscount &&
    course.discountPrice > 0 &&
    course.discountPrice < course.price &&
    (course.discountExpiry === null || course.discountExpiry > now);

  return active
    ? { price: course.discountPrice, original: course.price, discounted: true }
    : { price: course.price, original: null, discounted: false };
}

// الأدمن يرى كل شيء، والطالب يرى محتوى الكورسات التي اشتراها أو الكورس المجاني.
export function canAccessCourseContent(
  course: Course,
  student: Student | null,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  if (!student || student.archived) return false;
  return course.isFree || student.courses.includes(course.id);
}

// الأقسام والعناصر المؤرشفة لا تظهر للطلاب.
export function getVisibleSections(sections: CourseSection[]): CourseSection[] {
  return sections
    .filter((section) => !section.archived)
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => !item.archived)
        .map((item) => ({ ...item, children: item.children.filter((child) => !child.archived) })),
    }));
}

function stripItem(item: CourseItem): CourseItem {
  return {
    ...item,
    videoUrl: '',
    pdfUrl: '',
    raw: {},
    children: item.children.map(stripItem),
  };
}

// نسخة للعرض لغير المشترك: العناوين فقط بدون أي رابط أو أسئلة.
export function toPreviewSections(sections: CourseSection[]): CourseSection[] {
  return sections.map((section) => ({
    ...section,
    raw: {},
    items: section.items.map(stripItem),
  }));
}

export interface ItemAvailability {
  available: boolean;
  message: string;
}

export function getItemAvailability(item: CourseItem, now: number = Date.now()): ItemAvailability {
  if (item.availableFrom !== null && item.availableFrom > now) {
    return { available: false, message: `يتاح في ${formatDate(item.availableFrom)}` };
  }
  if (item.availableUntil !== null && item.availableUntil < now) {
    return { available: false, message: 'انتهت مدة إتاحته' };
  }
  return { available: true, message: '' };
}

// ---------- الكتابة (الأدمن) ----------

export interface CourseFormValues {
  title: string;
  desc: string;
  grade: GradeCode;
  price: number;
  isFree: boolean;
  hasDiscount: boolean;
  discountPrice: number;
  discountExpiry: string; // بصيغة YYYY-MM-DD أو نص فارغ
  order: number;
}

// الحد الأقصى لطول نص صورة الغلاف داخل المستند (يطابق قاعدة الأمان).
// الصورة المضغوطة حتى 60,000 بايت تصبح حوالي 80,000 حرف بعد التحويل.
const MAX_IMAGE_TEXT_LENGTH = 90000;

function assertImageSize(image: string): void {
  if (image.length > MAX_IMAGE_TEXT_LENGTH) {
    throw new Error('image-too-large');
  }
}

export function generateCourseId(): string {
  return `c${Date.now()}`;
}

export function generateContentId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function newSection(title: string): CourseSection {
  return {
    id: generateContentId('sec'),
    title: title.trim(),
    archived: false,
    items: [],
    raw: {},
  };
}

export function newItem(type: 'video' | 'pdf' | 'header', title: string, url: string): CourseItem {
  return {
    id: generateContentId('item'),
    type,
    assessmentKind: null,
    title: title.trim(),
    videoUrl: type === 'video' ? url.trim() : '',
    pdfUrl: type === 'pdf' ? url.trim() : '',
    duration: '',
    archived: false,
    availableFrom: null,
    availableUntil: null,
    children: [],
    raw: {},
  };
}

// عنصر الفيديو/الملف/العنوان نكتبه بالحقول المعروفة فوق الشكل الأصلي،
// وأي عنصر من نوع آخر (task وquiz) نرجعه كما هو بدون أي تغيير.
function serializeItem(item: CourseItem): RawObject {
  if (item.type === 'video') {
    const isYoutube = getVideoSource(item.videoUrl).kind === 'youtube';
    return {
      ...item.raw,
      id: item.id,
      type: 'video',
      title: item.title,
      youtubeUrl: isYoutube ? item.videoUrl : '',
      videoUrl: isYoutube ? '' : item.videoUrl,
      archived: item.archived,
    };
  }

  if (item.type === 'pdf') {
    return {
      ...item.raw,
      id: item.id,
      type: 'pdf',
      title: item.title,
      pdfUrl: item.pdfUrl,
      archived: item.archived,
    };
  }

  if (item.type === 'header') {
    return { ...item.raw, id: item.id, type: 'header', title: item.title, archived: item.archived };
  }

  return { ...item.raw };
}

function serializeSections(sections: CourseSection[]): RawObject[] {
  return sections.map((section) => ({
    ...section.raw,
    id: section.id,
    title: section.title,
    archived: section.archived,
    items: section.items.map(serializeItem),
  }));
}

// ينشئ كورسًا جديدًا مخفيًا (hidden: true) بنفس شكل بيانات المنصة القديمة.
// image: صورة الغلاف كنص data URL مضغوط (أو نص فارغ).
export async function createCourse(
  courseId: string,
  values: CourseFormValues,
  image: string,
): Promise<void> {
  assertImageSize(image);

  const reference = doc(db, 'courses', courseId);

  const existing = await getDoc(reference);
  if (existing.exists()) {
    throw new Error('course-already-exists');
  }

  await setDoc(reference, {
    id: courseId,
    title: values.title.trim(),
    desc: values.desc.trim(),
    image,
    price: values.price,
    grade: values.grade,
    hidden: true,
    finished: false,
    isFree: values.isFree,
    hasDiscount: values.hasDiscount,
    discountPrice: values.hasDiscount ? values.discountPrice : 0,
    discountExpiry: values.hasDiscount ? values.discountExpiry : '',
    order: values.order,
    contents: {
      sections: [{ id: 'sec_lectures', title: 'المحاضرات', archived: false, items: [] }],
      lectures: [],
      homeworks: [],
      exams: [],
      trainings: [],
      customSections: [],
    },
    source: 'v2',
    createdAt: serverTimestamp(),
  });

  invalidateCoursesCache();
}

async function assertEditableCourse(courseId: string): Promise<void> {
  const snapshot = await getDoc(doc(db, 'courses', courseId));
  if (!snapshot.exists()) {
    throw new Error('course-not-found');
  }
}

// تعديل بيانات الكورس (الكورسات القديمة والجديدة).
export async function updateCourseDetails(
  courseId: string,
  values: CourseFormValues,
  image?: string,
): Promise<void> {
  if (image !== undefined) assertImageSize(image);

  await assertEditableCourse(courseId);

  await updateDoc(doc(db, 'courses', courseId), {
    title: values.title.trim(),
    desc: values.desc.trim(),
    grade: values.grade,
    price: values.price,
    isFree: values.isFree,
    hasDiscount: values.hasDiscount,
    discountPrice: values.hasDiscount ? values.discountPrice : 0,
    discountExpiry: values.hasDiscount ? values.discountExpiry : '',
    order: values.order,
    ...(image !== undefined ? { image } : {}),
    updatedAt: serverTimestamp(),
  });

  invalidateCoursesCache();
}

// حفظ محتوى الكورس المطبّع (المحاضرات، الواجبات، الامتحانات).
// يضع contents.layoutVersion = 2 ويحافظ على كل حقول contents القديمة (... القديم).
export async function saveCourseContent(
  courseId: string,
  content: NormalizedCourseContent,
): Promise<void> {
  const reference = doc(db, 'courses', courseId);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) {
    throw new Error('course-not-found');
  }

  const existingData = snapshot.data();
  const existingContents = isObject(existingData.contents) ? existingData.contents : {};

  const updatedContents: RawObject = {
    ...existingContents,
    layoutVersion: 2,
    lectures: content.lectures.map((lec, idx) => ({
      ...(lec.raw || {}),
      id: lec.id,
      title: lec.title.trim(),
      youtubeUrl: lec.youtubeUrl.trim(),
      videoUrl: lec.youtubeUrl.trim(),
      pdfUrl: lec.pdfUrl.trim(),
      order: lec.order ?? idx + 1,
      duration: lec.duration || '',
      trainings: lec.trainings.map((tr, trIdx) => ({
        ...(tr.raw || {}),
        id: tr.id,
        title: tr.title.trim(),
        order: tr.order ?? trIdx + 1,
        type: tr.type || 'training',
        duration: tr.duration || '',
        questions: tr.questions || [],
        attachedToLectureId: lec.id,
        lectureId: lec.id,
      })),
    })),
    homeworks: content.homeworks.map((hw, idx) => ({
      ...(hw.raw || {}),
      id: hw.id,
      title: hw.title.trim(),
      order: hw.order ?? idx + 1,
      type: hw.type || 'homework',
      duration: hw.duration || '',
      strictMode: hw.strictMode ?? false,
      questions: hw.questions || [],
    })),
    exams: content.exams.map((ex, idx) => ({
      ...(ex.raw || {}),
      id: ex.id,
      title: ex.title.trim(),
      order: ex.order ?? idx + 1,
      type: ex.type || 'exam',
      duration: ex.duration || '',
      strictMode: ex.strictMode ?? false,
      questions: ex.questions || [],
    })),
  };

  await updateDoc(reference, {
    contents: updatedContents,
    updatedAt: serverTimestamp(),
  });

  invalidateCoursesCache();
}

// يكتب contents.sections فقط ولا يلمس باقي contents (lectures وhomeworks...).
export async function saveCourseSections(
  courseId: string,
  sections: CourseSection[],
): Promise<void> {
  await assertEditableCourse(courseId);

  await updateDoc(doc(db, 'courses', courseId), {
    'contents.sections': serializeSections(sections),
    updatedAt: serverTimestamp(),
  });

  invalidateCoursesCache();
}

// الإخفاء والنشر والترتيب مسموحة لكل الكورسات (القديمة والجديدة).
export async function setCourseHidden(courseId: string, hidden: boolean): Promise<void> {
  await updateDoc(doc(db, 'courses', courseId), { hidden });
  invalidateCoursesCache();
}

export async function setCourseOrder(courseId: string, order: number): Promise<void> {
  await updateDoc(doc(db, 'courses', courseId), { order });
  invalidateCoursesCache();
}

// ---------- تبنّي الكورسات القديمة (للمالك فقط) ----------

// يضيف source='v2' فقط ولا يلمس أي حقل آخر. معاملة، فلو تغيّر المستند أثناءها تُعاد القراءة.
export async function adoptLegacyCourse(courseId: string): Promise<void> {
  const reference = doc(db, 'courses', courseId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('course-not-found');
    if (snapshot.data().source === 'v2') throw new Error('already-adopted');
    transaction.update(reference, { source: 'v2' });
  });
  invalidateCoursesCache();
}

// التراجع: يحذف حقل source فقط فيعود الكورس "قديمًا" (إخفاء وترتيب فقط).
export async function revertAdoptedCourse(courseId: string): Promise<void> {
  const reference = doc(db, 'courses', courseId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('course-not-found');
    if (snapshot.data().source !== 'v2') throw new Error('not-adopted');
    transaction.update(reference, { source: deleteField() });
  });
  invalidateCoursesCache();
}

// نسخة احتياطية كاملة من مستندات الكورسات كنص JSON (يحمّلها المالك قبل أي تبنّي).
export async function exportCoursesBackup(): Promise<string> {
  const snapshot = await getDocs(collection(db, 'courses'));
  const items = snapshot.docs.map((item) => ({ id: item.id, data: item.data() }));
  return JSON.stringify({ exportedAt: new Date().toISOString(), courses: items }, null, 2);
}

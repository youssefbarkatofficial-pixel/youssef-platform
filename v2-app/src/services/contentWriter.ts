import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizeCourseContent } from '../lib/courseNormalize';
import { invalidateCoursesCache } from './courses';

// طبقة كتابة موحّدة للمحتوى (محاضرات، ملفات، تدريبات، واجبات، امتحانات).
// تكتب دائمًا في المصفوفات الجذرية contents.lectures / homeworks / exams (ومعها trainings داخل المحاضرة)،
// وهي المقروءة في الشكلين (القديم وlayoutVersion=2)، فلا يختفي أي عنصر بعد الرفع.
// كل الكتابة داخل معاملة ولا تغيّر layoutVersion ولا تحذف أي حقل آخر.

type RawObject = Record<string, unknown>;

function isObject(value: unknown): value is RawObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): RawObject[] {
  return Array.isArray(value) ? value.filter(isObject).map((item) => ({ ...item })) : [];
}

// يحوّل روابط Google Drive المختلفة إلى رابط عرض ثابت. غير Drive يرجع كما هو.
export function normalizeDriveUrl(input: string): string {
  const url = input.trim();
  if (!url) return '';
  const patterns = [/drive\.google\.com\/file\/d\/([\w-]{10,})/i, /drive\.google\.com\/(?:open|uc)\?[^#]*id=([\w-]{10,})/i];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return `https://drive.google.com/file/d/${match[1]}/view`;
  }
  return url;
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function mutateContents(
  courseId: string,
  mutate: (contents: RawObject, data: RawObject) => void,
): Promise<void> {
  const reference = doc(db, 'courses', courseId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('course-not-found');
    const data = snapshot.data() as RawObject;
    const contents: RawObject = isObject(data.contents) ? { ...data.contents } : {};
    mutate(contents, data);
    transaction.update(reference, { contents, updatedAt: serverTimestamp() });
  });
  invalidateCoursesCache();
}

// يرجع المحاضرة من المصفوفة الجذرية، أو يضيف نسخة جذرية منها (لو كانت داخل الأقسام القديمة فقط)
function ensureRootLecture(contents: RawObject, data: RawObject, lectureId: string): RawObject {
  const lectures = asArray(contents.lectures);
  let lecture = lectures.find((item) => item.id === lectureId);
  if (!lecture) {
    const known = normalizeCourseContent({ ...data, contents }).lectures.find((item) => item.id === lectureId);
    if (!known) throw new Error('lecture-not-found');
    lecture = { ...(known.raw || {}), id: lectureId, order: known.order };
    lectures.push(lecture);
  }
  contents.lectures = lectures;
  return lecture;
}

export interface LectureFileDraft {
  title: string;
  url: string;
  openAt?: number | null;
  closeAt?: number | null;
}

export interface LectureDraft {
  title: string;
  videoUrl: string;
  files: LectureFileDraft[];
  openAt?: number | null;
  closeAt?: number | null;
}

// يضيف محاضرات جديدة (فيديو + ملفات PDF اختيارية). mode=replace يستبدل المحاضرات الحالية.
export async function addLectures(
  courseId: string,
  drafts: LectureDraft[],
  mode: 'append' | 'replace' = 'append',
): Promise<number> {
  const clean = drafts.filter((draft) => draft.title.trim() !== '' || draft.videoUrl.trim() !== '');
  if (clean.length === 0) return 0;

  await mutateContents(courseId, (contents, data) => {
    const existing = normalizeCourseContent({ ...data, contents }).lectures;
    const rootLectures = mode === 'replace' ? [] : asArray(contents.lectures);
    const lastOrder = mode === 'replace' ? 0 : existing.reduce((max, item) => Math.max(max, item.order), 0);

    clean.forEach((draft, index) => {
      const id = newId('lec');
      const files = draft.files
        .filter((file) => isHttpUrl(file.url))
        .map((file, fileIndex) => ({
          id: `file_${id}_${fileIndex + 1}`,
          title: file.title.trim() || `ملف ${fileIndex + 1}`,
          url: normalizeDriveUrl(file.url),
          openAt: file.openAt ?? null,
          closeAt: file.closeAt ?? null,
        }));
      const video = draft.videoUrl.trim();
      rootLectures.push({
        id,
        title: draft.title.trim() || `محاضرة ${lastOrder + index + 1}`,
        youtubeUrl: video,
        videoUrl: video,
        pdfUrl: files[0]?.url || '',
        files,
        order: lastOrder + index + 1,
        duration: '',
        openAt: draft.openAt ?? null,
        closeAt: draft.closeAt ?? null,
        trainings: [],
        createdAt: Date.now(),
      });
    });
    contents.lectures = rootLectures;
  });
  return clean.length;
}

// يضيف ملف (PDF أو رابط Drive) إلى محاضرة موجودة.
export async function addFilesToLecture(
  courseId: string,
  lectureId: string,
  files: LectureFileDraft[],
): Promise<number> {
  const valid = files.filter((file) => isHttpUrl(file.url));
  if (valid.length === 0) throw new Error('no-valid-file');

  await mutateContents(courseId, (contents, data) => {
    const lecture = ensureRootLecture(contents, data, lectureId);
    const current = Array.isArray(lecture.files) ? (lecture.files as RawObject[]) : [];
    const next = [...current];
    valid.forEach((file) => {
      const url = normalizeDriveUrl(file.url);
      if (next.some((item) => item.url === url)) return;
      next.push({ id: newId('file'), title: file.title.trim() || 'ملف المحاضرة', url, openAt: file.openAt ?? null, closeAt: file.closeAt ?? null });
    });
    lecture.files = next;
    if (!lecture.pdfUrl && next[0]) lecture.pdfUrl = next[0].url;
  });
  return valid.length;
}

export type PlacedKind = 'training' | 'homework' | 'exam';

// يضع عنصر تقييم (له raw جاهز) في مكانه الصحيح: التدريب داخل المحاضرة، الواجب في الواجبات (مربوط بمحاضرة اختياريًا)، الامتحان في الامتحانات.
export async function placeAssessment(
  courseId: string,
  kind: PlacedKind,
  raw: RawObject,
  lectureId: string,
): Promise<void> {
  await mutateContents(courseId, (contents, data) => {
    if (kind === 'training') {
      if (!lectureId) throw new Error('lecture-required');
      const lecture = ensureRootLecture(contents, data, lectureId);
      const trainings = asArray(lecture.trainings);
      trainings.push({ ...raw, order: trainings.length + 1, attachedToLectureId: lectureId, lectureId });
      lecture.trainings = trainings;
      return;
    }
    const key = kind === 'homework' ? 'homeworks' : 'exams';
    const list = asArray(contents[key]);
    const item: RawObject = { ...raw, order: list.length + 1 };
    if (kind === 'homework' && lectureId) {
      item.lectureId = lectureId;
      item.attachedToLectureId = lectureId;
    }
    list.push(item);
    contents[key] = list;
  });
}

// يعدّل عنصر تقييم موجود في المصفوفات الجذرية. يرجع false لو لم يوجد هناك (يعني في الأقسام القديمة).
export async function patchAssessmentRaw(
  courseId: string,
  itemId: string,
  build: (current: RawObject) => RawObject,
): Promise<boolean> {
  let found = false;
  await mutateContents(courseId, (contents) => {
    const patchList = (list: RawObject[]): RawObject[] =>
      list.map((item) => {
        if (item.id !== itemId) return item;
        found = true;
        return build(item);
      });

    const lectures = asArray(contents.lectures).map((lecture) => {
      const trainings = patchList(asArray(lecture.trainings));
      return { ...lecture, trainings };
    });
    contents.lectures = lectures;
    contents.homeworks = patchList(asArray(contents.homeworks));
    contents.exams = patchList(asArray(contents.exams));
  });
  return found;
}

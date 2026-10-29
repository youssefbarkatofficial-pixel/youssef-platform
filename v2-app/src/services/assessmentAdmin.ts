import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { parseQuestions } from '../lib/grading';
import type { AssessmentKind } from '../lib/grading';
import {
  draftFromQuestion,
  parseRubric,
  toKeyEntry,
  toPublicQuestion,
  validateDraft,
} from '../lib/questionDraft';
import type { QuestionDraft } from '../lib/questionDraft';
import { adoptLegacyCourse, generateContentId, getCourse, saveCourseSections } from './courses';
import type { Course, CourseItem, CourseSection } from './courses';
import { patchAssessmentRaw, placeAssessment } from './contentWriter';
import type { PlacedKind } from './contentWriter';

// إنشاء وتعديل الامتحانات والتدريبات والواجبات الجديدة (في الكورسات الجديدة فقط).
// الأسئلة بدون إجابات في examContent/{id}، والإجابات الصحيحة في examKeys/{id} (للأدمن والسيرفر فقط)،
// وعنصر الكورس نفسه يحمل بيانات الامتحان فقط (العنوان والمدة والمواعيد...) بنفس شكل المنصة القديمة.

type RawObject = Record<string, unknown>;

export interface AssessmentMeta {
  kind: AssessmentKind;
  title: string;
  duration: number; // بالدقائق، 0 = مفتوح
  strictMode: boolean;
  availableFrom: string; // datetime-local أو نص فارغ
  availableUntil: string;
  lockedUntilTrainingId: string;
  deadlineDate: string; // للعرض فقط
  passingScore?: number; // نسبة النجاح لفتح ما بعده % (افتراضي 50)
  requirePassingToUnlock?: boolean; // ربط بالمحاضرة كمتطلب
}

export interface AssessmentRef {
  section: CourseSection;
  item: CourseItem;
}

export interface LoadedAssessment {
  course: Course;
  sectionId: string;
  item: CourseItem;
  meta: AssessmentMeta;
  questions: QuestionDraft[];
}

function isRecord(value: unknown): value is RawObject {
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

// نوع العنصر المكتوب في الكورس: امتحان quiz، وواجب task، وتدريب training.
export function itemTypeForKind(kind: AssessmentKind): 'quiz' | 'task' | 'training' {
  if (kind === 'homework') return 'task';
  if (kind === 'training') return 'training';
  return 'quiz';
}

// كل الامتحانات والتدريبات والواجبات في أقسام الكورس (مع القسم الذي تتبعه).
export function listAssessmentItems(sections: CourseSection[]): AssessmentRef[] {
  const refs: AssessmentRef[] = [];

  sections.forEach((section) => {
    section.items.forEach((item) => {
      if (item.assessmentKind !== null) refs.push({ section, item });
      item.children.forEach((child) => {
        if (child.assessmentKind !== null) refs.push({ section, item: child });
      });
    });
  });

  return refs;
}

function metaFromItem(item: CourseItem): AssessmentMeta {
  const raw = item.raw;

  return {
    kind: item.assessmentKind ?? 'exam',
    title: item.title,
    duration: Math.max(0, asNumber(raw.duration)),
    strictMode: raw.strictMode === true,
    availableFrom: asString(raw.availableFrom),
    availableUntil: asString(raw.availableUntil),
    lockedUntilTrainingId: asString(raw.lockedUntilTrainingId),
    deadlineDate: asString(raw.deadlineDate),
    passingScore: typeof raw.passingScore === 'number' ? raw.passingScore : 50,
    requirePassingToUnlock: raw.requirePassingToUnlock === true,
  };
}

function buildRaw(
  base: RawObject,
  id: string,
  meta: AssessmentMeta,
  questionCount: number,
  options?: { isDraft?: boolean; hidden?: boolean },
): RawObject {
  const openAt = meta.availableFrom ? new Date(meta.availableFrom).getTime() : (base.openAt ?? null);
  const closeAt = meta.availableUntil ? new Date(meta.availableUntil).getTime() : (base.closeAt ?? null);
  return {
    ...base,
    id,
    type: itemTypeForKind(meta.kind),
    title: meta.title.trim(),
    duration: meta.duration,
    strictMode: meta.strictMode,
    availableFrom: meta.availableFrom,
    availableUntil: meta.availableUntil,
    openAt,
    closeAt,
    passingScore: typeof meta.passingScore === 'number' ? meta.passingScore : (typeof base.passingScore === 'number' ? base.passingScore : 50),
    requirePassingToUnlock: meta.requirePassingToUnlock ?? (base.requirePassingToUnlock === true),
    lockedUntilTrainingId: meta.lockedUntilTrainingId,
    deadlineDate: meta.deadlineDate.trim(),
    questionCount,
    contentRef: 'examContent',
    createdAt: typeof base.createdAt === 'number' ? base.createdAt : Date.now(),
    archived: base.archived === true,
    source: 'v2',
    ...(options?.isDraft ? { isDraft: true, hidden: true } : {}),
  };
}

function makeItem(raw: RawObject, kind: AssessmentKind): CourseItem {
  return {
    id: asString(raw.id),
    type: kind === 'homework' ? 'task' : 'quiz',
    assessmentKind: kind,
    title: asString(raw.title),
    videoUrl: '',
    pdfUrl: '',
    duration: '',
    archived: raw.archived === true,
    availableFrom: null,
    availableUntil: null,
    children: [],
    raw,
  };
}

function checkInput(meta: AssessmentMeta, questions: QuestionDraft[]): void {
  if (meta.title.trim() === '') {
    throw new Error('عنوان التقييم مطلوب ولا يمكن أن يكون فارغًا.');
  }
  if (questions.length === 0) {
    throw new Error('يجب إضافة سؤال واحد على الأقل في التقييم.');
  }

  const hasIncompleteAnswers = questions.some((q) => q.needsReview || !q.answer);

  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];
    const err = validateDraft(q, hasIncompleteAnswers);
    if (err) {
      throw new Error(`خطأ في السؤال رقم ${idx + 1}: ${err}`);
    }
  }
}

// يكتب الأسئلة العامة والإجابات المغلقة في مستندين منفصلين.
async function writeContent(
  courseId: string,
  examId: string,
  meta: AssessmentMeta,
  questions: QuestionDraft[],
): Promise<void> {
  const now = new Date().toISOString();

  await setDoc(
    doc(db, 'examContent', examId),
    {
      courseId,
      title: meta.title.trim(),
      kind: meta.kind,
      questions: questions.map(toPublicQuestion),
      updatedAt: now,
    },
    { merge: true },
  );

  await setDoc(
    doc(db, 'examKeys', examId),
    {
      courseId,
      answers: questions.map(toKeyEntry),
      updatedAt: now,
    },
    { merge: true },
  );
}

async function loadEditableCourse(courseId: string): Promise<Course> {
  const course = await getCourse(courseId);
  if (!course) {
    throw new Error('الكورس غير موجود.');
  }
  if (!course.isV2) {
    try {
      await adoptLegacyCourse(courseId);
      return { ...course, isV2: true };
    } catch (err) {
      if (err instanceof Error && err.message === 'already-adopted') {
        return { ...course, isV2: true };
      }
      throw new Error(
        'هذا الكورس قديم ولم يتم اعتماده بعد في المنصة الجديدة. يرجى اعتماده أولاً من صفحة «تبنّي الكورسات» (/admin/adopt-courses) بحساب المالك.',
      );
    }
  }
  return course;
}

// ينشئ امتحانًا أو تدريبًا أو واجبًا جديدًا داخل قسم من كورس جديد، ويرجع رقمه.
// الكتابة دائمًا في المصفوفات الجذرية (contents.exams/homeworks/lectures[].trainings)
// لأنها المكان الذي يقرأه محرّك تطبيع المحتوى في كل أشكال الكورسات، فلا ينزل الامتحان كمحاضرة فيديو.
export async function createAssessment(
  courseId: string,
  sectionId: string,
  meta: AssessmentMeta,
  questions: QuestionDraft[],
  lectureId = '',
): Promise<string> {
  checkInput(meta, questions);

  const course = await loadEditableCourse(courseId);

  const hasIncompleteAnswers = questions.some((q) => q.needsReview || !q.answer);
  const draftMeta: AssessmentMeta = hasIncompleteAnswers ? { ...meta, strictMode: false } : meta;

  const newId = generateContentId('exam');

  // الأسئلة والإجابات أولًا، فلو فشل أي شيء لا يظهر عنصر ناقص في الكورس.
  await writeContent(courseId, newId, draftMeta, questions);

  const rawItem = buildRaw({}, newId, draftMeta, questions.length, {
    isDraft: hasIncompleteAnswers,
    hidden: hasIncompleteAnswers,
  });
  const placed: PlacedKind = meta.kind === 'homework' ? 'homework' : meta.kind === 'training' ? 'training' : 'exam';

  await placeAssessment(courseId, placed, rawItem, lectureId);
  return newId;
}

// يحمّل امتحانًا جديدًا للتعديل (الأسئلة مع إجاباتها، وهذا متاح للأدمن فقط).
export async function loadAssessmentForEdit(
  courseId: string,
  itemId: string,
): Promise<LoadedAssessment | null> {
  const course = await getCourse(courseId);
  if (!course) return null;

  for (const section of course.sections) {
    const item = section.items
      .flatMap((candidate) => [candidate, ...candidate.children])
      .find((candidate) => candidate.id === itemId && candidate.assessmentKind !== null);
    if (!item) continue;

    const [contentSnapshot, keysSnapshot] = await Promise.all([
      getDoc(doc(db, 'examContent', itemId)),
      getDoc(doc(db, 'examKeys', itemId)),
    ]);

    const publicQuestions = contentSnapshot.exists()
      ? parseQuestions(contentSnapshot.data().questions)
      : [];

    const keys = new Map<string, RawObject>();
    if (keysSnapshot.exists() && Array.isArray(keysSnapshot.data().answers)) {
      (keysSnapshot.data().answers as unknown[]).forEach((entry) => {
        if (isRecord(entry)) keys.set(asString(entry.id), entry);
      });
    }

    const questions = publicQuestions.map((question) => {
      const draft = draftFromQuestion(question);
      const key = keys.get(question.id);
      if (!key) return draft;

      return {
        ...draft,
        answer: asString(key.answer),
        altAnswers: Array.isArray(key.altAnswers)
          ? key.altAnswers.map(asString).filter((value) => value !== '')
          : [],
        rubric: parseRubric(key.rubric),
      };
    });

    return { course, sectionId: section.id, item, meta: metaFromItem(item), questions };
  }

  return null;
}

// يعدّل امتحانًا موجودًا (نوعه وقسمه لا يتغيران).
export async function updateAssessment(
  courseId: string,
  itemId: string,
  meta: AssessmentMeta,
  questions: QuestionDraft[],
): Promise<void> {
  checkInput(meta, questions);

  const course = await loadEditableCourse(courseId);

  // أولًا: لو العنصر في المصفوفات الجذرية (تدريب داخل محاضرة، واجب، امتحان) نعدّله هناك.
  const existing = listAssessmentItems(course.sections).find((ref) => ref.item.id === itemId);
  if (existing && existing.item.assessmentKind !== null) {
    const fixed: AssessmentMeta = { ...meta, kind: existing.item.assessmentKind };
    await writeContent(courseId, itemId, fixed, questions);
    const patched = await patchAssessmentRaw(courseId, itemId, (current) =>
      buildRaw(current, itemId, fixed, questions.length),
    );
    if (patched) return;
  }

  let found = false;
  const sections = course.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.id !== itemId || item.assessmentKind === null) return item;

      found = true;
      const fixedMeta: AssessmentMeta = { ...meta, kind: item.assessmentKind };
      const raw = buildRaw(item.raw, itemId, fixedMeta, questions.length);
      return makeItem(raw, item.assessmentKind);
    }),
  }));

  if (!found) {
    throw new Error('assessment-not-found');
  }

  const kind = meta.kind;
  await writeContent(courseId, itemId, { ...meta, kind }, questions);
  await saveCourseSections(courseId, sections);
}

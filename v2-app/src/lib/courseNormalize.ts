export type CourseItemType = 'video' | 'pdf' | 'header' | 'task' | 'quiz' | 'other';

type RawObject = Record<string, unknown>;

export interface CourseItem {
  id: string;
  type: CourseItemType;
  assessmentKind: 'exam' | 'homework' | 'training' | null;
  title: string;
  videoUrl: string;
  pdfUrl: string;
  duration: string;
  archived: boolean;
  availableFrom: number | null;
  availableUntil: number | null;
  children: CourseItem[];
  raw: RawObject;
}

export interface CourseSection {
  id: string;
  title: string;
  archived: boolean;
  items: CourseItem[];
  raw: RawObject;
}

export interface NormalizedTraining {
  id: string;
  title: string;
  type: string;
  order: number;
  duration?: string;
  questions?: unknown[];
  strictMode?: boolean;
  availableFrom?: number | null;
  availableUntil?: number | null;
  raw?: RawObject;
}

export interface NormalizedLecture {
  id: string;
  title: string;
  youtubeUrl: string;
  pdfUrl: string;
  order: number;
  duration?: string;
  availableFrom?: number | null;
  availableUntil?: number | null;
  archived?: boolean;
  trainings: NormalizedTraining[];
  raw?: RawObject;
}

export interface NormalizedAssessment {
  id: string;
  title: string;
  order: number;
  type?: string;
  duration?: string;
  availableFrom?: number | null;
  availableUntil?: number | null;
  archived?: boolean;
  strictMode?: boolean;
  questions?: unknown[];
  raw?: RawObject;
}

export interface NormalizedCourseContent {
  layoutVersion: number;
  lectures: NormalizedLecture[];
  homeworks: NormalizedAssessment[];
  exams: NormalizedAssessment[];
}

function isObject(value: unknown): value is RawObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function asOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

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
        const ms = (value.toMillis as () => number)();
        return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
      } catch {
        return null;
      }
    }
    if (typeof value.seconds === 'number') {
      return value.seconds * 1000;
    }
  }
  return null;
}

export function normalizeCourseContent(
  courseData: unknown,
): NormalizedCourseContent {
  if (!courseData || typeof courseData !== 'object') {
    return { layoutVersion: 2, lectures: [], homeworks: [], exams: [] };
  }

  const rawCourse = courseData as RawObject;
  const contents: RawObject = isObject(rawCourse.contents)
    ? rawCourse.contents
    : isObject(rawCourse) &&
        (Array.isArray(rawCourse.lectures) ||
          Array.isArray(rawCourse.sections) ||
          Array.isArray(rawCourse.homeworks) ||
          Array.isArray(rawCourse.exams))
      ? rawCourse
      : {};

  const isLayoutV2 = contents.layoutVersion === 2;

  const lecturesMap = new Map<string, RawObject>();
  const homeworksMap = new Map<string, RawObject>();
  const examsMap = new Map<string, RawObject>();
  const trainingsMap = new Map<string, RawObject>();

  function addItemToMap(item: unknown, targetMap: Map<string, RawObject>, fallbackPrefix = 'item') {
    if (!isObject(item)) return;
    const id = asString(item.id) || `${fallbackPrefix}_${targetMap.size + 1}`;
    if (targetMap.has(id)) {
      const existing = targetMap.get(id)!;
      targetMap.set(id, { ...item, ...existing, id });
      return;
    }
    targetMap.set(id, { ...item, id });
  }

  // 1. Process root arrays in contents
  if (Array.isArray(contents.lectures)) {
    contents.lectures.forEach((lec, idx) => {
      if (isObject(lec)) {
        addItemToMap({ order: asOptionalNumber(lec.order) ?? (idx + 1), ...lec }, lecturesMap, 'lec');
      }
    });
  }

  if (Array.isArray(contents.homeworks)) {
    contents.homeworks.forEach((hw, idx) => {
      if (isObject(hw)) {
        addItemToMap({ order: asOptionalNumber(hw.order) ?? (idx + 1), ...hw }, homeworksMap, 'hw');
      }
    });
  }

  if (Array.isArray(contents.exams)) {
    contents.exams.forEach((ex, idx) => {
      if (isObject(ex)) {
        addItemToMap({ order: asOptionalNumber(ex.order) ?? (idx + 1), ...ex }, examsMap, 'exam');
      }
    });
  }

  // Handle root trainings (only for legacy layouts where layoutVersion !== 2; when layoutVersion === 2, lecture.trainings is authoritative)
  if (!isLayoutV2 && Array.isArray(contents.trainings)) {
    contents.trainings.forEach((tr) => {
      if (isObject(tr)) addItemToMap(tr, trainingsMap, 'tr');
    });
  }

  // 2. If not layoutVersion 2, pull all items from legacy sections
  if (!isLayoutV2) {
    const rawSections = Array.isArray(contents.sections)
      ? contents.sections
      : Array.isArray(rawCourse.sections)
        ? (rawCourse.sections as unknown[])
        : [];

    rawSections.forEach((sec) => {
      if (!isObject(sec)) return;
      const secId = asString(sec.id).toLowerCase();
      const secTitle = (asString(sec.title) || asString(sec.name)).toLowerCase();
      const items = Array.isArray(sec.items) ? sec.items : [];

      items.forEach((item) => {
        if (!isObject(item)) return;
        const type = asString(item.type).toLowerCase();

        if (
          type === 'video' ||
          type === 'lecture' ||
          secId.includes('lecture') ||
          secTitle.includes('محاضر')
        ) {
          addItemToMap(item, lecturesMap);
        } else if (
          type === 'homework' ||
          type === 'task' ||
          type === 'واجب' ||
          secId.includes('homework') ||
          secTitle.includes('واجب')
        ) {
          addItemToMap(item, homeworksMap);
        } else if (
          type === 'exam' ||
          type === 'quiz' ||
          type === 'امتحان' ||
          secId.includes('exam') ||
          secTitle.includes('امتحان')
        ) {
          addItemToMap(item, examsMap);
        } else if (
          type === 'training' ||
          type === 'تدريب' ||
          secId.includes('training') ||
          secTitle.includes('تدريب')
        ) {
          addItemToMap(item, trainingsMap);
        } else {
          // Fallback based on properties
          if (item.youtubeUrl || item.videoUrl) {
            addItemToMap(item, lecturesMap);
          } else if (Array.isArray(item.questions)) {
            const title = asString(item.title).toLowerCase();
            if (title.includes('واجب')) {
              addItemToMap(item, homeworksMap);
            } else {
              addItemToMap(item, examsMap);
            }
          }
        }
      });
    });
  }

  // Unattached trainings list for lecture linking
  const remainingTrainings = Array.from(trainingsMap.values());

  // 3. Normalize lectures and link trainings
  const lectures: NormalizedLecture[] = Array.from(lecturesMap.values()).map((lec, idx) => {
    const lecId = asString(lec.id) || `lec_${idx + 1}`;
    const trainings: NormalizedTraining[] = [];

    let pdfUrl =
      asString(lec.pdfUrl) ||
      asString(lec.fileUrl) ||
      asString(typeof lec.url === 'string' && lec.url.endsWith('.pdf') ? lec.url : '');

    // Check lecture.trainings
    if (Array.isArray(lec.trainings)) {
      lec.trainings.forEach((tr, trIdx) => {
        if (isObject(tr)) {
          trainings.push({
            id: asString(tr.id) || `tr_${lecId}_${trIdx + 1}`,
            title: asString(tr.title) || asString(tr.name) || `تدريب ${trIdx + 1}`,
            type: 'training',
            order: asOptionalNumber(tr.order) ?? (trIdx + 1),
            duration: asString(tr.duration),
            questions: Array.isArray(tr.questions) ? tr.questions : [],
            strictMode: tr.strictMode === true,
            availableFrom: parseDateValue(tr.availableFrom),
            availableUntil: parseDateValue(tr.availableUntil),
            raw: tr,
          });
        }
      });
    }

    // Check lecture.children (could be pdf files or trainings)
    if (Array.isArray(lec.children)) {
      lec.children.forEach((child, chIdx) => {
        if (!isObject(child)) return;
        const childType = asString(child.type).toLowerCase();
        if (childType === 'pdf' || child.pdfUrl) {
          if (!pdfUrl) {
            pdfUrl = asString(child.pdfUrl) || asString(child.url);
          }
        } else if (childType === 'training' || childType === 'تدريب') {
          const childId = asString(child.id) || `tr_${lecId}_ch_${chIdx + 1}`;
          if (!trainings.some((t) => t.id === childId)) {
            trainings.push({
              id: childId,
              title: asString(child.title) || asString(child.name) || `تدريب ${chIdx + 1}`,
              type: 'training',
              order: asOptionalNumber(child.order) ?? (trainings.length + 1),
              duration: asString(child.duration),
              questions: Array.isArray(child.questions) ? child.questions : [],
              strictMode: child.strictMode === true,
              availableFrom: parseDateValue(child.availableFrom),
              availableUntil: parseDateValue(child.availableUntil),
              raw: child,
            });
          }
        }
      });
    }

    // Match unattached trainings by attachedToLectureId or lectureId or _parentLecId
    for (let i = remainingTrainings.length - 1; i >= 0; i--) {
      const tr = remainingTrainings[i];
      const targetLecId =
        asString(tr.attachedToLectureId) || asString(tr.lectureId) || asString(tr._parentLecId);
      if (targetLecId === lecId) {
        const trId = asString(tr.id);
        if (!trainings.some((t) => t.id === trId)) {
          trainings.push({
            id: trId,
            title: asString(tr.title) || asString(tr.name) || 'تدريب',
            type: 'training',
            order: asOptionalNumber(tr.order) ?? (trainings.length + 1),
            duration: asString(tr.duration),
            questions: Array.isArray(tr.questions) ? tr.questions : [],
            strictMode: tr.strictMode === true,
            availableFrom: parseDateValue(tr.availableFrom),
            availableUntil: parseDateValue(tr.availableUntil),
            raw: tr,
          });
        }
        remainingTrainings.splice(i, 1);
      }
    }

    trainings.sort((a, b) => a.order - b.order);

    return {
      id: lecId,
      title: asString(lec.title) || asString(lec.name) || `محاضرة ${idx + 1}`,
      youtubeUrl: asString(lec.youtubeUrl) || asString(lec.videoUrl),
      pdfUrl,
      order: asOptionalNumber(lec.order) ?? (idx + 1),
      duration: asString(lec.duration),
      availableFrom: parseDateValue(lec.availableFrom),
      availableUntil: parseDateValue(lec.availableUntil),
      archived: lec.archived === true,
      trainings,
      raw: lec,
    };
  });

  // If there are still unattached trainings left and we have lectures, attach them to the first lecture
  if (remainingTrainings.length > 0 && lectures.length > 0) {
    remainingTrainings.forEach((tr) => {
      const trId = asString(tr.id);
      if (!lectures[0].trainings.some((t) => t.id === trId)) {
        lectures[0].trainings.push({
          id: trId,
          title: asString(tr.title) || asString(tr.name) || 'تدريب',
          type: 'training',
          order: asOptionalNumber(tr.order) ?? (lectures[0].trainings.length + 1),
          duration: asString(tr.duration),
          questions: Array.isArray(tr.questions) ? tr.questions : [],
          strictMode: tr.strictMode === true,
          availableFrom: parseDateValue(tr.availableFrom),
          availableUntil: parseDateValue(tr.availableUntil),
          raw: tr,
        });
      }
    });
  }

  // 4. Normalize homeworks
  const homeworks: NormalizedAssessment[] = Array.from(homeworksMap.values()).map((hw, idx) => ({
    id: asString(hw.id) || `hw_${idx + 1}`,
    title: asString(hw.title) || asString(hw.name) || `واجب ${idx + 1}`,
    order: asOptionalNumber(hw.order) ?? (idx + 1),
    type: 'homework',
    duration: asString(hw.duration),
    availableFrom: parseDateValue(hw.availableFrom),
    availableUntil: parseDateValue(hw.availableUntil),
    archived: hw.archived === true,
    strictMode: hw.strictMode === true,
    questions: Array.isArray(hw.questions) ? hw.questions : [],
    raw: hw,
  }));

  // 5. Normalize exams
  const exams: NormalizedAssessment[] = Array.from(examsMap.values()).map((ex, idx) => ({
    id: asString(ex.id) || `exam_${idx + 1}`,
    title: asString(ex.title) || asString(ex.name) || `امتحان ${idx + 1}`,
    order: asOptionalNumber(ex.order) ?? (idx + 1),
    type: 'exam',
    duration: asString(ex.duration),
    availableFrom: parseDateValue(ex.availableFrom),
    availableUntil: parseDateValue(ex.availableUntil),
    archived: ex.archived === true,
    strictMode: ex.strictMode === true,
    questions: Array.isArray(ex.questions) ? ex.questions : [],
    raw: ex,
  }));

  // Sort each list by order
  lectures.sort((a, b) => a.order - b.order);
  homeworks.sort((a, b) => a.order - b.order);
  exams.sort((a, b) => a.order - b.order);

  return {
    layoutVersion: 2,
    lectures,
    homeworks,
    exams,
  };
}

export function buildSectionsFromContent(content: NormalizedCourseContent): CourseSection[] {
  const sections: CourseSection[] = [];

  if (content.lectures.length > 0) {
    const items: CourseItem[] = content.lectures.map((lec) => ({
      id: lec.id,
      type: 'video',
      assessmentKind: null,
      title: lec.title,
      videoUrl: lec.youtubeUrl,
      pdfUrl: lec.pdfUrl,
      duration: lec.duration || '',
      archived: lec.archived === true,
      availableFrom: lec.availableFrom ?? null,
      availableUntil: lec.availableUntil ?? null,
      children: lec.trainings.map((tr) => ({
        id: tr.id,
        type: 'task',
        assessmentKind: 'training',
        title: tr.title,
        videoUrl: '',
        pdfUrl: '',
        duration: tr.duration || '',
        archived: false,
        availableFrom: tr.availableFrom ?? null,
        availableUntil: tr.availableUntil ?? null,
        children: [],
        raw: tr.raw || {},
      })),
      raw: lec.raw || {},
    }));
    sections.push({
      id: 'sec_lectures',
      title: 'المحاضرات',
      archived: false,
      items,
      raw: {},
    });
  }

  if (content.homeworks.length > 0) {
    const items: CourseItem[] = content.homeworks.map((hw) => ({
      id: hw.id,
      type: 'task',
      assessmentKind: 'homework',
      title: hw.title,
      videoUrl: '',
      pdfUrl: '',
      duration: hw.duration || '',
      archived: hw.archived === true,
      availableFrom: hw.availableFrom ?? null,
      availableUntil: hw.availableUntil ?? null,
      children: [],
      raw: hw.raw || {},
    }));
    sections.push({
      id: 'sec_homeworks',
      title: 'الواجبات',
      archived: false,
      items,
      raw: {},
    });
  }

  if (content.exams.length > 0) {
    const items: CourseItem[] = content.exams.map((ex) => ({
      id: ex.id,
      type: 'quiz',
      assessmentKind: 'exam',
      title: ex.title,
      videoUrl: '',
      pdfUrl: '',
      duration: ex.duration || '',
      archived: ex.archived === true,
      availableFrom: ex.availableFrom ?? null,
      availableUntil: ex.availableUntil ?? null,
      children: [],
      raw: ex.raw || {},
    }));
    sections.push({
      id: 'sec_exams',
      title: 'الامتحانات',
      archived: false,
      items,
      raw: {},
    });
  }

  return sections;
}

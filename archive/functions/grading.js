// منطق تصحيح الامتحانات والتدريبات والواجبات على السيرفر.
// ملف فقط، غير منشور. نفس القواعد المكتوبة في src/lib/grading.ts، فأي تعديل هناك يُعدَّل هنا أيضًا.
// القواعد: 3 محاولات كحد أقصى، والأولى هي الرسمية، وخصم 20 نقطة مئوية عند التسليم بعد availableUntil.

const MAX_ATTEMPTS = 3;
const LATE_PENALTY_PERCENT = 20;

// ---------- أدوات صغيرة ----------

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function asNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// ---------- التواريخ (توقيت مصر) ----------
// مواعيد الإتاحة تُكتب من لوحة الأدمن كنص datetime-local بدون منطقة زمنية،
// ونعتبرها بتوقيت القاهرة، كما يفهمها متصفح الطالب في مصر.

function cairoOffsetMs(utcMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));

  const get = (type) => Number(parts.find((part) => part.type === type).value);
  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );

  return asIfUtc - utcMs;
}

function parseTime(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  if (isRecord(value) && typeof value.toMillis === 'function') return value.toMillis();

  if (typeof value === 'string') {
    const text = value.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(text);

    if (match) {
      const [, year, month, day, hour = '23', minute = '59'] = match;
      const asUtc = Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
      );
      return asUtc - cairoOffsetMs(asUtc);
    }

    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

// ---------- الأسئلة ----------

const QUESTION_TYPES = ['choose', 'tf', 'explain', 'result', 'prove', 'relation', 'whatif', 'meaning'];

function parseOptions(value) {
  if (!isRecord(value)) return null;

  const options = {};
  for (const key of ['a', 'b', 'c', 'd']) {
    const text = asString(value[key]);
    if (text.trim() !== '') options[key] = text;
  }
  return Object.keys(options).length > 0 ? options : null;
}

function parseQuestions(value) {
  if (!Array.isArray(value)) return [];

  const questions = [];

  value.forEach((entry, index) => {
    if (!isRecord(entry)) return;

    const options = parseOptions(entry.options);
    const typeText = asString(entry.type).trim().toLowerCase();
    const type = QUESTION_TYPES.includes(typeText) ? typeText : options ? 'choose' : 'explain';

    const rawPoints = typeof entry.points === 'number' ? entry.points : Number(asString(entry.points));
    const points = Number.isFinite(rawPoints) && rawPoints > 0 ? rawPoints : 1;

    questions.push({
      id: asString(entry.id) || `q${index}`,
      type,
      text: asString(entry.text) || asString(entry.question),
      points,
      options,
      asMcq: entry.asMcq === true,
      answer: entry.answer === undefined || entry.answer === null ? null : asString(entry.answer),
      altAnswers: Array.isArray(entry.altAnswers)
        ? entry.altAnswers.map(asString).filter((item) => item !== '')
        : [],
    });
  });

  return questions;
}

// يدمج الإجابات الصحيحة (من examKeys) مع الأسئلة العامة (من examContent).
function mergeKeys(questions, answersList) {
  const byId = new Map();

  asArray(answersList).forEach((entry) => {
    if (!isRecord(entry)) return;
    byId.set(asString(entry.id), {
      answer: entry.answer === undefined || entry.answer === null ? null : asString(entry.answer),
      altAnswers: Array.isArray(entry.altAnswers)
        ? entry.altAnswers.map(asString).filter((item) => item !== '')
        : [],
    });
  });

  return questions.map((question) => {
    const key = byId.get(question.id);
    return key ? { ...question, answer: key.answer, altAnswers: key.altAnswers } : question;
  });
}

function getAnswerMode(question) {
  if (question.type === 'choose') return 'choice';
  if (question.type === 'tf') return 'tf';
  if (question.asMcq && question.options) return 'choice';
  return 'text';
}

// ---------- التصحيح ----------

function normalizeText(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

function normalizeTf(value) {
  const text = normalizeText(value);
  if (['صح', 'صحيح', 'true', 't'].includes(text)) return 'صح';
  if (['خطا', 'خطاء', 'غلط', 'false', 'f'].includes(text)) return 'خطأ';
  return '';
}

function isTfCorrect(question, given) {
  const picked = normalizeTf(given);
  if (!picked || question.answer === null) return false;
  return [question.answer, ...question.altAnswers].some((item) => normalizeTf(item) === picked);
}

function isChoiceCorrect(question, given) {
  const picked = given.trim().toLowerCase();
  if (!picked || question.answer === null) return false;

  const pickedText = question.options ? question.options[picked] : undefined;

  return [question.answer, ...question.altAnswers].some((item) => {
    if (item.trim().toLowerCase() === picked) return true;
    return pickedText !== undefined && normalizeText(pickedText) === normalizeText(item);
  });
}

function gradeQuestion(question, rawAnswer) {
  const answer = asString(rawAnswer).trim();
  const mode = getAnswerMode(question);

  const base = {
    question: question.text,
    rawAnswer: answer,
    totalPoints: question.points,
    options: question.options,
    correctAnswer: question.answer,
  };

  if (answer === '') {
    return {
      ...base,
      score: 0,
      pointsEarned: 0,
      feedback: 'لم تجب عن هذا السؤال',
      needsReview: false,
      method: 'unanswered',
    };
  }

  // الأسئلة المقالية تُعلَّم للمراجعة (Gemini على السيرفر في المرحلة 6).
  if (mode === 'text') {
    return {
      ...base,
      score: 0,
      pointsEarned: 0,
      feedback: '',
      needsReview: true,
      method: 'needs_review',
    };
  }

  const correct = mode === 'tf' ? isTfCorrect(question, answer) : isChoiceCorrect(question, answer);

  return {
    ...base,
    score: correct ? 1 : 0,
    pointsEarned: correct ? question.points : 0,
    feedback: correct ? 'إجابة صحيحة' : 'إجابة خاطئة',
    needsReview: false,
    method: 'objective',
  };
}

function buildAttemptResult(input) {
  const details = input.questions.map((question) =>
    gradeQuestion(question, input.answers[question.id] ?? ''),
  );

  const totalPoints = round2(details.reduce((sum, item) => sum + item.totalPoints, 0));
  const earnedPoints = round2(details.reduce((sum, item) => sum + item.pointsEarned, 0));
  const percent = totalPoints > 0 ? round2((earnedPoints / totalPoints) * 100) : 0;

  const penalized = input.availableUntil !== null && input.submittedAt > input.availableUntil;
  const effectivePercent = penalized ? Math.max(0, round2(percent - LATE_PENALTY_PERCENT)) : percent;

  const needsReview = details.some((item) => item.needsReview);

  return {
    courseId: input.courseId,
    examId: input.examId,
    examTitle: input.examTitle,
    percent,
    earnedPoints,
    totalPoints,
    effectivePercent,
    penalized,
    attemptNumber: input.attemptNumber,
    isOfficial: input.attemptNumber === 1,
    autoSubmit: input.autoSubmit,
    ts: input.submittedAt,
    details,
    isTraining: input.kind === 'training',
    isHomework: input.kind === 'homework',
    needsReview,
    reviewReason: needsReview ? 'essay-questions' : '',
  };
}

// ---------- محاولات الطالب ----------

// الربط بالامتحان بـ examId، ولو غير موجود فبعنوان الامتحان.
function matchesAssessment(result, courseId, examId, title) {
  if (!isRecord(result)) return false;

  const resultCourse = asString(result.courseId);
  if (resultCourse && resultCourse !== courseId) return false;

  const resultExam = asString(result.examId);
  if (resultExam) return resultExam === examId;

  const resultTitle = asString(result.examTitle);
  return resultTitle !== '' && resultTitle === title;
}

// ---------- إيجاد عنصر الامتحان داخل مستند الكورس ----------

function detectKind(raw, defaultKind) {
  const type = asString(raw.type).trim().toLowerCase();

  if (type === 'video' || type === 'pdf' || type === 'header') return null;
  if (type === 'training' || type === 'تدريب') return 'training';
  if (type === 'homework' || type === 'task' || type === 'واجب') return 'homework';
  if (type === 'exam' || type === 'quiz' || type === 'امتحان') return 'exam';

  if (Array.isArray(raw.questions)) return defaultKind || 'exam';

  const hasMedia =
    asString(raw.youtubeUrl) !== '' || asString(raw.videoUrl) !== '' || asString(raw.pdfUrl) !== '';
  if (defaultKind && !hasMedia) return defaultKind;

  return null;
}

// نفس ترتيب القراءة وأرقام العناصر الاحتياطية في الواجهة (src/services/courses.ts).
function collectCandidates(course) {
  const contents = isRecord(course.contents) ? course.contents : {};
  const direct = Array.isArray(contents.sections)
    ? contents.sections
    : Array.isArray(course.sections)
      ? course.sections
      : [];

  const candidates = [];

  if (direct.length > 0) {
    direct.forEach((section, sectionIndex) => {
      if (!isRecord(section)) return;
      const sectionId = asString(section.id) || `sec_${sectionIndex}`;
      asArray(section.items).forEach((item, index) => {
        candidates.push({ raw: item, fallbackId: `${sectionId}_i${index}`, defaultKind: null });
      });
    });
    return candidates;
  }

  [
    ['sec_lectures', contents.lectures, null],
    ['sec_trainings', contents.trainings, 'training'],
    ['sec_homeworks', contents.homeworks, 'homework'],
    ['sec_exams', contents.exams, 'exam'],
  ].forEach(([sectionId, list, kind]) => {
    asArray(list).forEach((item, index) => {
      candidates.push({ raw: item, fallbackId: `${sectionId}_i${index}`, defaultKind: kind });
    });
  });

  asArray(contents.customSections).forEach((entry, customIndex) => {
    if (!isRecord(entry)) return;
    const sectionId = asString(entry.id) || `custom_${customIndex}`;
    asArray(entry.items).forEach((item, index) => {
      candidates.push({ raw: item, fallbackId: `${sectionId}_i${index}`, defaultKind: null });
    });
  });

  return candidates;
}

// يرجع { raw, kind, id } للعنصر المطلوب، أو null لو غير موجود أو ليس امتحانًا.
function findAssessmentItem(course, examId) {
  for (const candidate of collectCandidates(course)) {
    if (!isRecord(candidate.raw)) continue;

    const id = asString(candidate.raw.id) || candidate.fallbackId;

    if (id === examId) {
      const kind = detectKind(candidate.raw, candidate.defaultKind);
      return kind ? { raw: candidate.raw, kind, id } : null;
    }

    const children = asArray(candidate.raw.children);
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (!isRecord(child)) continue;

      const childId = asString(child.id) || `${id}_c${index}`;
      if (childId === examId) {
        const kind = detectKind(child, null);
        return kind ? { raw: child, kind, id: childId } : null;
      }
    }
  }

  return null;
}

module.exports = {
  MAX_ATTEMPTS,
  asArray,
  asNumber,
  asString,
  buildAttemptResult,
  findAssessmentItem,
  isRecord,
  matchesAssessment,
  mergeKeys,
  parseQuestions,
  parseTime,
};

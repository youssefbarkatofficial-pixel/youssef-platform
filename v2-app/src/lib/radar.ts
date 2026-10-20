// رادار التسرّب v2 وخريطة ضعف الدروس وجدول الأسبوع الذكي
// منطق نقي بدون أي اتصال بقاعدة البيانات (يُختبر وحدةً بالكامل).

export type RadarSegment =
  | 'stopped'
  | 'weak'
  | 'lagging'
  | 'star'
  | 'ok'
  | 'unwatched_video'
  | 'incomplete_video'
  | 'fast_or_skipped'
  | 'training_done_hw_pending'
  | 'hw_done_exam_pending'
  | 'exam_completed'
  | 'file_downloaded'
  | 'notified'
  | 'missed_full_week'
  | 'at_risk'
  | 'recovered';

export const SEGMENT_LABELS: Record<RadarSegment, string> = {
  stopped: 'متوقف',
  weak: 'مستواه ضعيف',
  lagging: 'متأخر في المشاهدة',
  star: 'متفوق',
  ok: 'ماشي كويس',
  unwatched_video: 'لسه مشافش الفيديو',
  incomplete_video: 'فتح ومكمّلش',
  fast_or_skipped: 'شاف بتسريع أو قفز',
  training_done_hw_pending: 'حل التدريب ولسه الواجب',
  hw_done_exam_pending: 'سلّم الواجب ولسه الامتحان',
  exam_completed: 'امتحن بنجاح',
  file_downloaded: 'حمّل ملف الدرس',
  notified: 'تم إشعاره مؤخرًا',
  missed_full_week: 'ضيّع الأسبوع كله',
  at_risk: 'طلاب في خطر',
  recovered: 'عاد للمسار بعد التصفير',
};

export interface ResetHistoryEntry {
  resetAt: number;
  note?: string;
  setBy: string;
}

export interface RadarStudentInput {
  id: string;
  name: string;
  phone: string;
  parentPhone: string;
  courseCount: number;
  lastActiveMs: number | null;
  createdAtMs: number | null;
  watchPercent: number | null; // 0-100
  avgScore: number | null; // 0-100
  examCount: number;
  archived: boolean;
  // حقول رادار v2 الجديدة
  baselineAt?: number | null;
  baselineNote?: string;
  followUpDate?: number | null;
  resetHistory?: ResetHistoryEntry[];
  latestLectureWatch?: {
    lectureId: string;
    progress: number; // 0-100
    speedExceeded?: boolean;
    seeks?: number;
  };
  latestTrainingSubmitted?: boolean;
  latestHomeworkSubmitted?: boolean;
  latestExamSubmitted?: boolean;
  downloadedFilesCount?: number;
  lastNotifiedMs?: number | null;
}

export interface WeeklyScheduleStatus {
  isMissedFullWeek: boolean;
  isHwDueWarning: boolean;
  daysLate: number;
  nextMilestone: string;
}

export interface RadarRow extends RadarStudentInput {
  daysInactive: number | null;
  risk: number; // 0-100
  segment: RadarSegment;
  smartSegments: RadarSegment[];
  weeklyStatus: WeeklyScheduleStatus;
}

export type SortOption = 'risk' | 'alphabetical' | 'newest' | 'oldest' | 'lastActive';

const DAY = 86_400_000;

/**
 * حساب حدود الأسبوع الدراسي بتوقيت القاهرة
 * دورة الأسبوع:
 * - فتح المحاضرة: الخميس 9:00 مساءً
 * - ميعاد الواجب: الثلاثاء 9:00 مساءً
 * - الامتحان: الأربعاء 9:00 مساءً
 */
export function getCairoWeekBoundaries(now: number): {
  thursdayMidnightMs: number;
  thursday9pmMs: number;
  tuesdayDeadlineMs: number;
  wednesdayDeadlineMs: number;
} {
  // توقيت القاهرة UTC+2
  const cairoOffset = 2 * 3600 * 1000;
  const d = new Date(now + cairoOffset);
  const dayOfWeek = d.getUTCDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat

  // نحدد فجر الخميس الأخير (بداية دورة الأسبوع الحالية)
  // فرق الأيام عن الخميس الماضي:
  const daysSinceThursday = (dayOfWeek - 4 + 7) % 7;
  const thuDate = new Date(d);
  thuDate.setUTCDate(d.getUTCDate() - daysSinceThursday);
  thuDate.setUTCHours(0, 0, 0, 0);
  const thursdayMidnightMs = thuDate.getTime() - cairoOffset;

  const thu9pm = new Date(thuDate);
  thu9pm.setUTCHours(21, 0, 0, 0);
  const thursday9pmMs = thu9pm.getTime() - cairoOffset;

  // الثلاثاء التالي (بعد 5 أيام من الخميس)
  const tueDeadline = new Date(thuDate);
  tueDeadline.setUTCDate(thuDate.getUTCDate() + 5);
  tueDeadline.setUTCHours(21, 0, 0, 0);
  const tuesdayDeadlineMs = tueDeadline.getTime() - cairoOffset;

  // الأربعاء التالي (بعد 6 أيام من الخميس)
  const wedDeadline = new Date(thuDate);
  wedDeadline.setUTCDate(thuDate.getUTCDate() + 6);
  wedDeadline.setUTCHours(21, 0, 0, 0);
  const wednesdayDeadlineMs = wedDeadline.getTime() - cairoOffset;

  return { thursdayMidnightMs, thursday9pmMs, tuesdayDeadlineMs, wednesdayDeadlineMs };
}

export function calculateWeeklyStatus(input: RadarStudentInput, now: number): WeeklyScheduleStatus {
  const boundaries = getCairoWeekBoundaries(now);
  const seen = input.lastActiveMs ?? input.createdAtMs;

  // ضيّع الأسبوع كله: منذ فجر الخميس الأخير لم يسجل أي نشاط
  const isMissedFullWeek = seen === null || seen < boundaries.thursdayMidnightMs;

  // تحذير: ميعاد الواجب جه (تجاوزنا الثلاثاء 9م) والتدريب لسه ما اتحلش
  const isPastTuesday = now >= boundaries.tuesdayDeadlineMs;
  const isHwDueWarning = isPastTuesday && !input.latestTrainingSubmitted;

  let daysLate = 0;
  if (seen !== null && now > seen) {
    daysLate = Math.floor((now - seen) / DAY);
  }

  let nextMilestone = 'محاضرة الخميس 9:00 م';
  if (now < boundaries.thursday9pmMs) {
    nextMilestone = 'محاضرة الخميس 9:00 م';
  } else if (now < boundaries.tuesdayDeadlineMs) {
    nextMilestone = 'تسليم الواجب الثلاثاء 9:00 م';
  } else if (now < boundaries.wednesdayDeadlineMs) {
    nextMilestone = 'امتحان الأربعاء 9:00 م';
  }

  return {
    isMissedFullWeek,
    isHwDueWarning,
    daysLate,
    nextMilestone,
  };
}

export function scoreStudent(input: RadarStudentInput, now: number): RadarRow {
  // إذا كان هناك baselineAt: نقيس النشاط بالنسبة لـ baselineAt
  const effectiveBase = input.baselineAt ?? null;
  const rawSeen = input.lastActiveMs ?? input.createdAtMs;
  const seen = effectiveBase && rawSeen && rawSeen < effectiveBase ? effectiveBase : rawSeen;

  const daysInactive = seen === null ? null : Math.max(0, Math.floor((now - seen) / DAY));
  const ageDays = input.createdAtMs === null ? null : Math.floor((now - input.createdAtMs) / DAY);

  let risk = 0;
  if (daysInactive !== null) {
    if (daysInactive >= 30) risk += 75;
    else if (daysInactive >= 14) risk += 60;
    else if (daysInactive >= 7) risk += 40;
    else if (daysInactive >= 3) risk += 15;
  }
  const weak = input.avgScore !== null && input.examCount >= 2 && input.avgScore < 50;
  if (weak) risk += 25;
  else if (input.avgScore !== null && input.examCount >= 2 && input.avgScore < 65) risk += 12;

  const lagging =
    input.watchPercent !== null && input.watchPercent < 30 && ageDays !== null && ageDays >= 14;
  if (lagging) risk += 15;

  const weeklyStatus = calculateWeeklyStatus(input, now);
  if (weeklyStatus.isMissedFullWeek) risk += 20;
  if (weeklyStatus.isHwDueWarning) risk += 15;

  // تحديد القطاع الأساسي
  let segment: RadarSegment = 'ok';
  if (daysInactive !== null && daysInactive >= 7) segment = 'stopped';
  else if (weak) segment = 'weak';
  else if (lagging) segment = 'lagging';
  else if (input.avgScore !== null && input.avgScore >= 85 && (daysInactive ?? 99) <= 3) segment = 'star';

  // تحديد جميع القطاعات الذكية المطابقة (Smart Segments)
  const smartSegments: RadarSegment[] = [segment];

  const lecWatch = input.latestLectureWatch;
  if (lecWatch) {
    if (lecWatch.progress === 0) smartSegments.push('unwatched_video');
    else if (lecWatch.progress > 0 && lecWatch.progress < 95) smartSegments.push('incomplete_video');
    if (lecWatch.speedExceeded || (lecWatch.seeks && lecWatch.seeks >= 3)) smartSegments.push('fast_or_skipped');
  } else if (input.watchPercent === 0 || input.watchPercent === null) {
    smartSegments.push('unwatched_video');
  }

  if (input.latestTrainingSubmitted && !input.latestHomeworkSubmitted) {
    smartSegments.push('training_done_hw_pending');
  }
  if (input.latestHomeworkSubmitted && !input.latestExamSubmitted) {
    smartSegments.push('hw_done_exam_pending');
  }
  if (input.latestExamSubmitted) {
    smartSegments.push('exam_completed');
  }
  if ((input.downloadedFilesCount ?? 0) > 0) {
    smartSegments.push('file_downloaded');
  }
  if (input.lastNotifiedMs && now - input.lastNotifiedMs < 7 * DAY) {
    smartSegments.push('notified');
  }
  if (weeklyStatus.isMissedFullWeek) {
    smartSegments.push('missed_full_week');
  }
  const finalRisk = Math.min(100, risk);
  if (finalRisk >= 70) {
    smartSegments.push('at_risk');
  }
  if (input.baselineAt && input.lastActiveMs && input.lastActiveMs > input.baselineAt) {
    smartSegments.push('recovered');
  }

  return {
    ...input,
    daysInactive,
    risk: finalRisk,
    segment,
    smartSegments: Array.from(new Set(smartSegments)),
    weeklyStatus,
  };
}

/**
 * بناء الرادار وتصنيف وفرز الطلاب بالخيارات المتقدمة
 */
export function buildRadar(
  inputs: RadarStudentInput[],
  now: number,
  sort: SortOption = 'risk',
  filterSegment?: RadarSegment | 'all',
  searchQuery?: string,
): RadarRow[] {
  let rows = inputs
    .filter((item) => !item.archived && item.courseCount > 0)
    .map((item) => scoreStudent(item, now));

  // تصفية بالبحث إن وجد
  if (searchQuery && searchQuery.trim() !== '') {
    const q = searchQuery.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.parentPhone.includes(q),
    );
  }

  // تصفية بالقطاع إن وجد
  if (filterSegment && filterSegment !== 'all') {
    rows = rows.filter(
      (r) => r.segment === filterSegment || r.smartSegments.includes(filterSegment as RadarSegment),
    );
  }

  // الفرز
  rows.sort((a, b) => {
    switch (sort) {
      case 'alphabetical':
        return a.name.localeCompare(b.name, 'ar');
      case 'newest':
        return (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);
      case 'oldest':
        return (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0);
      case 'lastActive':
        return (b.lastActiveMs ?? 0) - (a.lastActiveMs ?? 0);
      case 'risk':
      default:
        return b.risk - a.risk;
    }
  });

  return rows;
}

// أداة تطبيق التصفير baselineAt
export function applyBaseline(
  current: RadarStudentInput,
  note: string,
  followUpDate: number | null,
  setBy: string,
  now: number = Date.now(),
): RadarStudentInput {
  const history = [...(current.resetHistory || [])];
  history.push({
    resetAt: now,
    note: note.trim() || undefined,
    setBy,
  });

  return {
    ...current,
    baselineAt: now,
    baselineNote: note.trim(),
    followUpDate,
    resetHistory: history,
  };
}

// أداة التراجع عن التصفير
export function revertBaseline(current: RadarStudentInput): RadarStudentInput {
  const history = [...(current.resetHistory || [])];
  if (history.length > 0) {
    history.pop();
  }
  const prev = history[history.length - 1];

  return {
    ...current,
    baselineAt: prev ? prev.resetAt : null,
    baselineNote: prev ? prev.note || '' : '',
    followUpDate: null,
    resetHistory: history,
  };
}

export interface LessonScoreInput {
  key: string;
  title: string;
  courseId: string;
  score: number; // 0-100 (الدرجة الرسمية)
}

export interface LessonStat {
  key: string;
  title: string;
  courseId: string;
  count: number;
  avg: number;
  failRate: number; // 0-100
}

export function weakAssessments(scores: LessonScoreInput[], minCount = 3, limit = 10): LessonStat[] {
  const groups = new Map<string, LessonScoreInput[]>();
  scores.forEach((item) => {
    const list = groups.get(item.key) ?? [];
    list.push(item);
    groups.set(item.key, list);
  });

  const stats: LessonStat[] = [];
  groups.forEach((list, key) => {
    if (list.length < minCount) return;
    const avg = list.reduce((sum, item) => sum + item.score, 0) / list.length;
    const fails = list.filter((item) => item.score < 50).length;
    stats.push({
      key,
      title: list[0].title,
      courseId: list[0].courseId,
      count: list.length,
      avg: Math.round(avg),
      failRate: Math.round((fails / list.length) * 100),
    });
  });

  return stats.sort((a, b) => a.avg - b.avg).slice(0, limit);
}

export function toWhatsappNumber(phone: string): string {
  const digits = phone.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');
  if (digits.startsWith('01') && digits.length === 11) return `20${digits.slice(1)}`;
  if (digits.startsWith('20') && digits.length === 12) return digits;
  if (digits.startsWith('1') && digits.length === 10) return `20${digits}`;
  return digits;
}

export function whatsappLink(phone: string, text: string): string {
  const number = toWhatsappNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : '';
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'يا بطل';
}

/**
 * قوالب رسائل الواتساب مع دعم استبدال المتغيرات:
 * {studentName}, {courseName}, {lectureTitle}, {openTime}, {lateDays}
 */
export function generateWhatsAppTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  return result;
}

export const DEFAULT_WHATSAPP_TEMPLATES = {
  studentReminder: 'أهلًا {studentName}، وحشتنا على المنصة! باقيلك {lectureTitle}، ميعادها قرب. ادخل كمّل واستعد.',
  studentWarning: 'أهلًا {studentName}، عدّى {lateDays} أيام ولسه ما كملتش درس {lectureTitle}. ادخل دلوقتي وحل التدريب.',
  parentFollowup: 'السلام عليكم، معاك منصة أ. يوسف بركات. بنطمن على {studentName} في مادة الجغرافيا، متأخر {lateDays} أيام في {lectureTitle} وحابين نساعده.',
};

export function messageFor(segment: RadarSegment, name: string, forParent = false): string {
  const n = firstName(name);
  if (forParent) {
    switch (segment) {
      case 'stopped':
      case 'missed_full_week':
        return `السلام عليكم، معاك منصة أ. يوسف بركات. لاحظنا إن ${n} بقاله فترة مدخلش المنصة، وحابين نطمن عليه ونساعده يرجع لمستواه. لو في أي صعوبة قولنا.`;
      case 'weak':
      case 'at_risk':
        return `السلام عليكم، معاك منصة أ. يوسف بركات. ${n} محتاج دعم بسيط في بعض الدروس، وعندنا مراجعة ذكية تساعده. حابين نتعاون معاكم عشان نرفع مستواه.`;
      case 'star':
        return `السلام عليكم، معاك منصة أ. يوسف بركات. حابين نبلغكم إن ${n} مستواه ممتاز وملتزم، ربنا يوفقه.`;
      default:
        return `السلام عليكم، معاك منصة أ. يوسف بركات. بنتابع مستوى ${n} ونحب نطمنكم عليه، ولو محتاجين أي مساعدة احنا موجودين.`;
    }
  }
  switch (segment) {
    case 'stopped':
    case 'missed_full_week':
      return `أهلًا ${n}، وحشتنا على المنصة! فاتك كام درس، والمراجعة لسه في إيدك. ادخل كمّل من آخر درس وقفت عنده، ولو في حاجة وقفتك قولي.`;
    case 'weak':
    case 'at_risk':
      return `أهلًا ${n}، شفت إن في كام درس محتاج تثبّته. جرّب المراجعة الذكية في المنصة، هتركّز لك على نقط ضعفك بالظبط، وأنا معاك لو احتجت شرح.`;
    case 'lagging':
    case 'incomplete_video':
    case 'unwatched_video':
      return `أهلًا ${n}، لسه ما خلصتش مشاهدة محاضراتك. خلّي هدفك محاضرة النهاردة، والتدريبات بتتفتح بعدها علطول.`;
    case 'training_done_hw_pending':
      return `عاش يا ${n}! خلّصت التدريب، مستنيين منك الواجب النهاردة عشان المحاضرة اللي بعدها تفتحلك.`;
    case 'hw_done_exam_pending':
      return `ممتاز يا ${n}، الواجب وصل. ادخل دلوقتي امتحن تقييم الدرس وثبّت فهمك.`;
    case 'star':
      return `ما شاء الله عليك يا ${n}، مستواك ممتاز وملتزم! كمّل بنفس الشغل، وجرّب الامتحانات الأصعب عشان تثبّت مكانك.`;
    case 'recovered':
      return `أهلًا ${n}! منور المنصة من تاني، بداية موفقة وبنشجعك تكمّل للأول دايماً.`;
    default:
      return `أهلًا ${n}، بنتابع تقدمك على المنصة وكل حاجة ماشية كويس. كمّل!`;
  }
}

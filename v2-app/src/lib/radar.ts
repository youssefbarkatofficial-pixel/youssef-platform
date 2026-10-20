// رادار التسرّب وخريطة ضعف الدروس: منطق نقي بدون أي اتصال بقاعدة البيانات (يُختبر وحده).

export type RadarSegment = 'stopped' | 'weak' | 'lagging' | 'star' | 'ok';

export const SEGMENT_LABELS: Record<RadarSegment, string> = {
  stopped: 'متوقف',
  weak: 'مستواه ضعيف',
  lagging: 'متأخر في المشاهدة',
  star: 'متفوق',
  ok: 'ماشي كويس',
};

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
}

export interface RadarRow extends RadarStudentInput {
  daysInactive: number | null;
  risk: number; // 0-100
  segment: RadarSegment;
}

const DAY = 86_400_000;

export function scoreStudent(input: RadarStudentInput, now: number): RadarRow {
  const seen = input.lastActiveMs ?? input.createdAtMs;
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

  let segment: RadarSegment = 'ok';
  if (daysInactive !== null && daysInactive >= 7) segment = 'stopped';
  else if (weak) segment = 'weak';
  else if (lagging) segment = 'lagging';
  else if (input.avgScore !== null && input.avgScore >= 85 && (daysInactive ?? 99) <= 3) segment = 'star';

  return { ...input, daysInactive, risk: Math.min(100, risk), segment };
}

// الطلاب المشتركون غير المؤرشفين فقط، الأخطر أولًا.
export function buildRadar(inputs: RadarStudentInput[], now: number): RadarRow[] {
  return inputs
    .filter((item) => !item.archived && item.courseCount > 0)
    .map((item) => scoreStudent(item, now))
    .sort((a, b) => b.risk - a.risk);
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

// أضعف الامتحانات/التدريبات/الواجبات بمتوسط الدرجة الرسمية (يحتاج عدد محاولات كافٍ ليكون الرقم مفيدًا).
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

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'يا بطل';
}

// رسائل صادقة بدون أي ضغط كاذب: تذكير + عرض مساعدة.
export function messageFor(segment: RadarSegment, name: string, forParent = false): string {
  const n = firstName(name);
  if (forParent) {
    switch (segment) {
      case 'stopped':
        return `السلام عليكم، معاك منصة أ. يوسف بركات. لاحظنا إن ${n} بقاله فترة مدخلش المنصة، وحابين نطمن عليه ونساعده يرجع لمستواه. لو في أي صعوبة قولنا.`;
      case 'weak':
        return `السلام عليكم، معاك منصة أ. يوسف بركات. ${n} محتاج دعم بسيط في بعض الدروس، وعندنا مراجعة ذكية تساعده. حابين نتعاون معاكم عشان نرفع مستواه.`;
      case 'star':
        return `السلام عليكم، معاك منصة أ. يوسف بركات. حابين نبلغكم إن ${n} مستواه ممتاز وملتزم، ربنا يوفقه.`;
      default:
        return `السلام عليكم، معاك منصة أ. يوسف بركات. بنتابع مستوى ${n} ونحب نطمنكم عليه، ولو محتاجين أي مساعدة احنا موجودين.`;
    }
  }
  switch (segment) {
    case 'stopped':
      return `أهلًا ${n}، وحشتنا على المنصة! فاتك كام درس، والمراجعة لسه في إيدك. ادخل كمّل من آخر درس وقفت عنده، ولو في حاجة وقفتك قولي.`;
    case 'weak':
      return `أهلًا ${n}، شفت إن في كام درس محتاج تثبّته. جرّب المراجعة الذكية في المنصة، هتركّز لك على نقط ضعفك بالظبط، وأنا معاك لو احتجت شرح.`;
    case 'lagging':
      return `أهلًا ${n}، لسه ما خلصتش مشاهدة محاضراتك. خلّي هدفك محاضرة النهاردة، والتدريبات بتتفتح بعدها علطول.`;
    case 'star':
      return `ما شاء الله عليك يا ${n}، مستواك ممتاز وملتزم! كمّل بنفس الشغل، وجرّب الامتحانات الأصعب عشان تثبّت مكانك.`;
    default:
      return `أهلًا ${n}، بنتابع تقدمك على المنصة وكل حاجة ماشية كويس. كمّل!`;
  }
}

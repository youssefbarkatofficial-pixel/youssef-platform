export type GradeCode =
  | 'primary4'
  | 'primary5'
  | 'primary6'
  | 'prep1'
  | 'prep2'
  | 'prep3'
  | 'sec1'
  | 'sec2'
  | 'sec3';

export interface GradeInfo {
  code: GradeCode;
  label: string;
}

export const GRADES: GradeInfo[] = [
  { code: 'primary4', label: 'الصف الرابع الابتدائي' },
  { code: 'primary5', label: 'الصف الخامس الابتدائي' },
  { code: 'primary6', label: 'الصف السادس الابتدائي' },
  { code: 'prep1', label: 'الصف الأول الإعدادي' },
  { code: 'prep2', label: 'الصف الثاني الإعدادي' },
  { code: 'prep3', label: 'الصف الثالث الإعدادي' },
  { code: 'sec1', label: 'الصف الأول الثانوي' },
  { code: 'sec2', label: 'الصف الثاني الثانوي' },
  { code: 'sec3', label: 'الصف الثالث الثانوي' },
];

export const GRADE_OPTIONS = GRADES.map((grade) => ({
  value: grade.code,
  label: grade.label,
}));

export function isGradeCode(value: unknown): value is GradeCode {
  return GRADES.some((grade) => grade.code === value);
}

export type GradeTrack = 'general' | 'bacc';

export interface TrackInfo {
  code: GradeTrack;
  label: string;
}

export const TRACKS: TrackInfo[] = [
  { code: 'general', label: 'عام' },
  { code: 'bacc', label: 'بكالوريا' },
];

export function isSecondaryGrade(code: unknown): code is 'sec1' | 'sec2' | 'sec3' {
  return code === 'sec1' || code === 'sec2' || code === 'sec3';
}

export function getTrackLabel(track: GradeTrack | string | null | undefined): string {
  if (track === 'general') return 'عام';
  if (track === 'bacc') return 'بكالوريا';
  return '';
}

export function getGradeLabel(
  code: GradeCode | null | undefined,
  track?: GradeTrack | null,
): string {
  const found = GRADES.find((grade) => grade.code === code);
  if (!found) return 'غير محدد';
  if (isSecondaryGrade(code) && track) {
    const trackLabel = getTrackLabel(track);
    if (trackLabel) return `${found.label} (${trackLabel})`;
  }
  return found.label;
}

// الصف التالي المقترح عند بداية سنة دراسية جديدة.
export function suggestNextGrade(current: GradeCode | null): GradeCode | null {
  if (!current) return null;
  const index = GRADES.findIndex((grade) => grade.code === current);
  if (index === -1) return null;
  return GRADES[Math.min(index + 1, GRADES.length - 1)].code;
}

function cleanText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // التشكيل والتطويل
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/\s+/g, ' ')
    .trim();
}

function detectNumber(text: string): number | null {
  if (text.includes('سادس')) return 6;
  if (text.includes('خامس')) return 5;
  if (text.includes('رابع')) return 4;
  if (text.includes('ثالث') || text.includes('تالت')) return 3;
  if (text.includes('ثاني') || text.includes('تاني')) return 2;
  if (text.includes('اول')) return 1;
  const digit = text.match(/[1-6]/);
  return digit ? Number(digit[0]) : null;
}

// تحوّل أي صيغة قديمة (كود أو نص عربي) إلى الكود المعتمد، أو null لو لم تُعرف.
export function normalizeGrade(value: unknown): GradeCode | null {
  if (typeof value !== 'string') return null;

  const compact = value.toLowerCase().replace(/[\s_-]/g, '');
  if (isGradeCode(compact)) return compact;

  const text = cleanText(value);
  if (!text) return null;

  let stage: 'primary' | 'prep' | 'sec' | null = null;
  if (text.includes('ابتدا')) stage = 'primary';
  else if (text.includes('اعداد')) stage = 'prep';
  else if (text.includes('ثانو')) stage = 'sec';
  if (!stage) return null;

  const number = detectNumber(text);
  if (number === null) return null;

  const candidate = `${stage}${number}`;

  return isGradeCode(candidate) ? candidate : null;
}

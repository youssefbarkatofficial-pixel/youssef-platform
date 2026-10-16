// السنة الدراسية تبدأ في 25 يوليو (الأشهر في JavaScript تبدأ من 0، فيوليو = 6).
const ACADEMIC_YEAR_START_MONTH = 6;
const ACADEMIC_YEAR_START_DAY = 25;

// تُرجع رقم سنة البداية:
// بعد يونيو (أغسطس فما فوق) أو يوليو من يوم 25 فما فوق: السنة الحالية، وإلا السنة السابقة.
export function getAcademicYear(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const started =
    month > ACADEMIC_YEAR_START_MONTH ||
    (month === ACADEMIC_YEAR_START_MONTH && day >= ACADEMIC_YEAR_START_DAY);

  return started ? year : year - 1;
}

// قراءة متسامحة لقيمة lastUpdatedAcademicYear المخزنة (رقم، أو نص مثل "2025-2026").
export function parseAcademicYear(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const match = value.match(/[0-9]{4}/);
    if (match) return Number(match[0]);
  }
  return null;
}

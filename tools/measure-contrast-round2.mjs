/**
 * tools/measure-contrast-round2.mjs
 * حساب تباين الألوان آلياً وفق معادلة WCAG الرسمية والتحقق من توافق AAA (>= 7:1) للنصوص و (>= 4.5:1) للأيقونات
 */

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function getLuminance(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function getContrast(hex1, hex2) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const TESTS = [
  // --- Dark Mode ---
  { mode: 'Dark (ليلي)', element: 'النص الأساسي على خلفية الصفحة', fg: '#f8fafc', bg: '#071326', min: 7.0, type: 'Normal Text' },
  { mode: 'Dark (ليلي)', element: 'النص الأساسي على سطح البطاقة', fg: '#f8fafc', bg: '#0c1b33', min: 7.0, type: 'Normal Text' },
  { mode: 'Dark (ليلي)', element: 'النص الثانوي على سطح البطاقة', fg: '#cbd5e1', bg: '#0c1b33', min: 7.0, type: 'Secondary Text' },
  { mode: 'Dark (ليلي)', element: 'النص الخافت (Muted) على خلفية الصفحة', fg: '#94a3b8', bg: '#071326', min: 7.0, type: 'Muted Text' },
  { mode: 'Dark (ليلي)', element: 'اللون الذهبي (Brand Gold) على خلفية الصفحة', fg: '#d4a64f', bg: '#071326', min: 7.0, type: 'Brand Accent' },
  { mode: 'Dark (ليلي)', element: 'شريط القائمة الجانبية: النص الأساسي', fg: '#f8fafc', bg: '#071326', min: 7.0, type: 'Sidebar Text' },
  { mode: 'Dark (ليلي)', element: 'شريط القائمة الجانبية: النص الثانوي', fg: '#cbd5e1', bg: '#071326', min: 7.0, type: 'Sidebar Muted' },
  { mode: 'Dark (ليلي)', element: 'شريط القائمة الجانبية: الأيقونات', fg: '#d4a64f', bg: '#071326', min: 4.5, type: 'Sidebar Icon' },

  // --- Light Mode ---
  { mode: 'Light (نهاري)', element: 'النص الأساسي على خلفية الصفحة', fg: '#0f172a', bg: '#f8fafc', min: 7.0, type: 'Normal Text' },
  { mode: 'Light (نهاري)', element: 'النص الأساسي على سطح البطاقة الأبيض', fg: '#0f172a', bg: '#ffffff', min: 7.0, type: 'Normal Text' },
  { mode: 'Light (نهاري)', element: 'النص الثانوي على السطح الأبيض', fg: '#334155', bg: '#ffffff', min: 7.0, type: 'Secondary Text' },
  { mode: 'Light (نهاري)', element: 'النص الخافت (Muted) على السطح الأبيض', fg: '#475569', bg: '#ffffff', min: 7.0, type: 'Muted Text' },
  { mode: 'Light (نهاري)', element: 'اللون الذهبي الملكي على السطح الأبيض', fg: '#784f04', bg: '#ffffff', min: 7.0, type: 'Brand Gold' },
  { mode: 'Light (نهاري)', element: 'اللون الأخضر المساعد (Accent) على السطح الأبيض', fg: '#115e59', bg: '#ffffff', min: 7.0, type: 'Accent' },
  { mode: 'Light (نهاري)', element: 'شريط القائمة الجانبية: النص الأساسي الداكن', fg: '#0f172a', bg: '#ffffff', min: 7.0, type: 'Sidebar Text' },
  { mode: 'Light (نهاري)', element: 'شريط القائمة الجانبية: النص الخافت الداكن', fg: '#334155', bg: '#ffffff', min: 7.0, type: 'Sidebar Muted' },
  { mode: 'Light (نهاري)', element: 'شريط القائمة الجانبية: الأيقونات الذهبية الداكنة', fg: '#784f04', bg: '#ffffff', min: 7.0, type: 'Sidebar Icon' },
];

console.log('| الوضع | العنصر ومكان الاستخدام | لون العنصر | لون الخلفية | النسبة المحسوبة | المعيار المطلوب | النتيجة |');
console.log('|---|---|---|---|---|---|---|');

let allPassed = true;
for (const t of TESTS) {
  const ratio = getContrast(t.fg, t.bg);
  const passed = ratio >= t.min;
  if (!passed) allPassed = false;
  const status = passed ? '✅ مطابق (نجاح)' : '❌ غير مطابق';
  console.log(`| ${t.mode} | ${t.element} | \`${t.fg}\` | \`${t.bg}\` | **${ratio.toFixed(2)}:1** | $\\ge ${t.min}:1$ | ${status} |`);
}

console.log(`\nالنتيجة الإجمالية للفحص الآلي: ${allPassed ? 'نجاح تام 100%' : 'توجد إخفاقات'}`);

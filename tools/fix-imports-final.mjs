import fs from 'node:fs';

// 1. contentRules.ts
let cr = fs.readFileSync('v2-app/src/lib/contentRules.ts', 'utf8');
cr = cr.replace(
  "export { tzOffsetMs, cairoToUtcMs, cairoInputToUtcMs, formatCairoDateTime } from './cairoTime';",
  "import { tzOffsetMs, cairoToUtcMs, cairoInputToUtcMs, formatCairoDateTime } from './cairoTime';\nexport { tzOffsetMs, cairoToUtcMs, cairoInputToUtcMs, formatCairoDateTime };"
);
fs.writeFileSync('v2-app/src/lib/contentRules.ts', cr, 'utf8');
console.log('✔ contentRules.ts imports');

// 2. AdminAssessmentEditPage.tsx
let aa = fs.readFileSync('v2-app/src/pages/admin/AdminAssessmentEditPage.tsx', 'utf8');
if (!aa.includes("import { cairoInputToUtcMs }")) {
  aa = "import { cairoInputToUtcMs } from '../../lib/cairoTime';\n" + aa;
}
fs.writeFileSync('v2-app/src/pages/admin/AdminAssessmentEditPage.tsx', aa, 'utf8');
console.log('✔ AdminAssessmentEditPage.tsx imports');

// 3. QuickUploadPage.tsx
let qu = fs.readFileSync('v2-app/src/pages/admin/QuickUploadPage.tsx', 'utf8');
qu = qu.replace(
  "import { AlertTriangle,",
  "import { AlertTriangle, Plus, ArrowUp, ArrowDown,"
);
fs.writeFileSync('v2-app/src/pages/admin/QuickUploadPage.tsx', qu, 'utf8');
console.log('✔ QuickUploadPage.tsx lucide icons');

// 4. AssessmentPage.tsx
let ap = fs.readFileSync('v2-app/src/pages/student/AssessmentPage.tsx', 'utf8');
if (!ap.includes("import { formatCairoDateTime }")) {
  ap = "import { formatCairoDateTime } from '../../lib/cairoTime';\n" + ap;
}
fs.writeFileSync('v2-app/src/pages/student/AssessmentPage.tsx', ap, 'utf8');
console.log('✔ AssessmentPage.tsx imports');

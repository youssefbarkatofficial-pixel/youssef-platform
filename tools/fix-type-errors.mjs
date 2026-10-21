import fs from 'node:fs';

// 1. contentRules.ts
let cr = fs.readFileSync('v2-app/src/lib/contentRules.ts', 'utf8');
// remove the local formatCairoDateTime definition in contentRules.ts
cr = cr.replace(
  /\/\*\*\s*\* تنسيق الوقت بتوقيت القاهرة باللغة العربية\s*\*\/[\s\S]*?return new Date\(timestampMs\)\.toLocaleString\('ar-EG'\);\s*\}\s*\}/,
  ''
);
fs.writeFileSync('v2-app/src/lib/contentRules.ts', cr, 'utf8');
console.log('✔ fixed contentRules.ts');

// 2. questionImport.ts
let qi = fs.readFileSync('v2-app/src/lib/questionImport.ts', 'utf8');
qi = qi.replace(
  /\.replace\(<li[^>]*>([\s\S]*?)<\/li>/gi,
  (m) => m
);
qi = qi.replace(
  /\(_m, liContent\)/g,
  '(_m: string, liContent: string)'
);
fs.writeFileSync('v2-app/src/lib/questionImport.ts', qi, 'utf8');
console.log('✔ fixed questionImport.ts');

// 3. AdminAssessmentEditPage.tsx
let aa = fs.readFileSync('v2-app/src/pages/admin/AdminAssessmentEditPage.tsx', 'utf8');
if (!aa.includes("cairoInputToUtcMs")) {
  aa = aa.replace(
    "import { formatCairoScheduleSummary, getCairoNextSchedule } from '../../lib/questionImport';",
    "import { formatCairoScheduleSummary, getCairoNextSchedule } from '../../lib/questionImport';\nimport { cairoInputToUtcMs } from '../../lib/cairoTime';"
  );
}
aa = aa.replace(/openAt:\s*finalMeta\.availableFrom\s*\|\|\s*null/g, 'openAt: finalMeta.availableFrom ? cairoInputToUtcMs(finalMeta.availableFrom) : null');
fs.writeFileSync('v2-app/src/pages/admin/AdminAssessmentEditPage.tsx', aa, 'utf8');
console.log('✔ fixed AdminAssessmentEditPage.tsx');

// 4. QuickUploadPage.tsx
let qu = fs.readFileSync('v2-app/src/pages/admin/QuickUploadPage.tsx', 'utf8');
// check imports
if (!qu.includes("import { cairoInputToUtcMs")) {
  qu = "import { cairoInputToUtcMs, formatCairoDateTime, tzOffsetMs, cairoToUtcMs } from '../../lib/cairoTime';\n" + qu;
}
// check lucide icons
const lucideImports = ['Plus', 'ArrowUp', 'ArrowDown'];
lucideImports.forEach((icon) => {
  if (!qu.includes(`${icon},`) && !qu.includes(`${icon} `)) {
    qu = qu.replace('import {', `import { ${icon},`);
  }
});
qu = qu.replace(/openAt:\s*availableFrom\s*\|\|\s*null/g, 'openAt: availableFrom ? cairoInputToUtcMs(availableFrom) : null');
fs.writeFileSync('v2-app/src/pages/admin/QuickUploadPage.tsx', qu, 'utf8');
console.log('✔ fixed QuickUploadPage.tsx');

// 5. AssessmentPage.tsx
let ap = fs.readFileSync('v2-app/src/pages/student/AssessmentPage.tsx', 'utf8');
if (!ap.includes('formatCairoDateTime')) {
  ap = "import { formatCairoDateTime } from '../../lib/cairoTime';\n" + ap;
}
fs.writeFileSync('v2-app/src/pages/student/AssessmentPage.tsx', ap, 'utf8');
console.log('✔ fixed AssessmentPage.tsx');

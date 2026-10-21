import fs from 'fs';

// 1. Patch grading.ts: Add correct to AnswerDetail interface and ensure it's always set
let gradingContent = fs.readFileSync('v2-app/src/lib/grading.ts', 'utf8');

if (!gradingContent.includes('correct?: boolean;')) {
  gradingContent = gradingContent.replace(
    /export interface AnswerDetail \{([\s\S]*?)\}/,
    (m, inner) => `export interface AnswerDetail {${inner}  correct?: boolean;\n}`
  );
}

gradingContent = gradingContent.replace(
  /const base: AnswerDetail = \{([\s\S]*?)feedback: '',\n  \};/,
  (m, inner) => `const base: AnswerDetail = {${inner}feedback: '',\n    correct: false,\n  };`
);

// In buildAttemptResult, ensure correct is populated
const oldBuildDetails = `  const details = input.questions.map((question) => {
    const rawAnswer = input.answers[question.id] ?? '';
    const judgeInput = input.dualJudgesMap ? input.dualJudgesMap[question.id] : undefined;
    return gradeQuestion(question, rawAnswer, judgeInput);
  });`;

const newBuildDetails = `  const details = input.questions.map((question) => {
    const rawAnswer = input.answers[question.id] ?? '';
    const judgeInput = input.dualJudgesMap ? input.dualJudgesMap[question.id] : undefined;
    const graded = gradeQuestion(question, rawAnswer, judgeInput);
    return {
      ...graded,
      correct: graded.correct ?? (graded.score >= 1 && !graded.needsReview)
    };
  });`;

gradingContent = gradingContent.replace(oldBuildDetails, newBuildDetails);
fs.writeFileSync('v2-app/src/lib/grading.ts', gradingContent, 'utf8');
console.log('Patched grading.ts successfully.');

// 2. Patch questionImport.ts: Strip ###SECTION### from title & remove closeAt defaults
let qiContent = fs.readFileSync('v2-app/src/lib/questionImport.ts', 'utf8');

// Strip ###SECTION### in title detection
qiContent = qiContent.replace(
  /title = line;\s*continue;\s*\}/g,
  `title = line.replace(/^###SECTION###\\s*/, '').trim();\n        continue;\n      }`
);

qiContent = qiContent.replace(
  /return \{ title, sections, warnings, errors \};/g,
  `return { title: (title || '').replace(/^###SECTION###\\s*/, '').trim(), sections, warnings, errors };`
);

// Schedule defaults: Empty availableUntil for homework & exam
const oldHomeworkSchedule = `  if (kind === 'homework') {
    // الواجب: يفتح الثلاثاء 9:00 مساءً ويغلق الخميس 9:00 مساءً
    const open = getNextCairoDateTime(2, 21, 0, fromDate);
    const close = getNextCairoDateTime(4, 21, 0, new Date(open.timestampMs));
    return {
      availableFrom: open.isoLocal,
      availableUntil: close.isoLocal,
      summary: 'هذا الواجب سيفتح للطلاب يوم الثلاثاء 9:00 م ويغلق الخميس 9:00 م، ويتطلب 50% لفتح المحاضرة التالية.',
    };
  }

  if (kind === 'exam') {
    // الامتحان: يفتح الأربعاء 9:00 مساءً ويغلق الخميس 9:00 مساءً
    const open = getNextCairoDateTime(3, 21, 0, fromDate);
    const close = getNextCairoDateTime(4, 21, 0, new Date(open.timestampMs));
    return {
      availableFrom: open.isoLocal,
      availableUntil: close.isoLocal,
      summary: 'هذا الامتحان سيفتح للطلاب يوم الأربعاء 9:00 م ويغلق الخميس 9:00 م، ويتطلب 50% لفتح المحاضرة التالية.',
    };
  }`;

const newHomeworkSchedule = `  if (kind === 'homework') {
    // الواجب: يفتح الثلاثاء 9:00 مساءً وبلا موعد إغلاق افتراضي (فارغ)
    const open = getNextCairoDateTime(2, 21, 0, fromDate);
    return {
      availableFrom: open.isoLocal,
      availableUntil: '',
      summary: 'هذا الواجب سيفتح للطلاب يوم الثلاثاء 9:00 م (بلا موعد إغلاق افتراضي).',
    };
  }

  if (kind === 'exam') {
    // الامتحان: يفتح الأربعاء 9:00 مساءً وبلا موعد إغلاق افتراضي (فارغ)
    const open = getNextCairoDateTime(3, 21, 0, fromDate);
    return {
      availableFrom: open.isoLocal,
      availableUntil: '',
      summary: 'هذا الامتحان سيفتح للطلاب يوم الأربعاء 9:00 م (بلا موعد إغلاق افتراضي).',
    };
  }`;

qiContent = qiContent.replace(oldHomeworkSchedule, newHomeworkSchedule);
fs.writeFileSync('v2-app/src/lib/questionImport.ts', qiContent, 'utf8');
console.log('Patched questionImport.ts successfully.');

// 3. Patch QuickUploadPage.tsx: requirePassingToUnlock default to false
let qupContent = fs.readFileSync('v2-app/src/pages/admin/QuickUploadPage.tsx', 'utf8');
qupContent = qupContent.replace(
  'const [requirePassingToUnlock, setRequirePassingToUnlock] = useState(true);',
  'const [requirePassingToUnlock, setRequirePassingToUnlock] = useState(false);'
);
fs.writeFileSync('v2-app/src/pages/admin/QuickUploadPage.tsx', qupContent, 'utf8');
console.log('Patched QuickUploadPage.tsx successfully.');

// 4. Patch AdminAssessmentEditPage.tsx: requirePassingToUnlock default to false
let aaepContent = fs.readFileSync('v2-app/src/pages/admin/AdminAssessmentEditPage.tsx', 'utf8');
aaepContent = aaepContent.replace(
  'requirePassingToUnlock: true,',
  'requirePassingToUnlock: false,'
);
aaepContent = aaepContent.replace(
  'checked={meta.requirePassingToUnlock ?? true}',
  'checked={meta.requirePassingToUnlock ?? false}'
);
fs.writeFileSync('v2-app/src/pages/admin/AdminAssessmentEditPage.tsx', aaepContent, 'utf8');
console.log('Patched AdminAssessmentEditPage.tsx successfully.');

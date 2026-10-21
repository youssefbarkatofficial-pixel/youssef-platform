import fs from 'node:fs';

// 1. questionDraft.ts
let qDraft = fs.readFileSync('v2-app/src/lib/questionDraft.ts', 'utf8');
qDraft = qDraft.replace(
  "export const OPTION_KEYS = ['a', 'b', 'c', 'd'] as const;",
  "export const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;"
);
fs.writeFileSync('v2-app/src/lib/questionDraft.ts', qDraft);
console.log('questionDraft.ts updated');

// 2. QuestionForm.tsx
let qForm = fs.readFileSync('v2-app/src/components/admin/QuestionForm.tsx', 'utf8');
qForm = qForm.replace(
  "const OPTION_LABELS: Record<string, string> = { a: 'أ', b: 'ب', c: 'ج', d: 'د' };",
  "const OPTION_LABELS: Record<string, string> = { a: 'أ', b: 'ب', c: 'ج', d: 'د', e: 'هـ', f: 'و' };"
);
fs.writeFileSync('v2-app/src/components/admin/QuestionForm.tsx', qForm);
console.log('QuestionForm.tsx updated');

import test from 'node:test';
import assert from 'node:assert/strict';
import { groupItemsIntoLines } from '../src/lib/pdfExtract.ts';
import { parseQuestionsFromTxt } from '../src/lib/questionImport.ts';

test('1. سطور عربية RTL وترتيب من فوق لتحت', () => {
  const items = [
    { str: 'القاهرة', x: 100, y: 700 },
    { str: 'عاصمة مصر', x: 300, y: 701 }, // نفس السطر تقريبًا، الأيمن (x أكبر) أولًا
    { str: 'أ- القاهرة', x: 300, y: 650 },
  ];
  assert.deepEqual(groupItemsIntoLines(items), ['عاصمة مصر القاهرة', 'أ- القاهرة']);
});

test('2. اللاتيني LTR وتجاهل الفراغات', () => {
  const items = [
    { str: 'World', x: 80, y: 500 },
    { str: 'Hello', x: 10, y: 500 },
    { str: '  ', x: 5, y: 500 },
  ];
  assert.deepEqual(groupItemsIntoLines(items), ['Hello World']);
});

test('3. استخراج أسئلة من نص مستخرج من PDF تجريبي وتوليد هيكل التقييم', () => {
  const syntheticPdfExtractedText = `
س1: ما هي عاصمة جمهورية مصر العربية؟
أ) الإسكندرية
ب) القاهرة *
ج) الجيزة
د) أسوان

س2: تقع مصر في قارة إفريقيا.
أ) صح *
ب) خطأ

س3: اذكر أهمية نهر النيل بالنسبة لمصر.
`;

  const result = parseQuestionsFromTxt(syntheticPdfExtractedText);
  assert.equal(result.questions.length, 3);
  assert.equal(result.questions[0].type, 'choose');
  assert.equal(Object.keys(result.questions[0].options || {}).length, 4);

  assert.ok(result.questions[1].type === 'choose' || result.questions[1].type === 'tf');
  assert.equal(result.questions[2].type, 'short');
});

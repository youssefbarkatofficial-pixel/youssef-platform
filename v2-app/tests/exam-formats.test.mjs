import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseExamText,
  parseExamFromDocx,
  parseQuestionsFromPdf,
  parsedExamToQuestionDrafts,
  readSectionHeader,
  probeAnswerLine,
  probePointsLine,
  sectionTypeLabel,
} from '../src/lib/questionImport.ts';
import { QUESTION_FORMATS, QUESTION_TYPE_LABELS } from '../src/lib/questionDraft.ts';

const FIXTURES = path.resolve('tests/fixtures');

// النموذج الرسمي: عنوان قسم بدون عدد معلن ثم 3 أسئلة لكل صيغة = 45 سؤالًا في 15 قسمًا
const EXPECTED_TYPES = [
  'choose',
  'truefalse',
  'fill',
  'correct',
  'term',
  'who',
  'explain',
  'results',
  'prove',
  'compare',
  'similarities',
  'relation',
  'whatif',
  'define',
  'opinion',
];

function flat(parsed) {
  const out = [];
  for (const section of parsed.sections) {
    for (const question of section.questions) out.push({ section: section.type, question });
  }
  return out;
}

function answerKey(question) {
  if (question.type === 'choose') return `choice:${question.correctIndex}`;
  if (question.type === 'truefalse') return `tf:${question.correct}`;
  // نتجاهل التشكيل والمسافات لأن مستخرج الـ PDF قد يفرّق التنوين عن الحرف
  const text = (question.answerText || '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, '')
    .trim();
  return `text:${text}`;
}

test('1. النموذج الرسمي (بدون عدد معلن في العناوين) يُستخرج 45 سؤالًا في 15 قسمًا بنفس الصيغ', () => {
  const parsed = parseExamText(fs.readFileSync(path.join(FIXTURES, 'exam-demo.txt'), 'utf8'));

  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.warnings, []);
  assert.equal(parsed.sections.length, 15);
  assert.deepEqual(parsed.sections.map((s) => s.type), EXPECTED_TYPES);
  parsed.sections.forEach((section) => assert.equal(section.questions.length, 3));
  assert.equal(flat(parsed).length, 45);
});

test('2. الإجابات الصحيحة تُستخرج لكل الأسئلة (حرف أو نص أو صح/خطأ)', () => {
  const parsed = parseExamText(fs.readFileSync(path.join(FIXTURES, 'exam-demo.txt'), 'utf8'));
  const questions = flat(parsed).map((entry) => entry.question);

  // لا يوجد سؤال ناقص الإجابة في النموذج الرسمي
  assert.equal(questions.filter((q) => q.needsAnswer === true).length, 0);

  // اختر: الإجابة بحرف (ب) = الخيار الثاني
  assert.equal(questions[0].correctIndex, 1);
  // اختر: الإجابة بالنص (لندن) تطابق الخيار الأول
  assert.equal(questions[1].correctIndex, 0);
  // صح/خطأ
  assert.equal(questions[3].correct, true);
  assert.equal(questions[4].correct, false);
  // أكمل: إجابة نصية
  assert.equal(questions[6].answerText, 'نافارين');
});

test('3. Word و PDF و TXT يعطون نفس الأسئلة ونفس ترتيب الأقسام ونفس مفاتيح الإجابات', async () => {
  const txtParsed = parseExamText(fs.readFileSync(path.join(FIXTURES, 'exam-demo.txt'), 'utf8'));
  const docxParsed = await parseExamFromDocx(fs.readFileSync(path.join(FIXTURES, 'exam-demo.docx')));

  const pdfBuffer = fs.readFileSync(path.join(FIXTURES, 'exam-demo.pdf'));
  const pdfResult = await parseQuestionsFromPdf(
    pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength),
  );
  const pdfParsed = pdfResult.parsedExam;

  for (const [name, parsed] of [
    ['docx', docxParsed],
    ['pdf', pdfParsed],
  ]) {
    assert.ok(parsed, `الملف ${name} يجب أن يُحلَّل`);
    assert.equal(parsed.sections.length, 15, `${name}: عدد الأقسام`);
    assert.deepEqual(parsed.sections.map((s) => s.type), EXPECTED_TYPES, `${name}: ترتيب الصيغ`);
    assert.equal(flat(parsed).length, 45, `${name}: عدد الأسئلة`);

    const txtKeys = flat(txtParsed).map((entry) => answerKey(entry.question));
    const otherKeys = flat(parsed).map((entry) => answerKey(entry.question));
    assert.deepEqual(otherKeys, txtKeys, `${name}: مفاتيح الإجابات يجب أن تطابق TXT`);
  }
});

test('4. ناتج التحويل إلى مسودات: الصيغ الصحيحة والإجابات الجاهزة للتصحيح التلقائي', () => {
  const parsed = parseExamText(fs.readFileSync(path.join(FIXTURES, 'exam-demo.txt'), 'utf8'));
  const drafts = parsedExamToQuestionDrafts(parsed);

  assert.equal(drafts.length, 45);
  assert.equal(drafts[0].type, 'choose');
  assert.equal(drafts[0].answer, 'b');
  assert.equal(drafts[3].type, 'tf');
  assert.equal(drafts[3].answer, 'صح');
  assert.equal(drafts[6].type, 'fill');
  assert.equal(drafts[6].answer, 'نافارين');
  assert.equal(drafts[9].type, 'correct');
  assert.equal(drafts[12].type, 'term');
  assert.equal(drafts[15].type, 'who');
  assert.equal(drafts[18].type, 'explain');
  // «بم تفسر» في هذا النموذج جاءت بخيارات، فتُحوَّل إلى اختيار من متعدد مع الاحتفاظ بصيغتها
  assert.equal(drafts[18].options !== null, true);
  assert.equal(drafts[18].answer, 'b');

  // كل الأسئلة لها إجابة (لا شيء ناقص)
  assert.equal(drafts.filter((draft) => !draft.answer).length, 0);
});

test('5. صيغ الأسئلة المتاحة في المنصة = صيغ النموذج الرسمي بالترتيب (15 صيغة بلا زيادة أو نقص)', () => {
  assert.equal(QUESTION_FORMATS.length, 15);
  assert.deepEqual(QUESTION_FORMATS, [
    'choose',
    'tf',
    'fill',
    'correct',
    'term',
    'who',
    'explain',
    'result',
    'prove',
    'compare',
    'similarities',
    'relation',
    'whatif',
    'meaning',
    'opinion',
  ]);

  const labels = QUESTION_FORMATS.map((type) => QUESTION_TYPE_LABELS[type]);
  assert.deepEqual(labels, [
    'اختر الإجابة الصحيحة',
    'صح أو خطأ',
    'أكمل العبارات',
    'صوب ما تحته خط',
    'اكتب ما تشير إليه العبارة',
    'من هو؟',
    'بم تفسر',
    'ما النتائج المترتبة على',
    'دلل تاريخياً',
    'قارن بين',
    'أوجه الشبه والاختلاف',
    'ما العلاقة بين',
    'ماذا يحدث إذا',
    'ما المقصود',
    'ما رأيك في',
  ]);

  // لا توجد صيغة "اشرح" ولا "إجابة قصيرة" ولا "اختيار متعدد الإجابات" في قائمة الصيغ
  assert.equal(labels.some((label) => label.includes('اشرح')), false);
  assert.equal(labels.includes('إجابة قصيرة'), false);
});

test('6. قراءة عنوان القسم وسطر الإجابة وسطر الدرجة في كل الصيغ', () => {
  assert.deepEqual(readSectionHeader('أولاً: اختر الإجابة الصحيحة مما بين الأقواس:'), {
    kind: 'countless',
    declaredCount: 0,
    type: 'choose',
  });
  assert.deepEqual(readSectionHeader('ثانياً: ضع علامة (صح) أو (خطأ) أمام العبارات الآتية:')?.type, 'truefalse');
  assert.deepEqual(readSectionHeader('ثالث عشر: ماذا يحدث إذا:')?.type, 'whatif');
  assert.equal(readSectionHeader('أولاً: اختر الإجابة (3 أسئلة):')?.kind, 'strict');

  // ليست عناوين أقسام
  assert.equal(readSectionHeader('1. ما رأيك في: قيام محمد علي بمذبحة القلعة؟'), null);
  assert.equal(readSectionHeader('أ) رغبة الشعب في عودة الحملة الفرنسية'), null);

  assert.equal(probeAnswerLine('الإجابة: ب'), 'ب');
  assert.equal(probeAnswerLine('الإجابة: محمد علي'), 'محمد علي');
  assert.equal(probeAnswerLine('الإ جابة: ج'), 'ج');
  assert.equal(probeAnswerLine('ا إلجابة: صح'), 'صح');
  assert.equal(probeAnswerLine('هذا نص عادي'), null);

  assert.equal(probePointsLine('الدرجة: 2'), 2);
  assert.equal(probePointsLine('(2 درجة)'), 2);
  assert.equal(probePointsLine('نص عادي'), null);

  assert.equal(sectionTypeLabel('truefalse'), 'صح أو خطأ');
  assert.equal(sectionTypeLabel('opinion'), 'ما رأيك في');
});

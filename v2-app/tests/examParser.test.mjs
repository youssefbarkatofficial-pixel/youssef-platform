import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseExamText,
  parseExamFromJson,
  parseExamFromDocx,
  parsedExamToQuestionDrafts,
  splitQuestionAt,
  mergeWithPreviousQuestion,
  deleteQuestion,
  changeQuestionType,
  setQuestionCorrectAnswer,
  getCairoNextSchedule,
  formatCairoScheduleSummary,
} from '../src/lib/questionImport.ts';

const FIXTURES_DIR = path.resolve('tests/fixtures');

test('1. الاختبار الرسمي المرجعي: exam-template-v1.txt يطابق exam-template-v1.expected.json حرفياً (45 سؤالاً، 15 قسماً)', () => {
  const txtPath = path.join(FIXTURES_DIR, 'exam-template-v1.txt');
  const jsonPath = path.join(FIXTURES_DIR, 'exam-template-v1.expected.json');

  assert.ok(fs.existsSync(txtPath), 'ملف exam-template-v1.txt يجب أن يكون موجوداً');
  assert.ok(fs.existsSync(jsonPath), 'ملف exam-template-v1.expected.json يجب أن يكون موجوداً');

  const rawTxt = fs.readFileSync(txtPath, 'utf8');
  const expectedJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const parsed = parseExamText(rawTxt);

  // التأكد من عدم وجود أخطاء في النموذج الرسمي
  assert.equal(parsed.errors.length, 0, `لا يجب وجود أخطاء بنيوية: ${JSON.stringify(parsed.errors)}`);
  assert.equal(parsed.warnings.length, 0, `لا يجب وجود تحذيرات في النموذج الرسمي: ${JSON.stringify(parsed.warnings)}`);

  // مقارنة العنوان والأقسام حرفياً
  const candidate = {
    title: parsed.title,
    sections: parsed.sections,
  };

  assert.deepEqual(candidate, expectedJson, 'الناتج المستخرج يجب أن يطابق exam-template-v1.expected.json بنسبة 100% حرفياً');
  assert.equal(parsed.sections.length, 15, 'عدد الأقسام يجب أن يكون 15 قسماً');

  let totalQuestions = 0;
  parsed.sections.forEach((s) => {
    assert.equal(s.questions.length, 3, `القسم ${s.header} يجب أن يحتوي على 3 أسئلة`);
    totalQuestions += s.questions.length;
  });
  assert.equal(totalQuestions, 45, 'إجمالي الأسئلة يجب أن يكون 45 سؤالاً');
});

test('2. اختبار الملف القديم: unit2_comprehensive_exam.txt (135 سؤالاً، بدون إجابات، تقسيم الأقسام واكتشاف اختر بدقة)', () => {
  const txtPath = path.join(FIXTURES_DIR, 'unit2_comprehensive_exam.txt');
  assert.ok(fs.existsSync(txtPath), 'ملف unit2_comprehensive_exam.txt يجب أن يكون موجوداً');

  const rawTxt = fs.readFileSync(txtPath, 'utf8');
  const parsed = parseExamText(rawTxt);

  const expectedCounts = [20, 10, 10, 10, 5, 7, 20, 15, 20, 2, 4, 2, 5, 3, 2];
  const actualCounts = parsed.sections.map((s) => s.questions.length);

  assert.deepEqual(actualCounts, expectedCounts, 'أعداد الأسئلة في الأقسام الـ 15 يجب أن تطابق بدقة الترتيب المطلوب');

  const totalQuestions = parsed.sections.reduce((sum, s) => sum + s.questions.length, 0);
  assert.equal(totalQuestions, 135, 'إجمالي الأسئلة المستخرجة يجب أن يكون 135 سؤالاً');

  // فحص قسم اختر الأول: 20 سؤالاً من نوع choose، كل منها به 4 خيارات
  const chooseSection = parsed.sections[0];
  assert.equal(chooseSection.type, 'choose');
  assert.equal(chooseSection.questions.length, 20);

  chooseSection.questions.forEach((q, idx) => {
    assert.equal(q.type, 'choose', `السؤال ${idx + 1} يجب أن يكون نوعه choose وليس إجابة قصيرة`);
    assert.ok(Array.isArray(q.options), `السؤال ${idx + 1} يجب أن يحتوي على مصفوفة خيارات`);
    assert.equal(q.options.length, 4, `السؤال ${idx + 1} يجب أن يحتوي على 4 خيارات`);
    assert.equal(q.needsAnswer, true, `السؤال ${idx + 1} يجب أن يحمل علامة needsAnswer: true`);
  });

  // فحص أن جميع الأسئلة الـ 135 بدون إجابات وموسومة needsAnswer: true
  const allNeedsAnswer = parsed.sections.every((s) => s.questions.every((q) => q.needsAnswer === true));
  assert.equal(allNeedsAnswer, true, 'جميع أسئلة الامتحان القديم يجب أن تحمل needsAnswer: true');

  // تحويلها إلى مسودات QuestionDraft
  const drafts = parsedExamToQuestionDrafts(parsed);
  assert.equal(drafts.length, 135, 'يجب تحويل 135 مسودة سؤال');
  assert.ok(drafts.every((d) => d.needsReview === true), 'جميع المسودات تحتاج مراجعة المعلم');
});

test('3. اختبارات الحالات الحدية (Edge Cases)', () => {
  // أ) UTF-8 BOM
  const bomText = '\uFEFF' + `أولاً: اختر الإجابة الصحيحة (1 سؤال):
1. عاصمة مصر:
(القاهرة - الإسكندرية)
الإجابة: أ`;
  const bomParsed = parseExamText(bomText);
  assert.equal(bomParsed.sections[0].questions.length, 1);
  assert.equal(bomParsed.sections[0].questions[0].correctIndex, 0);

  // ب) CRLF line endings
  const crlfText = "أولاً: اختر الإجابة (1 سؤال):\r\n1. سؤال تجريبي:\r\n(أ - ب)\r\nالإجابة: أ\r\n";
  const crlfParsed = parseExamText(crlfText);
  assert.equal(crlfParsed.sections[0].questions.length, 1);

  // ج) أرقام عربية مشرقية (٠-٩)
  const arabicDigitsText = `أولاً: اختر الإجابة الصحيحة (١ سؤال):
١. قائد ثورة القاهرة الثانية عام ١٨٠٠م هو:
(عمر مكرم - محمد كُريم)
الإجابة: أ`;
  const adParsed = parseExamText(arabicDigitsText);
  assert.equal(adParsed.sections[0].declaredCount, 1);
  assert.equal(adParsed.sections[0].questions[0].number, 1);

  // د) حرف إجابة خارج النطاق
  const outOfRangeText = `أولاً: اختر الإجابة (1 سؤال):
1. سؤال مع حرف إجابة خاطئ:
(خيار 1 - خيار 2)
الإجابة: ج`;
  const oorParsed = parseExamText(outOfRangeText);
  assert.ok(oorParsed.errors.some((e) => e.includes('خارج نطاق الخيارات')));

  // هـ) إجابة نصية ليست ضمن الخيارات
  const textNotInOpts = `أولاً: اختر الإجابة (1 سؤال):
1. سؤال:
(الرباط - طرابلس)
الإجابة: تونس`;
  const tnioParsed = parseExamText(textNotInOpts);
  assert.ok(tnioParsed.errors.some((e) => e.includes('غير موجودة بين الخيارات')));

  // و) عنوان قسم غير معروف (تحذير وليس خطأ)
  const unknownHeader = `سادساً: عنوان غير مسبوق بالمرة (1 سؤال):
1. سؤال مقالي نصي عام؟
الإجابة: إجابة تجريبية`;
  const uhParsed = parseExamText(unknownHeader);
  assert.equal(uhParsed.sections[0].type, 'unknown');
  assert.ok(uhParsed.warnings.some((w) => w.includes('عنوان قسم غير معروف')));
  assert.equal(uhParsed.errors.length, 0);

  // ز) عدم مطابقة العدد المعلن في العنوان (تحذير)
  const countMismatch = `أولاً: أكمل العبارات (5 أسئلة):
1. سؤال 1
2. سؤال 2`;
  const cmParsed = parseExamText(countMismatch);
  assert.ok(cmParsed.warnings.some((w) => w.includes('لا يطابق العدد المعلن')));

  // ح) سؤال ممتد على سطرين
  const twoLineStem = `أولاً: اكتب ما تشير إليه العبارة (1 سؤال):
1. اتفاق عقد بين فرنسا وإنجلترا عام 1904م
نص على انفراد فرنسا بالمغرب مقابل انفراد إنجلترا بمصر.
الإجابة: الاتفاق الودي`;
  const tlsParsed = parseExamText(twoLineStem);
  assert.equal(tlsParsed.sections[0].questions.length, 1);
  assert.match(tlsParsed.sections[0].questions[0].stem, /الاتفاق الودي|انفراد فرنسا/);

  // ط) خيارات بصيغة أسطر مرقمة تحتوي على شرطة "-" داخل النص
  const dashInOption = `أولاً: اختر الإجابة الصحيحة (1 سؤال):
1. سؤال:
أ) معاهدة لندن - عام 1840م
ب) صلح إمبابة
الإجابة: أ`;
  const dioParsed = parseExamText(dashInOption);
  assert.equal(dioParsed.sections[0].questions[0].options[0], 'معاهدة لندن - عام 1840م');

  // ي) خياران متطابقان (خطأ بنيوي)
  const dupOpts = `أولاً: اختر (1 سؤال):
1. سؤال:
(القاهرة - القاهرة)
الإجابة: أ`;
  const dupParsed = parseExamText(dupOpts);
  assert.ok(dupParsed.errors.some((e) => e.includes('خياران متطابقان')));

  // ك) اختيار من متعدد بأقل من خيارين (خطأ بنيوي)
  const oneOpt = `أولاً: اختر (1 سؤال):
1. سؤال:
أ) خيار وحيد
الإجابة: أ`;
  const oneParsed = parseExamText(oneOpt);
  assert.ok(oneParsed.errors.some((e) => e.includes('يتطلب خيارين على الأقل')));
});

test('4. الاختبار الذهبي: ملف يوسف الفعلي (youssef_curriculum_exam.docx) يستخرج 156 سؤالاً مقسمة عبر 11 قسماً', async () => {
  const docxPath = path.join(FIXTURES_DIR, 'youssef_curriculum_exam.docx');
  assert.ok(fs.existsSync(docxPath), 'ملف youssef_curriculum_exam.docx يجب أن يكون موجوداً');

  const fileBuf = fs.readFileSync(docxPath);
  const parsed = await parseExamFromDocx(fileBuf);

  assert.equal(parsed.sections.length, 11, 'يجب استخراج 11 قسماً رئيسياً');
  const totalQuestions = parsed.sections.reduce((sum, s) => sum + s.questions.length, 0);
  assert.equal(totalQuestions, 156, 'إجمالي الأسئلة المستخرجة يجب أن يكون 156 سؤالاً بالضبط');

  // التأكد من توزيع الأقسام بدقة
  const expectedSectionCounts = [2, 5, 19, 25, 34, 30, 4, 14, 12, 8, 3];
  const actualSectionCounts = parsed.sections.map((s) => s.questions.length);
  assert.deepEqual(actualSectionCounts, expectedSectionCounts, 'أعداد الأسئلة في الأقسام الـ 11 يجب أن تطابق بدقة');

  // قسم الاختيار من متعدد: 19 سؤالاً بنوع choose وكل سؤال به خيارات
  const chooseSec = parsed.sections[2];
  assert.equal(chooseSec.type, 'choose');
  assert.equal(chooseSec.questions.length, 19);
  assert.ok(chooseSec.questions.every((q) => q.type === 'choose' && Array.isArray(q.options) && q.options.length >= 2));

  // قسم صح وخطأ: 34 سؤالاً بنوع truefalse
  const tfSec = parsed.sections[4];
  assert.equal(tfSec.type, 'truefalse');
  assert.equal(tfSec.questions.length, 34);
  assert.ok(tfSec.questions.every((q) => q.type === 'truefalse'));

  // تحويل إلى مسودات QuestionDraft
  const drafts = parsedExamToQuestionDrafts(parsed);
  assert.equal(drafts.length, 156);
});

test('5. اختبار دوال المراجعة التفاعلية (split, merge, delete, changeType, setAnswer)', () => {
  const initial = [
    {
      id: 'q1',
      type: 'choose',
      text: 'السؤال الأول الجزء أ والسؤال الأول الجزء ب',
      points: 1,
      options: { a: 'خيار 1', b: 'خيار 2' },
      answer: 'a',
      altAnswers: [],
      rubric: [],
    },
    {
      id: 'q2',
      type: 'choose',
      text: 'السؤال الثاني',
      points: 1,
      options: { a: 'خيار 1', b: 'خيار 2' },
      answer: '',
      altAnswers: [],
      rubric: [],
      needsReview: true,
    },
  ];

  // أ) تغيير الإجابة
  const withAnswer = setQuestionCorrectAnswer(initial, 1, 'b');
  assert.equal(withAnswer[1].answer, 'b');
  assert.equal(withAnswer[1].needsReview, false);

  // ب) تغيير نوع السؤال
  const withType = changeQuestionType(initial, 0, 'tf');
  assert.equal(withType[0].type, 'tf');
  assert.equal(withType[0].options, null);

  // ج) تقسيم السؤال
  const split = splitQuestionAt(initial, 0, 'والسؤال الأول الجزء ب');
  assert.equal(split.length, 3);
  assert.equal(split[0].text, 'السؤال الأول الجزء أ');
  assert.match(split[1].text, /الجزء ب/);

  // د) دمج مع السؤال السابق
  const merged = mergeWithPreviousQuestion(split, 1);
  assert.equal(merged.length, 2);
  assert.match(merged[0].text, /الجزء أ/);
  assert.match(merged[0].text, /الجزء ب/);

  // هـ) حذف سؤال
  const deleted = deleteQuestion(initial, 0);
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0].id, 'q2');
});

test('6. اختبار جدول القاهرة الأسبوعي الذكي وتلخيص القواعد (Cairo Weekly Schedule)', () => {
  // فحص موعد الواجب
  const hwSchedule = getCairoNextSchedule('homework');
  assert.ok(hwSchedule.availableFrom.includes('T21:00'));
  assert.ok(hwSchedule.availableUntil.includes('T21:00'));
  assert.match(hwSchedule.summary, /الثلاثاء 9:00 م/);
  assert.match(hwSchedule.summary, /الخميس 9:00 م/);

  // فحص موعد الامتحان
  const examSchedule = getCairoNextSchedule('exam');
  assert.ok(examSchedule.availableFrom.includes('T21:00'));
  assert.match(examSchedule.summary, /الأربعاء 9:00 م/);

  // فحص موعد التدريب
  const trSchedule = getCairoNextSchedule('training');
  assert.ok(trSchedule.availableFrom.includes('T21:00'));
  assert.equal(trSchedule.availableUntil, '');
  assert.match(trSchedule.summary, /الخميس 9:00 م/);

  // فحص ملخص التوقيت
  const emptySummary = formatCairoScheduleSummary('homework', null, null, 50);
  assert.match(emptySummary, /متاح فوراً بدون قيود زمنية/);
  assert.match(emptySummary, /50%/);
});

test('7. اختبار حماية الفشل الصامت (Silent Failure Protection)', () => {
  // نص طويل (> 300 حرف) ولكن غير منسق ونتج عنه سؤال واحد فقط
  const longUnformattedText = `
    هذا نص طويل جداً يحتوي على شرح للمادة التعليمية بدون ترقيم مناسب أو تقسيم للأقسام.
    المعلم كتب كلام كثير جداً يزيد عن 300 حرف ليشرح الدرس، وفي النهاية كتب سؤالاً وحيداً:
    1. ما هي عاصمة جمهورية مصر العربية؟
    هذا النص يتجاوز بالتأكيد ثلاثمائة حرف كاملة لاختبار تفعيل تحذير الفشل الصامت الذي يمنع قبول استخراج ملف ضخم بسؤال وحيد بدون مراجعة المعلم وتأكيده الصريح.
  `;

  const parsed = parseExamText(longUnformattedText);
  assert.ok(
    parsed.warnings.some((w) => w.includes('تنبيه: يبدو أن تنسيق الملف منع التقسيم التلقائي')),
    'يجب إظهار تحذير الفشل الصامت عند وجود نص طويل ينتج عنه سؤال واحد أو أقل'
  );
});

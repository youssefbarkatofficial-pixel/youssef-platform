import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  parseQuestionsFromJson,
  parseQuestionsFromTxt,
  parseBulkLectureInput,
} from '../src/lib/questionImport.ts';

test('1. استيراد fixture-draft_3prep_unit2_mcq.json: استخراج 20 سؤالاً كاملاً بدقة تامة', () => {
  const fixturePath = 'C:/Users/mohammed/Downloads/fixture-draft_3prep_unit2_mcq.json';
  if (!existsSync(fixturePath)) {
    console.log('Fixture file not in Downloads, skipping path check');
    return;
  }

  const rawJson = readFileSync(fixturePath, 'utf8');
  const { questions, warnings } = parseQuestionsFromJson(rawJson);

  assert.equal(questions.length, 20, 'يجب استخراج 20 سؤالاً بالتمام والكمال');
  assert.equal(warnings.length, 0, 'يجب ألا توجد أي تحذيرات أو أخطاء في استيراد الفيكستشر');

  // السؤال الأول:
  // "١ تصارع على حكم مصر بعد رحيل الحملة الفرنسية عام 1801م ثلاث قوى هي: الإنجليز، والمماليك، و........"
  const q1 = questions[0];
  assert.equal(q1.type, 'choose');
  assert.match(q1.text, /تصارع على حكم مصر/);
  assert.equal(q1.options?.c, 'العثمانيون');
  assert.equal(q1.answer, 'c', 'الإجابة حرف ج يجب أن تطابق c');

  // السؤال الثاني:
  const q2 = questions[1];
  assert.equal(q2.answer, 'c');
  assert.equal(q2.options?.c, 'محمد علي');

  // السؤال الثالث:
  const q3 = questions[2];
  assert.equal(q3.options?.c, 'سالونيك');
});

test('2. استيراد الأسئلة من TXT منظم: اختيار وصح/خطأ ومقالي', () => {
  const sampleTxt = `
1. قاد الحملة الإنجليزية على مصر عام 1807م:
أ) نيلسون
ب) نابليون
ج) فريزر
د) كليبر
الإجابة: ج

2. تخلص محمد علي من الزعامة الشعبية بنفي عمر مكرم إلى دمياط. (صح)

س3: بم تفسر: فشل حملة فريزر على مصر عام 1807م؟
ج: بسبب بسالة وشجاعة أهالي رشيد والحماد.
  `;

  const { questions, warnings } = parseQuestionsFromTxt(sampleTxt);
  assert.equal(questions.length, 3);

  // السؤال 1
  assert.equal(questions[0].type, 'choose');
  assert.equal(questions[0].answer, 'c');
  assert.equal(questions[0].options?.c, 'فريزر');

  // السؤال 2
  assert.equal(questions[1].type, 'tf');
  assert.equal(questions[1].answer, 'صح');

  // السؤال 3
  assert.equal(questions[2].type, 'short');
  assert.match(questions[2].text, /بم تفسر/);
  assert.match(questions[2].answer, /أهالي رشيد/);
});

test('3. تحليل روابط المحاضرات دفعة واحدة مع الترتيب والعناوين', () => {
  const bulkInput = `
1. الدرس الأول: محمد علي وبناء الدولة الحديثة | https://youtube.com/watch?v=abc123
2. الدرس الثاني: خلفاء محمد علي وازدياد التدخل الأجنبي | https://youtube.com/watch?v=def456
3. ملخص الوحدة الثالثة | https://youtube.com/watch?v=ghi789
  `;

  const parsed = parseBulkLectureInput(bulkInput);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].order, 1);
  assert.equal(parsed[0].title, 'الدرس الأول: محمد علي وبناء الدولة الحديثة');
  assert.equal(parsed[0].videoUrl, 'https://youtube.com/watch?v=abc123');

  assert.equal(parsed[1].order, 2);
  assert.equal(parsed[2].order, 3);
});

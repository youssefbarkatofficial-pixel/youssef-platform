import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMcqToDraft,
  applyMcqToQuestions,
  createEmptyDraft,
  draftFromQuestion,
  isChoiceQuestion,
  toPublicQuestion,
  validateDraft,
} from '../src/lib/questionDraft.ts';
import { buildAttemptResult, getAnswerMode, parseQuestions } from '../src/lib/grading.ts';
import { parseExamText, parsedExamToQuestionDrafts } from '../src/lib/questionImport.ts';
import fs from 'node:fs';
import path from 'node:path';

const explainDraft = () => ({
  id: 'q_explain',
  type: 'explain',
  text: 'بم تفسر: قيام ثورة الشعب المصري 1804؟',
  points: 2,
  options: null,
  answer: 'ظلم الولاة العثمانيين والمماليك',
  altAnswers: [],
  rubric: [],
});

test('1. زر الاختيار من متعدد: يحوّل سؤال «بم تفسر» إلى خيارات ويحتفظ بصيغته الأصلية', () => {
  const draft = explainDraft();
  assert.equal(isChoiceQuestion(draft), false);

  const converted = applyMcqToDraft(draft, true);
  assert.equal(converted.type, 'explain', 'الصيغة الأصلية تبقى كما هي');
  assert.equal(converted.asMcq, true);
  assert.ok(converted.options);
  // الإجابة النموذجية تُنقل إلى الخيار الأول وتصبح هي الصحيحة
  assert.equal(converted.options.a, 'ظلم الولاة العثمانيين والمماليك');
  assert.equal(converted.answer, 'a');
  assert.equal(isChoiceQuestion(converted), true);

  // إلغاء الزر: يرجع الطالب يكتب بنفسه مع الحفاظ على نص الإجابة
  const reverted = applyMcqToDraft(converted, false);
  assert.equal(reverted.type, 'explain');
  assert.equal(reverted.asMcq, undefined);
  assert.equal(reverted.options, null);
  assert.equal(reverted.answer, 'ظلم الولاة العثمانيين والمماليك');
  assert.equal(isChoiceQuestion(reverted), false);
});

test('2. صح/خطأ يظل اختيارين فقط (صح / خطأ) ولا يتحول إلى أربعة خيارات', () => {
  const tf = { ...createEmptyDraft('tf'), text: 'وضع محمد علي نظام الاحتكار.', answer: 'صح' };
  const converted = applyMcqToDraft(tf, true);

  assert.equal(converted.type, 'tf');
  assert.equal(converted.options, null);
  assert.equal(converted.asMcq, undefined);

  const question = parseQuestions([toPublicQuestion(converted)])[0];
  assert.equal(getAnswerMode(question), 'tf');
});

test('3. التحويل الجماعي لكل أسئلة التقييم ثم إلغاؤه', () => {
  const drafts = [
    explainDraft(),
    { ...createEmptyDraft('who'), id: 'q_who', text: 'من هو؟', answer: 'إبراهيم باشا' },
    { ...createEmptyDraft('tf'), id: 'q_tf', text: 'عبارة', answer: 'خطأ' },
  ];

  const converted = applyMcqToQuestions(drafts, true);
  assert.equal(converted[0].asMcq, true);
  assert.equal(converted[1].asMcq, true);
  assert.equal(converted[2].asMcq, undefined);
  assert.equal(converted.filter((draft) => isChoiceQuestion(draft)).length, 2);

  const reverted = applyMcqToQuestions(converted, false);
  assert.equal(reverted.filter((draft) => isChoiceQuestion(draft)).length, 0);
  assert.deepEqual(reverted.map((draft) => draft.answer), drafts.map((draft) => draft.answer));
});

test('4. الحفظ والقراءة: الخيارات و asMcq تصل للطالب ثم ترجع للمعلم كما هي', () => {
  const converted = applyMcqToDraft(explainDraft(), true);
  converted.options.b = 'خيار خاطئ 1';
  converted.options.c = 'خيار خاطئ 2';
  converted.options.d = 'خيار خاطئ 3';

  const publicQuestion = toPublicQuestion(converted);
  assert.equal(publicQuestion.asMcq, true);
  assert.deepEqual(Object.keys(publicQuestion.options), ['a', 'b', 'c', 'd']);

  const parsed = parseQuestions([publicQuestion])[0];
  assert.equal(parsed.asMcq, true);
  assert.equal(getAnswerMode(parsed), 'choice');

  const back = draftFromQuestion({ ...parsed, answer: 'a' });
  assert.equal(back.type, 'explain');
  assert.equal(back.asMcq, true);
  assert.equal(back.options.a, 'ظلم الولاة العثمانيين والمماليك');
});

test('5. التصحيح: السؤال المحوَّل يُصحح آليًا كاختيار (درجة كاملة أو صفر) ولا يُعلَّق للمراجعة', () => {
  const converted = applyMcqToDraft(explainDraft(), true);
  converted.options.b = 'خيار خاطئ 1';
  converted.options.c = 'خيار خاطئ 2';
  converted.options.d = 'خيار خاطئ 3';

  const publicQuestion = { ...toPublicQuestion(converted) };
  const question = { ...parseQuestions([publicQuestion])[0], answer: 'a' };

  const correct = buildAttemptResult({
    courseId: 'c1',
    examId: 'e1',
    examTitle: 'امتحان',
    kind: 'exam',
    questions: [question],
    answers: { [question.id]: 'a' },
    attemptNumber: 1,
    autoSubmit: false,
    submittedAt: Date.now(),
    availableUntil: null,
  });
  assert.equal(correct.percent, 100);
  assert.equal(correct.needsReview, false);

  const wrong = buildAttemptResult({
    courseId: 'c1',
    examId: 'e1',
    examTitle: 'امتحان',
    kind: 'exam',
    questions: [question],
    answers: { [question.id]: 'b' },
    attemptNumber: 1,
    autoSubmit: false,
    submittedAt: Date.now(),
    availableUntil: null,
  });
  assert.equal(wrong.percent, 0);
  assert.equal(wrong.needsReview, false);
});

test('6. التحقق: زر الاختيار يطلب خيارين على الأقل وإجابة صحيحة داخل الخيارات', () => {
  const converted = applyMcqToDraft(explainDraft(), true);
  // بعد التحويل يكون الخيار الأول فقط مكتوبًا (نص الإجابة) فيُطلب خيار ثانٍ
  assert.match(validateDraft(converted), /خيارين على الأقل/);

  const ready = { ...converted, options: { ...converted.options, b: 'خيار خاطئ' } };
  assert.equal(validateDraft(ready), '');

  const onlyOne = { ...converted, options: { a: 'خيار واحد', b: '', c: '', d: '' } };
  assert.match(validateDraft(onlyOne), /خيارين على الأقل/);

  const answerOutside = { ...ready, options: { a: 'خيار', b: 'آخر', c: '', d: '' }, answer: 'd' };
  assert.match(validateDraft(answerOutside), /اختر الإجابة الصحيحة من الخيارات المكتوبة/);
});

test('7. استخراج الاختبار: صيغة السؤال الأصلية تبقى محفوظة للمعلم والطالب', () => {
  const parsed = parseExamText(fs.readFileSync(path.resolve('tests/fixtures/exam-demo.txt'), 'utf8'));
  const drafts = parsedExamToQuestionDrafts(parsed);

  const explainDrafts = drafts.filter((draft) => draft.type === 'explain');
  assert.equal(explainDrafts.length, 3, 'أسئلة «بم تفسر» تُحفظ بصيغتها وليست اختيارًا عامًا');
  explainDrafts.forEach((draft) => {
    assert.equal(draft.asMcq, true);
    assert.ok(draft.options);
    assert.match(draft.answer, /^[a-d]$/);
  });

  // ونفس الشيء لبقية الصيغ التي جاءت بخيارات في النموذج
  const whoDrafts = drafts.filter((draft) => draft.type === 'who');
  assert.equal(whoDrafts.length, 3);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSkillMapFromCourses,
  convertAttemptsToAnswerEvents,
  buildBankPracticeQuestions,
} from '../src/lib/revision/adapter.ts';

test('1. الـ adapter: محاولة لسؤال بدون درس تُستبعد تمامًا ولا تخترع ربطًا', () => {
  const questionToSkill = new Map([
    ['q1', 'lesson_101'],
  ]);

  const attempts = [
    {
      courseId: 'c1',
      examId: 'e1',
      examTitle: 'امتحان تجريبي',
      percent: 50,
      earnedPoints: 1,
      totalPoints: 2,
      effectivePercent: 50,
      penalized: false,
      attemptNumber: 1,
      isOfficial: true,
      autoSubmit: false,
      ts: 1000,
      isTraining: false,
      isHomework: false,
      needsReview: false,
      reviewReason: '',
      details: [
        {
          question: 'سؤال معروف',
          questionId: 'q1',
          rawAnswer: 'a',
          score: 1,
          pointsEarned: 1,
          totalPoints: 1,
          feedback: 'صحيح',
          needsReview: false,
          method: 'auto',
          options: null,
          correctAnswer: 'a'
        },
        {
          question: 'سؤال عام بدون درس',
          questionId: 'q_orphan_999',
          rawAnswer: 'b',
          score: 0,
          pointsEarned: 0,
          totalPoints: 1,
          feedback: 'خطأ',
          needsReview: false,
          method: 'auto',
          options: null,
          correctAnswer: 'a'
        }
      ]
    }
  ];

  const { events, unlinkedQuestionsCount } = convertAttemptsToAnswerEvents(attempts, questionToSkill);

  assert.equal(events.length, 1, 'يجب تضمين السؤال المربوط فقط');
  assert.equal(events[0].questionId, 'q1');
  assert.equal(events[0].skillId, 'lesson_101');
  assert.equal(events[0].outcome, 'correct');
  assert.equal(unlinkedQuestionsCount, 1, 'يجب تسجيل السؤال اليتيم في عداد unlinkedQuestionsCount');
});

test('2. الـ adapter: السؤال المحذوف (archived) يُستبعد من بنك الأسئلة', () => {
  const bank = [
    {
      id: 'bq1',
      docId: 'bq1',
      type: 'choose',
      text: 'ما عاصمة مصر؟',
      points: 1,
      options: { a: 'القاهرة', b: 'الإسكندرية' },
      answer: 'a',
      altAnswers: [],
      grade: 'prep1',
      topic: 'مصر الفرعونية',
      archived: true, // محذوف / مؤرشف
      createdAt: '2026-01-01',
      asMcq: true,
      rubric: []
    },
    {
      id: 'bq2',
      docId: 'bq2',
      type: 'choose',
      text: 'أي قارة تقع مصر؟',
      points: 1,
      options: { a: 'أفريقيا', b: 'آسيا' },
      answer: 'a',
      altAnswers: [],
      grade: 'prep1',
      topic: 'مصر الفرعونية',
      archived: false,
      createdAt: '2026-01-01',
      asMcq: true,
      rubric: []
    }
  ];

  const topicMap = new Map([['مصر الفرعونية', 'lesson_geo_1']]);
  const result = buildBankPracticeQuestions(bank, topicMap);

  assert.equal(result.practiceQuestions.length, 1);
  assert.equal(result.practiceQuestions[0].id, 'bq2');
  assert.equal(result.excludedCount, 1);
  assert.equal(result.excludedByType['archived'], 1);
});

test('3. الـ adapter: السؤال المقالي يُستبعد ويُعلَّم مع العدّ (الاختيار من متعدد فقط)', () => {
  const bank = [
    {
      id: 'bq_essay',
      docId: 'bq_essay',
      type: 'explain', // مقالي: بم تفسر
      text: 'بم تفسر: قيام الحضارة المصرية؟',
      points: 2,
      options: null,
      answer: null,
      altAnswers: [],
      grade: 'prep1',
      topic: 'الوحدة الأولى',
      archived: false,
      createdAt: '2026-01-01',
      asMcq: false,
      rubric: []
    },
    {
      id: 'bq_mcq',
      docId: 'bq_mcq',
      type: 'choose',
      text: 'نهر النيل شريان الحياة في مصر.',
      points: 1,
      options: { a: 'صح', b: 'خطأ' },
      answer: 'a',
      altAnswers: [],
      grade: 'prep1',
      topic: 'الوحدة الأولى',
      archived: false,
      createdAt: '2026-01-01',
      asMcq: true,
      rubric: []
    }
  ];

  const topicMap = new Map([['الوحدة الأولى', 'lesson_nile_1']]);
  const result = buildBankPracticeQuestions(bank, topicMap);

  assert.equal(result.practiceQuestions.length, 1);
  assert.equal(result.practiceQuestions[0].id, 'bq_mcq');
  assert.equal(result.excludedCount, 1);
  assert.equal(result.excludedByType['explain'], 1);
});

test('4. الـ adapter: محاولتان للسؤال نفسه تُسجّلان كحدثين منفصلين بتسلسل زمني سليم', () => {
  const questionToSkill = new Map([['q_repeat', 'lesson_history_2']]);

  const attempts = [
    {
      courseId: 'c1',
      examId: 'e1',
      examTitle: 'امتحان 1',
      percent: 0,
      earnedPoints: 0,
      totalPoints: 1,
      effectivePercent: 0,
      penalized: false,
      attemptNumber: 1,
      isOfficial: true,
      autoSubmit: false,
      ts: 10000,
      isTraining: false,
      isHomework: false,
      needsReview: false,
      reviewReason: '',
      details: [
        {
          question: 'سؤال متكرر',
          questionId: 'q_repeat',
          rawAnswer: 'b',
          score: 0,
          pointsEarned: 0,
          totalPoints: 1,
          feedback: 'خطأ',
          needsReview: false,
          method: 'auto',
          options: null,
          correctAnswer: 'a'
        }
      ]
    },
    {
      courseId: 'c1',
      examId: 'e1',
      examTitle: 'امتحان 1 إعادة',
      percent: 100,
      earnedPoints: 1,
      totalPoints: 1,
      effectivePercent: 100,
      penalized: false,
      attemptNumber: 2,
      isOfficial: false,
      autoSubmit: false,
      ts: 20000,
      isTraining: false,
      isHomework: false,
      needsReview: false,
      reviewReason: '',
      details: [
        {
          question: 'سؤال متكرر',
          questionId: 'q_repeat',
          rawAnswer: 'a',
          score: 1,
          pointsEarned: 1,
          totalPoints: 1,
          feedback: 'صحيح',
          needsReview: false,
          method: 'auto',
          options: null,
          correctAnswer: 'a'
        }
      ]
    }
  ];

  const { events, unlinkedQuestionsCount } = convertAttemptsToAnswerEvents(attempts, questionToSkill);

  assert.equal(events.length, 2, 'يجب تسجيل الحدثين كليهما');
  assert.equal(unlinkedQuestionsCount, 0);
  assert.equal(events[0].outcome, 'wrong');
  assert.equal(events[0].at, 10000);
  assert.equal(events[1].outcome, 'correct');
  assert.equal(events[1].at, 20000);
});

import { buildAttemptResult } from '../v2-app/src/lib/grading.ts';
import { validateDraft } from '../v2-app/src/lib/questionDraft.ts';

console.log('=== Step 2: Manual Assessment Builder Verification ===');

// 1. Five questions created via manual builder (one of each required type)
const drafts = [
  {
    id: 'q_manual_choose',
    type: 'choose',
    text: 'عاصمة جمهورية مصر العربية هي مدينة:',
    points: 2,
    options: { a: 'الإسكندرية', b: 'القاهرة', c: 'الأقصر' }, // 3 options
    answer: 'b',
    altAnswers: [],
    rubric: []
  },
  {
    id: 'q_manual_tf',
    type: 'tf',
    text: 'يمر نهر النيل بأراضي جمهورية مصر العربية.',
    points: 2,
    options: null,
    answer: 'صح',
    altAnswers: [],
    rubric: []
  },
  {
    id: 'q_manual_fill',
    type: 'fill',
    text: 'تطل مصر من جهة الشرق على البحر ....',
    points: 2,
    options: null,
    answer: 'الأحمر',
    altAnswers: ['الاحمر'],
    rubric: []
  },
  {
    id: 'q_manual_short',
    type: 'short',
    text: 'ما هي عاصمة محافظة الإسكندرية القديمة التي أسسها القائد؟',
    points: 2,
    options: null,
    answer: 'الإسكندرية',
    altAnswers: ['الاسكندرية', 'اسكندرية'],
    rubric: []
  },
  {
    id: 'q_manual_essay',
    type: 'explain',
    text: 'بم تفسر: أهمية موقع مصر الجغرافي عبر التاريخ؟',
    points: 4,
    options: null,
    answer: 'تربط بين قارات العالم القديم وتتحكم في طرق التجارة وقناة السويس',
    altAnswers: [],
    rubric: [
      { concept: 'الربط بين قارات العالم القديم', weight: 2 },
      { concept: 'التحكم في طرق التجارة وقناة السويس', weight: 2 }
    ]
  }
];

console.log(`\n1. Validating 5 manual question drafts:`);
drafts.forEach((d, idx) => {
  const err = validateDraft(d);
  console.log(` - Question ${idx + 1} (${d.type}): ${err ? `Validation Error: ${err}` : 'VALID ✓'}`);
});

console.log('\n2. Solving the 5-question assessment with e2e student answers:');
const studentAnswers = {
  q_manual_choose: 'b',
  q_manual_tf: 'صح',
  q_manual_fill: 'الأحمر',
  q_manual_short: 'الإسكندرية',
  q_manual_essay: 'تربط بين قارات العالم القديم وتتحكم في طرق التجارة والملاحة العالمية عبر قناة السويس'
};

const result = buildAttemptResult({
  courseId: 'test_copy_v2_hidden',
  examId: 'manual_assessment_5q_test',
  examTitle: 'تقييم تجريبي يدوي 5 أسئلة',
  kind: 'exam',
  questions: drafts.map((d) => ({
    id: d.id,
    type: d.type,
    question: d.text,
    title: d.text,
    options: d.options,
    answer: d.answer,
    altAnswers: d.altAnswers,
    rubric: d.rubric,
    points: d.points
  })),
  answers: studentAnswers,
  attemptNumber: 1,
  autoSubmit: false,
  submittedAt: Date.now(),
  availableUntil: null
});

console.log('\n3. Graded Result Output:');
console.log(' - Total Points Possible:', result.totalPoints);
console.log(' - Earned Points:', result.earnedPoints);
console.log(' - Score Percent:', result.percent + '%');
console.log(' - Effective Percent:', result.effectivePercent + '%');
console.log(' - Needs Teacher Review (for Essay):', result.needsReview ? 'نعم (تم احتجازه لمراجعة المعلم)' : 'لا');
console.log(' - Question Results Breakdown (details):');
Object.entries(result.details || {}).forEach(([qId, qDet], i) => {
  console.log(`   * Q${i + 1} (${qId}): points=${qDet.pointsEarned}, correct=${qDet.correct}`);
});

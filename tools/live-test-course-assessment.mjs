import fs from 'fs';
import { buildAttemptResult, sanitizeAttemptForStorage } from '../v2-app/src/lib/grading.ts';

const envContent = fs.readFileSync('v2-app/.env', 'utf8');
const apiKey = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/)?.[1]?.trim();

const COURSE_ID = 'c1792025474962'; // كورس تجريبي (مخفي)
const EXAM_ID = `exam_manual_${Date.now()}`;
const BACKUP_PATH = 'C:/Users/mohammed/.gemini/antigravity/brain/1d6c450a-94c1-4c40-b814-bff021014ff4/backup_course_c1792025474962.json';

async function getToken(email, pass) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass, returnSecureToken: true })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { token: data.idToken, uid: data.localId };
}

function encodeVal(v) {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'boolean') return { booleanValue: v };
  if (v === null || v === undefined) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeVal) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) {
      if (val !== undefined) fields[k] = encodeVal(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function decodeField(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(decodeField);
  if ('mapValue' in val) {
    const obj = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      obj[k] = decodeField(v);
    }
    return obj;
  }
  return null;
}

async function run() {
  console.log('=== Step 0: Authentication and Pre-write Backup ===');
  const admin = await getToken('e2e_admin_test@youssefbarakat.local', 'AdminTestPass123!');
  const student = await getToken('e2e_student_test@youssefbarakat.local', 'StudentTestPass123!');

  // Backup course document
  const courseRes = await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/courses/${COURSE_ID}`, {
    headers: { Authorization: `Bearer ${admin.token}` }
  });
  const courseDoc = await courseRes.json();
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(courseDoc, null, 2), 'utf8');
  console.log(`Course ${COURSE_ID} backed up to disk (${fs.statSync(BACKUP_PATH).size} bytes).`);

  console.log('\n=== Step 1: Saving 5-Question Manual Assessment to Firestore ===');
  const questionsPublic = [
    {
      id: 'q1_choose',
      type: 'choose',
      question: 'عاصمة جمهورية مصر العربية هي:',
      options: { a: 'الإسكندرية', b: 'القاهرة', c: 'الأقصر' },
      points: 2
    },
    {
      id: 'q2_tf',
      type: 'tf',
      question: 'يمر نهر النيل بأراضي مصر.',
      options: null,
      points: 2
    },
    {
      id: 'q3_fill',
      type: 'fill',
      question: 'تطل مصر شرقاً على البحر ....',
      options: null,
      points: 2
    },
    {
      id: 'q4_short',
      type: 'short',
      question: 'ما هي عاصمة مصر في عصر الدولة الحديثة؟',
      options: null,
      points: 2
    },
    {
      id: 'q5_essay',
      type: 'explain',
      question: 'بم تفسر: أهمية موقع مصر الجغرافي؟',
      options: null,
      points: 4
    }
  ];

  const questionsKeys = [
    { id: 'q1_choose', answer: 'b' },
    { id: 'q2_tf', answer: 'صح' },
    { id: 'q3_fill', answer: 'الأحمر', altAnswers: ['الاحمر'] },
    { id: 'q4_short', answer: 'طيبة', altAnswers: ['الاقصر', 'الأقصر'] },
    {
      id: 'q5_essay',
      answer: 'تربط بين قارات العالم القديم',
      rubric: [{ concept: 'الربط بين قارات العالم القديم', weight: 4 }]
    }
  ];

  // 1. Write examContent/{EXAM_ID}
  const contentBody = {
    fields: {
      courseId: { stringValue: COURSE_ID },
      title: { stringValue: 'امتحان تجريبي يدوي 5 أسئلة' },
      kind: { stringValue: 'exam' },
      questions: { arrayValue: { values: questionsPublic.map(encodeVal) } },
      updatedAt: { stringValue: new Date().toISOString() }
    }
  };
  const setContentRes = await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/examContent/${EXAM_ID}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(contentBody)
  });
  console.log('examContent write HTTP:', setContentRes.status);

  // 2. Write examKeys/{EXAM_ID}
  const keysBody = {
    fields: {
      courseId: { stringValue: COURSE_ID },
      answers: { arrayValue: { values: questionsKeys.map(encodeVal) } },
      updatedAt: { stringValue: new Date().toISOString() }
    }
  };
  const setKeysRes = await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/examKeys/${EXAM_ID}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(keysBody)
  });
  console.log('examKeys write HTTP:', setKeysRes.status);

  console.log('\n=== Step 2: Read from Firestore and Print Questions Count and Types ===');
  const readContentRes = await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/examContent/${EXAM_ID}`, {
    headers: { Authorization: `Bearer ${admin.token}` }
  });
  const savedDoc = await readContentRes.json();
  const rawQList = savedDoc.fields?.questions?.arrayValue?.values || [];
  const parsedQList = rawQList.map(v => decodeField(v));
  
  console.log(`Questions Count: ${parsedQList.length}`);
  console.log(`Question Types: ${parsedQList.map(q => q.type).join(', ')}`);

  console.log('\n=== Step 3: Solve as e2e Student and Submit ===');
  // Combine public + keys for grading
  const fullQuestions = parsedQList.map(q => {
    const k = questionsKeys.find(key => key.id === q.id) || {};
    return {
      ...q,
      answer: k.answer,
      altAnswers: k.altAnswers,
      rubric: k.rubric,
      text: q.question
    };
  });

  const studentAnswers = {
    q1_choose: 'b', // Correct -> 2 pts
    q2_tf: 'صح',     // Correct -> 2 pts
    q3_fill: 'الأحمر', // Correct -> 2 pts
    q4_short: 'طيبة', // Correct -> 2 pts
    q5_essay: 'تربط بين قارات العالم القديم' // Essay
  };

  const attemptResult = buildAttemptResult({
    courseId: COURSE_ID,
    examId: EXAM_ID,
    examTitle: 'امتحان تجريبي يدوي 5 أسئلة',
    kind: 'exam',
    questions: fullQuestions,
    answers: studentAnswers,
    attemptNumber: 1,
    autoSubmit: false,
    submittedAt: Date.now(),
    availableUntil: null
  });

  console.log(`Submission Score: ${attemptResult.earnedPoints} / ${attemptResult.totalPoints} (${attemptResult.percent}%)`);
  console.log(`Effective Percent: ${attemptResult.effectivePercent}%`);
  console.log(`Needs Review: ${attemptResult.needsReview}`);
  console.log('Question Details correct values:');
  attemptResult.details.forEach((d, idx) => {
    console.log(` - Q${idx + 1} (${d.questionId}): points=${d.pointsEarned}/${d.totalPoints}, correct=${d.correct}`);
  });

  console.log('\n=== Step 4: Cleanup Test Documents ===');
  await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/examContent/${EXAM_ID}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${admin.token}` }
  });
  await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/examKeys/${EXAM_ID}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${admin.token}` }
  });
  console.log('Cleanup completed cleanly.');
}

run().catch(console.error);

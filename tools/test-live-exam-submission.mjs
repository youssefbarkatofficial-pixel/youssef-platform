import fs from 'fs';
import { buildAttemptResult } from '../v2-app/src/lib/grading.ts';

const envContent = fs.readFileSync('v2-app/.env', 'utf8');
const apiKey = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/)?.[1]?.trim();

const creds = {
  email: 'e2e_student_test@youssefbarakat.local',
  pass: 'StudentTestPass123!'
};

async function testSubmit() {
  console.log('=== Step 1: Sign in with Test Student ===');
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.pass, returnSecureToken: true })
  });
  const authData = await authRes.json();
  if (authData.error) {
    console.error('Auth error:', authData.error);
    return;
  }
  const uid = authData.localId;
  const idToken = authData.idToken;
  console.log('Signed in successfully.');

  console.log('\n=== Step 2: Fetch Current Student Document ===');
  const studentDocRes = await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/students/${uid}`, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  const studentDoc = await studentDocRes.json();
  const currentFields = studentDoc.fields || {};
  const currentResults = currentFields.examResults?.arrayValue?.values || [];
  console.log('Current exam results count before submit:', currentResults.length);

  console.log('\n=== Step 3: Grade a Sample Test Exam with grading engine ===');
  // Define 2 objective questions
  const sampleQuestions = [
    {
      id: 'q_test_1',
      type: 'choose',
      title: 'سؤال اختياري 1',
      question: 'عاصمة جمهورية مصر العربية هي:',
      options: { a: 'الإسكندرية', b: 'القاهرة', c: 'الجيزة', d: 'أسوان' },
      answer: 'b',
      points: 2
    },
    {
      id: 'q_test_2',
      type: 'tf',
      title: 'سؤال صح أو خطأ 2',
      question: 'تقع مصر في قارة أفريقيا.',
      answer: 'true',
      points: 2
    }
  ];

  const studentAnswers = {
    'q_test_1': 'b', // Correct -> 2 points
    'q_test_2': 'true' // Correct -> 2 points
  };

  const attemptNumber = currentResults.length + 1;
  const result = buildAttemptResult({
    courseId: 'c1785241200444',
    examId: 'test_live_eval_exam_1',
    examTitle: 'امتحان تجريبي حي للتحقق من التصحيح',
    kind: 'exam',
    questions: sampleQuestions,
    answers: studentAnswers,
    attemptNumber,
    autoSubmit: false,
    submittedAt: Date.now(),
    availableUntil: null
  });

  console.log('Grading Result produced by engine:');
  console.log('  Exam Title:', result.examTitle);
  console.log('  Attempt Number:', result.attemptNumber);
  console.log('  Earned Points:', result.earnedPoints, '/', result.totalPoints);
  console.log('  Score Percent:', result.percent + '%');
  console.log('  Effective Percent:', result.effectivePercent + '%');
  console.log('  Penalized:', result.penalized);
  console.log('  Is Official:', result.isOfficial);

  console.log('\n=== Step 4: Writing Attempt to Firestore students/{uid}.examResults ===');
  // Use sanitizeAttemptForStorage to ensure 100% compliance with Firestore security rules
  const { sanitizeAttemptForStorage } = await import('../v2-app/src/lib/grading.ts');
  const sanitizedResult = sanitizeAttemptForStorage(result);

  function encodeValue(val) {
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return { integerValue: String(val) };
      return { doubleValue: val };
    }
    if (typeof val === 'boolean') return { booleanValue: val };
    if (val === null || val === undefined) return { nullValue: null };
    if (Array.isArray(val)) return { arrayValue: { values: val.map(encodeValue) } };
    if (typeof val === 'object') {
      const fields = {};
      for (const [k, v] of Object.entries(val)) {
        fields[k] = encodeValue(v);
      }
      return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
  }

  const encodedNewResult = encodeValue(sanitizedResult);
  const updatedResultsList = [...currentResults, encodedNewResult];

  // We patch the student document with the new examResults
  const patchRes = await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/students/${uid}?updateMask.fieldPaths=examResults`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      fields: {
        examResults: {
          arrayValue: {
            values: updatedResultsList
          }
        }
      }
    })
  });

  const patchData = await patchRes.json();
  if (patchData.error) {
    console.error('FAILED to append exam result to Firestore:', patchData.error);
    return;
  }

  console.log('SUCCESS: Firestore accepted update! Document updated at:', patchData.updateTime);

  console.log('\n=== Step 5: Verification Read of the Written Document ===');
  const verifyRes = await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/students/${uid}`, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  const verifyData = await verifyRes.json();
  const savedResults = verifyData.fields?.examResults?.arrayValue?.values || [];
  console.log('Verified exam results count in Firestore:', savedResults.length);
  const lastSaved = savedResults[savedResults.length - 1]?.mapValue?.fields;
  console.log('Last saved result in Firestore:');
  console.log('  examId:', lastSaved?.examId?.stringValue);
  console.log('  percent:', lastSaved?.percent?.integerValue || lastSaved?.percent?.doubleValue);
  console.log('  earnedPoints:', lastSaved?.earnedPoints?.integerValue);
  console.log('  totalPoints:', lastSaved?.totalPoints?.integerValue);
}

testSubmit().catch(console.error);

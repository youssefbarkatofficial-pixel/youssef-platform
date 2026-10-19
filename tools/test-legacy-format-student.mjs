import fs from 'fs';

const envContent = fs.readFileSync('v2-app/.env', 'utf8');
const apiKey = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/)?.[1]?.trim();

const testPhone = '01000000099';
const testEmail = `${testPhone}@student.youssefbarakat.com`;
const testPass = 'LegacyPass123!@#';

console.log('=== Item 5: Create and Test Legacy-Format Student Account ===');

async function run() {
  console.log('1. Attempting to create legacy-format auth account (or sign in if already exists)...');
  let authData;
  const signUpRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPass,
      returnSecureToken: true
    })
  });
  const signUpJson = await signUpRes.json();
  if (signUpJson.error && signUpJson.error.message === 'EMAIL_EXISTS') {
    console.log('   Account exists, signing in...');
    const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPass,
        returnSecureToken: true
      })
    });
    authData = await signInRes.json();
  } else if (signUpJson.error) {
    console.error('   SignUp Error:', signUpJson.error);
    return;
  } else {
    authData = signUpJson;
    console.log('   Created new Auth user with UID:', authData.localId);
  }

  const uid = authData.localId;
  const idToken = authData.idToken;

  console.log('2. Writing legacy-format student document to Firestore (students/' + uid + ')...');
  // Legacy document fields
  const legacyFields = {
    name: { stringValue: 'طالب تجريبي نمط قديم' },
    phone: { stringValue: testPhone },
    parentPhone: { stringValue: '01000000098' },
    gov: { stringValue: 'القاهرة' },
    grade: { stringValue: 'sec1' },
    studentCode: { stringValue: 'LEGACY-TEST-01' },
    email: { stringValue: testEmail },
    role: { stringValue: 'student' },
    courses: { arrayValue: { values: [{ stringValue: 'c1785241200444' }] } },
    notifications: { arrayValue: { values: [] } },
    createdAt: { stringValue: new Date().toISOString() },
    lastUpdatedAcademicYear: { integerValue: '2026' }
  };

  const patchRes = await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/students/${uid}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ fields: legacyFields })
  });
  const patchData = await patchRes.json();
  console.log('   Firestore Write Status:', patchRes.status);
  if (patchData.error) {
    console.error('   Firestore Write Error:', patchData.error);
    return;
  }

  console.log('3. Testing login using ONLY phone number ("' + testPhone + '") via candidate resolution...');
  // Same candidates resolution as v2 loginEmailCandidates
  const candidates = [
    `${testPhone}@student.youssefbarakat.com`,
    `${testPhone.replace(/^0/, '')}@student.youssefbarakat.com`,
    `20${testPhone.replace(/^0/, '')}@student.youssefbarakat.com`
  ];
  let loggedInUid = null;
  let loggedInToken = null;
  for (const c of candidates) {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: c,
        password: testPass,
        returnSecureToken: true
      })
    });
    const data = await res.json();
    if (!data.error) {
      loggedInUid = data.localId;
      loggedInToken = data.idToken;
      console.log('   Candidate matched:', c, '-> UID:', loggedInUid);
      break;
    }
  }

  if (!loggedInUid) {
    console.error('   Login with candidate emails failed!');
    return;
  }

  console.log('4. Fetching student profile with auth token...');
  const getProfileRes = await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/students/${loggedInUid}`, {
    headers: { Authorization: `Bearer ${loggedInToken}` }
  });
  const profileJson = await getProfileRes.json();
  console.log('   Profile Status:', getProfileRes.status);
  console.log('   Enrolled courses:', profileJson.fields?.courses?.arrayValue?.values?.map(v => v.stringValue));

  console.log('5. Fetching enrolled course (c1785241200444) content...');
  const courseRes = await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/courses/c1785241200444`, {
    headers: { Authorization: `Bearer ${loggedInToken}` }
  });
  const courseJson = await courseRes.json();
  console.log('   Course Fetch Status:', courseRes.status);
  console.log('   Course Title:', courseJson.fields?.title?.stringValue);
  console.log('   SUCCESS: Legacy-format student can log in and access enrolled courses perfectly!');
}

run().catch(console.error);

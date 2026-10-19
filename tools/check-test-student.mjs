import fs from 'fs';

const envContent = fs.readFileSync('v2-app/.env', 'utf8');
const apiKey = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/)?.[1]?.trim();

const creds = {
  email: 'e2e_student_test@youssefbarakat.local',
  pass: 'StudentTestPass123!'
};

async function run() {
  console.log('=== Checking Test Student in Firestore ===');
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
  console.log('Test student Auth successful.');

  const docRes = await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/students/${uid}`, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  const docData = await docRes.json();
  if (docData.error) {
    console.error('Firestore student doc fetch error:', docData.error);
    return;
  }

  console.log('Student doc found:');
  const fields = docData.fields || {};
  console.log('  name:', fields.name?.stringValue);
  console.log('  grade:', fields.grade?.stringValue);
  console.log('  enrolledCourses:', fields.enrolledCourses?.arrayValue?.values?.map(v => v.stringValue));
  console.log('  examResults count:', fields.examResults?.arrayValue?.values?.length || 0);
}

run().catch(console.error);

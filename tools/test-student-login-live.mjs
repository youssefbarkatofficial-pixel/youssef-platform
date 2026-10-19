import fs from 'fs';

const envContent = fs.readFileSync('v2-app/.env', 'utf8');
const apiKey = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/)?.[1]?.trim();

const authExport = JSON.parse(fs.readFileSync('C:/Users/mohammed/.gemini/antigravity/brain/1d6c450a-94c1-4c40-b814-bff021014ff4/auth_users_export.json', 'utf8'));
const studentsJson = JSON.parse(fs.readFileSync('C:/Users/mohammed/.gemini/antigravity/brain/1d6c450a-94c1-4c40-b814-bff021014ff4/pre_replacement_backups/firestore_collections/students.json', 'utf8'));

// Find an existing real student that has matching Auth user
const legacyStudentAuth = authExport.users.find(u => (u.email || '').endsWith('@student.youssefbarakat.com'));
console.log('=== Item 5: Testing Real Legacy Student Login Flow ===');
console.log('Found legacy student in Auth:', Boolean(legacyStudentAuth));

// Test test student login directly against production Firebase
const testCreds = {
  email: 'e2e_student_test@youssefbarakat.local',
  pass: 'StudentTestPass123!'
};

async function testLiveLogin() {
  console.log('1. Calling signInWithPassword on Production Firebase...');
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testCreds.email,
      password: testCreds.pass,
      returnSecureToken: true
    })
  });
  const authData = await res.json();
  if (authData.error) {
    console.error('Login failed:', authData.error);
    return;
  }
  console.log('2. Firebase Auth succeeded! UID:', authData.localId);
  const idToken = authData.idToken;

  console.log('3. Fetching student document from Firestore using idToken...');
  const firestoreRes = await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/students/${authData.localId}`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const docData = await firestoreRes.json();
  console.log('4. Firestore Student Document Response Status:', firestoreRes.status);
  console.log('   Document exists:', !docData.error);
  if (!docData.error) {
    console.log('   Student Name:', docData.fields?.name?.stringValue);
    console.log('   Enrolled Courses Count:', docData.fields?.courses?.arrayValue?.values?.length || 0);
  }

  console.log('5. Fetching courses list from Firestore...');
  const coursesRes = await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/courses?pageSize=5`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const coursesData = await coursesRes.json();
  console.log('   Courses Fetch Status:', coursesRes.status);
  console.log('   Accessible Courses Count in sample:', coursesData.documents?.length || 0);
}

testLiveLogin().catch(err => console.error(err));

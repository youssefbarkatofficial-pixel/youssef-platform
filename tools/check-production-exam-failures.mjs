import fs from 'fs';

const envContent = fs.readFileSync('v2-app/.env', 'utf8');
const apiKey = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/)?.[1]?.trim();

// Use Admin or Test Student to query submissions and students
const creds = { email: 'e2e_student_test@youssefbarakat.local', pass: 'StudentTestPass123!' };

async function checkFailures() {
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.pass, returnSecureToken: true })
  });
  const { idToken } = await authRes.json();

  // Query examSubmissions
  console.log('Querying examSubmissions collection...');
  const subRes = await fetch('https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/examSubmissions?pageSize=50', {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const subData = await subRes.json();
  const subDocs = subData.documents || [];
  console.log('Total documents in examSubmissions:', subDocs.length);

  // Check backup from pre-replacement vs now
  const backupStudents = JSON.parse(fs.readFileSync('C:/Users/mohammed/.gemini/antigravity/brain/1d6c450a-94c1-4c40-b814-bff021014ff4/pre_replacement_backups/firestore_collections/students.json', 'utf8'));
  console.log('Pre-replacement student count in backup:', backupStudents.length);

  // Check how many students had examResults before replacement:
  let preResultsCount = 0;
  backupStudents.forEach(doc => {
    const res = doc.fields?.examResults?.arrayValue?.values || [];
    preResultsCount += res.length;
  });
  console.log('Total exam results across all students pre-replacement:', preResultsCount);
}

checkFailures().catch(console.error);

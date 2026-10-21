import fs from 'node:fs';

const envContent = fs.readFileSync('v2-app/.env', 'utf8');
const apiKey = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/)?.[1]?.trim();
const creds = { email: 'e2e_student_test@youssefbarakat.local', pass: 'StudentTestPass123!' };

async function run() {
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.pass, returnSecureToken: true })
  });
  const authData = await authRes.json();
  const token = authData.idToken;

  const chatRes = await fetch('https://youssefbarakat.pages.dev/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ message: 'ما هي عاصمة جمهورية مصر العربية؟' })
  });
  console.log('Live Pages /chat HTTP Status:', chatRes.status);
  const data = await chatRes.json();
  console.log('Live Pages /chat Response Body:', data);
}

run().catch(console.error);

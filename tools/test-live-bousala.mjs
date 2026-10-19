import fs from 'fs';

const envContent = fs.readFileSync('v2-app/.env', 'utf8');
const apiKey = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/)?.[1]?.trim();
const botUrl = (envContent.match(/VITE_BOT_URL=(.*)/)?.[1]?.trim() || 'https://bot-worker.youssefbarkatofficial.workers.dev').replace(/\/+$/, '');

const creds = {
  email: 'e2e_student_test@youssefbarakat.local',
  pass: 'StudentTestPass123!'
};

async function testBousala() {
  console.log('=== Step 1: Logging in as Test Student ===');
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
  const token = authData.idToken;
  console.log('Logged in successfully. Token obtained.');

  console.log('\n=== Step 2: Bousala Question 1 (From Syllabus - In-Scope) ===');
  const q1 = 'ما هي أسباب لجوء شعب الإنكا إلى زراعة المدرجات الجبلية؟';
  console.log('Sending Question 1:', q1);

  const res1 = await fetch(`${botUrl}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-device-id': 'dev_test_suite_runner_1'
    },
    body: JSON.stringify({ message: q1 })
  });
  console.log('Q1 HTTP Status:', res1.status);
  const data1 = await res1.json();
  console.log('Q1 Response:', {
    reply: (data1.reply || '').slice(0, 150) + '...',
    source: data1.source,
    remaining: data1.remaining,
    lessonTitles: data1.lessonTitles,
    logId: data1.logId
  });

  console.log('\n=== Step 3: Bousala Question 2 (Outside Syllabus - Out-of-Scope) ===');
  const q2 = 'ما هي عاصمة اليابان وما هي أهم صناعاتها التكنولوجية؟';
  console.log('Sending Question 2:', q2);

  const res2 = await fetch(`${botUrl}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-device-id': 'dev_test_suite_runner_1'
    },
    body: JSON.stringify({ message: q2 })
  });
  console.log('Q2 HTTP Status:', res2.status);
  const data2 = await res2.json();
  console.log('Q2 Response:', {
    reply: (data2.reply || '').slice(0, 150) + '...',
    source: data2.source,
    remaining: data2.remaining,
    lessonTitles: data2.lessonTitles,
    logId: data2.logId
  });
}

testBousala().catch(console.error);

import fs from 'fs';

const envContent = fs.readFileSync('v2-app/.env', 'utf8');
const apiKey = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/)?.[1]?.trim();
const botUrl = 'https://bot-worker.youssefbarkatofficial.workers.dev';

async function getToken(email, pass) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass, returnSecureToken: true })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.idToken;
}

async function testCase(label, token, message) {
  try {
    const res = await fetch(`${botUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-device-id': 'diag_device_1'
      },
      body: JSON.stringify({ message })
    });
    const status = res.status;
    const body = await res.json().catch(() => ({}));
    const source = body.source || 'none';
    const fallbackReason = body.fallbackReason || 'none';
    const reply = (body.reply || body.error || '').slice(0, 80).replace(/\n/g, ' ');
    console.log(`[${label}] status=${status} source=${source} fallbackReason=${fallbackReason} reply="${reply}"`);
    return { status, source, fallbackReason, reply };
  } catch (err) {
    console.log(`[${label}] error=${err.message}`);
  }
}

async function run() {
  const studentToken = await getToken('e2e_student_test@youssefbarakat.local', 'StudentTestPass123!');
  const adminToken = await getToken('e2e_admin_test@youssefbarakat.local', 'AdminTestPass123!');

  console.log('--- Initial 4-Case Diagnostic on Live Worker ---');
  await testCase('أ. ازايك (student)', studentToken, 'ازايك');
  await testCase('ب. ازايك (admin)', adminToken, 'ازايك');
  
  const lessonQuestion = 'ما هي أعلى جبال في قارة آسيا وما اسم أعلى قمة فيها؟';
  await testCase('ج. سؤال منهج (student)', studentToken, lessonQuestion);
  await testCase('د. سؤال منهج (admin)', adminToken, lessonQuestion);
}

run().catch(console.error);

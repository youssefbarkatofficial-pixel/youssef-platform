import fs from 'fs';

const envContent = fs.readFileSync('v2-app/.env', 'utf8');
const apiKey = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/)?.[1]?.trim();
const botUrl = (envContent.match(/VITE_BOT_URL=(.*)/)?.[1]?.trim() || 'https://bot-worker.youssefbarkatofficial.workers.dev').replace(/\/+$/, '');

const creds = {
  email: 'e2e_student_test@youssefbarakat.local',
  pass: 'StudentTestPass123!'
};

async function runTests() {
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.pass, returnSecureToken: true })
  });
  const authData = await authRes.json();
  if (authData.error) {
    console.error('Auth error:', authData.error);
    process.exit(1);
  }
  const token = authData.idToken;

  const questions = [
    {
      category: '1. من المنهج (السؤال الأول: تضاريس آسيا)',
      text: 'ما هي أعلى جبال في قارة آسيا وما اسم أعلى قمة فيها؟'
    },
    {
      category: '2. من المنهج (السؤال الثاني: حضارة مصر ونهر النيل)',
      text: 'ما هي العوامل الطبيعية وأهمية نهر النيل في قيام الحضارة المصرية؟'
    },
    {
      category: '3. خارج المنهج (سؤال عام فيزياء/برمجة)',
      text: 'كيف تعمل خوارزميات التشفير ومبدأ المفتاح العام في الحاسوب؟'
    },
    {
      category: '4. عام / ترحيب',
      text: 'السلام عليكم يا بوصلة ازيك'
    }
  ];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\n================== ${q.category} ==================`);
    console.log(`السؤال: ${q.text}`);

    const res = await fetch(`${botUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-device-id': 'bousala_evaluator_device'
      },
      body: JSON.stringify({ message: q.text })
    });

    if (!res.ok) {
      console.error(`HTTP Error ${res.status}:`, await res.text());
      continue;
    }

    const data = await res.json();
    console.log(`source: ${data.source}`);
    console.log(`fallbackReason: ${data.fallbackReason || 'none'}`);
    console.log(`reply: ${data.reply}`);
  }
}

runTests().catch(console.error);

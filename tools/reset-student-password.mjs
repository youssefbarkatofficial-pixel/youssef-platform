import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const phone = args[0]?.trim();
const newPassword = args[1]?.trim();

if (!phone || !newPassword) {
  console.log('الاستخدام:');
  console.log('node tools/reset-student-password.mjs <رقم_الطالب> <الباسورد_الجديد>');
  process.exit(1);
}

async function run() {
  const config = JSON.parse(fs.readFileSync('C:/Users/mohammed/.config/configstore/firebase-tools.json', 'utf8'));
  const auth = require('C:/Users/mohammed/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth.js');
  const scopes = typeof config.tokens.scope === 'string' ? config.tokens.scope.split(' ') : [];
  const tokenObj = await auth.getAccessToken(config.tokens.refresh_token, scopes);

  const cleanPhone = phone.replace(/[\s-]/g, '');
  const email = `${cleanPhone}@student.youssefbarakat.com`;

  // 1. Look up user
  const lookupRes = await fetch('https://identitytoolkit.googleapis.com/v1/projects/youssefbarakatplatform-8abff/accounts:lookup', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenObj.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: [email] })
  });

  const lookupData = await lookupRes.json();
  if (!lookupData.users || lookupData.users.length === 0) {
    console.error(`❌ لم يتم العثور على أي حساب مسجل برقم: ${cleanPhone}`);
    process.exit(1);
  }

  const user = lookupData.users[0];
  const uid = user.localId;

  // 2. Update password
  const updateRes = await fetch('https://identitytoolkit.googleapis.com/v1/projects/youssefbarakatplatform-8abff/accounts:update', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenObj.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ localId: uid, password: newPassword })
  });

  const updateData = await updateRes.json();
  if (updateData.localId) {
    console.log(`✅ تم تحديث وتفعيل كلمة المرور للطالب (${cleanPhone}) بنجاح في سيرفرات فايربيز!`);
    console.log(`UID: ${uid}`);
    console.log(`كلمة المرور الجديدة: ${newPassword}`);
  } else {
    console.error('❌ تعذر التحديث:', updateData);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('❌ خطأ غير متوقع:', err);
  process.exit(1);
});

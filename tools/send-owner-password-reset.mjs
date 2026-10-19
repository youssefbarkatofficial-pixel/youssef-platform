import fs from 'fs';

const envContent = fs.readFileSync('v2-app/.env', 'utf8');
const apiKey = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/)?.[1]?.trim();

const ownerEmail = 'youssefbarkatofficial@gmail.com';

console.log('=== Item 1: Sending Password Reset Email to Owner ===');
console.log('Target Email:', ownerEmail);

async function sendReset() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'PASSWORD_RESET',
      email: ownerEmail
    })
  });

  const data = await res.json();
  console.log('HTTP Status:', res.status);
  console.log('API Response:', data);

  if (res.status === 200 && data.email) {
    console.log('SUCCESS: Password reset email has been dispatched by Firebase to', data.email);
  } else {
    console.log('FAILED to dispatch email:', data.error);
  }
}

sendReset().catch(console.error);

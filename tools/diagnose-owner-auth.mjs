import fs from 'fs';

const envContent = fs.readFileSync('v2-app/.env', 'utf8');
const apiKey = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/)?.[1]?.trim();

const adminsJson = JSON.parse(fs.readFileSync('C:/Users/mohammed/.gemini/antigravity/brain/1d6c450a-94c1-4c40-b814-bff021014ff4/pre_replacement_backups/firestore_collections/platformAdmins.json', 'utf8'));
const ownerDoc = adminsJson.find(a => a.name.includes('youssefbarkatofficial@gmail.com'));
const ownerEmail = ownerDoc?.fields?.email?.stringValue || 'youssefbarkatofficial@gmail.com';
const storedPassword = ownerDoc?.fields?.password?.stringValue;

console.log('=== Checking Owner in Firebase Auth (Production) ===');
console.log('Target Email:', ownerEmail);
console.log('Has stored password in platformAdmins:', Boolean(storedPassword));

async function checkAuth() {
  console.log('--- Checking email existence via createAuthUri ---');
  const uriRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: ownerEmail,
      continueUri: 'http://localhost'
    })
  });
  const uriData = await uriRes.json();
  console.log('createAuthUri response:', uriData);

  if (!storedPassword) {
    console.log('No password available to test');
    return;
  }

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ownerEmail,
      password: storedPassword,
      returnSecureToken: true
    })
  });

  const data = await res.json();
  if (data.error) {
    console.log('Auth API Error Code:', data.error.message);
    console.log('Auth API Error Details:', data.error.errors?.[0]?.message);
  } else {
    console.log('Auth API Success!');
    console.log('User UID in Firebase Auth:', data.localId);
    console.log('Email verified:', data.emailVerified);
    console.log('Registered:', data.registered);
  }
}

checkAuth().catch(err => console.error(err.message));

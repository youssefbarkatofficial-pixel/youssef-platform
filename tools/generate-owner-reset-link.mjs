import fs from 'fs';

const envContent = fs.readFileSync('v2-app/.env', 'utf8');
const apiKey = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/)?.[1]?.trim();

const fbTools = JSON.parse(fs.readFileSync('C:/Users/mohammed/.config/configstore/firebase-tools.json', 'utf8'));
const accessToken = fbTools.tokens?.access_token;

const ownerEmail = 'youssefbarkatofficial@gmail.com';

async function generateLink() {
  console.log('Generating one-time reset link with OAuth access token...');
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      requestType: 'PASSWORD_RESET',
      email: ownerEmail,
      returnOobLink: true
    })
  });

  const data = await res.json();
  if (data.oobLink) {
    console.log('OOB_LINK_GENERATED_SUCCESS');
    console.log('Link:', data.oobLink);
  } else {
    console.log('Failed:', data);
  }
}

generateLink().catch(console.error);

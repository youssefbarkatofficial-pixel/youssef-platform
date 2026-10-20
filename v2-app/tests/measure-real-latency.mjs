import fs from 'fs';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

async function getOAuthToken() {
  const configPath = 'C:/Users/mohammed/.config/configstore/firebase-tools.json';
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const apiPath = 'C:/Users/mohammed/AppData/Roaming/npm/node_modules/firebase-tools/lib/api.js';
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const api = require(apiPath);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: api.clientId(),
      client_secret: api.clientSecret(),
      refresh_token: config.tokens.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function measureRealStudentsFetch() {
  const token = await getOAuthToken();
  const url = 'https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/students?pageSize=300';
  
  console.log('>>> Measuring real network fetch of students collection from Firestore...');
  const t0 = performance.now();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  const t1 = performance.now();
  
  const studentCount = data.documents?.length || 0;
  const networkTimeMs = (t1 - t0).toFixed(2);
  console.log(`✔ Real network fetch time for ${studentCount} students from Firestore: ${networkTimeMs} ms`);
}

measureRealStudentsFetch().catch(console.error);

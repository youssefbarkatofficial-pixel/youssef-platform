import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

async function run() {
  const apiModule = require('C:/Users/mohammed/AppData/Roaming/npm/node_modules/firebase-tools/lib/api');
  const config = JSON.parse(fs.readFileSync('C:/Users/mohammed/.config/configstore/firebase-tools.json', 'utf8'));
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: apiModule.clientId(),
      client_secret: apiModule.clientSecret(),
      refresh_token: config.tokens.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  const { access_token } = await tokenRes.json();
  const projectId = 'youssefbarakatplatform-8abff';

  // 1. Read platform_settings
  console.log('=== PLATFORM_SETTINGS ===');
  const psRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/platform_settings`, {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  const psData = await psRes.json();
  if (psData.documents) {
    for (const doc of psData.documents) {
      const id = doc.name.split('/').pop();
      const val = doc.fields?.value?.stringValue || doc.fields?.value?.mapValue || '(other format)';
      console.log(`Doc ID: ${id}`);
      if (typeof val === 'string') {
        console.log(`  Preview: ${val.substring(0, 120)}... (length: ${val.length})`);
      } else {
        console.log(`  Val:`, JSON.stringify(val));
      }
    }
  } else {
    console.log('No documents found in platform_settings:', psData);
  }

  // 2. Read courses
  console.log('\n=== COURSES IN FIRESTORE ===');
  const cRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/courses`, {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  const cData = await cRes.json();
  if (cData.documents) {
    console.log(`Total courses in Firestore: ${cData.documents.length}`);
    for (const doc of cData.documents) {
      const id = doc.name.split('/').pop();
      const title = doc.fields?.title?.stringValue || 'بدون عنوان';
      const status = doc.fields?.status?.stringValue || '(no status field)';
      const isHidden = doc.fields?.hidden?.booleanValue;
      const isPublished = doc.fields?.isPublished?.booleanValue;
      const grade = doc.fields?.grade?.stringValue;
      const createdAt = doc.fields?.createdAt?.stringValue || doc.fields?.createdAt?.timestampValue || doc.createTime;
      console.log(`- ID: ${id} | Title: "${title}" | grade: ${grade} | status: ${status} | isPublished: ${isPublished} | hidden: ${isHidden} | created: ${createdAt}`);
    }
  } else {
    console.log('No documents in courses:', cData);
  }
}
run().catch(console.error);

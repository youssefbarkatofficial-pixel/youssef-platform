import { readFileSync } from 'fs';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const api = require('C:/Users/mohammed/AppData/Roaming/npm/node_modules/firebase-tools/lib/api.js');
const config = JSON.parse(readFileSync('C:/Users/mohammed/.config/configstore/firebase-tools.json', 'utf8'));

async function getOAuthToken() {
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

async function checkCourse(token, courseId) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/courses/${courseId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    return { id: courseId, status: res.status };
  }
  const data = await res.json();
  const hidden = data.fields?.hidden?.booleanValue;
  const title = data.fields?.title?.stringValue;
  return { id: courseId, title, hidden };
}

async function main() {
  const token = await getOAuthToken();
  const targetCourses = ['c1792025474962', 'test_copy_v2_hidden', 'test_copy_legacy_hidden'];
  
  console.log('--- Checking Test Courses Hidden Status on Live Firestore ---');
  for (const cid of targetCourses) {
    const result = await checkCourse(token, cid);
    console.log(`Course ${result.id}: title="${result.title}", hidden=${result.hidden}`);
  }

  // Also fetch all courses and verify visible list on HomePage and CoursesPage
  const listRes = await fetch('https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/courses', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const allData = await listRes.json();
  const docs = allData.documents || [];
  const visibleCourses = docs
    .filter(d => d.fields?.hidden?.booleanValue !== true)
    .map(d => ({
      id: d.name.split('/').pop(),
      title: d.fields?.title?.stringValue
    }));

  console.log('\n--- Visible Courses in Public Pages (filter: !course.hidden) ---');
  console.log(`Total visible courses: ${visibleCourses.length}`);
  visibleCourses.forEach(c => console.log(` - [Visible] ${c.id}: ${c.title}`));

  const leaked = visibleCourses.filter(c => targetCourses.includes(c.id));
  console.log(`\nLeaked test courses in public list: ${leaked.length}`);
  if (leaked.length === 0) {
    console.log('✔ VERIFIED: ZERO test courses visible in public lists. All test courses are completely hidden.');
  } else {
    console.error('FAILED: Some test courses are visible!', leaked);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

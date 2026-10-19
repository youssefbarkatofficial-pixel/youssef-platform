import { readFileSync, writeFileSync, mkdirSync, statSync, copyFileSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const ARTIFACT_BACKUP_DIR = 'C:\\Users\\mohammed\\.gemini\\antigravity\\brain\\1d6c450a-94c1-4c40-b814-bff021014ff4\\pre_replacement_backups\\firestore_collections';
const DISK_BACKUP_DIR = 'g:\\هارد يوسف\\Graphic\\روابط برامج\\New folder\\New folder\\New folder\\New folder\\شغل\\youssef\\شغل فيديو دروس\\المنصة\\pre_replacement_backups\\firestore_collections';

mkdirSync(ARTIFACT_BACKUP_DIR, { recursive: true });
mkdirSync(DISK_BACKUP_DIR, { recursive: true });

async function getAccessToken() {
  const config = JSON.parse(readFileSync('C:/Users/mohammed/.config/configstore/firebase-tools.json', 'utf8'));
  const auth = require('C:/Users/mohammed/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth.js');
  const scopes = typeof config.tokens.scope === 'string' ? config.tokens.scope.split(' ') : [];
  const tokenObj = await auth.getAccessToken(config.tokens.refresh_token, scopes);
  return tokenObj.access_token;
}

async function fetchCollection(token, collectionId) {
  let documents = [];
  let pageToken = '';
  const projectId = 'youssefbarakatplatform-8abff';

  do {
    let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionId}?pageSize=300`;
    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[WARN] Collection ${collectionId} status ${res.status}: ${errText.slice(0, 100)}`);
      break;
    }

    const data = await res.json();
    if (data.documents && Array.isArray(data.documents)) {
      documents.push(...data.documents);
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return documents;
}

async function main() {
  console.log('=== Starting Read-Only Firestore Export ===');
  const token = await getAccessToken();
  console.log('Successfully acquired admin read token.');

  const collections = [
    'courses',
    'platform_settings',
    'platformAdmins',
    'assessments',
    'paymentRequests',
    'supportTickets',
    'notifications',
    'students'
  ];

  const summary = [];

  for (const col of collections) {
    try {
      const docs = await fetchCollection(token, col);
      const filePathArtifact = join(ARTIFACT_BACKUP_DIR, `${col}.json`);
      const filePathDisk = join(DISK_BACKUP_DIR, `${col}.json`);

      const jsonStr = JSON.stringify(docs, null, 2);
      writeFileSync(filePathArtifact, jsonStr, 'utf8');
      writeFileSync(filePathDisk, jsonStr, 'utf8');

      const sizeBytes = Buffer.byteLength(jsonStr, 'utf8');
      summary.push({
        collection: col,
        count: docs.length,
        sizeBytes,
        path: filePathArtifact
      });
      console.log(`[OK] ${col}: ${docs.length} docs (${sizeBytes} bytes)`);
    } catch (e) {
      console.error(`[ERR] Failed to export ${col}:`, e.message);
    }
  }

  console.log('\n=== Export Summary ===');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(console.error);

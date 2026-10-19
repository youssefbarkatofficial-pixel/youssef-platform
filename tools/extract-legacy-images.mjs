import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  const psRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/platform_settings`, {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  const psData = await psRes.json();
  const outDir = path.join(__dirname, '..', 'v2-app', 'public', 'assets', 'images');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const doc of psData.documents || []) {
    const id = doc.name.split('/').pop();
    const val = doc.fields?.value?.stringValue;
    if (val && val.startsWith('data:image/')) {
      const match = val.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const filename = `${id}-legacy.${ext}`;
        const filePath = path.join(outDir, filename);
        fs.writeFileSync(filePath, buffer);
        console.log(`Saved ${id} (${buffer.length} bytes) to ${filename}`);
      }
    }
  }
}

run().catch(console.error);

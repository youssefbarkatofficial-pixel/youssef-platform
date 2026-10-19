import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

async function getAccessToken() {
  const config = JSON.parse(readFileSync('C:/Users/mohammed/.config/configstore/firebase-tools.json', 'utf8'));
  const auth = require('C:/Users/mohammed/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth.js');
  const scopes = typeof config.tokens.scope === 'string' ? config.tokens.scope.split(' ') : [];
  const tokenObj = await auth.getAccessToken(config.tokens.refresh_token, scopes);
  return tokenObj.access_token;
}

async function activateRules() {
  const token = await getAccessToken();
  const projectId = 'youssefbarakatplatform-8abff';
  const now = Date.now();

  const payload = {
    fields: {
      enabled: { booleanValue: true },
      enabledAt: { integerValue: String(now) },
      watchThreshold: { doubleValue: 0.95 },
      updatedAt: { timestampValue: new Date(now).toISOString() }
    }
  };

  console.log(`Activating contentRules at timestamp ${now} (${new Date(now).toISOString()})...`);

  // 1. settings/contentRules
  const url1 = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/contentRules`;
  const res1 = await fetch(url1, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  console.log('1. settings/contentRules write status:', res1.status, res1.statusText);
  const data1 = await res1.json();
  if (data1.error) {
    console.error('Error writing settings/contentRules:', JSON.stringify(data1.error));
  } else {
    console.log('Successfully written settings/contentRules!');
  }

  // 2. platform_settings/contentRules (fallback)
  const url2 = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/platform_settings/contentRules`;
  const res2 = await fetch(url2, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  console.log('2. platform_settings/contentRules write status:', res2.status, res2.statusText);
  const data2 = await res2.json();
  if (data2.error) {
    console.error('Error writing platform_settings/contentRules:', JSON.stringify(data2.error));
  } else {
    console.log('Successfully written platform_settings/contentRules!');
  }
}

activateRules().catch(err => {
  console.error('Fatal error activating rules:', err);
  process.exit(1);
});

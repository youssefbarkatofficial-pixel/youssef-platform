import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

async function getOAuthToken() {
  const configPath = 'C:/Users/mohammed/.config/configstore/firebase-tools.json';
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const apiPath = 'C:/Users/mohammed/AppData/Roaming/npm/node_modules/firebase-tools/lib/api.js';
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

async function run() {
  const token = await getOAuthToken();
  const projectId = 'youssefbarakatplatform-8abff';
  
  // 1. Get releases to find the active ruleset for cloud.firestore
  const releasesRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const releasesData = await releasesRes.json();
  const firestoreRelease = (releasesData.releases || []).find(r => r.name.includes('cloud.firestore'));
  console.log('Active Release Name:', firestoreRelease?.name);
  console.log('Active Ruleset Name:', firestoreRelease?.rulesetName);

  if (firestoreRelease?.rulesetName) {
    const rulesetRes = await fetch(`https://firebaserules.googleapis.com/v1/${firestoreRelease.rulesetName}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const rulesetData = await rulesetRes.json();
    const sourceFiles = rulesetData.source?.files || [];
    const mainRuleFile = sourceFiles.find(f => f.name === 'firestore.rules') || sourceFiles[0];
    
    fs.writeFileSync('tools/live-deployed-rules.txt', mainRuleFile?.content || '', 'utf8');
    console.log(`Saved live deployed rules (${mainRuleFile?.content?.length || 0} chars).`);

    // Extract pushQueue rule from live deployed rules
    const pushQueueMatch = mainRuleFile?.content?.match(/match \/pushQueue\/\{id\} \{[\s\S]*?\n    \}/);
    console.log('\n=== Live Deployed pushQueue Rule: ===');
    console.log(pushQueueMatch ? pushQueueMatch[0] : 'Not Found');
  }
}

run().catch(console.error);

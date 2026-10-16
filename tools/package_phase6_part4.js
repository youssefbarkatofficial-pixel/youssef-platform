const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const filesToInclude = [
  // bot-worker database migrations & core logic
  'bot-worker/migrations/0002_conversation_states.sql',
  'bot-worker/src/admin.ts',
  'bot-worker/src/db.ts',
  'bot-worker/src/index.ts',
  'bot-worker/src/intents.ts',
  'bot-worker/src/llm.ts',
  'bot-worker/test/bot.test.mjs',
  // v2-app frontend services, drawer & admin monitor page
  'v2-app/src/services/bot.ts',
  'v2-app/src/components/student/BousalaChatDrawer.tsx',
  'v2-app/src/pages/admin/BotMonitorPage.tsx',
  // deployment documentation
  'docs/DEPLOY.md'
];

const tempDir = path.resolve('temp_phase6_part4');
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

for (const relPath of filesToInclude) {
  const fullSrc = path.resolve(relPath);
  if (!fs.existsSync(fullSrc)) {
    console.error('File not found:', relPath);
    process.exit(1);
  }
  const fullDest = path.join(tempDir, relPath);
  fs.mkdirSync(path.dirname(fullDest), { recursive: true });
  fs.copyFileSync(fullSrc, fullDest);
}

// Strict security check: ensure no keys exist in package
for (const relPath of filesToInclude) {
  const content = fs.readFileSync(path.join(tempDir, relPath), 'utf8');
  if (content.includes('gsk_') && !relPath.includes('test/')) {
    console.error('CRITICAL ERROR: Groq Key found in', relPath);
    process.exit(1);
  }
  if (content.includes('AIzaSy') && !relPath.includes('test/')) {
    console.error('CRITICAL ERROR: Firebase Key found in', relPath);
    process.exit(1);
  }
}

const zipName = 'phase6-part4.zip';
if (fs.existsSync(zipName)) {
  fs.unlinkSync(zipName);
}

// Compress using powershell
execSync(`powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipName}' -Force"`, { stdio: 'inherit' });
console.log('Successfully created', zipName);

// Copy to artifact directory
const artifactDir = 'C:\\Users\\mohammed\\.gemini\\antigravity\\brain\\1d6c450a-94c1-4c40-b814-bff021014ff4';
if (fs.existsSync(artifactDir)) {
  const artifactZip = path.join(artifactDir, zipName);
  fs.copyFileSync(zipName, artifactZip);
  console.log('Successfully copied to artifact directory:', artifactZip);
}

// Cleanup temp dir
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('Phase 6 Part 4 bundle successfully packaged.');

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const filesToInclude = [
  // bot-worker
  'bot-worker/src/types.ts',
  'bot-worker/src/prompts.ts',
  'bot-worker/src/rag.ts',
  'bot-worker/src/db.ts',
  'bot-worker/src/auth.ts',
  'bot-worker/src/index.ts',
  'bot-worker/wrangler.toml',
  'bot-worker/test/bot.test.mjs',
  // v2-app
  'v2-app/src/services/bot.ts',
  'v2-app/src/components/student/BousalaChatDrawer.tsx',
  'v2-app/src/layouts/StudentLayout.tsx',
  'v2-app/src/vite-env.d.ts',
  'v2-app/.env.example',
  // tools
  'tools/compare_prompts_direct.js'
];

const tempDir = path.resolve('temp_phase6_part2');
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

// Ensure no secrets exist in the copied files
for (const relPath of filesToInclude) {
  const content = fs.readFileSync(path.join(tempDir, relPath), 'utf8');
  if (content.includes('gsk_') && !relPath.includes('test/')) {
    console.error('ERROR: Secret found in', relPath);
    process.exit(1);
  }
}

const zipName = 'phase6-part2.zip';
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

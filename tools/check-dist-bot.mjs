import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../v2-app/dist');

console.log('--- Scanning dist directory for bot references ---');
console.log('Dist directory:', distDir);

const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) walk(full);
    else files.push(full);
  }
}
walk(distDir);

let foundApiBot = 0;
let botUrlMatches = [];

for (const file of files) {
  const rel = path.relative(distDir, file);
  const text = fs.readFileSync(file, 'utf8');

  // Check for api/bot
  if (text.includes('api/bot')) {
    console.log(`[ALERT] Found 'api/bot' in ${rel}`);
    foundApiBot++;
  }

  // Check for workers.dev or bot url
  const idx = text.indexOf('workers.dev');
  if (idx !== -1) {
    const snippet = text.substring(Math.max(0, idx - 50), Math.min(text.length, idx + 80));
    botUrlMatches.push({ file: rel, snippet });
  }
}

console.log(`Total occurrences of 'api/bot': ${foundApiBot}`);
console.log('Bot URL occurrences (production Cloudflare endpoint):');
for (const match of botUrlMatches) {
  console.log(`- File: ${match.file}`);
  console.log(`  Snippet: ...${match.snippet}...`);
}

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const zipPath = 'C:/Users/mohammed/.gemini/antigravity/brain/1d6c450a-94c1-4c40-b814-bff021014ff4/.user_uploaded/media_1792376041250_ba511083.zip';
const targetDir = 'C:/Users/mohammed/.gemini/antigravity/brain/1d6c450a-94c1-4c40-b814-bff021014ff4/extracted_upload';

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

console.log('Zip file exists:', fs.existsSync(zipPath), 'Size:', fs.statSync(zipPath).size);

// Extract using tar or powershell Expand-Archive
try {
  execSync(`powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${targetDir}' -Force"`);
  console.log('Extracted successfully to:', targetDir);
} catch (e) {
  console.error('Extract error:', e.message);
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const s = fs.statSync(full);
    if (s.isDirectory()) {
      walk(full);
    } else {
      console.log(path.relative(targetDir, full), `(${s.size} bytes)`);
    }
  }
}

console.log('\n--- Extracted Files: ---');
walk(targetDir);

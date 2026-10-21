import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const stagingDir = path.join(rootDir, 'staging_bundle');

console.log('Cleaning staging directory...');
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

function copyFile(srcRel, destRel) {
  const src = path.join(rootDir, srcRel);
  const dest = path.join(stagingDir, destRel);
  if (!fs.existsSync(src)) {
    console.warn(`File not found: ${srcRel}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${srcRel} -> ${destRel}`);
}

function copyDir(srcRel, destRel, filterFn = null) {
  const src = path.join(rootDir, srcRel);
  const dest = path.join(stagingDir, destRel);
  if (!fs.existsSync(src)) {
    console.warn(`Directory not found: ${srcRel}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const relPath = path.join(srcRel, entry.name);

    if (filterFn && !filterFn(entry.name, relPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDir(relPath, path.join(destRel, entry.name), filterFn);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Copying root documentation and configuration...');
copyFile('DEVELOPER_README.md', 'DEVELOPER_README.md');
copyFile('DEPLOY-RULES.md', 'DEPLOY-RULES.md');
copyFile('PLATFORM_MASTER_BLUEPRINT.md', 'PLATFORM_MASTER_BLUEPRINT.md');
copyFile('firestore.rules', 'firestore.rules');

console.log('Copying tools...');
copyDir('tools', 'tools', (name) => name !== 'create-bundle.mjs');

console.log('Copying bot-worker...');
copyDir('bot-worker/src', 'bot-worker/src');
copyDir('bot-worker/migrations', 'bot-worker/migrations');
copyFile('bot-worker/schema.sql', 'bot-worker/schema.sql');
copyFile('bot-worker/wrangler.toml', 'bot-worker/wrangler.toml');
copyFile('bot-worker/package.json', 'bot-worker/package.json');
copyFile('bot-worker/package-lock.json', 'bot-worker/package-lock.json');
copyFile('bot-worker/tsconfig.json', 'bot-worker/tsconfig.json');

console.log('Copying v2-app frontend...');
copyDir('v2-app/src', 'v2-app/src');
copyDir('v2-app/public', 'v2-app/public');
copyDir('v2-app/tests', 'v2-app/tests');
copyFile('v2-app/index.html', 'v2-app/index.html');
copyFile('v2-app/package.json', 'v2-app/package.json');
copyFile('v2-app/package-lock.json', 'v2-app/package-lock.json');
copyFile('v2-app/vite.config.ts', 'v2-app/vite.config.ts');
copyFile('v2-app/tsconfig.json', 'v2-app/tsconfig.json');
copyFile('v2-app/tailwind.config.js', 'v2-app/tailwind.config.js');
copyFile('v2-app/postcss.config.js', 'v2-app/postcss.config.js');
copyFile('v2-app/.env.example', 'v2-app/.env.example');
copyFile('v2-app/SEO-MIGRATION.md', 'v2-app/SEO-MIGRATION.md');
copyFile('v2-app/README.md', 'v2-app/README.md');

console.log('Staging complete! Creating zip archive...');

const zipFileName = 'youssef-barakat-platform-full-source.zip';
const targetZip1 = path.join(rootDir, zipFileName);
const targetZip2 = path.join('C:\\Users\\mohammed\\Downloads', zipFileName);
const targetZip3 = path.join('C:\\Users\\mohammed\\.gemini\\antigravity\\brain\\1d6c450a-94c1-4c40-b814-bff021014ff4', zipFileName);

// Remove existing zip files if any
[targetZip1, targetZip2, targetZip3].forEach((z) => {
  if (fs.existsSync(z)) fs.unlinkSync(z);
});

// Use PowerShell to compress stagingDir
const psCmd = `powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${stagingDir}', '${targetZip1}', [System.IO.Compression.CompressionLevel]::Optimal, $false)"`;
console.log('Compressing with .NET ZipFile...');
execSync(psCmd, { stdio: 'inherit' });

console.log(`Created: ${targetZip1} (${(fs.statSync(targetZip1).size / 1024 / 1024).toFixed(2)} MB)`);

// Copy to Downloads & Artifacts
console.log('Copying to Downloads folder...');
fs.copyFileSync(targetZip1, targetZip2);
console.log(`Copied to Downloads: ${targetZip2}`);

console.log('Copying to Artifacts folder...');
fs.copyFileSync(targetZip1, targetZip3);
console.log(`Copied to Artifacts: ${targetZip3}`);

// Clean up staging directory
console.log('Cleaning up staging directory...');
fs.rmSync(stagingDir, { recursive: true, force: true });

console.log('Done! All packages created successfully.');

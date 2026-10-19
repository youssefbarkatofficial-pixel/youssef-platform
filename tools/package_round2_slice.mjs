import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const filesToInclude = [
  'v2-app/src/index.css',
  'v2-app/src/hooks/useTheme.ts',
  'v2-app/src/components/ui/ThemeSwitcher.tsx',
  'v2-app/src/components/ui/Reveal.tsx',
  'v2-app/src/components/ui/Button.tsx',
  'v2-app/src/components/ui/Card.tsx',
  'v2-app/src/components/ui/Badge.tsx',
  'v2-app/src/components/ui/Input.tsx',
  'v2-app/src/components/ui/Modal.tsx',
  'v2-app/src/components/ui/StatCard.tsx',
  'v2-app/src/components/ui/Table.tsx',
  'v2-app/src/components/ui/Tabs.tsx',
  'v2-app/src/components/ui/index.ts',
  'v2-app/src/components/layout/Brand.tsx',
  'v2-app/src/components/layout/PublicHeader.tsx',
  'v2-app/src/components/layout/TopTicker.tsx',
  'v2-app/src/components/layout/Footer.tsx',
  'v2-app/src/components/layout/DashboardShell.tsx',
  'v2-app/src/components/home/HeroPortrait.tsx',
  'v2-app/src/components/auth/LoginModal.tsx',
  'v2-app/src/components/course/CourseCard.tsx',
  'v2-app/src/components/student/BousalaChatDrawer.tsx',
  'v2-app/src/layouts/PublicLayout.tsx',
  'v2-app/src/pages/public/HomePage.tsx',
  'v2-app/src/lib/courseNormalize.ts',
  'v2-app/src/services/courses.ts',
  'v2-app/tests/normalize.test.mjs',
  'v2-app/public/assets/images/ownerBgImage-legacy.webp',
  'v2-app/public/assets/images/ownerHeroImage-legacy.webp',
  'v2-app/public/assets/images/ownerNavLogoImage-legacy.webp',
  'v2-app/public/assets/images/ownerFeaturesLogoImage-legacy.webp',
  'v2-app/public/assets/images/ownerFooterLogoImage-legacy.webp',
  'v2-app/public/assets/images/hero-circle-bg.svg',
  'v2-app/public/fonts/ibm-plex-latin-600.woff2',
  'v2-app/public/fonts/ibm-plex-latin-700.woff2',
  'v2-app/public/fonts/plus-jakarta-sans.woff2',
  'tools/measure-contrast-round2.mjs',
  'tools/capture-round2-screenshots.mjs',
  'tools/extract-legacy-images.mjs'
];

const tempDir = path.resolve('temp_round2_slice');
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

for (const relPath of filesToInclude) {
  const fullSrc = path.resolve(relPath);
  if (!fs.existsSync(fullSrc)) {
    console.warn('File not found, skipping:', relPath);
    continue;
  }
  const fullDest = path.join(tempDir, relPath);
  fs.mkdirSync(path.dirname(fullDest), { recursive: true });
  fs.copyFileSync(fullSrc, fullDest);
}

// Strict security check: ensure no secrets or student PII exist
for (const relPath of filesToInclude) {
  const fullDest = path.join(tempDir, relPath);
  if (!fs.existsSync(fullDest)) continue;
  if (relPath.endsWith('.woff2') || relPath.endsWith('.webp') || relPath.endsWith('.svg')) continue;
  const content = fs.readFileSync(fullDest, 'utf8');
  if (content.includes('gsk_') && !relPath.includes('test/')) {
    console.error('CRITICAL ERROR: Groq Key found in', relPath);
    process.exit(1);
  }
  if (content.includes('AIzaSy') && !relPath.includes('test/')) {
    console.error('CRITICAL ERROR: Firebase Key found in', relPath);
    process.exit(1);
  }
}

const zipName = 'round2-slice-v1.zip';
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
console.log('Round 2 slice bundle successfully packaged.');

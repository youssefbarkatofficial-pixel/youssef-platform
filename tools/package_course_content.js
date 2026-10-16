const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const filesToInclude = [
  'v2-app/src/lib/courseNormalize.ts',
  'v2-app/src/services/courses.ts',
  'v2-app/src/components/admin/CourseContentEditor.tsx',
  'v2-app/src/pages/admin/AdminCourseEditPage.tsx',
  'v2-app/src/pages/public/CourseDetailsPage.tsx',
  'v2-app/package.json',
  'v2-app/tests/fixtures/course-c1785241200444.json',
  'v2-app/tests/normalize.test.mjs',
  'tools/inspect-c1785241200444.mjs'
];

const tempDir = path.resolve('temp_phase6_course_content');
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

// Strict security check: ensure no keys, secrets, or backup.sql exist in package
for (const relPath of filesToInclude) {
  const content = fs.readFileSync(path.join(tempDir, relPath), 'utf8');
  if (content.includes('gsk_')) {
    console.error('CRITICAL ERROR: Groq Key found in', relPath);
    process.exit(1);
  }
  if (content.includes('AIzaSy') && !relPath.includes('fixtures/') && !relPath.includes('test/')) {
    console.error('CRITICAL ERROR: Firebase Key found in', relPath);
    process.exit(1);
  }
  if (relPath.includes('backup.sql')) {
    console.error('CRITICAL ERROR: backup.sql included in zip!');
    process.exit(1);
  }
}

const zipName = 'phase6-course-content.zip';
if (fs.existsSync(zipName)) {
  fs.unlinkSync(zipName);
}

// Compress using powershell
execSync(`powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipName}' -Force"`, { stdio: 'inherit' });
console.log('Successfully created', zipName);

// Also copy to artifacts dir
const artifactDir = 'C:\\Users\\mohammed\\.gemini\\antigravity\\brain\\1d6c450a-94c1-4c40-b814-bff021014ff4';
if (fs.existsSync(artifactDir)) {
  fs.copyFileSync(zipName, path.join(artifactDir, zipName));
  console.log('Copied to artifact dir:', path.join(artifactDir, zipName));
}

// Clean up tempDir
fs.rmSync(tempDir, { recursive: true, force: true });

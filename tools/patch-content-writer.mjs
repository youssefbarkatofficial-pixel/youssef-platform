import fs from 'node:fs';

let code = fs.readFileSync('v2-app/src/services/contentWriter.ts', 'utf8');

code = code.replace(
  /export interface LectureFileDraft\s*\{\s*title:\s*string;\s*url:\s*string;\s*\}/,
  `export interface LectureFileDraft {\n  title: string;\n  url: string;\n  openAt?: number | null;\n  closeAt?: number | null;\n}`
);

code = code.replace(
  /export interface LectureDraft\s*\{\s*title:\s*string;\s*videoUrl:\s*string;\s*files:\s*LectureFileDraft\[\];\s*openAt\?:\s*number\s*\|\s*null;\s*\}/,
  `export interface LectureDraft {\n  title: string;\n  videoUrl: string;\n  files: LectureFileDraft[];\n  openAt?: number | null;\n  closeAt?: number | null;\n}`
);

code = code.replace(
  /openAt:\s*draft\.openAt\s*\?\?\s*null,/,
  `openAt: draft.openAt ?? null,\n        closeAt: draft.closeAt ?? null,`
);

code = code.replace(
  /url:\s*normalizeDriveUrl\(file\.url\),/g,
  `url: normalizeDriveUrl(file.url),\n          openAt: file.openAt ?? null,\n          closeAt: file.closeAt ?? null,`
);

code = code.replace(
  /next\.push\(\{\s*id:\s*newId\('file'\),\s*title:\s*file\.title\.trim\(\)\s*\|\|\s*'ملف المحاضرة',\s*url\s*\}\);/,
  `next.push({ id: newId('file'), title: file.title.trim() || 'ملف المحاضرة', url, openAt: file.openAt ?? null, closeAt: file.closeAt ?? null });`
);

fs.writeFileSync('v2-app/src/services/contentWriter.ts', code);
console.log('contentWriter.ts patched successfully');

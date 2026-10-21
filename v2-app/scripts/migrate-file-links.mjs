// dry-run افتراضي. لا حذف ولا strip هنا عمدًا. مفتاح الخدمة خارج المستودع.
import fs from 'node:fs';
import { extractFileLinks, countLinks, approxBytes, DOC_LIMIT_WARN } from './file-links-lib.mjs';

const WRITE = process.argv.includes('--write');
const LEGACY = process.argv.includes('--include-legacy'); // مش مستحسن: القديمة بتقرا نفس الحقول
const keyFile = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
if (!keyFile) {
  console.error('missing FIREBASE_SERVICE_ACCOUNT_FILE');
  process.exit(1);
}

let admin;
try {
  admin = (await import('firebase-admin')).default;
} catch {
  console.error('firebase-admin is not installed. Run `npm i firebase-admin` in this script environment.');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyFile, 'utf8'))) });
}
const db = admin.firestore();

const snap = await db.collection('courses').get();
let courses = 0, links = 0, skippedLegacy = 0;
const backup = {};

for (const d of snap.docs) {
  const c = d.data();
  if (!LEGACY && c.source !== 'v2') {
    skippedLegacy++;
    continue;
  }
  const map = extractFileLinks(c);
  const n = countLinks(map);
  if (!n) continue;
  courses++;
  links += n;
  const bytes = approxBytes(map);
  if (bytes > DOC_LIMIT_WARN) console.warn(`WARN course ${d.id}: ~${bytes} bytes (قرب حد 1MB)`);
  backup[d.id] = map;
  if (WRITE) {
    await db.doc(`courseFiles/${d.id}`).set({ items: map, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: false });
  }
}

console.log(`courses with links=${courses} links=${links} skippedLegacy=${skippedLegacy} write=${WRITE}`);
if (WRITE) {
  const p = `backup-links-${Date.now()}.json`;
  fs.writeFileSync(p, JSON.stringify(backup));
  console.log('backup written:', p, '(ملف حساس: خارج المستودع، ومضاف لـ .gitignore)');
}
console.log('strip غير موجود في الباتش ده عمدًا؛ يتنفّذ بعد المرحلتين 2 و3 وموافقة يوسف.');

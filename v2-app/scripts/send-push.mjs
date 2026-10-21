import { isQuietHour, categoryAllowed, validateQueueItem } from './push-lib.mjs';

const MAX = Number(process.env.MAX_PER_RUN || 200);
const DRY = process.env.DRY_RUN === '1';
const now = process.env.NOW_OVERRIDE ? new Date(process.env.NOW_OVERRIDE) : new Date();

if (isQuietHour(now)) { console.log('quiet hours, sent=0'); process.exit(0); }
if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.error('missing FIREBASE_SERVICE_ACCOUNT'); process.exit(1); }
const admin = (await import('firebase-admin')).default || (await import('firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

const sw = (await db.doc('settings/notificationSwitches').get()).data() || {};
const snap = await db.collection('pushQueue').where('status', '==', 'pending').limit(MAX).get();
console.log(`pending=${snap.size} (max ${MAX}) dry=${DRY}`);
let sent = 0, skipped = 0, failed = 0;
const mark = (ref, status, extra = {}) => (DRY ? null : ref.update({ status, ...extra }));

for (const d of snap.docs) {
  const q = d.data();
  const bad = validateQueueItem(q);
  if (bad) { console.log(`skip ${d.id}: ${bad}`); await mark(d.ref, 'skipped', { reason: bad }); skipped++; continue; }
  if (!categoryAllowed(q.category, sw)) { await mark(d.ref, 'skipped', { reason: 'category-off' }); skipped++; continue; }
  const tdoc = await db.collection('pushTokens').doc(q.uid).get();
  const t = tdoc.exists ? tdoc.data() : null;
  if (!t || t.enabled !== true || !t.tokens?.length) { await mark(d.ref, 'skipped', { reason: 'no-token' }); skipped++; continue; }
  if (DRY) { console.log(`[dry] would send to ${t.tokens.length} device(s)`); continue; }
  try {
    const res = await admin.messaging().sendEachForMulticast({
      tokens: t.tokens,
      data: { title: String(q.title), body: String(q.body), url: String(q.url || '/student/notifications') },
    });
    const dead = [];
    res.responses.forEach((r, i) => {
      if (!r.success && /registration-token-not-registered|invalid-registration-token/.test(r.error?.code || '')) dead.push(t.tokens[i]);
    });
    if (dead.length) await tdoc.ref.update({ tokens: admin.firestore.FieldValue.arrayRemove(...dead) });
    await mark(d.ref, res.successCount > 0 ? 'sent' : 'failed', { sentAt: admin.firestore.FieldValue.serverTimestamp() });
    res.successCount > 0 ? sent++ : failed++;
  } catch (e) { console.error('send error', e.code || e.message); await mark(d.ref, 'failed'); failed++; }
}
console.log(`sent=${sent} skipped=${skipped} failed=${failed}`);

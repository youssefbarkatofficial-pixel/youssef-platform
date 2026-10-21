// بدون Functions: المكافأة يدوية بموافقة يوسف.
import { doc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { generateCode, normalizeCode } from '../lib/marketing.ts';

/** الطالب بيولّد كوده؛ id المستند = الكود، ownerUid = uid. القواعد بتمنع الكتابة فوق كود موجود. */
export async function createMyCode(uid: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    try {
      await setDoc(doc(db, 'referralCodes', code), { ownerUid: uid, createdAt: serverTimestamp() });
      return code;
    } catch {
      /* تصادم أو رفض: جرّب كود تاني */
    }
  }
  throw new Error('code-generation-failed');
}

/** الطالب الجديد بيستخدم كود صديق: claim واحد لكل uid، حالته pending لحد موافقة يوسف. */
export async function claimCode(uid: string, rawCode: string): Promise<void> {
  const code = normalizeCode(rawCode);
  await runTransaction(db, async (tx) => {
    const codeSnap = await tx.get(doc(db, 'referralCodes', code));
    if (!codeSnap.exists()) throw new Error('invalid-code');
    const ownerUid = codeSnap.data().ownerUid as string;
    if (ownerUid === uid) throw new Error('own-code');
    const claimRef = doc(db, 'referralClaims', uid);
    if ((await tx.get(claimRef)).exists()) throw new Error('already-claimed');
    tx.set(claimRef, { code, ownerUid, status: 'pending', createdAt: serverTimestamp() });
  });
}

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const OWNER_EMAIL = 'youssefbarkatofficial@gmail.com';
const ADMIN_EMAIL = 'fulladmin@student.youssefbarakat.com';
const ASSISTANT_EMAIL = 'assistant@student.youssefbarakat.com';
const ALICE_EMAIL = '01000000001@student.youssefbarakat.com';
const BOB_EMAIL = '01000000002@student.youssefbarakat.com';
const CHARLIE_EMAIL = '01000000003@student.youssefbarakat.com';

let testEnv;

const rulesContent = readFileSync(resolve(process.cwd(), '../firestore.rules'), 'utf8');

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'referral-rules-test',
    firestore: {
      rules: rulesContent,
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

const serverTime = () => firebase.firestore.FieldValue.serverTimestamp();

const aliceDb = () => testEnv.authenticatedContext('alice', { email: ALICE_EMAIL }).firestore();
const bobDb = () => testEnv.authenticatedContext('bob', { email: BOB_EMAIL }).firestore();
const charlieDb = () => testEnv.authenticatedContext('charlie', { email: CHARLIE_EMAIL }).firestore();
const assistantDb = () => testEnv.authenticatedContext('assistantUid', { email: ASSISTANT_EMAIL }).firestore();
const adminDb = () => testEnv.authenticatedContext('adminUid', { email: ADMIN_EMAIL }).firestore();
const ownerDb = () => testEnv.authenticatedContext('ownerUid', { email: OWNER_EMAIL }).firestore();
const anonDb = () => testEnv.unauthenticatedContext().firestore();

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`platformAdmins/${ADMIN_EMAIL}`).set({ role: 'admin', active: true });
    await db.doc(`platformAdmins/${ASSISTANT_EMAIL}`).set({ role: 'assistant', active: true });

    // Seed existing referral code for Alice
    await db.doc('referralCodes/ALICE123').set({
      ownerUid: 'alice',
      createdAt: new Date(),
    });

    // Seed existing claim for charlie
    await db.doc('referralClaims/charlie').set({
      code: 'ALICE123',
      ownerUid: 'alice',
      status: 'pending',
      createdAt: new Date(),
    });
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

describe('Referral Rules (قواعد التسويق الصادق والدعوات)', () => {
  it('1. الطالب ينشئ كود دعوة لنفسه بنجاح (8 أحرف مع serverTimestamp)', async () => {
    await assertSucceeds(
      bobDb().doc('referralCodes/BOBCODE1').set({
        ownerUid: 'bob',
        createdAt: serverTime(),
      })
    );
  });

  it('2. كود الدعوة غير الصالح (أقل من 8 أو رموز) يُرفض', async () => {
    await assertFails(
      bobDb().doc('referralCodes/SHORT').set({
        ownerUid: 'bob',
        createdAt: serverTime(),
      })
    );
    await assertFails(
      bobDb().doc('referralCodes/BAD_CODE!').set({
        ownerUid: 'bob',
        createdAt: serverTime(),
      })
    );
  });

  it('3. طالب لا يستطيع إنشاء كود لحساب شخص آخر', async () => {
    await assertFails(
      aliceDb().doc('referralCodes/BOBCODE2').set({
        ownerUid: 'bob',
        createdAt: serverTime(),
      })
    );
  });

  it('4. كود الدعوة لا يمكن تعديله أو حذفه', async () => {
    await assertFails(
      aliceDb().doc('referralCodes/ALICE123').update({
        ownerUid: 'bob',
      })
    );
    await assertFails(aliceDb().doc('referralCodes/ALICE123').delete());
    await assertFails(adminDb().doc('referralCodes/ALICE123').delete());
  });

  it('5. الطالب المسجل يقرأ الكود للتحقق، بينما الزائر غير المسجل يُمنع', async () => {
    await assertSucceeds(bobDb().doc('referralCodes/ALICE123').get());
    await assertFails(anonDb().doc('referralCodes/ALICE123').get());
  });

  it('6. قائمة الأكواد (list) للأدمن فقط، ممنوعة على الطالب', async () => {
    await assertFails(bobDb().collection('referralCodes').get());
    await assertSucceeds(adminDb().collection('referralCodes').get());
  });

  it('7. طالب (Bob) يطالب بكود Alice بنجاح (حالة pending)', async () => {
    await assertSucceeds(
      bobDb().doc('referralClaims/bob').set({
        code: 'ALICE123',
        ownerUid: 'alice',
        status: 'pending',
        createdAt: serverTime(),
      })
    );
  });

  it('8. طالب يطالب بكود نفسه يُرفض (ownerUid == uid)', async () => {
    await assertFails(
      aliceDb().doc('referralClaims/alice').set({
        code: 'ALICE123',
        ownerUid: 'alice',
        status: 'pending',
        createdAt: serverTime(),
      })
    );
  });

  it('9. تزوير ownerUid عند المطالبة يُرفض عبر التحقق من كود الدعوة في Firestore', async () => {
    // Bob claims ALICE123 but passes charlie as ownerUid
    await assertFails(
      bobDb().doc('referralClaims/bob').set({
        code: 'ALICE123',
        ownerUid: 'charlie',
        status: 'pending',
        createdAt: serverTime(),
      })
    );
  });

  it('10. إنشاء المطالبة بحالة غير pending يُرفض', async () => {
    await assertFails(
      bobDb().doc('referralClaims/bob').set({
        code: 'ALICE123',
        ownerUid: 'alice',
        status: 'approved',
        createdAt: serverTime(),
      })
    );
  });

  it('11. الأدمن الكامل (Senior Admin / Owner) يعتمد أو يرفض المطالبة، والمساعد يُمنع', async () => {
    // Assistant tries to approve -> fails
    await assertFails(
      assistantDb().doc('referralClaims/charlie').update({
        status: 'approved',
      })
    );

    // Senior admin approves -> succeeds
    await assertSucceeds(
      adminDb().doc('referralClaims/charlie').update({
        status: 'approved',
      })
    );

    // Cannot modify other fields during update
    await assertFails(
      adminDb().doc('referralClaims/charlie').update({
        status: 'rejected',
        ownerUid: 'hacked',
      })
    );
  });

  it('12. حذف المطالبات ممنوع على الجميع', async () => {
    await assertFails(bobDb().doc('referralClaims/charlie').delete());
    await assertFails(adminDb().doc('referralClaims/charlie').delete());
  });
});

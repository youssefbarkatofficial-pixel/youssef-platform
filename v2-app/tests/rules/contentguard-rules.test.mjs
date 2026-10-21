import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const OWNER_EMAIL = 'youssefbarkatofficial@gmail.com';
const ADMIN_EMAIL = 'fulladmin@student.youssefbarakat.com';
const ASSISTANT_EMAIL = 'assistant@student.youssefbarakat.com';
const ALICE_EMAIL = '01000000001@student.youssefbarakat.com';
const BOB_EMAIL = '01000000002@student.youssefbarakat.com';

let testEnv;

const rulesContent = readFileSync(resolve(process.cwd(), '../firestore.rules'), 'utf8');

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'contentguard-rules-test',
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

const aliceDb = () => testEnv.authenticatedContext('alice', { email: ALICE_EMAIL }).firestore();
const bobDb = () => testEnv.authenticatedContext('bob', { email: BOB_EMAIL }).firestore();
const assistantDb = () => testEnv.authenticatedContext('assistantUid', { email: ASSISTANT_EMAIL }).firestore();
const adminDb = () => testEnv.authenticatedContext('adminUid', { email: ADMIN_EMAIL }).firestore();
const ownerDb = () => testEnv.authenticatedContext('ownerUid', { email: OWNER_EMAIL }).firestore();
const anonDb = () => testEnv.unauthenticatedContext().firestore();

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`platformAdmins/${ADMIN_EMAIL}`).set({ role: 'admin', active: true });
    await db.doc(`platformAdmins/${ASSISTANT_EMAIL}`).set({ role: 'assistant', active: true });

    // Seed courses
    await db.doc('courses/course_paid').set({
      title: 'كورس مدفوع',
      isFree: false,
    });
    await db.doc('courses/course_free').set({
      title: 'كورس مجاني',
      isFree: true,
    });

    // Seed students: Alice enrolled in course_paid, Bob has no courses
    await db.doc('students/alice').set({
      name: 'Alice Student',
      email: ALICE_EMAIL,
      role: 'student',
      courses: ['course_paid'],
      lastUpdatedAcademicYear: 2026,
    });
    await db.doc('students/bob').set({
      name: 'Bob Student',
      email: BOB_EMAIL,
      role: 'student',
      courses: [],
      lastUpdatedAcademicYear: 2026,
    });

    // Seed courseFiles
    await db.doc('courseFiles/course_paid').set({
      items: {
        lec1: { pdfUrl: 'https://drive.google.com/paid.pdf', files: [] },
      },
    });
    await db.doc('courseFiles/course_free').set({
      items: {
        lec1: { pdfUrl: 'https://drive.google.com/free.pdf', files: [] },
      },
    });
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

describe('Content Guard Rules (حماية روابط الملفات)', () => {
  it('1. طالب مشترك (Alice) يقرأ روابط ملفات الكورس المشترك به بنجاح', async () => {
    await assertSucceeds(aliceDb().doc('courseFiles/course_paid').get());
  });

  it('2. طالب غير مشترك (Bob) يُمنع من قراءة روابط ملفات الكورس المدفوع (permission-denied)', async () => {
    await assertFails(bobDb().doc('courseFiles/course_paid').get());
  });

  it('3. طالب مسجل يقرأ روابط ملفات الكورس المجاني حتى لو لم يشترك', async () => {
    await assertSucceeds(bobDb().doc('courseFiles/course_free').get());
  });

  it('4. مستخدم غير مسجل (زائر عام) يُمنع من قراءة ملفات أي كورس', async () => {
    await assertFails(anonDb().doc('courseFiles/course_paid').get());
    await assertFails(anonDb().doc('courseFiles/course_free').get());
  });

  it('5. الأدمن يقرأ ويحصل على قائمة ملفات الكورسات (list)', async () => {
    await assertSucceeds(adminDb().doc('courseFiles/course_paid').get());
    await assertSucceeds(adminDb().collection('courseFiles').get());
    await assertFails(aliceDb().collection('courseFiles').get());
  });

  it('6. الأدمن يُنشئ ويُعدّل روابط ملفات الكورس', async () => {
    await assertSucceeds(
      adminDb().doc('courseFiles/course_new').set({
        items: {
          lec1: { pdfUrl: 'https://drive.google.com/new.pdf', files: [] },
        },
      })
    );
    await assertSucceeds(
      adminDb().doc('courseFiles/course_new').update({
        'items.lec2': { pdfUrl: 'https://drive.google.com/new2.pdf', files: [] },
      })
    );
  });

  it('7. طالب لا يستطيع إنشاء أو تعديل روابط ملفات الكورس', async () => {
    await assertFails(
      aliceDb().doc('courseFiles/course_paid').set({
        items: {},
      })
    );
    await assertFails(
      aliceDb().doc('courseFiles/course_paid').update({
        items: {},
      })
    );
  });

  it('8. حذف مستندات روابط الملفات ممنوع على الجميع (حتى الأدمن)', async () => {
    await assertFails(aliceDb().doc('courseFiles/course_paid').delete());
    await assertFails(adminDb().doc('courseFiles/course_paid').delete());
    await assertFails(ownerDb().doc('courseFiles/course_paid').delete());
  });
});

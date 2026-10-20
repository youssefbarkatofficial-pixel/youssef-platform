import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

// Set emulator host environment variable
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
    projectId: 'radar-v2-rules-test',
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

    // Setup platform admins
    await db.doc(`platformAdmins/${ADMIN_EMAIL}`).set({ role: 'admin', active: true });
    await db.doc(`platformAdmins/${ASSISTANT_EMAIL}`).set({ role: 'assistant', active: true });

    // Setup Alice student (enrolled in course1)
    await db.doc('students/alice').set({
      name: 'Alice Student',
      phone: '01000000001',
      parentPhone: '01099999999',
      grade: 'prep1',
      gov: 'القاهرة',
      studentCode: 'YB-ALICE123',
      email: ALICE_EMAIL,
      role: 'student',
      courses: ['course1'],
      notifications: [],
      xp: 0,
      points: 0,
      badges: [],
      lastUpdatedAcademicYear: 2026,
      examResults: [],
      watchProgress: { lec1: 50 },
      downloadedFilesCount: 1,
    });

    // Setup Bob student (enrolled in course2)
    await db.doc('students/bob').set({
      name: 'Bob Student',
      phone: '01000000002',
      parentPhone: '01088888888',
      grade: 'prep1',
      gov: 'الجيزة',
      studentCode: 'YB-BOB456',
      email: BOB_EMAIL,
      role: 'student',
      courses: ['course2'],
      notifications: [],
      xp: 0,
      points: 0,
      badges: [],
      lastUpdatedAcademicYear: 2026,
      examResults: [],
      watchProgress: {},
      downloadedFilesCount: 0,
    });

    // Setup course1
    await db.doc('courses/course1').set({
      id: 'course1',
      title: 'الجغرافيا للثانوية العامة',
      hidden: false,
      isFree: false,
      source: 'v2',
      image: '',
      contents: { sections: [] },
    });
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

describe('قواعد الأمان الصارمة - رادار الطلاب v2 (Literal Rules Tests)', () => {

  // 1. اختبارات تحميل المذكرات (downloadClicks)
  it('1.1 طالب لا يكتب downloadClick لطالب آخر', async () => {
    // Alice trying to write downloadClick under Bob
    await assertFails(
      aliceDb().doc('students/bob/downloadClicks/file1').set({
        courseId: 'course2',
        lectureId: 'lec1',
        fileId: 'file1',
        clickedAt: new Date(),
      })
    );
  });

  it('1.2 طالب لا يكتب downloadClick لكورس غير مشترك فيه', async () => {
    // Alice is enrolled in course1, trying to record download for course2
    await assertFails(
      aliceDb().doc('students/alice/downloadClicks/file2').set({
        courseId: 'course2',
        lectureId: 'lec1',
        fileId: 'file2',
        clickedAt: new Date(),
      })
    );
  });

  it('1.3 طالب يكتب downloadClick بنجاح لكورس مشترك فيه', async () => {
    await assertSucceeds(
      aliceDb().doc('students/alice/downloadClicks/file1').set({
        courseId: 'course1',
        lectureId: 'lec1',
        fileId: 'file1',
        clickedAt: new Date(),
      })
    );
  });

  // 2. اختبارات الإشعارات العامة (broadcast_notifications)
  it('2.1 طالب لا ينشئ إشعار بث عام', async () => {
    await assertFails(
      aliceDb().collection('broadcast_notifications').add({
        title: 'إشعار غير مصرح به',
        message: 'رسالة من طالب',
        category: 'platformUpdates',
        targetType: 'all',
        sentBy: ALICE_EMAIL,
        createdAt: new Date(),
      })
    );
  });

  it('2.2 الأدمن ينشئ إشعار بث عام بنجاح', async () => {
    await assertSucceeds(
      adminDb().collection('broadcast_notifications').add({
        title: 'تنبيه هام للجميع',
        message: 'تم رفع المحاضرة الجديدة الآن بالتوفيق لجميع الطلاب',
        category: 'curriculumUpdates',
        targetType: 'all',
        sentBy: ADMIN_EMAIL,
        createdAt: new Date(),
      })
    );
  });

  it('2.3 رفض إشعار البث لو احتوى على رقم هاتف', async () => {
    await assertFails(
      adminDb().collection('broadcast_notifications').add({
        title: 'تنبيه خاطئ',
        message: 'اتصل بنا على 01012345678 للاستفسار',
        category: 'curriculumUpdates',
        targetType: 'all',
        sentBy: ADMIN_EMAIL,
        createdAt: new Date(),
      })
    );
  });

  it('2.4 المساعد لا يعدل ولا يحذف إشعارات البث العام', async () => {
    // First seed a broadcast doc
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('broadcast_notifications/notif1').set({
        title: 'إشعار سابق',
        message: 'نص الإشعار السابق للجميع',
        category: 'platformUpdates',
        targetType: 'all',
        sentBy: OWNER_EMAIL,
      });
    });

    // Assistant tries to update or delete -> FAILS
    await assertFails(assistantDb().doc('broadcast_notifications/notif1').update({ title: 'تعديل مساعد' }));
    await assertFails(assistantDb().doc('broadcast_notifications/notif1').delete());

    // Senior Admin / Owner CAN update/delete
    await assertSucceeds(adminDb().doc('broadcast_notifications/notif1').update({ title: 'تعديل مصرح به للأدمن' }));
    await assertSucceeds(ownerDb().doc('broadcast_notifications/notif1').delete());
  });

  // 3. اختبارات مفاتيح التحكم المركزية (notificationSwitches)
  it('3.1 طالب لا يغيّر مفاتيح الإشعارات في settings', async () => {
    await assertFails(
      aliceDb().doc('settings/notificationSwitches').set({
        platformUpdates: false,
        curriculumUpdates: false,
        laggingWarnings: false,
      })
    );
  });

  it('3.2 الأدمن يغيّر مفاتيح الإشعارات بنجاح', async () => {
    await assertSucceeds(
      adminDb().doc('settings/notificationSwitches').set({
        platformUpdates: true,
        curriculumUpdates: true,
        laggingWarnings: true,
      })
    );
  });

  // 4. اختبارات تقدم المشاهدة والنشاط للطالب القديم والجديد
  it('4.1 طالب يكتب watchProgress و lastActiveMs ضمن الحدود', async () => {
    const now = Date.now();
    await assertSucceeds(
      aliceDb().doc('students/alice').update({
        'watchProgress.lec2': 90,
        lastActiveMs: now,
        downloadedFilesCount: 2,
      })
    );
  });

  it('4.2 رفض lastActiveMs خارج الحدود (في المستقبل بأكثر من دقيقة)', async () => {
    const futureTime = Date.now() + 5 * 60 * 1000; // 5 minutes in future
    await assertFails(
      aliceDb().doc('students/alice').update({
        lastActiveMs: futureTime,
      })
    );
  });

  it('4.3 رفض downloadedFilesCount بالسالب', async () => {
    await assertFails(
      aliceDb().doc('students/alice').update({
        downloadedFilesCount: -1,
      })
    );
  });

  // 5. قاعدة عدم تناقص نسبة المشاهدة (Monotonic Non-Decreasing Coverage)
  it('5.1 قاعدة عدم تناقص نسبة المشاهدة: رفض كتابة نسبة أقل وقبول نسبة أعلى', async () => {
    // Seed initial watchProgress in subcollection: coverage = 0.8
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('students/alice/watchProgress/lec1').set({
        itemId: 'lec1',
        totalDuration: 1000,
        coveredSeconds: 800,
        coverage: 0.8,
        intervals: [{ start: 0, end: 800 }],
        lastPosition: 800,
        completed: false,
      });
    });

    // Try to decrease coverage to 0.5 -> MUST FAIL!
    await assertFails(
      aliceDb().doc('students/alice/watchProgress/lec1').set({
        itemId: 'lec1',
        totalDuration: 1000,
        coveredSeconds: 500,
        coverage: 0.5,
        intervals: [{ start: 0, end: 500 }],
        lastPosition: 500,
        completed: false,
      }, { merge: true })
    );

    // Try to increase coverage to 0.95 -> MUST SUCCEED!
    await assertSucceeds(
      aliceDb().doc('students/alice/watchProgress/lec1').set({
        itemId: 'lec1',
        totalDuration: 1000,
        coveredSeconds: 950,
        coverage: 0.95,
        intervals: [{ start: 0, end: 950 }],
        lastPosition: 950,
        completed: true,
      }, { merge: true })
    );
  });

  // 6. اختبارات قواعد Web Push (pushTokens و pushQueue)
  it('6.1 طالب يكتب pushTokens لنفسه بنجاح', async () => {
    await assertSucceeds(
      aliceDb().doc('pushTokens/alice').set({
        tokens: ['token_abc123'],
        enabled: true,
        updatedAt: new Date(),
      })
    );
  });

  it('6.2 طالب لا يكتب pushTokens لطالب آخر', async () => {
    await assertFails(
      aliceDb().doc('pushTokens/bob').set({
        tokens: ['token_hacked'],
        enabled: true,
        updatedAt: new Date(),
      })
    );
  });

  it('6.3 طالب لا يكتب في pushQueue', async () => {
    await assertFails(
      aliceDb().collection('pushQueue').add({
        uid: 'alice',
        category: 'platformUpdates',
        title: 'رسالة غير مصرحة',
        body: 'نص',
        status: 'pending',
        createdAt: new Date(),
      })
    );
  });

  it('6.4 الأدمن ينشئ عنصراً في pushQueue بنجاح', async () => {
    await assertSucceeds(
      adminDb().collection('pushQueue').add({
        uid: 'alice',
        category: 'curriculumUpdates',
        title: 'تنبيه درس جديد',
        body: 'تم رفع درس الجغرافيا الجديد بالتوفيق',
        status: 'pending',
        createdAt: new Date(),
      })
    );
  });

  it('6.5 رفض عنصر pushQueue لو احتوى النص على رقم هاتف', async () => {
    await assertFails(
      adminDb().collection('pushQueue').add({
        uid: 'alice',
        category: 'curriculumUpdates',
        title: 'تنبيه خاطئ',
        body: 'تواصل معنا على 01012345678',
        status: 'pending',
        createdAt: new Date(),
      })
    );
  });
});

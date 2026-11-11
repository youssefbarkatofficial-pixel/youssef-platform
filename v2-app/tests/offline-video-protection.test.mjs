import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  canUseOfflineVideoCache,
  buildScopedVideoCacheKey,
} from '../src/lib/videoCache.ts';
import {
  saveEntitlements,
  clearEntitlements,
  canAccessCourseOffline,
  OFFLINE_GRACE_MS,
} from '../src/lib/entitlementCache.ts';
import {
  getStudentEnrollmentTimestamp,
  isStudentExempt,
  getDetailedLectureLock,
  getAssessmentPrerequisiteDiagnostics,
} from '../src/lib/contentRules.ts';

test('1. السماح بحفظ وتشغيل الفيديو المباشر (file) من الكاش فقط عند اكتمال المشاهدة وسريان الاشتراك', () => {
  const now = 1700000000000;
  const ok = canUseOfflineVideoCache({
    videoKind: 'file',
    completed: true,
    coverage: 0.96,
    hasAccess: true,
    archived: false,
    isAdmin: false,
    expiresAt: now + 86400000,
    now,
  });

  assert.equal(ok.eligibleToCache, true);
  assert.equal(ok.eligibleToPlay, true);
  assert.equal(ok.shouldEvict, false);
});

test('2. منع الحفظ والتشغيل أوفلاين قبل إتمام الحصة (أقل من 95%)', () => {
  const res = canUseOfflineVideoCache({
    videoKind: 'file',
    completed: false,
    coverage: 0.6,
    hasAccess: true,
    archived: false,
    isAdmin: false,
  });

  assert.equal(res.eligibleToCache, false);
  assert.equal(res.eligibleToPlay, false);
  assert.equal(res.shouldEvict, false);
});

test('3. إغلاق وحذف كاش الفيديو فوراً عند انتهاء صلاحية الاشتراك أو الأرشفة أو سحب الصلاحية', () => {
  const now = 1700000000000;

  const expired = canUseOfflineVideoCache({
    videoKind: 'file',
    completed: true,
    coverage: 1,
    hasAccess: true,
    archived: false,
    isAdmin: false,
    expiresAt: now - 1000,
    now,
  });
  assert.equal(expired.eligibleToPlay, false);
  assert.equal(expired.shouldEvict, true);

  const revoked = canUseOfflineVideoCache({
    videoKind: 'file',
    completed: true,
    coverage: 1,
    hasAccess: false,
    archived: false,
    isAdmin: false,
  });
  assert.equal(revoked.eligibleToPlay, false);
  assert.equal(revoked.shouldEvict, true);
});

test('4. عدم تخزين فيديوهات YouTube/Vimeo في الكاش بسبب قيود CORS/iframe', () => {
  const yt = canUseOfflineVideoCache({
    videoKind: 'youtube',
    completed: true,
    coverage: 1,
    hasAccess: true,
    archived: false,
    isAdmin: false,
  });
  assert.equal(yt.eligibleToCache, false);
  assert.equal(yt.eligibleToPlay, false);
});

test('5. عزل مفاتيح الكاش حسب معرف الطالب والكورس والمحاضرة لمنع التسرب بين الحسابات', () => {
  const k1 = buildScopedVideoCacheKey('stu_A', 'c_1', 'lec_1');
  const k2 = buildScopedVideoCacheKey('stu_B', 'c_1', 'lec_1');
  assert.notEqual(k1, k2);
  assert.match(k1, /^\/__yb_offline_video__\//);
});

test('6. التحقق من درع منع الشير وزر المشاركة في ProtectedVideoPlayer', () => {
  const playerCode = readFileSync(
    new URL('../src/components/course/ProtectedVideoPlayer.tsx', import.meta.url),
    'utf8',
  );
  assert.match(playerCode, /controls:\s*0/);
  assert.match(playerCode, /disablekb:\s*1/);
  assert.match(playerCode, /fs:\s*0/);
  assert.match(playerCode, /iv_load_policy:\s*3/);
  assert.match(playerCode, /youtube-nocookie\.com/);
  assert.match(playerCode, /pointer-events-none/);
  assert.match(playerCode, /requestFullscreen/);
});

test('7. التحقق من تفعيل persistentLocalCache في اعدادات Firebase', () => {
  const fbCode = readFileSync(new URL('../src/lib/firebase.ts', import.meta.url), 'utf8');
  assert.match(fbCode, /persistentLocalCache/);
  assert.match(fbCode, /persistentMultipleTabManager/);
  assert.match(fbCode, /100 \* 1024 \* 1024/);
});

test('8. بوابة صلاحيات الأوفلاين: التحقق من المدة ومنع تلاعب تغيير ساعة الهاتف والمسح عند الخروج', () => {
  const store = new Map();
  const prevStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };

  try {
    const t0 = Date.now();
    saveEntitlements('stu_offline', {
      c_perm: { expiresAt: null },
      c_monthly: { expiresAt: t0 + 3 * 24 * 60 * 60 * 1000 },
    });

    assert.equal(canAccessCourseOffline('stu_offline', 'c_perm', t0 + 1000), true);
    assert.equal(canAccessCourseOffline('stu_offline', 'c_monthly', t0 + 1000), true);
    assert.equal(canAccessCourseOffline('stu_offline', 'c_other', t0 + 1000), false);
    assert.equal(canAccessCourseOffline('other_uid', 'c_perm', t0 + 1000), false);

    // بعد انتهاء الاشتراك الشهري يغلق فوراً أوفلاين
    assert.equal(
      canAccessCourseOffline('stu_offline', 'c_monthly', t0 + 4 * 24 * 60 * 60 * 1000),
      false,
    );

    // تجاوز مهلة الـ 7 أيام بدون اتصال يغلق الوصول
    assert.equal(canAccessCourseOffline('stu_offline', 'c_perm', t0 + OFFLINE_GRACE_MS + 1000), false);

    // إعادة ساعة الجهاز للخلف أكثر من 5 دقائق يرفض الوصول فوراً
    assert.equal(canAccessCourseOffline('stu_offline', 'c_perm', t0 - 10 * 60 * 1000), false);

    // مسح الصلاحيات عند تسجيل الخروج
    clearEntitlements();
    assert.equal(canAccessCourseOffline('stu_offline', 'c_perm', t0 + 1000), false);
  } finally {
    if (prevStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevStorage;
  }
});


test('9. التعرف على تواريخ التسجيل الفعلية (createdAtMs و accessGrants و trials) في قواعد المحتوى', () => {
  const rules = { enabled: true, enabledAt: 1750000000000, watchThreshold: 0.95 };

  const liveStudent = {
    id: 'stu_live',
    createdAtMs: 1750005000000,
    courses: ['c1'],
    accessGrants: {
      c1: { plan: 'trial_lecture', grantedAt: 1750006000000 },
    },
  };
  assert.equal(getStudentEnrollmentTimestamp(liveStudent, 'c1'), 1750006000000);
  assert.equal(isStudentExempt(liveStudent, rules, 'c1', false), false);

  const trialClaimStudent = {
    id: 'stu_trial',
    createdAtMs: 1750001000000,
    progress: {
      trials: {
        c1: { claimedAt: 1750007000000, lectureId: 'lec_5' },
      },
    },
  };
  assert.equal(getStudentEnrollmentTimestamp(trialClaimStudent, 'c1'), 1750007000000);
  assert.equal(isStudentExempt(trialClaimStudent, rules, 'c1', false), false);
});

test('10. تشخيص سبب القفل الدقيق والمرتبط بإحصائيات الطالب لكل عنصر واختبار بدون رسائل عامة', () => {
  const rules = { enabled: true, enabledAt: 1750000000000, watchThreshold: 0.95 };
  const student = {
    id: 'stu_1',
    createdAtMs: 1750001000000,
    enrolledCourses: { c1: { enrolledAt: 1750002000000 } },
  };
  const course = {
    id: 'c1',
    content: {
      lectures: [
        {
          id: 'lec_1',
          order: 1,
          title: 'الدرس الأول',
          trainings: [{ id: 'tr_1', title: 'تدريب 1' }],
          homeworks: [{ id: 'hw_1', title: 'واجب 1' }],
        },
        {
          id: 'lec_2',
          order: 2,
          title: 'الدرس الثاني',
          trainings: [{ id: 'tr_2', title: 'تدريب 2' }],
          homeworks: [{ id: 'hw_2', title: 'واجب 2' }],
        },
      ],
      homeworks: [],
      exams: [
        {
          id: 'ex_2',
          title: 'امتحان الدرس الثاني',
          raw: { lectureId: 'lec_2' },
        },
      ],
    },
  };

  // 1) مشاهدة 40% + التدريب والواجب لم يُحلا -> تظهر النسبة 40% من 95% + التدريب + الواجب بالاسم
  const partialDiag = getAssessmentPrerequisiteDiagnostics({
    course,
    assessment: { id: 'ex_2', title: 'امتحان الدرس الثاني', kind: 'exam', raw: { lectureId: 'lec_2' } },
    student,
    watchProgress: { lec_1: 96, lec_2: 40 },
    examResults: [{ assessmentId: 'tr_1' }, { assessmentId: 'hw_1' }],
    rules,
  });
  assert.equal(partialDiag.locked, true);
  assert.match(partialDiag.message, /40% من 95%/);
  assert.match(partialDiag.message, /تدريب 2/);
  assert.match(partialDiag.message, /واجب 2/);

  // 2) شاهد 96% وحل الواجب لكنه لم يحل التدريب -> يذكر التدريب فقط دون الواجب أو الفيديو
  const onlyTrDiag = getAssessmentPrerequisiteDiagnostics({
    course,
    assessment: { id: 'ex_2', title: 'امتحان الدرس الثاني', kind: 'exam', raw: { lectureId: 'lec_2' } },
    student,
    watchProgress: { lec_1: 96, lec_2: 96 },
    examResults: [{ assessmentId: 'tr_1' }, { assessmentId: 'hw_1' }, { assessmentId: 'hw_2' }],
    rules,
  });
  assert.equal(onlyTrDiag.locked, true);
  assert.match(onlyTrDiag.message, /تدريب 2/);
  assert.doesNotMatch(onlyTrDiag.message, /واجب 2/);
  assert.doesNotMatch(onlyTrDiag.message, /مشاهدة فيديو/);

  // 3) المحاضرة السابقة ناقص منها الواجب فقط -> يذكر واجب المحاضرة السابقة بالاسم دون رسالة عامة
  const lec2LockOnlyHw = getDetailedLectureLock(
    course,
    1,
    student,
    { lec_1: 96 },
    [{ assessmentId: 'tr_1' }],
    rules,
  );
  assert.equal(lec2LockOnlyHw.locked, true);
  assert.match(lec2LockOnlyHw.message || '', /واجب 1/);
  assert.doesNotMatch(lec2LockOnlyHw.message || '', /متأخرات/);
  assert.doesNotMatch(lec2LockOnlyHw.message || '', /وحل تدريبها/);

  // 4) طالب التجريبي على الدرس الثاني (#2 فقط) لا يتحجب بسبب الدرس #1 الممنوع، لكن امتحانه يتطلب مشاهدة #2
  const trialDiag = getAssessmentPrerequisiteDiagnostics({
    course,
    assessment: { id: 'ex_2', title: 'امتحان الدرس الثاني', kind: 'exam', raw: { lectureId: 'lec_2' } },
    student,
    watchProgress: { lec_2: 0 },
    examResults: [],
    rules,
    grantStatus: { hasAccess: true, plan: 'trial_lecture', targetLectureId: 'lec_2', targetLectureOrder: 2 },
  });
  assert.equal(trialDiag.locked, true);
  assert.match(trialDiag.message, /0% من 95%/);
  assert.doesNotMatch(trialDiag.message, /الدرس الأول/);

  // 5) إكمال كل المتطلبات -> يفتح الاختبار
  const openDiag = getAssessmentPrerequisiteDiagnostics({
    course,
    assessment: { id: 'ex_2', title: 'امتحان الدرس الثاني', kind: 'exam', raw: { lectureId: 'lec_2' } },
    student,
    watchProgress: { lec_1: 96, lec_2: 97 },
    examResults: [
      { assessmentId: 'tr_1' },
      { assessmentId: 'hw_1' },
      { assessmentId: 'tr_2' },
      { assessmentId: 'hw_2' },
    ],
    rules,
  });
  assert.equal(openDiag.locked, false);
  assert.equal(openDiag.missingItems.length, 0);
});

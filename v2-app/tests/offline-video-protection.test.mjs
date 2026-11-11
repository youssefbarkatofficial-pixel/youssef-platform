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

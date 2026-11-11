import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  canUseOfflineVideoCache,
  buildScopedVideoCacheKey,
} from '../src/lib/videoCache.ts';

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
});

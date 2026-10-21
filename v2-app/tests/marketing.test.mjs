import test from 'node:test';
import assert from 'node:assert/strict';
import { upgradeMessage, winBackMessage, inviteMessage, isFreePreview, generateCode, normalizeCode } from '../src/lib/marketing.ts';

test('القوالب بتملا المتغيرات من غير أرقام مخترعة', () => {
  const m = upgradeMessage('طالب تجريبي', '17 من 20', 'https://example.test/c');
  assert.ok(m.includes('طالب تجريبي') && m.includes('17 من 20') && !m.includes('{'));
  assert.ok(!winBackMessage('س', 'الدرس الأول').includes('{'));
  assert.ok(inviteMessage('ABCD2345').includes('ABCD2345'));
  assert.ok(!/01[0-9]{9}/.test(m)); // نفس قيد قواعد الإشعارات
});
test('freePreview صريح فقط', () => {
  assert.equal(isFreePreview({ freePreview: true }), true);
  assert.equal(isFreePreview({ freePreview: 'true' }), false);
  assert.equal(isFreePreview({}), false);
});
test('كود الدعوة', () => {
  const c = generateCode(8, () => 0);
  assert.equal(c.length, 8);
  assert.match(generateCode(), /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(normalizeCode(' ab-cd 23 '), 'ABCD23');
});

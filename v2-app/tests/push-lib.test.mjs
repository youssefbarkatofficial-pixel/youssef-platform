import test from 'node:test';
import assert from 'node:assert/strict';
import { isQuietHour, categoryAllowed, hasPhoneNumber, validateQueueItem } from '../scripts/push-lib.mjs';

test('ساعات الصمت بتوقيت القاهرة (UTC+3 صيفي / UTC+2 شتوي)', () => {
  assert.equal(isQuietHour(new Date('2026-07-01T20:30:00Z')), true);   // 11:30م القاهرة (صيفي)
  assert.equal(isQuietHour(new Date('2026-07-01T07:00:00Z')), false);  // 10:00ص
  assert.equal(isQuietHour(new Date('2026-07-01T04:00:00Z')), true);   // 7:00ص
  assert.equal(isQuietHour(new Date('2026-07-01T05:00:00Z')), false);  // 8:00ص
});
test('الفئات والمفاتيح', () => {
  assert.equal(categoryAllowed('laggingWarnings', { laggingWarnings: false }), false);
  assert.equal(categoryAllowed('platformUpdates', {}), true);
  assert.equal(categoryAllowed('other', {}), false);
});
test('أرقام الهاتف والتحقق', () => {
  assert.equal(hasPhoneNumber('كلمني 01012345678'), true);
  assert.equal(validateQueueItem({ uid: 'u1', category: 'platformUpdates', title: 'مرحبا', body: 'نص' }), null);
  assert.equal(validateQueueItem({ uid: 'u1', category: 'platformUpdates', title: 'x', body: '01012345678' }), 'phone-in-text');
  assert.equal(validateQueueItem({ uid: '', category: 'platformUpdates', title: 'x', body: 'y' }), 'no-uid');
});

import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage in globalThis for testing studentPasswords
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new LocalStorageMock();
globalThis.window = globalThis;

const {
  getStoredAdminPassword,
  setStoredAdminPassword,
  resolveStudentPassword,
} = await import('../src/lib/studentPasswords.ts');

test('resolveStudentPassword returns plainPassword if present and valid', () => {
  const student = {
    id: 'uid_1',
    phone: '01012345678',
    plainPassword: 'my_secret_pass',
  };
  assert.equal(resolveStudentPassword(student), 'my_secret_pass');
});

test('resolveStudentPassword falls back to phone if plainPassword is undefined', () => {
  const student = {
    id: 'uid_2',
    phone: '01098765432',
  };
  assert.equal(resolveStudentPassword(student), '01098765432');
});

test('resolveStudentPassword falls back to phone if plainPassword is "مخفية"', () => {
  const student = {
    id: 'uid_3',
    phone: '01234567890',
    plainPassword: 'مخفية',
  };
  assert.equal(resolveStudentPassword(student), '01234567890');
});

test('admin override takes precedence over plainPassword and phone', () => {
  const student = {
    id: 'uid_4',
    phone: '01112223334',
    plainPassword: 'old_pass',
  };
  setStoredAdminPassword(student.id, 'admin_new_pass_999', student.phone);
  assert.equal(resolveStudentPassword(student), 'admin_new_pass_999');
  assert.equal(getStoredAdminPassword(student.phone), 'admin_new_pass_999');
});

test('reading from legacy strictUsers in localStorage', () => {
  globalThis.localStorage.setItem('strictUsers', JSON.stringify([
    { phone: '01555555555', password: 'legacy_strict_pass' }
  ]));
  const student = {
    id: 'uid_5',
    phone: '01555555555',
  };
  assert.equal(resolveStudentPassword(student), 'legacy_strict_pass');
});

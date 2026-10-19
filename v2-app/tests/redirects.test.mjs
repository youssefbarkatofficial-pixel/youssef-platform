import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const redirectsPath = resolve(__dirname, '../public/_redirects');

describe('Cloudflare Pages _redirects Verification', () => {
  it('1. ملف _redirects موجود وغير فارغ', () => {
    assert.ok(existsSync(redirectsPath), 'ملف _redirects يجب أن يكون موجوداً في public/');
    const content = readFileSync(redirectsPath, 'utf8').trim();
    assert.ok(content.length > 50, 'ملف _redirects يجب ألا يكون فارغاً');
  });

  it('2. فحص صياغة كل سطر في _redirects (source target status)', () => {
    const lines = readFileSync(redirectsPath, 'utf8').split('\n');
    const rules = [];

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const parts = line.split(/\s+/);
      assert.ok(parts.length >= 2, `سطر غير صالح: ${line}`);
      const source = parts[0];
      const target = parts[1];
      const status = parts[2] ? parseInt(parts[2], 10) : 302;
      assert.ok([200, 301, 302].includes(status), `كود تحويل غير صالح (${status}) في السطر: ${line}`);
      assert.ok(source.startsWith('/') || source.startsWith('/*'), `المصدر يجب أن يبدأ بـ /: ${source}`);
      assert.ok(target.startsWith('/') || target.startsWith('http'), `الهدف يجب أن يبدأ بـ / أو http: ${target}`);
      rules.push({ source, target, status });
    }

    assert.ok(rules.length >= 20, `يجب أن يحتوي الملف على الأقل على 20 قاعدة تحويل (الحالي: ${rules.length})`);
  });

  it('3. قاعدة الـ SPA الشاملة موجودة كآخر سطر وبكود 200', () => {
    const lines = readFileSync(redirectsPath, 'utf8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'));

    const lastRule = lines[lines.length - 1];
    const parts = lastRule.split(/\s+/);
    assert.equal(parts[0], '/*', 'آخر قاعدة يجب أن تطابق جميع المسارات /*');
    assert.equal(parts[1], '/index.html', 'الهدف يجب أن يكون /index.html');
    assert.equal(parts[2], '200', 'كود الحالة يجب أن يكون 200 (Rewrite)');
  });

  it('4. محاكاة التحويلات للمسارات القديمة الشائعة والتأكد من وجهاتها', () => {
    const content = readFileSync(redirectsPath, 'utf8');
    const expectedMappings = {
      '/index.html': { target: '/', status: 301 },
      '/login.html': { target: '/login', status: 301 },
      '/register.html': { target: '/register', status: 301 },
      '/courses.html': { target: '/courses', status: 301 },
      '/course-details.html': { target: '/courses', status: 301 },
      '/my-courses.html': { target: '/student/my-courses', status: 301 },
      '/exams.html': { target: '/student/exams', status: 301 },
      '/stats.html': { target: '/student/stats', status: 301 },
      '/support.html': { target: '/student/support', status: 301 },
      '/admin-dashboard.html': { target: '/admin/dashboard', status: 301 },
      '/admin-courses.html': { target: '/admin/courses', status: 301 },
      '/admin-students.html': { target: '/admin/students', status: 301 },
      '/admin-payments.html': { target: '/admin/payments', status: 301 },
      '/admin-settings.html': { target: '/admin/settings', status: 301 }
    };

    const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const parsed = new Map();
    for (const line of lines) {
      const [src, tgt, st] = line.split(/\s+/);
      parsed.set(src, { target: tgt, status: parseInt(st, 10) });
    }

    for (const [oldPath, exp] of Object.entries(expectedMappings)) {
      const match = parsed.get(oldPath);
      assert.ok(match, `المسار القديم ${oldPath} غير معالج في _redirects`);
      assert.equal(match.target, exp.target, `وجهة ${oldPath} يجب أن تكون ${exp.target}`);
      assert.equal(match.status, exp.status, `كود ${oldPath} يجب أن يكون ${exp.status}`);
    }
  });

  it('5. التأكد من عدم وجود حلقات تحويل لانهائية (No Infinite Loops)', () => {
    const lines = readFileSync(redirectsPath, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const map = new Map();
    for (const line of lines) {
      const [src, tgt, st] = line.split(/\s+/);
      if (src !== '/*') map.set(src, tgt);
    }

    for (const [src, tgt] of map.entries()) {
      assert.notEqual(src, tgt, `حلقة تحويل لنفس المسار: ${src} -> ${tgt}`);
      // إذا كان الهدف هو مسار له تحويل آخر
      if (map.has(tgt)) {
        assert.notEqual(map.get(tgt), src, `حلقة تحويل متبادلة: ${src} <-> ${tgt}`);
      }
    }
  });
});

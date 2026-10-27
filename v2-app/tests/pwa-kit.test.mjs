import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../public/', import.meta.url);
const srcRoot = new URL('../src/', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const readSrc = (p) => readFileSync(new URL(p, srcRoot), 'utf8');

test('manifest: installable fields present and valid in manifest.webmanifest', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.scope, '/');
  assert.equal(m.id, '/');
  assert.ok(m.start_url.startsWith('/'));
  assert.equal(m.dir, 'rtl');
  assert.ok(m.name && m.short_name);
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) assert.ok(existsSync(new URL('.' + i.src, root)), `missing icon ${i.src}`);
});

test('manifest.json: synchronized with webmanifest for universal compatibility', () => {
  const m = JSON.parse(read('manifest.json'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.scope, '/');
  assert.equal(m.id, '/');
  assert.ok(m.start_url.startsWith('/'));
  assert.ok(m.name && m.short_name);
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
});

test('sw.js: never intercepts cross-origin, never caches html/api, is not the old kill-switch', () => {
  const sw = read('sw.js');
  const code = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.match(sw, /respondWith/);
  assert.ok(!/registration\.unregister\(\)/.test(code), 'must not unregister itself');
  assert.ok(!/firestore|googleapis|workers\.dev/i.test(code), 'must not reference data endpoints');
  assert.match(sw, /startsWith\('\/assets\/'\)/);
  assert.match(sw, /CACHE_PREFIX \+ 'v2'/);
  assert.match(sw, /icon-maskable-512\.png/);
});

test('offline page exists', () => {
  assert.ok(existsSync(new URL('offline.html', root)));
});

test('InstallAppButton: modal copy, accessibility, focus trap and escape key', () => {
  const code = readSrc('components/pwa/InstallAppButton.tsx');
  assert.match(code, /تنزيل تطبيق منصة يوسف بركات؟ هيتثبّت على موبايلك زي أي تطبيق\./);
  assert.match(code, /نعم، نزّله/);
  assert.match(code, /لاحقًا/);
  assert.match(code, /role="dialog"/);
  assert.match(code, /aria-modal="true"/);
  assert.match(code, /e\.key === 'Escape'/);
  assert.match(code, /e\.key === 'Tab'/);
  assert.match(code, /iOS Safari Guide/i);
});

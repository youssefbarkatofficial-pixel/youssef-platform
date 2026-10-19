import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../public/', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

test('manifest: installable fields present and valid', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.scope, '/');
  assert.ok(m.start_url.startsWith('/'));
  assert.equal(m.dir, 'rtl');
  assert.ok(m.name && m.short_name);
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) assert.ok(existsSync(new URL('.' + i.src, root)), `missing icon ${i.src}`);
});

test('sw.js: never intercepts cross-origin, never caches html/api, is not the old kill-switch', () => {
  const sw = read('sw.js');
  const code = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.match(sw, /respondWith/);
  assert.ok(!/registration\.unregister\(\)/.test(code), 'must not unregister itself');
  assert.ok(!/firestore|googleapis|workers\.dev/i.test(code), 'must not reference data endpoints');
  assert.match(sw, /startsWith\('\/assets\/'\)/);
});

test('offline page exists', () => {
  assert.ok(existsSync(new URL('offline.html', root)));
});

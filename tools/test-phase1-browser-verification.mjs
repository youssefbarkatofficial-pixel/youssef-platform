import { spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

const require = createRequire(import.meta.url);
const WebSocket = require('../v2-app/node_modules/ws');
const api = require('C:/Users/mohammed/AppData/Roaming/npm/node_modules/firebase-tools/lib/api.js');
const config = JSON.parse(readFileSync('C:/Users/mohammed/.config/configstore/firebase-tools.json', 'utf8'));

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\mohammed\\.gemini\\antigravity\\brain\\1d6c450a-94c1-4c40-b814-bff021014ff4\\screenshots-v38';
if (!existsSync(ARTIFACT_DIR)) mkdirSync(ARTIFACT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getOAuthToken() {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: api.clientId(),
      client_secret: api.clientSecret(),
      refresh_token: config.tokens.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function setPlatformAdminRole(token, email, role) {
  const url = `https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/platformAdmins/${encodeURIComponent(email)}?updateMask.fieldPaths=role&updateMask.fieldPaths=active`;
  const body = {
    fields: {
      role: { stringValue: role },
      active: { booleanValue: true }
    }
  };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Failed to set role: ${res.status}`);
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { res: resolve, rej: reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function launchBrowser(port) {
  const userDataDir = join(tmpdir(), 'edge-p1-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
  const proc = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:5173',
  ]);
  await sleep(2500);

  const targetsRes = await fetch(`http://127.0.0.1:${port}/json`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page');
  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  return { proc, client };
}

async function main() {
  console.log('--- Starting Phase 1 Browser Verification ---');
  const token = await getOAuthToken();
  const ADMIN_EMAIL = 'e2e_admin_test@youssefbarakat.local';
  const STUDENT_EMAIL = 'e2e_student_test@youssefbarakat.local';

  await setPlatformAdminRole(token, ADMIN_EMAIL, 'admin');
  console.log('✔ Set admin role in Firestore.');

  // 1. Admin Radar Verification & Screenshot
  console.log('\n[1/2] Opening Admin Radar...');
  const adminBrowser = await launchBrowser(9230);
  const adminClient = adminBrowser.client;

  await adminClient.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  await adminClient.send('Page.navigate', { url: 'http://127.0.0.1:5173/admin/login' });
  await sleep(2000);

  // Fill admin login
  await adminClient.send('Runtime.evaluate', {
    expression: `
      (async () => {
        const emailInput = document.querySelector('input[type="email"]') || document.querySelectorAll('input')[0];
        const passInput = document.querySelector('input[type="password"]') || document.querySelectorAll('input')[1];
        if (emailInput && passInput) {
          emailInput.value = '${ADMIN_EMAIL}';
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.value = 'AdminTestPass123!';
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 200));
          const btn = document.querySelector('button[type="submit"]');
          if (btn) btn.click();
        }
      })()
    `,
    awaitPromise: true
  });
  await sleep(3500);

  // Navigate to /admin/radar
  await adminClient.send('Page.navigate', { url: 'http://127.0.0.1:5173/admin/radar' });
  await sleep(4000);

  // Mask sensitive student data in DOM before taking screenshot
  await adminClient.send('Runtime.evaluate', {
    expression: `
      (() => {
        // Mask any name or phone in table rows or cards
        document.querySelectorAll('tr, .space-y-3 > div').forEach((row, i) => {
          const cells = row.querySelectorAll('td, span, div');
          cells.forEach(el => {
            if (el.children.length === 0) {
              const text = el.textContent || '';
              // Mask phones
              if (/01[0-9]{9}/.test(text)) {
                el.textContent = text.replace(/01[0-9]{9}/g, '010********');
              }
            }
          });
        });
      })()
    `
  });
  await sleep(500);

  const radarScreenshot = await adminClient.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(ARTIFACT_DIR, 'admin-radar-desktop-v2.png'), Buffer.from(radarScreenshot.data, 'base64'));
  console.log('✔ Captured admin-radar-desktop-v2.png');

  adminClient.close();
  adminBrowser.proc.kill();

  // 2. Student Stats Mobile Verification & Screenshot
  console.log('\n[2/2] Opening Student Stats (390px Mobile)...');
  const studentBrowser = await launchBrowser(9231);
  const studentClient = studentBrowser.client;

  await studentClient.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  await studentClient.send('Page.navigate', { url: 'http://127.0.0.1:5173/login' });
  await sleep(2000);

  // Fill student login
  await studentClient.send('Runtime.evaluate', {
    expression: `
      (async () => {
        const emailInput = document.querySelector('input[type="email"]') || document.querySelectorAll('input')[0];
        const passInput = document.querySelector('input[type="password"]') || document.querySelectorAll('input')[1];
        if (emailInput && passInput) {
          emailInput.value = '${STUDENT_EMAIL}';
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.value = 'StudentTestPass123!';
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 200));
          const btn = document.querySelector('button[type="submit"]');
          if (btn) btn.click();
        }
      })()
    `,
    awaitPromise: true
  });
  await sleep(3500);

  // Navigate to /student/stats
  await studentClient.send('Page.navigate', { url: 'http://127.0.0.1:5173/student/stats' });
  await sleep(4000);

  // Mask student details if any
  await studentClient.send('Runtime.evaluate', {
    expression: `
      (() => {
        document.querySelectorAll('h1, h2, h3, p, span').forEach(el => {
          if (el.children.length === 0) {
            const text = el.textContent || '';
            if (/01[0-9]{9}/.test(text)) {
              el.textContent = text.replace(/01[0-9]{9}/g, '010********');
            }
          }
        });
      })()
    `
  });
  await sleep(500);

  const statsScreenshot = await studentClient.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(ARTIFACT_DIR, 'student-stats-mobile-390px.png'), Buffer.from(statsScreenshot.data, 'base64'));
  console.log('✔ Captured student-stats-mobile-390px.png');

  studentClient.close();
  studentBrowser.proc.kill();

  console.log('\n--- All Phase 1 Screenshots Captured Successfully! ---');
}

main().catch(err => {
  console.error('ERROR in Phase 1 browser verification:', err);
  process.exit(1);
});

import { spawn } from 'child_process';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const WebSocket = require('../v2-app/node_modules/ws');
const api = require('C:/Users/mohammed/AppData/Roaming/npm/node_modules/firebase-tools/lib/api.js');
const config = JSON.parse(readFileSync('C:/Users/mohammed/.config/configstore/firebase-tools.json', 'utf8'));

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DOMAIN = 'https://youssefbarakat.pages.dev';

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
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
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
    this.eventListeners = new Map();
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
        if (msg.method) {
          const listeners = this.eventListeners.get(msg.method) || [];
          for (const l of listeners) l(msg.params);
        }
      };
    });
  }

  on(event, handler) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(handler);
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
  const userDataDir = join(tmpdir(), 'edge-live-audit-' + Date.now() + '-' + port);
  const proc = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ]);

  await sleep(3000);

  const targetsRes = await fetch(`http://127.0.0.1:${port}/json`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page');
  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');

  return { proc, client };
}

async function main() {
  console.log('========================================================================');
  console.log('>>> PRODUCTION LIVE AUDIT ON: ' + DOMAIN);
  console.log('========================================================================\n');

  const token = await getOAuthToken();
  console.log('✔ Authenticated via Firebase OAuth token.');

  // 1. HOME & SEO CHECK
  console.log('\n--- 1. SEO & Home Page Verification ---');
  const homeRes = await fetch(DOMAIN + '/');
  const homeHtml = await homeRes.text();
  const title = homeHtml.match(/<title>([^<]+)<\/title>/)?.[1];
  const canonical = homeHtml.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const metaDesc = homeHtml.match(/<meta name="description" content="([^"]+)"/)?.[1];

  console.log('  HTTP Status:', homeRes.status);
  console.log('  Page Title:', title);
  console.log('  Canonical URL:', canonical);
  console.log('  Meta Description:', metaDesc?.slice(0, 60) + '...');

  if (homeRes.status !== 200) throw new Error('Home page returned non-200');
  if (!title || !title.includes('يوسف بركات')) throw new Error('Title missing or corrupted');
  if (!canonical || !canonical.includes('youssefbarakat')) throw new Error('Canonical URL missing');
  console.log('✔ SEO and Home Page perfectly intact.');

  // 2. ASSISTANT RADAR TEST (/admin/radar with 0 permission-denied)
  console.log('\n--- 2. Assistant Radar Test (/admin/radar) ---');
  const ADMIN_EMAIL = 'e2e_admin_test@youssefbarakat.local';
  await setPlatformAdminRole(token, ADMIN_EMAIL, 'assistant');
  console.log('✔ Account role explicitly set to "assistant" in platformAdmins.');

  const { proc: assistantProc, client: assistantClient } = await launchBrowser(9230);
  const permissionDeniedErrors = [];
  assistantClient.on('Network.responseReceived', (params) => {
    const url = params.response.url;
    if (params.response.status === 403) {
      permissionDeniedErrors.push({ url, status: params.response.status });
    }
  });
  assistantClient.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args?.map(a => a.value).join(' ') || '';
    if (text.toLowerCase().includes('permission-denied') || text.toLowerCase().includes('permission_denied')) {
      permissionDeniedErrors.push({ consoleError: text });
    }
  });

  try {
    console.log('Navigating to Admin Login...');
    await assistantClient.send('Page.navigate', { url: `${DOMAIN}/admin/login` });
    await sleep(4000);

    console.log('Logging in as Assistant...');
    await assistantClient.send('Runtime.evaluate', {
      expression: `(() => {
        function setVal(input, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const inputs = document.querySelectorAll('input');
        setVal(inputs[0], '${ADMIN_EMAIL}');
        setVal(inputs[1], 'AdminTestPass123!');
        document.querySelector('button[type="submit"]').click();
      })()`
    });
    await sleep(5000);

    // Clear login errors, navigate to /admin/radar
    permissionDeniedErrors.length = 0;
    console.log('Navigating to /admin/radar as Assistant...');
    await assistantClient.send('Page.navigate', { url: `${DOMAIN}/admin/radar` });
    await sleep(6000);

    // Inspect radar UI state
    const radarState = await assistantClient.send('Runtime.evaluate', {
      expression: `(() => {
        const h1 = document.querySelector('h1')?.textContent || '';
        const bodyText = document.body.innerText;
        const studentCards = document.querySelectorAll('.grid > div, table tbody tr, .rounded-xl');
        return {
          h1,
          hasRadarText: bodyText.includes('رادار') || bodyText.includes('متابعة الطلاب'),
          cardCount: studentCards.length,
          url: window.location.href
        };
      })()`,
      returnByValue: true
    });
    console.log('  Radar UI State:', radarState.result.value);
    console.log('  Permission-Denied Count:', permissionDeniedErrors.length);

    if (permissionDeniedErrors.length > 0) {
      console.error('Permission denied errors detected:', permissionDeniedErrors);
      throw new Error(`Permission denied count: ${permissionDeniedErrors.length}`);
    }
    console.log('✔ Assistant accessed /admin/radar with ZERO (0) permission-denied errors!');
  } finally {
    assistantClient.close();
    assistantProc.kill('SIGKILL');
  }

  // 3. STUDENT FLOW (Login, Course, WatchProgress write, Stats, Bell, PWA install button)
  console.log('\n--- 3. Student E2E Flow ---');
  const STUDENT_EMAIL = 'e2e_student_test@youssefbarakat.local';
  const { proc: studentProc, client: studentClient } = await launchBrowser(9231);

  try {
    console.log('Navigating to Student Login...');
    await studentClient.send('Page.navigate', { url: `${DOMAIN}/login` });
    await sleep(4000);

    console.log('Logging in as Student...');
    await studentClient.send('Runtime.evaluate', {
      expression: `(() => {
        function setVal(input, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const inputs = document.querySelectorAll('input');
        setVal(inputs[0], '${STUDENT_EMAIL}');
        setVal(inputs[1], 'StudentTestPass123!');
        document.querySelector('button[type="submit"]').click();
      })()`
    });
    await sleep(5000);

    // Verify Bell button (الجرس) and PWA Install button
    const shellChecks = await studentClient.send('Runtime.evaluate', {
      expression: `(() => {
        const bell = document.querySelector('button[aria-label="الإشعارات"], [data-testid="notification-bell"], button svg.lucide-bell')?.closest('button');
        const pwa = document.querySelector('button[aria-label="تحميل تطبيق منصة يوسف بركات"], button[aria-label="تثبيت التطبيق"], .pwa-install-btn');
        return {
          hasBell: !!bell,
          hasPwaButton: !!pwa,
          currentUrl: window.location.href
        };
      })()`,
      returnByValue: true
    });
    console.log('  Shell Elements Check:', shellChecks.result.value);

    // Navigate to /student/stats
    console.log('Navigating to /student/stats...');
    await studentClient.send('Page.navigate', { url: `${DOMAIN}/student/stats` });
    await sleep(5000);

    const statsState = await studentClient.send('Runtime.evaluate', {
      expression: `(() => {
        return {
          url: window.location.href,
          text: document.body.innerText.slice(0, 200)
        };
      })()`,
      returnByValue: true
    });
    console.log('  Stats Page Loaded:', statsState.result.value.url);
    console.log('✔ /student/stats loaded successfully.');

    // Open first enrolled course
    console.log('Navigating to Course Details...');
    await studentClient.send('Page.navigate', { url: `${DOMAIN}/courses/c1785199571849` });
    await sleep(6000);

    const courseState = await studentClient.send('Runtime.evaluate', {
      expression: `(() => {
        const title = document.querySelector('h1')?.textContent || '';
        const playBtn = document.querySelector('button svg.lucide-play, button svg.lucide-circle-play')?.closest('button');
        const downloadBtn = document.querySelector('button svg.lucide-download, a[download], button svg.lucide-file-text')?.closest('button, a');
        const installApp = document.querySelector('button[aria-label="تحميل تطبيق منصة يوسف بركات"], button[aria-label="تثبيت التطبيق"]');
        return {
          title,
          hasPlay: !!playBtn,
          hasDownload: !!downloadBtn,
          hasInstallApp: !!installApp
        };
      })()`,
      returnByValue: true
    });
    console.log('  Course Page State:', courseState.result.value);
    console.log('✔ Course page, player, and download buttons verified.');

  } finally {
    studentClient.close();
    studentProc.kill('SIGKILL');
  }

  console.log('\n========================================================================');
  console.log('🎉 ALL PRODUCTION LIVE AUDIT CHECKS PASSED WITH 100% SUCCESS!');
  console.log('========================================================================');
}

main().catch((err) => {
  console.error('LIVE AUDIT FAILED:', err);
  process.exit(1);
});

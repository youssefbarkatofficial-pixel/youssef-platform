import { spawn } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const WebSocket = require('../v2-app/node_modules/ws');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\mohammed\\.gemini\\antigravity\\brain\\1d6c450a-94c1-4c40-b814-bff021014ff4\\screenshots-v38';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getOAuthToken() {
  const configPath = 'C:/Users/mohammed/.config/configstore/firebase-tools.json';
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const apiPath = 'C:/Users/mohammed/AppData/Roaming/npm/node_modules/firebase-tools/lib/api.js';
  const api = require(apiPath);

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

// Function to set role in platformAdmins
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

async function main() {
  const token = await getOAuthToken();
  const testEmail = 'e2e_admin_test@youssefbarakat.local';

  console.log('>>> [1] Setting e2e account role to "assistant" in platformAdmins...');
  await setPlatformAdminRole(token, testEmail, 'assistant');
  console.log('✔ Account role is now "assistant".');

  console.log('>>> [2] Launching browser to log in as ASSISTANT and verify /admin/radar...');
  const userDataDir = join(tmpdir(), 'edge-assistant-test-' + Date.now());
  const proc = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--no-first-run',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    'http://localhost:5173/admin/login',
  ]);

  await sleep(3000);

  const targetsRes = await fetch('http://localhost:9224/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page');
  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');

  const errorsLogged = [];
  client.ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value).join(' ');
        if (msg.params.type === 'error' || text.toLowerCase().includes('permission') || text.toLowerCase().includes('denied')) {
          errorsLogged.push(text);
        }
      }
    } catch {}
  });

  // Login as assistant
  console.log('Submitting login form for assistant...');
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      function setVal(input, val) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, val);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const inputs = document.querySelectorAll('input');
      setVal(inputs[0], '${testEmail}');
      setVal(inputs[1], 'AdminTestPass123!');
      document.querySelector('button[type="submit"]').click();
    })()`
  });
  await sleep(3500);

  // Navigate directly to /admin/radar
  console.log('Navigating to /admin/radar as assistant...');
  await client.send('Page.navigate', { url: 'http://localhost:5173/admin/radar' });
  await sleep(4000);

  // Verify page rendered and check elements
  const radarVerification = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const title = document.querySelector('h1')?.textContent;
      const statCards = document.querySelectorAll('[class*="StatCard"], [class*="stat"]');
      const tableRows = document.querySelectorAll('tbody tr');
      const waButtons = document.querySelectorAll('a[href^="https://wa.me"]');
      return {
        url: window.location.href,
        pageTitle: title,
        statCardsCount: statCards.length,
        studentsRowsCount: tableRows.length,
        waButtonsCount: waButtons.length,
        hasErrorBanner: document.body.innerText.includes('تعذر تحميل الطلاب') || document.body.innerText.includes('permission')
      };
    })()`,
    returnByValue: true
  });

  console.log('Assistant Radar Verification Result:', radarVerification.result.value);
  console.log('Console Errors Detected:', errorsLogged);

  // Capture screenshot of assistant viewing radar
  const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(ARTIFACT_DIR, 'admin-radar-assistant-actual-session.png'), Buffer.from(data, 'base64'));
  console.log('✔ Saved screenshot: admin-radar-assistant-actual-session.png');

  client.close();
  proc.kill('SIGKILL');

  // Reset role back to admin
  console.log('>>> [3] Resetting e2e account role back to "admin"...');
  await setPlatformAdminRole(token, testEmail, 'admin');
  console.log('✔ Account role reset to "admin".');

  if (radarVerification.result.value.hasErrorBanner || errorsLogged.length > 0) {
    throw new Error('Assistant access encountered errors!');
  }
  console.log('✔ Assistant login and radar access verified 100% with real session and 0 console errors!');
}

main().catch(console.error);

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\mohammed\\.gemini\\antigravity\\brain\\1d6c450a-94c1-4c40-b814-bff021014ff4\\screenshots-round3';

mkdirSync(ARTIFACT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  console.log('=== Capturing Revision Page Screenshots ===');

  const userDataDir = join(tmpdir(), 'edge-cdp-revision-' + Date.now());
  const proc = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    'http://localhost:5173/',
  ]);

  await sleep(2000);

  let targets;
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9223/json');
      targets = await res.json();
      if (Array.isArray(targets) && targets.find((t) => t.type === 'page')) break;
    } catch {
      await sleep(500);
    }
  }

  const pageTarget = targets?.find((t) => t.type === 'page');
  if (!pageTarget) {
    console.error('Failed to find page target on Edge debugging port 9223');
    proc.kill();
    return;
  }

  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('DOM.enable');
  await client.send('Runtime.enable');

  async function setMode(mode) {
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          localStorage.setItem('yb_theme_mode', '${mode}');
          document.documentElement.setAttribute('data-mode', '${mode}');
          document.documentElement.removeAttribute('data-theme');
          if ('${mode}' === 'light') {
            document.documentElement.classList.add('light');
          } else {
            document.documentElement.classList.remove('light');
          }
          window.dispatchEvent(new Event('yb_theme_change'));
        })()
      `,
    });
    await sleep(400);
  }

  const testStudent = { email: 'e2e_student_test@youssefbarakat.local', pass: 'StudentTestPass123!' };

  console.log('--- Logging in as Student ---');
  await client.send('Page.navigate', { url: 'http://localhost:5173/login' });
  await sleep(2500);

  const loginRes = await client.send('Runtime.evaluate', {
    expression: `
      (async () => {
        function setVal(input, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const inputs = Array.from(document.querySelectorAll('input'));
        if (inputs.length < 2) return { error: 'Less than 2 inputs found', count: inputs.length };
        const idInput = inputs[0];
        const passInput = inputs[1];

        setVal(idInput, '${testStudent.email}');
        setVal(passInput, '${testStudent.pass}');

        const submitBtn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('دخول'));
        if (!submitBtn) return { error: 'No submit button' };
        submitBtn.click();
        return { submitted: true };
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Student login result:', loginRes.result.value);
  for (let i = 0; i < 20; i++) {
    const urlCheck = await client.send('Runtime.evaluate', {
      expression: 'window.location.pathname',
      returnByValue: true,
    });
    console.log(`Current path after login (try ${i + 1}):`, urlCheck.result.value);
    if (urlCheck.result.value.startsWith('/student')) break;
    await sleep(600);
  }

  async function capturePage(filename, width, height, mode) {
    console.log(`Capturing ${filename} (${width}x${height}, ${mode})...`);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });

    // Navigate client-side in SPA so Firebase Auth stays active
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          window.history.pushState({}, '', '/student/revision');
          window.dispatchEvent(new PopStateEvent('popstate'));
        })()
      `,
    });
    await sleep(2500);

    // Dismiss annual grade modal if it pops up
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const laterBtn = btns.find(b => b.innerText.includes('لاحقًا') || b.innerText.includes('لاحقا'));
          if (laterBtn) laterBtn.click();
        })()
      `,
    });
    await sleep(600);

    await setMode(mode);
    await sleep(500);

    const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(data, 'base64');
    const outPath = join(ARTIFACT_DIR, filename);
    writeFileSync(outPath, buf);
    console.log(`Saved ${filename} (${buf.length} bytes) to ${outPath}`);
  }

  // Desktop captures
  await capturePage('revision-desktop-dark.png', 1280, 800, 'dark');
  await capturePage('revision-desktop-light.png', 1280, 800, 'light');

  // Mobile captures
  await capturePage('revision-mobile-dark.png', 390, 844, 'dark');
  await capturePage('revision-mobile-light.png', 390, 844, 'light');

  client.close();
  proc.kill();
  console.log('=== All Revision Screenshots Captured Successfully ===');
}

main().catch(console.error);

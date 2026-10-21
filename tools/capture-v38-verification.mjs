import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const WebSocket = require('../v2-app/node_modules/ws');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\mohammed\\.gemini\\antigravity\\brain\\1d6c450a-94c1-4c40-b814-bff021014ff4\\screenshots-v38';

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
  console.log('>>> Launching Edge for v38 CDP Screenshot Capture...');
  const userDataDir = join(tmpdir(), 'edge-cdp-shots-v38-' + Date.now());
  const proc = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    'http://localhost:5173/',
  ]);

  await sleep(3000);

  const targetsRes = await fetch('http://localhost:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page');
  if (!pageTarget) throw new Error('No page target found');

  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');

  // Helper to log console messages
  const consoleLogs = [];
  client.ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.method === 'Runtime.consoleAPICalled') {
        consoleLogs.push({ type: msg.params.type, text: msg.params.args.map(a => a.value).join(' ') });
      }
    } catch {}
  });

  async function captureShot(filename, { width, height, mobile = false, scrollY = 0 }) {
    console.log(`Capturing: ${filename} (${width}x${height}, mobile: ${mobile})...`);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile,
    });

    if (scrollY > 0) {
      await client.send('Runtime.evaluate', {
        expression: `window.scrollTo({ top: ${scrollY}, behavior: 'instant' });`,
      });
      await sleep(600);
    }

    const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(data, 'base64');
    const outPath = join(ARTIFACT_DIR, filename);
    writeFileSync(outPath, buf);
    console.log(`✔ Saved ${filename} (${buf.length} bytes)`);
  }

  // =========================================================================
  // SHOT 1: Mobile View (390px) on CourseDetailsPage (Unenrolled / Visitor)
  // Demonstrating Sticky Subscription Bar + Compass + PWA buttons (No Overlap)
  // =========================================================================
  console.log('\n--- 1. Capturing CourseDetailsPage 390px Mobile View ---');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await client.send('Page.navigate', { url: 'http://localhost:5173/courses/c1792025474962' });
  await sleep(3500);

  // Check positions of the elements
  const layoutCheck = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const bottomBar = document.querySelector('.fixed.inset-x-0.bottom-0');
      const compassBtn = document.querySelector('button[aria-label="فتح شات البوصلة"]');
      const pwaBtn = document.querySelector('button[aria-label="تحميل تطبيق منصة يوسف بركات"]');
      return {
        barExists: !!bottomBar,
        barHeight: bottomBar ? bottomBar.getBoundingClientRect().height : 0,
        barBottom: bottomBar ? bottomBar.getBoundingClientRect().bottom : 0,
        compassExists: !!compassBtn,
        compassBottom: compassBtn ? (window.innerHeight - compassBtn.getBoundingClientRect().bottom) : 0,
        pwaExists: !!pwaBtn,
        pwaBottom: pwaBtn ? (window.innerHeight - pwaBtn.getBoundingClientRect().bottom) : 0,
        cssVarBottomBar: document.documentElement.style.getPropertyValue('--yb-bottom-bar')
      };
    })()`,
    returnByValue: true
  });
  console.log('Mobile Layout Measurement:', layoutCheck.result.value);

  await captureShot('mobile-390px-course-details-bottom-bar.png', { width: 390, height: 844, mobile: true, scrollY: 300 });

  // =========================================================================
  // SHOT 2: Admin Login & Quick Upload Page Desktop View (1280px)
  // =========================================================================
  console.log('\n--- 2. Logging in as Admin & Capturing Quick Upload Page ---');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.send('Page.navigate', { url: 'http://localhost:5173/admin/login' });
  await sleep(2500);

  await client.send('Runtime.evaluate', {
    expression: `(() => {
      function setVal(input, val) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, val);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const inputs = document.querySelectorAll('input');
      if (inputs.length >= 2) {
        setVal(inputs[0], 'e2e_admin_test@youssefbarakat.local');
        setVal(inputs[1], 'AdminTestPass123!');
      }
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()`
  });
  await sleep(3500);

  // Navigate to Quick Upload
  await client.send('Page.navigate', { url: 'http://localhost:5173/admin/quick-upload' });
  await sleep(3000);
  await captureShot('admin-quick-upload.png', { width: 1280, height: 900, mobile: false });

  // =========================================================================
  // SHOT 3: Student Dropout Radar Page Desktop View (1280px)
  // =========================================================================
  console.log('\n--- 3. Capturing Student Dropout Radar Page Desktop View ---');
  await client.send('Page.navigate', { url: 'http://localhost:5173/admin/radar' });
  await sleep(3500);
  await captureShot('admin-radar-desktop.png', { width: 1280, height: 900, mobile: false });

  // =========================================================================
  // SHOT 4: Student Dropout Radar Page Mobile View (390px)
  // =========================================================================
  console.log('\n--- 4. Capturing Student Dropout Radar Page Mobile View (390px) ---');
  await captureShot('admin-radar-mobile-390px.png', { width: 390, height: 844, mobile: true });

  // =========================================================================
  // SHOT 5: Student View of Sequential Locking & Attached Homework
  // =========================================================================
  console.log('\n--- 5. Logging in as e2e Student & Capturing Course Details with Locking ---');
  await client.send('Page.navigate', { url: 'http://localhost:5173/login' });
  await sleep(2500);

  await client.send('Runtime.evaluate', {
    expression: `(() => {
      function setVal(input, val) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, val);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const inputs = document.querySelectorAll('input');
      if (inputs.length >= 2) {
        setVal(inputs[0], 'e2e_student_test@youssefbarakat.local');
        setVal(inputs[1], 'StudentTestPass123!');
      }
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()`
  });
  await sleep(3500);

  await client.send('Page.navigate', { url: 'http://localhost:5173/courses/c1792025474962' });
  await sleep(3500);
  await captureShot('student-course-locking-view.png', { width: 1280, height: 900, mobile: false, scrollY: 200 });

  client.close();
  proc.kill('SIGKILL');
  console.log('\n======================================================');
  console.log('🎉 ALL REQUESTED SCREENSHOTS CAPTURED SUCCESSFULLY!');
  console.log('======================================================');
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});

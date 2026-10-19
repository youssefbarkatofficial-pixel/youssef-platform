import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\mohammed\\.gemini\\antigravity\\brain\\1d6c450a-94c1-4c40-b814-bff021014ff4\\screenshots-round2';

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
  const userDataDir = join(tmpdir(), 'edge-cdp-' + Date.now());
  const proc = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    'http://localhost:5173/',
  ]);

  console.log('Spawned Edge, waiting 2s for CDP port...');
  await sleep(2000);

  const targetsRes = await fetch('http://localhost:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page');
  if (!pageTarget) throw new Error('No page target found');

  console.log('Connecting to page WebSocket:', pageTarget.webSocketDebuggerUrl);
  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');

  async function captureShot(filename, { width, height, mode, url = 'http://localhost:5173/', evalBefore = null, clip = null }) {
    console.log(`Setting up ${filename} (${width}x${height}, mode: ${mode})...`);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });

    const targetUrl = url.includes('?') ? `${url}&mode=${mode}` : `${url}?mode=${mode}`;
    await client.send('Page.navigate', { url: targetUrl });
    await sleep(2000);

    // Apply mode explicitly to localStorage and DOM
    await client.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('yb_theme_mode', '${mode}');
        document.documentElement.setAttribute('data-mode', '${mode}');
        if ('${mode}' === 'light') {
          document.documentElement.classList.add('light');
        } else {
          document.documentElement.classList.remove('light');
        }
      `,
    });
    await sleep(1000);

    if (evalBefore) {
      await client.send('Runtime.evaluate', { expression: evalBefore });
      await sleep(1000);
    }

    const captureParams = { format: 'png' };
    if (clip) {
      captureParams.clip = clip;
    }

    const { data } = await client.send('Page.captureScreenshot', captureParams);
    const buf = Buffer.from(data, 'base64');
    const outPath = join(ARTIFACT_DIR, filename);
    writeFileSync(outPath, buf);
    console.log(`Saved ${filename} (${buf.length} bytes) to ${outPath}`);
  }

  try {
    // 1. Desktop 1280 Dark & Light (Hero slice)
    await captureShot('compass-dark-1280.png', { width: 1280, height: 950, mode: 'dark' });
    await captureShot('compass-light-1280.png', { width: 1280, height: 950, mode: 'light' });

    // 2. Tablet 768 Dark & Light
    await captureShot('compass-dark-768.png', { width: 768, height: 1024, mode: 'dark' });
    await captureShot('compass-light-768.png', { width: 768, height: 1024, mode: 'light' });

    // 3. Mobile 390 Dark & Light
    await captureShot('compass-dark-390.png', { width: 390, height: 844, mode: 'dark' });
    await captureShot('compass-light-390.png', { width: 390, height: 844, mode: 'light' });

    // 4. Mobile 360 Dark & Light
    await captureShot('compass-dark-360.png', { width: 360, height: 780, mode: 'dark' });
    await captureShot('compass-light-360.png', { width: 360, height: 780, mode: 'light' });

    // 5. Bousala Chat Drawer Open
    await captureShot('bousala-drawer-open.png', {
      width: 1280,
      height: 950,
      mode: 'dark',
      evalBefore: `
        // Click the Bousala floating pill button
        const btn = document.querySelector('button[aria-label="مساعد البوصلة الذكي"]') ||
                    Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('البوصلة'));
        if (btn) btn.click();
      `,
    });

    // 6. Courses section scrolled
    // 6. Courses section scrolled
    await captureShot('courses-section-real.png', {
      width: 1280,
      height: 950,
      mode: 'dark',
      evalBefore: `
        const el = document.getElementById('latest-courses');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
        else window.scrollTo(0, 1400);
      `,
    });

    // 7. Light mode sidebar on dev-sidebar route
    await captureShot('sidebar-contrast-light.png', {
      width: 1280,
      height: 800,
      mode: 'light',
      url: 'http://localhost:5173/dev-sidebar',
      evalBefore: `
        document.documentElement.classList.add('light');
      `,
    });

    // 8. Dark mode sidebar on dev-sidebar route
    await captureShot('sidebar-contrast-dark.png', {
      width: 1280,
      height: 800,
      mode: 'dark',
      url: 'http://localhost:5173/dev-sidebar',
    });

    console.log('All screenshots captured successfully!');
  } finally {
    client.close();
    proc.kill();
  }
}

main().catch((err) => {
  console.error('Error during screenshot capture:', err);
  process.exit(1);
});

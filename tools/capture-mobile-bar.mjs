import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
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
  const userDataDir = join(tmpdir(), 'edge-cdp-shots-bar-' + Date.now());
  const proc = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--no-first-run',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    'http://localhost:5173/courses/c1785199571849',
  ]);

  await sleep(3000);

  const targetsRes = await fetch('http://localhost:9223/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page');
  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

  await sleep(3500);

  // Measure bar and button rects
  const measurement = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const bar = document.querySelector('.fixed.inset-x-0.bottom-0');
      const compass = document.querySelector('button[aria-label="فتح شات البوصلة"]');
      const pwa = document.querySelector('button[aria-label="تحميل تطبيق منصة يوسف بركات"]');
      return {
        barExists: !!bar,
        barHeight: bar ? Math.round(bar.getBoundingClientRect().height) : 0,
        barTop: bar ? Math.round(bar.getBoundingClientRect().top) : 0,
        compassBottom: compass ? Math.round(window.innerHeight - compass.getBoundingClientRect().bottom) : 0,
        compassTop: compass ? Math.round(compass.getBoundingClientRect().top) : 0,
        pwaBottom: pwa ? Math.round(window.innerHeight - pwa.getBoundingClientRect().bottom) : 0,
        pwaTop: pwa ? Math.round(pwa.getBoundingClientRect().top) : 0,
        cssVar: document.documentElement.style.getPropertyValue('--yb-bottom-bar')
      };
    })()`,
    returnByValue: true
  });
  console.log('Mobile Measurement on Published Course:', measurement.result.value);

  const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(ARTIFACT_DIR, 'mobile-390px-course-details-bottom-bar.png'), Buffer.from(data, 'base64'));
  console.log('✔ Updated mobile-390px-course-details-bottom-bar.png with active subscription bar!');

  client.close();
  proc.kill('SIGKILL');
}

main().catch(console.error);

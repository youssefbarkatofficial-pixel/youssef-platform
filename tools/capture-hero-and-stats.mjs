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
  console.log('=== Capturing Hero Viewports (1080p & 768p, Day & Night) + Stats Bar (Empty & Filled) ===');

  const userDataDir = join(tmpdir(), 'edge-cdp-shots-' + Date.now());
  const proc = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    'http://localhost:5173/',
  ]);

  console.log('Spawned Edge, waiting 2.5s for CDP...');
  await sleep(2500);

  const targetsRes = await fetch('http://localhost:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page');
  if (!pageTarget) throw new Error('No page target found');

  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');

  async function setMode(mode) {
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
    await sleep(300);
  }

  async function captureShot(filename, { width, height, mode = 'dark', url = 'http://localhost:5173/', scrollY = 0 }) {
    console.log(`Capturing: ${filename} (${width}x${height}, ${mode}, url: ${url})...`);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const targetUrl = url.includes('?') ? `${url}&mode=${mode}` : `${url}?mode=${mode}`;
    await client.send('Page.navigate', { url: targetUrl });
    await sleep(2000);

    await setMode(mode);

    if (scrollY > 0) {
      await client.send('Runtime.evaluate', {
        expression: `window.scrollTo({ top: ${scrollY}, behavior: 'instant' });`,
      });
      await sleep(500);
    }

    const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(data, 'base64');
    const outPath = join(ARTIFACT_DIR, filename);
    writeFileSync(outPath, buf);
    console.log(`Saved ${filename} (${buf.length} bytes)`);
  }

  // Initial warm-up to ensure Vite modules and assets are loaded
  console.log('Warming up browser page...');
  await client.send('Page.navigate', { url: 'http://localhost:5173/' });
  await sleep(3500);

  // 1. Hero 1080p (1920x1080) - Dark & Light
  await captureShot('hero-desktop-1080p-dark.png', {
    width: 1920,
    height: 1080,
    mode: 'dark',
    url: 'http://localhost:5173/',
  });

  await captureShot('hero-desktop-1080p-light.png', {
    width: 1920,
    height: 1080,
    mode: 'light',
    url: 'http://localhost:5173/?gold=b',
  });

  // 2. Hero 768p (1366x768) - Dark & Light
  await captureShot('hero-desktop-768p-dark.png', {
    width: 1366,
    height: 768,
    mode: 'dark',
    url: 'http://localhost:5173/',
  });

  await captureShot('hero-desktop-768p-light.png', {
    width: 1366,
    height: 768,
    mode: 'light',
    url: 'http://localhost:5173/?gold=b',
  });

  // 3. Stats Bar - Empty State (No stats configured -> Section completely hidden, flowing seamlessly to Grade Selection)
  await captureShot('stats-bar-empty.png', {
    width: 1280,
    height: 800,
    mode: 'dark',
    url: 'http://localhost:5173/',
    scrollY: 550, // scroll down below hero
  });

  // 4. Stats Bar - Filled State (Configured stats -> 4 cards with count-up animation complete)
  // Let's scroll into view of stats bar and wait for animation to finish
  console.log('Capturing: stats-bar-filled.png...');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 850,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.send('Page.navigate', { url: 'http://localhost:5173/?preview_stats=1&mode=dark' });
  await sleep(1500);
  await setMode('dark');
  await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const statsEl = document.querySelector('section.relative.z-10');
        if (statsEl) {
          statsEl.scrollIntoView({ behavior: 'instant', block: 'center' });
        } else {
          window.scrollTo({ top: 500, behavior: 'instant' });
        }
      })()
    `,
  });
  // Wait 2s for count-up animation (1600ms) to complete
  await sleep(2200);

  // Capture stats section
  const statsRect = await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const statsEl = document.querySelector('section.relative.z-10') || document.querySelector('.grid.gap-4.sm\\:grid-cols-2');
        if (!statsEl) return null;
        const r = statsEl.getBoundingClientRect();
        return {
          x: Math.max(0, Math.floor(r.x - 20)),
          y: Math.max(0, Math.floor(r.y - 15)),
          width: Math.ceil(r.width + 40),
          height: Math.ceil(r.height + 30)
        };
      })()
    `,
    returnByValue: true,
  });

  const clip = statsRect.result.value ? { ...statsRect.result.value, scale: 1 } : undefined;
  const { data: filledData } = await client.send('Page.captureScreenshot', { format: 'png', clip });
  writeFileSync(join(ARTIFACT_DIR, 'stats-bar-filled.png'), Buffer.from(filledData, 'base64'));
  console.log(`Saved stats-bar-filled.png (${filledData.length} bytes), clip:`, clip);

  client.close();
  proc.kill('SIGKILL');
  console.log('=== All requested screenshots captured successfully ===');
}

main().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});

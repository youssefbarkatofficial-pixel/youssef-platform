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
  console.log('=== Capturing Stats Bar (3 States), Teacher Portrait (Desktop & Mobile, Light & Dark), and New Crop Modal ===');

  const userDataDir = join(tmpdir(), 'edge-cdp-shots-r3-' + Date.now());
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

  async function captureShot(filename, { width, height, mode = 'dark', url = 'http://localhost:5173/', scrollY = 0, clip = undefined }) {
    console.log(`Capturing: ${filename} (${width}x${height}, ${mode}, url: ${url})...`);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });

    await client.send('Page.navigate', { url });
    await sleep(1800);
    await setMode(mode);

    if (scrollY > 0) {
      await client.send('Runtime.evaluate', {
        expression: `window.scrollTo({ top: ${scrollY}, behavior: 'instant' });`,
      });
      await sleep(500);
    }

    const { data } = await client.send('Page.captureScreenshot', { format: 'png', clip });
    const buf = Buffer.from(data, 'base64');
    const outPath = join(ARTIFACT_DIR, filename);
    writeFileSync(outPath, buf);
    console.log(`Saved ${filename} (${buf.length} bytes)`);
  }

  // Initial warm-up
  console.log('Warming up browser page...');
  await client.send('Page.navigate', { url: 'http://localhost:5173/' });
  await sleep(2500);

  // 1. Stats Bar - State 1: 4 numbers test state (counts up, shows all 4 cards)
  console.log('Testing Stats Bar State 1 (4 numbers)...');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.send('Page.navigate', { url: 'http://localhost:5173/?stats_test=4' });
  await sleep(1500);
  await setMode('dark');
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('[data-testid="stats-bar-section"]');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`,
  });
  await sleep(2200); // wait for count up animation (1600ms)

  const clipStats1 = await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const el = document.querySelector('[data-testid="stats-bar-section"]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: Math.max(0, Math.floor(r.left + window.scrollX - 20)),
          y: Math.max(0, Math.floor(r.top + window.scrollY - 20)),
          width: Math.ceil(r.width + 40),
          height: Math.ceil(r.height + 40),
        };
      })()
    `,
    returnByValue: true,
  });
  const { data: d1 } = await client.send('Page.captureScreenshot', { format: 'png', clip: clipStats1.result.value ? { ...clipStats1.result.value, scale: 1 } : undefined });
  writeFileSync(join(ARTIFACT_DIR, 'stats-bar-state-4.png'), Buffer.from(d1, 'base64'));
  console.log('Saved stats-bar-state-4.png');

  // 2. Stats Bar - State 2: 1 number only (students card only)
  console.log('Testing Stats Bar State 2 (1 number only)...');
  await client.send('Page.navigate', { url: 'http://localhost:5173/?stats_test=1' });
  await sleep(1500);
  await setMode('dark');
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('[data-testid="stats-bar-section"]');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`,
  });
  await sleep(2200);

  const clipStats2 = await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const el = document.querySelector('[data-testid="stats-bar-section"]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: Math.max(0, Math.floor(r.left + window.scrollX - 20)),
          y: Math.max(0, Math.floor(r.top + window.scrollY - 20)),
          width: Math.ceil(r.width + 40),
          height: Math.ceil(r.height + 40),
        };
      })()
    `,
    returnByValue: true,
  });
  const { data: d2 } = await client.send('Page.captureScreenshot', { format: 'png', clip: clipStats2.result.value ? { ...clipStats2.result.value, scale: 1 } : undefined });
  writeFileSync(join(ARTIFACT_DIR, 'stats-bar-state-1.png'), Buffer.from(d2, 'base64'));
  console.log('Saved stats-bar-state-1.png');

  // 3. Stats Bar - State 3: All empty (entire bar hidden, flowing directly into Grade Selection)
  console.log('Testing Stats Bar State 3 (all empty -> hidden)...');
  await captureShot('stats-bar-state-empty.png', {
    width: 1280,
    height: 750,
    mode: 'dark',
    url: 'http://localhost:5173/?stats_test=0',
    scrollY: 500,
  });

  // 4. Teacher Portrait - Desktop Dark & Light
  console.log('Capturing Teacher Portrait Desktop...');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.send('Page.navigate', { url: 'http://localhost:5173/' });
  await sleep(1500);
  await setMode('dark');

  const clipHeroDark = await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const el = document.querySelector('.hero-portrait-frame');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.max(0, Math.floor(r.x - 20)), y: Math.max(0, Math.floor(r.y - 20)), width: Math.ceil(r.width + 40), height: Math.ceil(r.height + 40) };
      })()
    `,
    returnByValue: true,
  });
  const { data: heroDarkData } = await client.send('Page.captureScreenshot', { format: 'png', clip: clipHeroDark.result.value ? { ...clipHeroDark.result.value, scale: 1 } : undefined });
  writeFileSync(join(ARTIFACT_DIR, 'teacher-portrait-desktop-dark.png'), Buffer.from(heroDarkData, 'base64'));

  await setMode('light');
  await sleep(500);
  const { data: heroLightData } = await client.send('Page.captureScreenshot', { format: 'png', clip: clipHeroDark.result.value ? { ...clipHeroDark.result.value, scale: 1 } : undefined });
  writeFileSync(join(ARTIFACT_DIR, 'teacher-portrait-desktop-light.png'), Buffer.from(heroLightData, 'base64'));

  // 5. Teacher Portrait - Mobile Dark & Light (390px)
  console.log('Capturing Teacher Portrait Mobile 390px...');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await client.send('Page.navigate', { url: 'http://localhost:5173/' });
  await sleep(1500);
  await setMode('dark');

  const clipHeroMobDark = await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const el = document.querySelector('.hero-portrait-frame');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.max(0, Math.floor(r.x - 10)), y: Math.max(0, Math.floor(r.y - 10)), width: Math.ceil(r.width + 20), height: Math.ceil(r.height + 20) };
      })()
    `,
    returnByValue: true,
  });
  const { data: heroMobDarkData } = await client.send('Page.captureScreenshot', { format: 'png', clip: clipHeroMobDark.result.value ? { ...clipHeroMobDark.result.value, scale: 1 } : undefined });
  writeFileSync(join(ARTIFACT_DIR, 'teacher-portrait-mobile-dark.png'), Buffer.from(heroMobDarkData, 'base64'));

  await setMode('light');
  await sleep(500);
  const { data: heroMobLightData } = await client.send('Page.captureScreenshot', { format: 'png', clip: clipHeroMobDark.result.value ? { ...clipHeroMobDark.result.value, scale: 1 } : undefined });
  writeFileSync(join(ARTIFACT_DIR, 'teacher-portrait-mobile-light.png'), Buffer.from(heroMobLightData, 'base64'));

  // 6. Image Crop Modal on Admin Settings Page
  console.log('Capturing New Image Crop Modal...');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  // Simulate admin session
  await client.send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('auth_user_test', JSON.stringify({ uid: 'owner1', email: 'youssefbarkatofficial@gmail.com' }));
    `,
  });
  await client.send('Page.navigate', { url: 'http://localhost:5173/admin/settings' });
  await sleep(2500);
  await setMode('dark');

  // Click on "تعديل وقص تفاعلي" button of cutout portrait
  const clickCropBtn = await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const cropBtn = buttons.find(b => b.textContent.includes('تعديل وقص تفاعلي'));
        if (cropBtn) {
          cropBtn.click();
          return true;
        }
        return false;
      })()
    `,
    returnByValue: true,
  });
  console.log('Clicked crop button:', clickCropBtn.result.value);
  await sleep(1000);

  // Capture modal
  const { data: modalData } = await client.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(ARTIFACT_DIR, 'image-crop-modal.png'), Buffer.from(modalData, 'base64'));
  console.log('Saved image-crop-modal.png');

  client.close();
  proc.kill('SIGKILL');
  console.log('=== All requested screenshots captured successfully ===');
}

main().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});

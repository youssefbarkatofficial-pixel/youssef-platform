import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\mohammed\\.gemini\\antigravity\\brain\\1d6c450a-94c1-4c40-b814-bff021014ff4\\screenshots-round3';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const userDataDir = join(tmpdir(), 'edge-cdp-teacher-' + Date.now());
  const proc = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    'http://localhost:5173/#about',
  ]);
  await sleep(2500);

  const targets = await (await fetch('http://localhost:9222/json')).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 1;
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const curId = id++;
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === curId) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');

  const getAboutRect = async () => {
    const res = await send('Runtime.evaluate', {
      expression: `
        (() => {
          let el = document.querySelector('#about');
          if (!el) return null;
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
          const r = el.getBoundingClientRect();
          return {
            x: Math.max(0, Math.floor(r.x + window.scrollX)),
            y: Math.max(0, Math.floor(r.y + window.scrollY)),
            width: Math.ceil(r.width),
            height: Math.ceil(r.height)
          };
        })()
      `,
      returnByValue: true,
    });
    return res.result.value ? { ...res.result.value, scale: 1 } : undefined;
  };

  // 1. Desktop Light (1280px)
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Runtime.evaluate', {
    expression: `
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.setAttribute('data-mode', 'light');
    `,
  });
  await sleep(500);
  let clip = await getAboutRect();
  let shot = await send('Page.captureScreenshot', { format: 'png', clip });
  writeFileSync(join(ARTIFACT_DIR, 'teacher-box-light-desktop.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved teacher-box-light-desktop.png');

  // 2. Desktop Dark (1280px)
  await send('Runtime.evaluate', {
    expression: `
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-mode', 'dark');
    `,
  });
  await sleep(500);
  clip = await getAboutRect();
  shot = await send('Page.captureScreenshot', { format: 'png', clip });
  writeFileSync(join(ARTIFACT_DIR, 'teacher-box-dark-desktop.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved teacher-box-dark-desktop.png');

  // 3. Mobile Light (390px)
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Runtime.evaluate', {
    expression: `
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.setAttribute('data-mode', 'light');
    `,
  });
  await sleep(500);
  clip = await getAboutRect();
  shot = await send('Page.captureScreenshot', { format: 'png', clip });
  writeFileSync(join(ARTIFACT_DIR, 'teacher-box-mobile-light.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved teacher-box-mobile-light.png');

  // 4. Mobile Dark (390px)
  await send('Runtime.evaluate', {
    expression: `
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-mode', 'dark');
    `,
  });
  await sleep(500);
  clip = await getAboutRect();
  shot = await send('Page.captureScreenshot', { format: 'png', clip });
  writeFileSync(join(ARTIFACT_DIR, 'teacher-box-mobile-dark.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved teacher-box-mobile-dark.png');

  ws.close();
  proc.kill('SIGKILL');
}

run().catch(console.error);

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\mohammed\\.gemini\\antigravity\\brain\\1d6c450a-94c1-4c40-b814-bff021014ff4\\screenshots-round3';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const userDataDir = join(tmpdir(), 'edge-cdp-shot-a-' + Date.now());
  const proc = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    'http://localhost:5173/',
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:5173/?mode=light' });
  await sleep(2500);
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('yb_theme_mode', 'light');
      document.documentElement.setAttribute('data-mode', 'light');
      document.documentElement.classList.add('light');
    `,
  });
  await sleep(1000);

  const rectRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        let el = document.querySelector('h1');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: Math.max(0, Math.floor(r.x - 20)),
          y: Math.max(0, Math.floor(r.y - 16)),
          width: Math.ceil(r.width + 40),
          height: Math.ceil(r.height + 32)
        };
      })()
    `,
    returnByValue: true,
  });

  const clip = rectRes.result.value ? { ...rectRes.result.value, scale: 1 } : undefined;
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip });
  writeFileSync(join(ARTIFACT_DIR, 'title-gold-option-a-confirmed.png'), Buffer.from(data, 'base64'));
  console.log('Saved title-gold-option-a-confirmed.png successfully, size:', data.length);
  ws.close();
  proc.kill('SIGKILL');
}

run().catch(console.error);

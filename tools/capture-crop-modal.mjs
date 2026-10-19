import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\mohammed\\.gemini\\antigravity\\brain\\1d6c450a-94c1-4c40-b814-bff021014ff4\\screenshots-round3';

const proc = spawn(EDGE_PATH, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--no-first-run',
  '--disable-gpu',
  'http://localhost:5173/admin/settings?dev_admin=true',
]);

await new Promise((r) => setTimeout(r, 2500));
const targetsRes = await fetch('http://localhost:9222/json');
const targets = await targetsRes.json();
const pageTarget = targets.find((t) => t.type === 'page');
const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 1;
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const msgId = id++;
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === msgId) {
        ws.removeEventListener('message', handler);
        if (msg.error) rej(msg.error);
        else res(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 950,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url: 'http://localhost:5173/admin/settings?dev_admin=true' });
await new Promise((r) => setTimeout(r, 2500));

// Click on 'تعديل وقص تفاعلي'
const clicked = await send('Runtime.evaluate', {
  expression: `(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent && b.textContent.includes('تعديل وقص تفاعلي'));
    if (btn) { btn.click(); return true; }
    return false;
  })()`,
  returnByValue: true,
});
console.log('Clicked crop button:', clicked.result.value);
await new Promise((r) => setTimeout(r, 1200));

const { data } = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(ARTIFACT_DIR, 'image-crop-modal.png'), Buffer.from(data, 'base64'));
console.log('Captured image-crop-modal.png successfully!');

ws.close();
proc.kill('SIGKILL');
process.exit(0);

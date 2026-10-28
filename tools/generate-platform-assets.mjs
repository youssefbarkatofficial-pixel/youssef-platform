import cp from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SVG_SOURCE = 'لوجو البوصلة مفرغ.svg';

if (!fs.existsSync(SVG_SOURCE)) {
  console.error('Source SVG file not found:', SVG_SOURCE);
  process.exit(1);
}

const rawSvg = fs.readFileSync(SVG_SOURCE, 'utf8');

// 1. Copy SVG to public destinations
const publicDirs = [
  'v2-app/public/icons',
  'v2-app/public/assets/images',
  'v2-app/public'
];
for (const dir of publicDirs) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync('v2-app/public/icons/logo.svg', rawSvg, 'utf8');
fs.writeFileSync('v2-app/public/favicon.svg', rawSvg, 'utf8');
fs.writeFileSync('v2-app/public/assets/images/logo.svg', rawSvg, 'utf8');
console.log('✔ Copied logo.svg and favicon.svg');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 2. Launch Headless Edge for rasterization
async function launchEdgeCDP() {
  const port = 9666;
  const userDataDir = path.join(os.tmpdir(), 'edge-logo-' + Date.now());
  const proc = cp.spawn(EDGE_PATH, [
    '--headless=new',
    '--no-first-run',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ]);

  await sleep(2500);

  const listRes = await fetch(`http://127.0.0.1:${port}/json`);
  const targets = await listRes.json();
  const pageTarget = targets.find(t => t.type === 'page');
  if (!pageTarget) throw new Error('No page target found: ' + JSON.stringify(targets));

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  let id = 1;
  const callbacks = new Map();
  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.id && callbacks.has(data.id)) {
      callbacks.get(data.id)(data);
      callbacks.delete(data.id);
    }
  };

  function send(method, params = {}) {
    return new Promise(res => {
      const msgId = id++;
      callbacks.set(msgId, res);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await send('Page.enable');

  const tmpHtmlPath = path.join(os.tmpdir(), 'render-logo.html');

  async function renderToPng(options) {
    const { width, height, bgColor = 'transparent', padding = 0 } = options;
    const innerW = width - (padding * 2);
    const innerH = height - (padding * 2);

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: ${width}px;
    height: ${height}px;
    background: ${bgColor};
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  svg {
    width: ${innerW}px;
    height: ${innerH}px;
    display: block;
  }
</style>
</head>
<body>
  ${rawSvg}
</body>
</html>`;

    fs.writeFileSync(tmpHtmlPath, html, 'utf8');
    const fileUrl = 'file:///' + tmpHtmlPath.replace(/\\/g, '/');

    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false
    });
    await send('Page.navigate', { url: fileUrl });
    await sleep(400);

    const response = await send('Page.captureScreenshot', { format: 'png' });
    const b64 = response?.result?.data;
    if (!b64) throw new Error('Failed to capture screenshot: ' + JSON.stringify(response));

    return Buffer.from(b64, 'base64');
  }

  async function close() {
    try { ws.close(); } catch {}
    try { proc.kill(); } catch {}
    try { fs.unlinkSync(tmpHtmlPath); } catch {}
  }

  return { renderToPng, close };
}

function createIco(images) {
  const count = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + (dirEntrySize * count);

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO format
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  for (const img of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // colors
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(img.buffer.length, 8); // size
    entry.writeUInt32LE(offset, 12); // offset
    dirEntries.push(entry);
    offset += img.buffer.length;
  }

  return Buffer.concat([
    header,
    ...dirEntries,
    ...images.map(img => img.buffer)
  ]);
}

async function main() {
  console.log('Starting Edge CDP rasterizer...');
  const cdp = await launchEdgeCDP();

  try {
    // 512x512 transparent
    console.log('Rendering 512x512 transparent...');
    const png512 = await cdp.renderToPng({ width: 512, height: 512 });
    fs.writeFileSync('v2-app/public/icons/icon-512.png', png512);
    fs.writeFileSync('v2-app/public/assets/images/og-image.png', png512);
    console.log('✔ Saved icon-512.png and og-image.png (' + png512.length + ' bytes)');

    // 192x192 transparent
    console.log('Rendering 192x192 transparent...');
    const png192 = await cdp.renderToPng({ width: 192, height: 192 });
    fs.writeFileSync('v2-app/public/icons/icon-192.png', png192);
    console.log('✔ Saved icon-192.png (' + png192.length + ' bytes)');

    // 180x180 transparent (apple touch icon)
    console.log('Rendering 180x180 transparent...');
    const png180 = await cdp.renderToPng({ width: 180, height: 180 });
    fs.writeFileSync('v2-app/public/icons/apple-touch-icon-180.png', png180);
    console.log('✔ Saved apple-touch-icon-180.png (' + png180.length + ' bytes)');

    // 512x512 maskable (with 52px padding = 10% safe area, dark navy background #071226)
    console.log('Rendering 512x512 maskable...');
    const pngMaskable = await cdp.renderToPng({
      width: 512,
      height: 512,
      bgColor: '#071226',
      padding: 52
    });
    fs.writeFileSync('v2-app/public/icons/icon-maskable-512.png', pngMaskable);
    console.log('✔ Saved icon-maskable-512.png (' + pngMaskable.length + ' bytes)');

    // 48x48 and 32x32 for favicon.ico
    console.log('Rendering 48x48 and 32x32 for favicon.ico...');
    const png48 = await cdp.renderToPng({ width: 48, height: 48 });
    const png32 = await cdp.renderToPng({ width: 32, height: 32 });
    const ico = createIco([
      { width: 48, height: 48, buffer: png48 },
      { width: 32, height: 32, buffer: png32 }
    ]);
    fs.writeFileSync('v2-app/public/favicon.ico', ico);
    console.log('✔ Saved favicon.ico (' + ico.length + ' bytes)');

    // Legacy webp logos (256x256)
    console.log('Rendering 256x256 webp for legacy logos...');
    const webp256 = await cdp.renderToPng({ width: 256, height: 256 });
    fs.writeFileSync('v2-app/public/assets/images/ownerNavLogoImage-legacy.webp', webp256);
    fs.writeFileSync('v2-app/public/assets/images/ownerFooterLogoImage-legacy.webp', webp256);
    fs.writeFileSync('v2-app/public/assets/images/ownerFeaturesLogoImage-legacy.webp', webp256);
    console.log('✔ Saved legacy logo images (' + webp256.length + ' bytes)');

    console.log('\n🎉 ALL ICONS AND FAVICONS GENERATED SUCCESSFULLY!');
  } finally {
    await cdp.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

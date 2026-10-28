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

// 1. Ensure public directories exist and copy SVGs
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
  const port = 9668;
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
  // Crucial: Override default background to 100% transparent (no white background from browser viewport)
  await send('Emulation.setDefaultBackgroundColorOverride', {
    color: { r: 0, g: 0, b: 0, a: 0 }
  });

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
    background: ${bgColor} !important;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  svg {
    width: ${innerW}px;
    height: ${innerH}px;
    display: block;
    margin: auto;
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

    const response = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true
    });
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
    // 1. Full-size transparent icons (padded minimally ~1% so edge subpixels never clip)
    console.log('Rendering 512x512 transparent (maximized, no clip)...');
    const png512 = await cdp.renderToPng({ width: 512, height: 512, padding: 4 });
    fs.writeFileSync('v2-app/public/icons/icon-512.png', png512);
    fs.writeFileSync('v2-app/public/assets/images/og-image.png', png512);
    console.log('✔ Saved icon-512.png and og-image.png (' + png512.length + ' bytes)');

    console.log('Rendering 192x192 transparent (maximized, no clip)...');
    const png192 = await cdp.renderToPng({ width: 192, height: 192, padding: 2 });
    fs.writeFileSync('v2-app/public/icons/icon-192.png', png192);
    console.log('✔ Saved icon-192.png (' + png192.length + ' bytes)');

    console.log('Rendering 180x180 transparent (apple touch icon)...');
    const png180 = await cdp.renderToPng({ width: 180, height: 180, padding: 2 });
    fs.writeFileSync('v2-app/public/icons/apple-touch-icon-180.png', png180);
    console.log('✔ Saved apple-touch-icon-180.png (' + png180.length + ' bytes)');

    // 2. Maskable icons (TRANSPARENT background, scaled to safe-zone 72% so Android circular mask never cuts the loop or dial)
    console.log('Rendering 512x512 maskable (TRANSPARENT, safe-zone scaled)...');
    const pngMaskable512 = await cdp.renderToPng({
      width: 512,
      height: 512,
      bgColor: 'transparent',
      padding: 70
    });
    fs.writeFileSync('v2-app/public/icons/icon-maskable-512.png', pngMaskable512);
    console.log('✔ Saved icon-maskable-512.png (' + pngMaskable512.length + ' bytes)');

    console.log('Rendering 192x192 maskable (TRANSPARENT, safe-zone scaled)...');
    const pngMaskable192 = await cdp.renderToPng({
      width: 192,
      height: 192,
      bgColor: 'transparent',
      padding: 26
    });
    fs.writeFileSync('v2-app/public/icons/icon-maskable-192.png', pngMaskable192);
    console.log('✔ Saved icon-maskable-192.png (' + pngMaskable192.length + ' bytes)');

    // 3. 48x48 and 32x32 for favicon.ico
    console.log('Rendering 48x48 and 32x32 for favicon.ico...');
    const png48 = await cdp.renderToPng({ width: 48, height: 48, padding: 1 });
    const png32 = await cdp.renderToPng({ width: 32, height: 32, padding: 1 });
    const ico = createIco([
      { width: 48, height: 48, buffer: png48 },
      { width: 32, height: 32, buffer: png32 }
    ]);
    fs.writeFileSync('v2-app/public/favicon.ico', ico);
    console.log('✔ Saved favicon.ico (' + ico.length + ' bytes)');

    // 4. Legacy webp logos (256x256, transparent)
    console.log('Rendering 256x256 for legacy logos...');
    const webp256 = await cdp.renderToPng({ width: 256, height: 256, padding: 2 });
    fs.writeFileSync('v2-app/public/assets/images/ownerNavLogoImage-legacy.webp', webp256);
    fs.writeFileSync('v2-app/public/assets/images/ownerFooterLogoImage-legacy.webp', webp256);
    fs.writeFileSync('v2-app/public/assets/images/ownerFeaturesLogoImage-legacy.webp', webp256);
    console.log('✔ Saved legacy logo images (' + webp256.length + ' bytes)');

    // 5. Android Native Launcher Mipmap Icons (ALL 100% TRANSPARENT)
    const androidResDir = 'v2-app/android/app/src/main/res';
    if (fs.existsSync(androidResDir)) {
      console.log('\n--- Generating Android Native Mipmap Icons (100% Transparent) ---');
      const densities = [
        { dir: 'mipmap-mdpi', size: 48, fgSize: 108, fgPad: 18 },
        { dir: 'mipmap-hdpi', size: 72, fgSize: 162, fgPad: 27 },
        { dir: 'mipmap-xhdpi', size: 96, fgSize: 216, fgPad: 36 },
        { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324, fgPad: 54 },
        { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432, fgPad: 72 }
      ];

      for (const d of densities) {
        const targetDir = path.join(androidResDir, d.dir);
        fs.mkdirSync(targetDir, { recursive: true });

        // Full legacy launcher icon (transparent)
        const legacyPng = await cdp.renderToPng({ width: d.size, height: d.size, padding: 1 });
        fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), legacyPng);
        fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), legacyPng);

        // Adaptive icon foreground (108dp canvas, safe-zone scaled, transparent)
        const fgPng = await cdp.renderToPng({ width: d.fgSize, height: d.fgSize, padding: d.fgPad });
        fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), fgPng);

        console.log(`✔ Generated Android ${d.dir} (size: ${d.size}x${d.size}, fg: ${d.fgSize}x${d.fgSize})`);
      }
    }

    console.log('\n🎉 ALL WEB AND ANDROID ICONS GENERATED WITH 100% TRANSPARENCY & ZERO CLIPPING!');
  } finally {
    await cdp.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

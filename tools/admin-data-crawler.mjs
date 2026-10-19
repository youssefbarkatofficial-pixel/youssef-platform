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
  console.log('=== Admin Pages Light Mode Verification with Data-Wait ===');

  const testAdmin = { email: 'e2e_admin_test@youssefbarakat.local', pass: 'AdminTestPass123!' };
  const userDataDir = join(tmpdir(), 'edge-cdp-admin-' + Date.now());
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

  const targets = await (await fetch('http://localhost:9222/json')).json();
  const pageTarget = targets.find((t) => t.type === 'page');
  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');

  // Mobile viewport 390px
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

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
    await sleep(200);
  }

  // Admin Login
  console.log('Logging in as test admin...');
  await client.send('Page.navigate', { url: 'http://localhost:5173/admin/login?mode=light' });
  await sleep(2500);
  await setMode('light');

  await client.send('Runtime.evaluate', {
    expression: `
      (async () => {
        function setVal(input, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const inputs = Array.from(document.querySelectorAll('input'));
        setVal(inputs[0], '${testAdmin.email}');
        setVal(inputs[1], '${testAdmin.pass}');
        const btn = document.querySelector('button[type="submit"]');
        if (btn) btn.click();
      })()
    `,
  });

  await sleep(3500); // wait for auth & redirect to /admin

  // Admin Data Pages to inspect
  const adminPages = [
    { path: '/admin/students', name: 'إدارة الطلاب' },
    { path: '/admin/settings', name: 'الإعدادات العامة' },
    { path: '/admin/payments', name: 'المدفوعات' },
    { path: '/admin/notifications', name: 'الإشعارات' },
    { path: '/admin/courses', name: 'إدارة الكورسات' },
    { path: '/admin/bot', name: 'مراقبة البوصلة' },
    { path: '/admin/support', name: 'دعم الأدمن' },
    { path: '/admin/game', name: 'إدارة اللعبة' },
    { path: '/admin/question-bank', name: 'بنك الأسئلة' },
    { path: '/admin/adopt-courses', name: 'تنسيق الكورسات' },
    { path: '/admin/quick-upload', name: 'الرفع السريع' },
    { path: '/admin/analytics', name: 'التحليلات' },
  ];

  const results = [];

  for (const page of adminPages) {
    console.log(`\nNavigating to ${page.path} in LIGHT mode (390px)...`);
    await client.send('Page.navigate', { url: `http://localhost:5173${page.path}?mode=light` });
    await setMode('light');

    // Wait loop: Poll until data has fully loaded (max 8 seconds)
    let ready = false;
    for (let i = 0; i < 16; i++) {
      await sleep(500);
      const checkRes = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const hasSpinner = Boolean(document.querySelector('.animate-spin'));
            let isReady = false;
            if (window.location.pathname === '/admin/students') {
              isReady = !hasSpinner && Boolean(document.querySelector('table tbody tr a'));
            } else if (window.location.pathname === '/admin/payments') {
              isReady = !hasSpinner && document.querySelectorAll('table tbody tr').length > 1;
            } else if (window.location.pathname === '/admin/courses') {
              isReady = !hasSpinner && document.querySelectorAll('table tbody tr').length > 1;
            } else if (window.location.pathname === '/admin/settings') {
              isReady = !hasSpinner && document.querySelectorAll('input').length >= 8;
            } else if (window.location.pathname === '/admin/notifications') {
              isReady = !hasSpinner && document.querySelectorAll('button, input').length >= 4;
            } else {
              isReady = !hasSpinner;
            }
            return {
              hasSpinner,
              tableRows: document.querySelectorAll('table tbody tr').length,
              inputs: document.querySelectorAll('input').length,
              buttons: document.querySelectorAll('button').length,
              isReady
            };
          })()
        `,
        returnByValue: true,
      });

      if (checkRes.result.value?.isReady) {
        ready = true;
        console.log(`Data ready on ${page.path} after ${(i + 1) * 500}ms! Stats:`, checkRes.result.value);
        break;
      }
    }

    // Additional calm down
    await sleep(600);

    // Scan links, buttons, dead links (strictly without capturing student personal text)
    const scanRes = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const links = Array.from(document.querySelectorAll('a'));
          const deadLinks = [];
          for (const a of links) {
            const href = a.getAttribute('href');
            const aria = a.getAttribute('aria-label') || a.title || '';
            // Safe identification without printing student names/phones
            const isStudentDetail = href && href.startsWith('/admin/students/');
            const safeLabel = isStudentDetail ? 'رابط ملف طالب (محمي)' : (aria || (a.innerText ? a.innerText.slice(0, 30) : '(بدون نص)'));
            
            if (!href || href === '' || href === '#' || href === 'javascript:void(0);' || href === 'javascript:;' || href.includes('undefined') || href.includes('null') || href.includes('[object')) {
              deadLinks.push({
                element: 'a',
                safeLabel,
                href: href || '(فارغ)',
                reason: !href || href === '' ? 'رابط فارغ' : href === '#' ? 'مرساة ميتة (#)' : 'رابط غير صالح'
              });
            }
          }

          const buttons = Array.from(document.querySelectorAll('button'));
          const tabs = Array.from(document.querySelectorAll('[role="tab"], button[role="tab"], [data-tab]'));

          return {
            title: document.title,
            currentUrl: window.location.pathname,
            linksCount: links.length,
            deadLinksCount: deadLinks.length,
            deadLinks,
            buttonsCount: buttons.length,
            tabsCount: tabs.length,
            tableRowsCount: document.querySelectorAll('table tbody tr').length
          };
        })()
      `,
      returnByValue: true,
    });

    const data = scanRes.result.value;
    console.log(`[Result Light 390px] ${page.path} (${page.name}): ${data.linksCount} links, ${data.buttonsCount} buttons, ${data.deadLinksCount} dead links, ${data.tableRowsCount} table rows`);
    results.push({
      path: page.path,
      name: page.name,
      ...data,
    });
  }

  const outPath = join(ARTIFACT_DIR, 'admin-light-data-crawled.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('Saved report to', outPath);

  client.close();
  proc.kill('SIGKILL');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

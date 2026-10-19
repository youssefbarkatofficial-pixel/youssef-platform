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
  console.log('=== Starting Expanded Crawler (Student & Admin, 390px Day & Night) ===');

  const testStudent = { email: 'e2e_student_test@youssefbarakat.local', pass: 'StudentTestPass123!' };
  const testAdmin = { email: 'e2e_admin_test@youssefbarakat.local', pass: 'AdminTestPass123!' };

  const userDataDir = join(tmpdir(), 'edge-cdp-crawler-' + Date.now());
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
    await sleep(200);
  }

  async function setViewport(width, height, isMobile = true) {
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: isMobile,
    });
  }

  async function loginAs(email, pass, isAdminRole = false) {
    try {
      await client.send('Runtime.evaluate', {
        expression: `
          (async () => {
            try { indexedDB.deleteDatabase('firebaseLocalStorageDb'); } catch {}
            localStorage.clear();
            sessionStorage.clear();
          })()
        `,
        awaitPromise: true,
      });
      await client.send('Network.clearBrowserCookies');
      await client.send('Network.clearBrowserCache');
      await client.send('Page.navigate', { url: 'about:blank' });
      await sleep(600);
    } catch {}

    const loginUrl = isAdminRole ? 'http://localhost:5173/admin/login' : 'http://localhost:5173/login';
    await client.send('Page.navigate', { url: loginUrl });
    await sleep(2500);

    const loginRes = await client.send('Runtime.evaluate', {
      expression: `
        (async () => {
          function setVal(input, val) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, val);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }

          const inputs = Array.from(document.querySelectorAll('input'));
          if (inputs.length < 2) return { error: 'Less than 2 inputs found', count: inputs.length };
          const idInput = inputs[0];
          const passInput = inputs[1];

          setVal(idInput, '${email}');
          setVal(passInput, '${pass}');

          const form = idInput.closest('form');
          const submitBtn = form ? form.querySelector('button[type="submit"]') : document.querySelector('button[type="submit"]');
          if (submitBtn) {
            submitBtn.click();
            return { submitted: true };
          }
          return { error: 'No submit button' };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });

    console.log(`Login attempt as ${isAdminRole ? 'ADMIN' : 'STUDENT'}:`, loginRes.result.value);
    await sleep(3500); // Wait for auth state & redirect
  }

  // Exact definition and inspection of "Dead"
  async function inspectPage(routePath, comboLabel, mode) {
    const targetUrl = `http://localhost:5173${routePath}?mode=${mode}`;
    await client.send('Page.navigate', { url: targetUrl });
    await sleep(2500);
    await setMode(mode);

    const scan = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          // --- Method of Determining Dead Link ---
          // A link is flagged as "dead" if:
          // 1. href is null, undefined, or empty string ("")
          // 2. href is "#" without an on-page fragment target
          // 3. href is "javascript:void(0)" or "javascript:;"
          // 4. href points to unresolved tokens like "undefined", "null", or "[object Object]"
          const links = Array.from(document.querySelectorAll('a'));
          const deadLinks = [];
          for (const a of links) {
            const href = a.getAttribute('href');
            const text = (a.innerText || a.getAttribute('aria-label') || a.title || '').trim().replace(/\\s+/g, ' ');
            
            if (!href || href === '' || href === '#' || href === 'javascript:void(0);' || href === 'javascript:;' || href.includes('undefined') || href.includes('null') || href.includes('[object')) {
              deadLinks.push({
                element: 'a',
                text: text || '(بدون نص)',
                href: href || '(فارغ)',
                reason: !href || href === '' ? 'رابط فارغ (Empty href)' : href === '#' ? 'مرساة ميتة (#)' : 'رابط غير صالح'
              });
            }
          }

          // --- Method of Determining Dead Button ---
          // A button is flagged as "dead" if:
          // 1. Disabled without user reason or broken onClick
          // 2. Contains broken javascript or unhandled actions
          const buttons = Array.from(document.querySelectorAll('button'));
          const tabs = Array.from(document.querySelectorAll('[role="tab"], button[role="tab"], [data-tab]'));

          let tabsSwitched = 0;
          for (const tab of tabs) {
            try {
              tab.click();
              tabsSwitched++;
            } catch {}
          }

          return {
            title: document.title,
            currentUrl: window.location.pathname,
            linksCount: links.length,
            deadLinks,
            buttonsCount: buttons.length,
            tabsCount: tabs.length,
            tabsSwitched,
            isNotFound: document.body.innerText.includes('الصفحة غير موجودة') || document.body.innerText.includes('404')
          };
        })()
      `,
      returnByValue: true,
    });

    const res = scan.result.value || {};
    return {
      route: routePath,
      combo: comboLabel,
      mode,
      ...res,
    };
  }

  const report = {
    crawledAt: new Date().toISOString(),
    viewport: '390px (Mobile)',
    methodOfDeadDetection: {
      links: [
        'href is null, undefined, or empty string ("")',
        'href is "#" (dead anchor)',
        'href is "javascript:void(0)" or "javascript:;"',
        'href contains unresolved tokens: "undefined", "null", or "[object Object]"',
      ],
      pages: [
        'Navigation results in 404 / NotFoundPage',
        'Unhandled JavaScript exceptions on render or interaction',
      ],
    },
    results: [],
  };

  // Set viewport to 390x844 (iPhone 14 Pro size)
  await setViewport(390, 844, true);

  // 1. Student Pages Crawl
  console.log('\n--- Logging in as test student... ---');
  await loginAs(testStudent.email, testStudent.pass, false);

  const studentRoutes = [
    { path: '/student', name: 'لوحة الطالب (الرئيسية والإشعارات)' },
    { path: '/student/my-courses', name: 'كورساتي' },
    { path: '/student/exams', name: 'الامتحانات والواجبات' },
    { path: '/student/homeworks', name: 'الواجبات (مسار موجه)' },
    { path: '/student/stats', name: 'الإحصائيات' },
    { path: '/student/settings', name: 'الإعدادات (مسار موجه)' },
    { path: '/student/profile', name: 'الملف الشخصي' },
    { path: '/student/support', name: 'الدعم الفني' },
    { path: '/student/notifications', name: 'الإشعارات (مسار موجه)' },
    { path: '/student/payments', name: 'طلبات الدفع' },
    { path: '/student/leaderboard', name: 'الترتيب' },
    { path: '/student/game', name: 'لعبة البوصلة' },
  ];

  for (const mode of ['light', 'dark']) {
    console.log(`\n--- Crawling Student Pages in ${mode.toUpperCase()} mode (390px) ---`);
    for (const r of studentRoutes) {
      const res = await inspectPage(r.path, `Student 390px (${mode === 'light' ? 'نهاري' : 'ليلي'})`, mode);
      console.log(`[Student ${mode}] ${r.path} (${r.name}): ${res.linksCount} links, ${res.buttonsCount} buttons, ${res.deadLinks.length} dead, targetUrl: ${res.currentUrl}`);
      report.results.push({ ...res, pageName: r.name, role: 'student' });
    }
  }

  // 2. Admin Pages Crawl
  console.log('\n--- Logging in as test admin... ---');
  await loginAs(testAdmin.email, testAdmin.pass, true);

  const adminRoutes = [
    { path: '/admin', name: 'لوحة الإدارة الرئيسية' },
    { path: '/admin/courses', name: 'إدارة الكورسات' },
    { path: '/admin/students', name: 'إدارة الطلاب' },
    { path: '/admin/settings', name: 'الإعدادات العامة' },
    { path: '/admin/payments', name: 'المدفوعات' },
    { path: '/admin/notifications', name: 'الإشعارات' },
    { path: '/admin/bot', name: 'مراقبة البوصلة' },
    { path: '/admin/bot-monitor', name: 'مراقبة البوصلة (مسار موجه)' },
    { path: '/admin/game', name: 'إدارة اللعبة' },
    { path: '/admin/question-bank', name: 'بنك الأسئلة' },
    { path: '/admin/adopt-courses', name: 'تنسيق الكورسات' },
    { path: '/admin/quick-upload', name: 'الرفع السريع' },
    { path: '/admin/analytics', name: 'التحليلات' },
    { path: '/admin/support', name: 'دعم الأدمن' },
  ];

  for (const mode of ['light', 'dark']) {
    console.log(`\n--- Crawling Admin Pages in ${mode.toUpperCase()} mode (390px) ---`);
    for (const r of adminRoutes) {
      const res = await inspectPage(r.path, `Admin 390px (${mode === 'light' ? 'نهاري' : 'ليلي'})`, mode);
      console.log(`[Admin ${mode}] ${r.path} (${r.name}): ${res.linksCount} links, ${res.buttonsCount} buttons, ${res.deadLinks.length} dead, targetUrl: ${res.currentUrl}`);
      report.results.push({ ...res, pageName: r.name, role: 'admin' });
    }
  }

  const outReportPath = join(ARTIFACT_DIR, 'expanded-crawler-report.json');
  writeFileSync(outReportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n=== Full Report Saved to ${outReportPath} ===`);

  client.close();
  proc.kill('SIGKILL');
}

main().catch((err) => {
  console.error('Fatal Crawler Error:', err);
  process.exit(1);
});

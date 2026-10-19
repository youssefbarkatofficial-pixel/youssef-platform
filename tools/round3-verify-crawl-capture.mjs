import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
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
  console.log('=== Round 3 Verification & Crawler Starting ===');

  const testStudent = { email: 'e2e_student_test@youssefbarakat.local', pass: 'StudentTestPass123!' };
  const testAdmin = { email: 'e2e_admin_test@youssefbarakat.local', pass: 'AdminTestPass123!' };

  // 1. Mobile HTTP POST proof to /api/bot (with authenticated student ID token)
  console.log('\n--- [1. Mobile HTTP Proof to Bousala via Vite Proxy] ---');
  const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  let mobileHttpResult = null;
  try {
    const envFile = readFileSync('v2-app/.env', 'utf8');
    const webApiKey = envFile.split('\n')[0].split('=')[1].trim();

    // Sign in to get real ID token for test student
    const signInRes = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + webApiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testStudent.email, password: testStudent.pass, returnSecureToken: true }),
    });
    const signInData = await signInRes.json();
    const idToken = signInData.idToken;

    const res = await fetch('http://localhost:5173/api/bot/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'User-Agent': mobileUA,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'من هو مؤسس الدولة الفاطمية في مصر؟',
      }),
    });
    const data = await res.json();
    mobileHttpResult = {
      status: res.status,
      ok: res.ok,
      hasReply: Boolean(data.reply),
      replySnippet: (data.reply || '').slice(0, 160),
      remaining: data.remaining,
      source: data.source,
    };
    console.log('Mobile HTTP Response:', mobileHttpResult);
  } catch (err) {
    console.error('Mobile HTTP Error:', err);
    mobileHttpResult = { error: err.message };
  }

  // 2. Launch Browser for E2E Crawler & Screenshots
  const userDataDir = join(tmpdir(), 'edge-cdp-r3-' + Date.now());
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
    await sleep(250);
  }

  async function captureShot(filename, { width, height, mode = 'dark', url = 'http://localhost:5173/', evalBefore = null, clip = null }) {
    console.log(`Capturing: ${filename} (${width}x${height}, ${mode})...`);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });

    const targetUrl = url.includes('?') ? `${url}&mode=${mode}` : `${url}?mode=${mode}`;
    await client.send('Page.navigate', { url: targetUrl });
    await sleep(2000);

    await setMode(mode);

    if (evalBefore) {
      await client.send('Runtime.evaluate', { expression: evalBefore });
      await sleep(800);
    }

    const captureParams = { format: 'png' };
    if (clip) {
      captureParams.clip = clip;
    }

    const { data } = await client.send('Page.captureScreenshot', captureParams);
    const buf = Buffer.from(data, 'base64');
    const outPath = join(ARTIFACT_DIR, filename);
    writeFileSync(outPath, buf);
    console.log(`Saved ${filename} (${buf.length} bytes)`);
  }

  async function captureElementShot(selector, filename, { width = 1280, height = 900, mode = 'dark', url = 'http://localhost:5173/' }) {
    console.log(`Capturing element ${selector} -> ${filename} (${width}x${height}, ${mode})...`);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });

    const targetUrl = url.includes('?') ? `${url}&mode=${mode}` : `${url}?mode=${mode}`;
    await client.send('Page.navigate', { url: targetUrl });
    await sleep(2200);

    await setMode(mode);
    await sleep(400);

    const rectRes = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          let el = document.querySelector('${selector}');
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
    const { data } = await client.send('Page.captureScreenshot', { format: 'png', clip });
    const buf = Buffer.from(data, 'base64');
    const outPath = join(ARTIFACT_DIR, filename);
    writeFileSync(outPath, buf);
    console.log(`Saved ${filename} (${buf.length} bytes), clip:`, clip);
  }

  // --- Step 2A: Capture Hero Title Gold Options & Night Mode ---
  console.log('\n--- [2A. Capturing Hero Title Gold Options] ---');
  // Option A (Legacy gold, Light mode)
  await captureElementShot('h1', 'title-gold-option-a.png', {
    width: 1280,
    height: 900,
    mode: 'light',
    url: 'http://localhost:5173/?gold=a&preview_stats=1',
  });

  // Option B (Darker gold with subtle shadow, Light mode)
  await captureElementShot('h1', 'title-gold-option-b.png', {
    width: 1280,
    height: 900,
    mode: 'light',
    url: 'http://localhost:5173/?gold=b&preview_stats=1',
  });

  // Night Mode (Full Royal Gold)
  await captureElementShot('h1', 'title-gold-night.png', {
    width: 1280,
    height: 900,
    mode: 'dark',
    url: 'http://localhost:5173/?gold=b&preview_stats=1',
  });

  // --- Step 2B: Capture Hero on 1080p and 768p ---
  console.log('\n--- [2B. Capturing Hero Viewports (1080p and 768p)] ---');
  // 1080p Desktop: 1920x1080
  await captureShot('hero-desktop-1080p.png', {
    width: 1920,
    height: 1080,
    mode: 'dark',
    url: 'http://localhost:5173/?preview_stats=1',
  });

  // 768p Desktop: 1366x768
  await captureShot('hero-desktop-768p.png', {
    width: 1366,
    height: 768,
    mode: 'dark',
    url: 'http://localhost:5173/?preview_stats=1',
  });

  // --- Step 2C: Capture Animated Stats Bar ---
  console.log('\n--- [2C. Capturing Animated Stats Bar] ---');
  await captureElementShot('.font-num', 'stats-bar-animated.png', {
    width: 1280,
    height: 900,
    mode: 'dark',
    url: 'http://localhost:5173/?preview_stats=1',
  });

  // --- Step 2D: Bousala Mobile Drawer with iOS Scroll Lock Verification ---
  console.log('\n--- [2D. Testing Bousala Mobile Drawer with iOS Scroll Lock] ---');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await client.send('Emulation.setUserAgentOverride', {
    userAgent: mobileUA,
  });

  await client.send('Page.navigate', { url: 'http://localhost:5173/' });
  await sleep(2000);

  // Click Bousala floating button to open drawer
  const openRes = await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('button[aria-label="فتح شات البوصلة"]') ||
                    Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').includes('البوصلة'));
        if (btn) {
          btn.click();
          return { clicked: true, text: btn.innerText };
        }
        return { clicked: false };
      })()
    `,
    returnByValue: true,
  });
  console.log('Opened Bousala drawer on mobile:', openRes.result.value);
  await sleep(1000);

  // Verify iOS Scroll Lock
  const lockCheck = await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          position: document.body.style.position,
          overflow: document.body.style.overflow,
          top: document.body.style.top,
          touchAction: document.body.style.touchAction,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('iOS Scroll Lock Verification Result:', lockCheck.result.value);

  // Send a message inside the mobile drawer
  const typeSendRes = await client.send('Runtime.evaluate', {
    expression: `
      (async () => {
        const input = document.querySelector('input[placeholder*="اسأل"]') ||
                      document.querySelector('form input');
        if (!input) return { error: 'No input found' };
        input.value = 'ما هي أسباب قيام ثورة 1919؟';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        const form = input.closest('form');
        const sendBtn = form ? form.querySelector('button[type="submit"]') : null;
        if (sendBtn) {
          sendBtn.click();
          return { sent: true, value: input.value };
        }
        return { error: 'No send button found' };
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Sent message in Bousala mobile drawer:', typeSendRes.result.value);

  // Wait 3.5s for bot reply
  await sleep(3500);

  // Check messages
  const messagesCheck = await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const bubbles = Array.from(document.querySelectorAll('[data-role="assistant"], .bg-theme-surface, p'))
          .map(el => el.innerText)
          .filter(t => t && t.length > 20);
        return {
          totalBubbles: bubbles.length,
          latestReplySnippet: bubbles[bubbles.length - 1]?.slice(0, 160) || ''
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('Bousala mobile conversation state:', messagesCheck.result.value);

  // Capture screenshot of mobile drawer
  const { data: drawerData } = await client.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(ARTIFACT_DIR, 'bousala-mobile-send.png'), Buffer.from(drawerData, 'base64'));
  console.log('Saved bousala-mobile-send.png');

  // Close drawer and verify unlock
  await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const closeBtn = document.querySelector('button[aria-label="إغلاق الشات"]');
        if (closeBtn) closeBtn.click();
      })()
    `,
  });
  await sleep(600);
  const unlockCheck = await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          position: document.body.style.position || '',
          overflow: document.body.style.overflow || '',
          top: document.body.style.top || ''
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('Scroll Unlock Check after Close:', unlockCheck.result.value);

  // --- Step 3: Link, Button & Tab Crawler ---
  console.log('\n--- [3. Link, Button & Tab Crawler] ---');

  // Helper to log in via React controlled inputs
  async function loginAs(email, pass, isAdminRole = false) {
    // Clear previous session completely
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

          const submitBtn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('دخول'));
          if (!submitBtn) return { error: 'No submit button' };
          submitBtn.click();
          return { submitted: true, idValue: idInput.value };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`Login attempt for ${email}:`, loginRes.result.value);
    await sleep(3500);
  }

  const crawlerReport = {
    testedAt: new Date().toISOString(),
    mobileHttpTest: mobileHttpResult,
    iosScrollLock: {
      lockedState: lockCheck.result.value,
      unlockedState: unlockCheck.result.value,
      isPass: lockCheck.result.value?.position === 'fixed' && !unlockCheck.result.value?.position,
    },
    sections: [],
  };

  async function crawlRoute(routePath, comboLabel) {
    await client.send('Page.navigate', { url: 'http://localhost:5173' + routePath });
    await sleep(2000);

    const scan = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const links = Array.from(document.querySelectorAll('a'));
          const deadLinks = [];
          for (const a of links) {
            const href = a.getAttribute('href');
            const text = (a.innerText || a.getAttribute('aria-label') || '').trim();
            if (!href || href === '#' || href === 'javascript:void(0);' || href === 'javascript:;') {
              deadLinks.push({ text: text || '(empty text)', href });
            }
          }

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
            tabsSwitched
          };
        })()
      `,
      returnByValue: true,
    });

    return {
      route: routePath,
      combo: comboLabel,
      ...(scan.result.value || {}),
    };
  }

  // 3.1 Public Routes on Desktop & Mobile
  const publicRoutes = ['/', '/courses', '/login', '/register', '/forgot-password', '/support'];
  const publicCombos = [
    { label: 'Desktop Dark (1280px)', w: 1280, h: 900, mode: 'dark' },
    { label: 'Mobile Light (390px)', w: 390, h: 844, mode: 'light' },
  ];

  for (const combo of publicCombos) {
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: combo.w,
      height: combo.h,
      deviceScaleFactor: 1,
      mobile: combo.w < 600,
    });
    await setMode(combo.mode);

    for (const r of publicRoutes) {
      const res = await crawlRoute(r, combo.label);
      crawlerReport.sections.push(res);
      console.log(`[Public] ${combo.label} -> ${r}: ${res.linksCount} links, ${res.buttonsCount} btns, ${res.deadLinks.length} dead links`);
    }
  }

  // 3.2 Student Routes (Log in as student)
  console.log('\n--- Logging in as test student for Student Crawl ---');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await setMode('dark');
  await loginAs(testStudent.email, testStudent.pass, false);

  const studentRoutes = [
    '/student',
    '/student/my-courses',
    '/student/exams',
    '/student/stats',
    '/student/leaderboard',
    '/student/game',
    '/student/profile',
    '/student/support',
    '/student/payments',
  ];

  for (const r of studentRoutes) {
    const res = await crawlRoute(r, 'Student Desktop Dark (1280px)');
    crawlerReport.sections.push(res);
    console.log(`[Student] ${r}: ${res.linksCount} links, ${res.buttonsCount} btns, ${res.deadLinks.length} dead links (at ${res.currentUrl})`);
  }

  // 3.3 Admin Routes (Log in as admin)
  console.log('\n--- Logging in as test admin for Admin Crawl ---');
  await loginAs(testAdmin.email, testAdmin.pass, true);

  const adminRoutes = [
    '/admin',
    '/admin/courses',
    '/admin/students',
    '/admin/settings',
    '/admin/payments',
    '/admin/notifications',
    '/admin/support',
    '/admin/bot-monitor',
    '/admin/game',
    '/admin/question-bank',
    '/admin/adopt-courses',
    '/admin/quick-upload',
    '/admin/analytics',
  ];

  for (const r of adminRoutes) {
    const res = await crawlRoute(r, 'Admin Desktop Dark (1280px)');
    crawlerReport.sections.push(res);
    console.log(`[Admin] ${r}: ${res.linksCount} links, ${res.buttonsCount} btns, ${res.deadLinks.length} dead links (at ${res.currentUrl})`);
  }

  // Capture Admin Settings Section 5 Screenshot
  console.log('\n--- Capturing Admin Settings Section 5 Screenshot ---');
  await client.send('Page.navigate', { url: 'http://localhost:5173/admin/settings' });
  await sleep(2500);
  const { data: settingsData } = await client.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(ARTIFACT_DIR, 'settings-stats-inputs.png'), Buffer.from(settingsData, 'base64'));
  console.log('Saved settings-stats-inputs.png');

  // Save full JSON report
  const reportPath = join(ARTIFACT_DIR, 'round3-full-crawler-report.json');
  writeFileSync(reportPath, JSON.stringify(crawlerReport, null, 2), 'utf8');
  console.log(`Saved crawler report to ${reportPath}`);

  client.close();
  proc.kill();
  console.log('=== All Round 3 Tasks & Crawls Completed Successfully ===');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

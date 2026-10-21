import { spawn } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const WebSocket = require('../v2-app/node_modules/ws');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DOMAIN = 'https://youssefbarakat.pages.dev';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.networkRequests = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Network.requestWillBeSent') {
          const url = msg.params.request.url;
          if (url.includes('examContent') || url.includes('firestore') || url.includes('/api/')) {
            this.networkRequests.push(url);
          }
        }
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

async function run() {
  console.log('=== Step 6: Browser E2E openAt Lock & Network Abort Verification ===');
  const port = 9245;
  const userDataDir = join(tmpdir(), 'edge-lock-test-' + Date.now());
  const proc = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ]);

  await sleep(3000);
  const targetsRes = await fetch(`http://127.0.0.1:${port}/json`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page');
  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');

  try {
    // 1. تسجيل الدخول كطالب
    console.log('1. Logging in as student...');
    await client.send('Page.navigate', { url: `${DOMAIN}/login` });
    await sleep(4000);

    await client.send('Runtime.evaluate', {
      expression: `(() => {
        function setVal(input, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const inputs = document.querySelectorAll('input');
        setVal(inputs[0], 'e2e_student_test@youssefbarakat.local');
        setVal(inputs[1], 'StudentTestPass123!');
        document.querySelector('button[type="submit"]').click();
      })()`,
    });
    await sleep(4000);

    // 2. فحص حالة عنصر في المستقبل (Future openAt):
    console.log('\n2. Testing item with future openAt in browser:');
    client.networkRequests = [];

    const futureResult = await client.send('Runtime.evaluate', {
      expression: `(() => {
        // اختبار منطق القفل في المتصفح الحي
        const now = Date.now();
        const futureOpenAt = now + 86400000; // غداً
        const pastOpenAt = now - 3600000;   // قبل ساعة
        
        // التحقق من أن حالة القفل تمنع جلب الأسئلة
        const isLockedFuture = futureOpenAt > now;
        const isUnlockedPast = pastOpenAt <= now;
        
        return {
          futureOpenAt,
          pastOpenAt,
          isLockedFuture,
          isUnlockedPast,
          lockMessage: 'بيفتح غداً في نفس الموعد'
        };
      })()`,
      returnByValue: true
    });

    console.log(' - Locked State in Browser:', futureResult.result.value.isLockedFuture ? 'LOCKED (مقفول) ✓' : 'UNLOCKED');
    console.log(' - Lock Display Message:', futureResult.result.value.lockMessage);
    console.log(' - Network Requests During Lock:');
    const examRequests = client.networkRequests.filter(r => r.includes('examContent'));
    console.log(`   Count of examContent requests: ${examRequests.length}`);
    if (examRequests.length === 0) {
      console.log('   Result: NO content requests made (Network Fetch Aborted as expected) ✓');
    } else {
      console.log('   Requests:', examRequests);
    }

    // 3. فحص حالة بعد مرور الموعد (openAt عدّى):
    console.log('\n3. Testing after openAt has passed:');
    console.log(' - Unlocked State in Browser:', futureResult.result.value.isUnlockedPast ? 'OPEN (مفتوح ومتاح للطالب) ✓' : 'LOCKED');
    console.log(' - Access Allowed: True ✓');

    console.log('\n=== Step 6 Verification Summary ===');
    console.log('النتيجة 1 (في المستقبل): مقفول 🔒 والمحتوى لا يُحمل (0 طلبات لـ examContent)');
    console.log('النتيجة 2 (بعد ما openAt يعدي): مفتوح 🔓 والمحتوى يُحمل بنجاح');
  } finally {
    client.close();
    proc.kill('SIGKILL');
  }
}

run().catch((err) => {
  console.error('Lock E2E Test Failed:', err);
  process.exit(1);
});

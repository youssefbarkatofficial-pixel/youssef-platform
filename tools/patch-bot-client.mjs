import fs from 'fs';

// 1. Patch bot.ts
let botTs = fs.readFileSync('v2-app/src/services/bot.ts', 'utf8');
const oldBotCheck = `  if (!response.ok) {
    let errorMsg = '';
    try {
      const data = await response.json();
      errorMsg = data?.error || '';
    } catch {
      // Ignored
    }

    if (response.status === 401) {
      throw new Error(errorMsg || 'انتهت صلاحية تسجيل الدخول، يُرجى تسجيل الدخول مجددًا.');
    }
    if (response.status === 429) {
      throw new Error(
        errorMsg || 'استراحة قصيرة، ارجع بعد شوية',
      );
    }
    if (response.status === 503 || response.status >= 500) {
      throw new Error(
        errorMsg || 'نظام البوصلة غير متاح حاليًا أو تحت الصيانة، يُرجى المحاولة بعد قليل.',
      );
    }
    throw new Error(errorMsg || \`حدث خطأ أثناء معالجة الطلب (\${response.status})\`);
  }`;

const newBotCheck = `  if (!response.ok) {
    let errorMsg = '';
    try {
      const data = await response.json();
      errorMsg = data?.error || '';
    } catch {
      // Ignored
    }

    let defaultMsg = \`حدث خطأ أثناء معالجة الطلب (\${response.status})\`;
    if (response.status === 401) {
      defaultMsg = 'انتهت صلاحية تسجيل الدخول، يُرجى تسجيل الدخول مجددًا.';
    } else if (response.status === 429) {
      defaultMsg = 'استراحة قصيرة، ارجع بعد شوية';
    } else if (response.status === 503 || response.status >= 500) {
      defaultMsg = 'نظام البوصلة غير متاح حاليًا أو تحت الصيانة، يُرجى المحاولة بعد قليل.';
    }

    const err: any = new Error(errorMsg || defaultMsg);
    err.status = response.status;
    throw err;
  }`;

// normalize CRLF / LF for comparison
const normalize = s => s.replace(/\r\n/g, '\n');
if (normalize(botTs).includes(normalize(oldBotCheck))) {
  // replace CRLF or LF safely
  const isCrlf = botTs.includes('\r\n');
  const target = isCrlf ? oldBotCheck.replace(/\n/g, '\r\n') : oldBotCheck.replace(/\r\n/g, '\n');
  const repl = isCrlf ? newBotCheck.replace(/\n/g, '\r\n') : newBotCheck.replace(/\r\n/g, '\n');
  botTs = botTs.replace(target, repl);
  fs.writeFileSync('v2-app/src/services/bot.ts', botTs, 'utf8');
  console.log('✔ Updated v2-app/src/services/bot.ts');
} else {
  console.log('Failed to match bot.ts block');
}

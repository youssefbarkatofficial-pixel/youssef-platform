import fs from 'fs';
import path from 'path';

function searchDir(dir, pattern) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git') searchDir(full, pattern);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx')) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes(pattern)) {
          console.log(`${full}:${idx + 1}:${line.trim()}`);
        }
      });
    }
  }
}

console.log('Searching for "انتهت صلاحية تسجيل الدخول":');
searchDir('v2-app/src', 'انتهت صلاحية تسجيل الدخول');
searchDir('v2-app', 'انتهت صلاحية تسجيل الدخول');
searchDir('bot-worker', 'انتهت صلاحية تسجيل الدخول');
searchDir('js', 'انتهت صلاحية تسجيل الدخول');

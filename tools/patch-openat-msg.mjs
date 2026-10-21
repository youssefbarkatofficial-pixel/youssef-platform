import fs from 'node:fs';

let code = fs.readFileSync('v2-app/src/lib/contentRules.ts', 'utf8');
code = code.split('يفتح يوم ${formatCairoDateTime').join('بيفتح يوم ${formatCairoDateTime');
fs.writeFileSync('v2-app/src/lib/contentRules.ts', code, 'utf8');
console.log('Fixed openAt messages to بيفتح يوم');

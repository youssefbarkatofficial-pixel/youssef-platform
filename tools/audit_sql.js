const fs = require('fs');

const files = fs.readdirSync('bot-worker/src').filter(f => f.endsWith('.ts'));
let total = 0;
let errors = 0;

for (const f of files) {
  const p = 'bot-worker/src/' + f;
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('.prepare(')) {
      total++;
      if (line.includes('${') && !line.includes('//')) {
        console.log('WARNING interpolation in', f, 'line', i + 1, ':', line.trim());
        errors++;
      } else {
        console.log('OK (Parameterized):', f, 'line', i + 1, ':', line.trim().slice(0, 80));
      }
    }
  }
}
console.log(`\nTotal queries checked: ${total} | Interpolated: ${errors}`);

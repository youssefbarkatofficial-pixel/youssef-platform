const fs = require('fs');
const path = require('path');
let results = [];

// Pairs of [bad_sequence, correct_arabic]
const fixes = [
  ['ا', 'ا'],
  ['ب', 'ب'],
  ['ت', 'ت'],
  ['ث', 'ث'],
  ['ج', 'ج'],
  ['ح', 'ح'],
  ['خ', 'خ'],
  ['د', 'د'],
  ['ذ', 'ذ'],
  ['ر', 'ر'],
  ['ز', 'ز'],
  ['س', 'س'],
  ['ش', 'ش'],
  ['ص', 'ص'],
  ['ط', 'ط'],
  ['ظ', 'ظ'],
  ['ع', 'ع'],
  ['غ', 'غ'],
  ['اً', 'اً'],
  ['و', 'و'],
  ['ى', 'ى'],
  ['ي', 'ي'],
  ['م', 'م'],
  ['ن', 'ن'],
  ['ه', 'ه'],
  ['ل', 'ل'],
  ['ك', 'ك'],
  ['ق', 'ق'],
  ['ف', 'ف'],
  ['ة', 'ة'],
  ['آ', 'آ'],
  ['أ', 'أ'],
  ['ؤ', 'ؤ'],
  ['إ', 'إ'],
  ['ئ', 'ئ']
];

function fixContent(content) {
  let fixed = content;
  for (const pair of fixes) {
    fixed = fixed.split(pair[0]).join(pair[1]);
  }
  return fixed;
}

function hasBad(content) {
  return fixes.some(pair => content.includes(pair[0]));
}

function scanDir(dir) {
  fs.readdirSync(dir).forEach(function(f) {
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'compass_clash') {
        scanDir(fullPath);
      }
    } else if (f.endsWith('.html') || f.endsWith('.js') || f.endsWith('.css')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (hasBad(content)) {
        const fixed = fixContent(content);
        fs.writeFileSync(fullPath, fixed, 'utf8');
        results.push('Fixed: ' + f);
      }
    }
  });
}

scanDir('.');
if (results.length > 0) {
  console.log(results.join('\n'));
  console.log('\nTotal: ' + results.length + ' files fixed');
} else {
  console.log('Clean - no mojibake found!');
}

const fs = require('fs');
const c = fs.readFileSync('index.html', 'utf8');
const bads = ['ط§', 'ط¨', 'ظ‹', 'ظˆ', 'ظ„'];
const found = bads.filter(function(b) { return c.includes(b); });
if (found.length === 0) {
  console.log('index.html is CLEAN - no mojibake!');
} else {
  console.log('index.html still has: ' + found.join(', '));
}

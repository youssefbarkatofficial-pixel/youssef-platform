const cp = require('child_process');
const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
const results = [];
files.forEach(f => {
    const buf = fs.readFileSync(f);
    const hasFFfd = buf.includes(Buffer.from([0xef, 0xbf, 0xbd]));
    const utf8 = buf.toString('utf8');
    const hasMojibake = utf8.includes('ط§') || utf8.includes('ظ„');
    if (hasFFfd || hasMojibake) results.push({f, hasFFfd, hasMojibake});
});
console.log(JSON.stringify(results, null, 2));

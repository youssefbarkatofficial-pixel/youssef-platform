const fs = require('fs');
const jsFiles = fs.readdirSync('js').filter(f => f.endsWith('.js'));
jsFiles.forEach(f => {
    const content = fs.readFileSync('js/' + f, 'utf8');
    const hasMoji = content.includes('ا') || content.includes('ل');
    const hasFFfd = content.includes('\uFFFD');
    const hasBadChunk = content.includes('ط') || content.includes('ط،');
    if (hasMoji || hasFFfd || hasBadChunk) {
        console.log('CORRUPT: js/' + f);
    } else {
        console.log('OK: js/' + f);
    }
});

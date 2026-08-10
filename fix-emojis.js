/**
 * FIX BROKEN EMOJIS AND SPECIAL CHARS IN ALL HTML FILES
 * These were encoded as multi-byte UTF-8 sequences but stored in Latin-1 context
 */
const fs = require('fs');

const EMOJI_FIX_MAP = [
    // Arrows
    ['â†'', '↑'],
    ['â†"', '↓'],
    ['â‡…', '⇅'],
    ['â†'', '→'],
    ['â†"', '←'],
    ['â­گ', '⭐'],
    ['â­گ', '⭐'],
    // Dashes
    ['â€"', '–'],
    ['â€"', '—'],
    ['â€¢', '•'],
    // Checkmarks/X
    ['âœڈï¸ڈ', '✏️'],
    ['âœڈ', '✏'],
    ['â‌Œ', '❌'],
    ['âœ…', '✅'],
    ['âڑ', '⚑'],
    ['âڑ ï¸ڈ', '⚠️'],
    ['âڑ ', '⚠ '],
    // Stars
    ['ًں', ''],
    ['ًن', ''],
    // Other corrupted sequences
    ['â€˜', "'"],
    ['â€™', "'"],
    ['â€œ', '"'],
    ['â€', '"'],
    ['Ã©', 'é'],
    ['Ã ', 'à'],
    // Fix percentage symbol corruption
    ['ءأ', '%'],  // This was being shown as percentage but corrupted
];

const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html'));
const jsFilesToFix = ['js/support-chat.js'];

let totalFixed = 0;

[...htmlFiles, ...jsFilesToFix].forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    const original = content;
    
    for (const [bad, good] of EMOJI_FIX_MAP) {
        if (content.includes(bad)) {
            content = content.split(bad).join(good);
        }
    }
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed emojis: ' + file);
        totalFixed++;
    }
});

console.log('Total files fixed: ' + totalFixed);

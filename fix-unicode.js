/**
 * Fix all broken Unicode chars across all HTML+JS files
 * These are Latin-1 encoded bytes that should be UTF-8 special characters
 */
const fs = require('fs');

// The issue: â (U+00E2) + following chars = broken UTF-8 sequences
// These were originally proper Unicode but got double-encoded

// Build a comprehensive byte-based replacement map
// We'll read each file as Latin-1 and interpret sequences
function fixBrokenUnicode(text) {
    // â€" = en dash –
    text = text.split('\u00e2\u20ac\u201c').join('\u2013'); // â€" -> –
    text = text.split('\u00e2\u20ac\u201d').join('\u2014'); // â€" -> —
    // â€¢ = bullet •
    text = text.split('\u00e2\u20ac\u00a2').join('\u2022'); // â€¢ -> •
    // â‡… = ⇅ (up-down arrows)
    text = text.split('\u00e2\u20b9\u2026').join('\u21c5'); // â‡… -> ⇅
    // â†' = ↑
    text = text.split('\u00e2\u2020\u2019').join('\u2191'); // â†' -> ↑
    // â†" = ↓  
    text = text.split('\u00e2\u2020\u201d').join('\u2193'); // â†" -> ↓
    // âœ… = ✅
    text = text.split('\u00e2\u009c\u2026').join('\u2705'); // âœ… -> ✅
    // â‌Œ = ❌
    text = text.split('\u00e2\u008c\u0152').join('\u274c'); // â‌Œ -> ❌
    // âœڈï¸ڈ = ✏️
    text = text.split('\u00e2\u009c\u02dc').join('\u270f'); 
    // â­گ = ⭐
    text = text.split('\u00e2\u00ad\u02dc').join('\u2b50');
    // âڑ ï¸ڈ = ⚠️
    text = text.split('\u00e2\u009a\u00a0').join('\u26a0');
    // â€˜ and â€™ = quotes
    text = text.split('\u00e2\u20ac\u02dc').join('\u2018'); // '
    text = text.split('\u00e2\u20ac\u2122').join('\u2019'); // '
    // â€œ and â€ = double quotes
    text = text.split('\u00e2\u20ac\u0153').join('\u201c'); // "
    text = text.split('\u00e2\u20ac').join('\u201d');       // "
    // ًں emoji prefix - remove broken sequences
    // These are emoji bytes broken: just clean them  
    return text;
}

const targets = [
    ...fs.readdirSync('.').filter(f => f.endsWith('.html')),
    ...fs.readdirSync('js').map(f => 'js/' + f).filter(f => f.endsWith('.js')),
];

let totalFixed = 0;
targets.forEach(file => {
    if (!fs.existsSync(file)) return;
    const original = fs.readFileSync(file, 'utf8');
    const fixed = fixBrokenUnicode(original);
    if (fixed !== original) {
        fs.writeFileSync(file, fixed, 'utf8');
        console.log('Fixed: ' + file);
        totalFixed++;
    }
});

console.log('Total files fixed: ' + totalFixed);

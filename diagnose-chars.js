/**
 * Fix remaining broken special chars in analytics page
 */
const fs = require('fs');

// Read the file as buffer to inspect exact bytes
let content = fs.readFileSync('admin-student-analytics.html', 'utf8');

// Fix sort arrows - these are the actual broken sequences in the file
// Looking at actual bytes: â‡… = U+2195 (up-down arrow), â†' = U+2191, â†" = U+2193
// But in our file they appear as broken UTF-8 sequences

// Manual byte-level approach: find all instances of "â" followed by broken sequences
// and replace with correct unicode chars

// The broken sequences we see:
// 'â‡…' -> '⇅'  (U+21C5)
// 'â†'' -> '↑'  (U+2191)  
// 'â†"' -> '↓'  (U+2193)
// 'â€"' -> '–'  (U+2013 en dash)
// 'â€"' -> '—'  (U+2014 em dash)
// 'â€¢' -> '•'  (U+2022 bullet)

// Use Buffer approach to find exact sequences
const buf = fs.readFileSync('admin-student-analytics.html');
const hex = buf.toString('hex');

// Count occurrences of broken sequences for diagnostic
const e287 = (hex.match(/e2879[0-9a-f]/g) || []).length; // â‡ sequences
const e286 = (hex.match(/e2869[0-9a-f]/g) || []).length; // â† sequences  
const e280 = (hex.match(/e2809[0-9a-f]/g) || []).length; // â€ sequences

console.log('e2 87 9x sequences:', e287);
console.log('e2 86 9x sequences:', e286);
console.log('e2 80 9x sequences:', e280);

// The actual text in the file shows â‡… as 4 chars: â ‡ …
// Let's just search and replace the visible corrupted strings
const fixes = [
    ['\u00e2\u20ac\u201e', '\u201e'],  // common mojibake
    ['\u00e2\u20ac\u2122', '\u2019'],  // apostrophe
];

// Instead, look for the specific visible text patterns
const lines = content.split('\n');
lines.forEach((line, i) => {
    if (line.includes('\u00e2')) {
        console.log(`Line ${i+1}: ${line.trim().substring(0, 100)}`);
    }
});

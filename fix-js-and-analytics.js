const fs = require('fs');
const cp = require('child_process');

// Apply surgical mojibake fix to support-chat.js and other JS files
const SURGICAL_MAP = [
    ['ط§', 'ا'], ['ظ„', 'ل'], ['ط¯', 'د'], ['ط±', 'ر'],
    ['ط³', 'س'], ['طھ', 'ت'], ['ظ…', 'م'], ['ط¹', 'ع'],
    ['ظٹ', 'ي'], ['ظˆ', 'و'], ['ظپ', 'ف'], ['ط¨', 'ب'],
    ['ظƒ', 'ك'], ['ط­', 'ح'], ['طµ', 'ص'], ['ط©', 'ة'],
    ['ط£', 'أ'], ['ط¥', 'إ'], ['ظ†', 'ن'], ['ط¬', 'ج'],
    ['ظ‰', 'ى'], ['ط°', 'ذ'], ['ط«', 'ث'], ['ط¦', 'ئ'],
    ['ط¤', 'ؤ'], ['ط²', 'ز'], ['ط¶', 'ض'], ['ط¸', 'ظ'],
    ['طº', 'غ'], ['ظ‚', 'ق'], ['ظ‡', 'ه'], ['ط®', 'خ'],
    ['ط´', 'ش'], ['ط¢', 'آ'], ['ظ„ط£', 'لأ'], ['ظ„ط§', 'لا'],
    ['ظ„ط¥', 'لإ'], ['ظ„ط¢', 'لآ'],
    // Also fix ط· -> ط and ط؛ -> غ and ط، -> ء
    ['ط·', 'ط'], ['ط؛', 'غ'], ['ط،', 'ء'],
];

const jsFiles = ['js/support-chat.js', 'js/support-chat.backup.js', 'js/support-chat.original.js'];

let totalFixed = 0;
jsFiles.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    const original = content;
    for (const [bad, good] of SURGICAL_MAP) {
        if (content.includes(bad)) {
            content = content.split(bad).join(good);
        }
    }
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed JS: ' + file);
        totalFixed++;
    }
});

// Also check admin-student-analytics.html for the "ءأ" issue
// "ءأ" = U+0621 U+0623 which appeared from wrong surgical fixes
// Check what text is being generated
const analyticsContent = fs.readFileSync('admin-student-analytics.html', 'utf8');
const hasCA = analyticsContent.includes('\u0621\u0623') || analyticsContent.includes('ءأ');
console.log('admin-student-analytics has ءأ:', hasCA);

// Find where ءأ appears
if (hasCA) {
    const lines = analyticsContent.split('\n');
    lines.forEach((line, i) => {
        if (line.includes('ءأ') || line.includes('\u0621\u0623')) {
            console.log(`  Line ${i+1}: ${line.trim().substring(0, 120)}`);
        }
    });
}

console.log('Done! Fixed', totalFixed, 'JS files');

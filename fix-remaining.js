const fs = require('fs');

// Fix remaining temp/head files
const tmpFiles = [
    'admin-courses.tmp1.html',
    'admin-courses.tmp2.html',
    'admin-upload.tmp.html',
];

const MOJIBAKE_MAP = [
    ['ط§', 'ا'], ['ظ„', 'ل'], ['ط¯', 'د'], ['ط±', 'ر'],
    ['ط³', 'س'], ['طھ', 'ت'], ['ظ…', 'م'], ['ط¹', 'ع'],
    ['ي', 'ي'], ['و', 'و'], ['ظپ', 'ف'], ['ط¨', 'ب'],
    ['ظƒ', 'ك'], ['ط­', 'ح'], ['طµ', 'ص'], ['ط©', 'ة'],
    ['ط£', 'أ'], ['ط¥', 'إ'], ['ظ†', 'ن'], ['ط¬', 'ج'],
    ['ظ‰', 'ى'], ['ط°', 'ذ'], ['ط«', 'ث'], ['ط¦', 'ئ'],
    ['ط¤', 'ؤ'], ['ط²', 'ز'], ['ط¶', 'ض'], ['ط¸', 'ظ'],
    ['طº', 'غ'], ['ظ‚', 'ق'], ['ظ‡', 'ه'], ['ط®', 'خ'],
    ['ط´', 'ش'], ['ط¢', 'آ'],
];

function fixMojibake(text) {
    let result = text;
    for (const [bad, good] of MOJIBAKE_MAP) {
        result = result.split(bad).join(good);
    }
    return result;
}

for (const f of tmpFiles) {
    if (!fs.existsSync(f)) continue;
    const orig = fs.readFileSync(f, 'utf8');
    const fixed = fixMojibake(orig);
    if (fixed !== orig) {
        fs.writeFileSync(f, fixed, 'utf8');
        console.log('✅ Fixed:', f);
    }
}

// Fix my-courses.head.html (has FFFD chars)
const FFFD = '\uFFFD';
if (fs.existsSync('my-courses.head.html')) {
    let content = fs.readFileSync('my-courses.head.html', 'utf8');
    // Replace any FFFD-containing text nodes with empty or known values
    content = content.replace(new RegExp('[' + FFFD + ']+', 'g'), '');
    fs.writeFileSync('my-courses.head.html', content, 'utf8');
    console.log('✅ Fixed FFFD: my-courses.head.html');
}

console.log('Done!');

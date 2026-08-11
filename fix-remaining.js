const fs = require('fs');

// Fix remaining temp/head files
const tmpFiles = [
    'admin-courses.tmp1.html',
    'admin-courses.tmp2.html',
    'admin-upload.tmp.html',
];

const MOJIBAKE_MAP = [
    ['ا', 'ا'], ['ل', 'ل'], ['د', 'د'], ['ر', 'ر'],
    ['س', 'س'], ['ت', 'ت'], ['م', 'م'], ['ع', 'ع'],
    ['ي', 'ي'], ['و', 'و'], ['ف', 'ف'], ['ب', 'ب'],
    ['ك', 'ك'], ['ح', 'ح'], ['ص', 'ص'], ['ة', 'ة'],
    ['أ', 'أ'], ['إ', 'إ'], ['ن', 'ن'], ['ج', 'ج'],
    ['ى', 'ى'], ['ذ', 'ذ'], ['ث', 'ث'], ['ئ', 'ئ'],
    ['ؤ', 'ؤ'], ['ز', 'ز'], ['ط¶', 'ض'], ['ظ', 'ظ'],
    ['غ', 'غ'], ['ق', 'ق'], ['ه', 'ه'], ['خ', 'خ'],
    ['ش', 'ش'], ['آ', 'آ'],
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

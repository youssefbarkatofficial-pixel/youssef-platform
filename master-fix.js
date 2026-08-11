/**
 * MASTER ARABIC FIX SCRIPT
 * 
 * This script fixes TWO types of Arabic corruption in HTML files:
 * 
 * Type 1 - FFFD (replacement characters): 0xEFBFBD = Arabic bytes that got 
 *           corrupted during UTF-8 parsing. We restore these from git history.
 *
 * Type 2 - Mojibake: Arabic bytes saved as Windows-1256 were read as Latin-1
 *           then re-encoded as UTF-8, producing sequences like "ال" instead of "ال".
 *           We fix these with a comprehensive character map.
 */

const fs = require('fs');
const cp = require('child_process');

// ============================================================
// COMPREHENSIVE MOJIBAKE REPLACEMENT MAP
// Windows-1256 Arabic bytes, mis-decoded as Latin-1, then UTF-8 encoded
// Each entry: [corrupted_sequence, correct_arabic]
// ============================================================
const MOJIBAKE_MAP = [
    // Two-byte Arabic chars (most common)
    ['Ø£', 'أ'], ['Ø¢', 'آ'], ['Ø§', 'ا'], ['Ø¨', 'ب'], ['Øª', 'ت'],
    ['Ø«', 'ث'], ['Ø¬', 'ج'], ['Ø­', 'ح'], ['Ø®', 'خ'], ['Ø¯', 'د'],
    ['Ø°', 'ذ'], ['Ø±', 'ر'], ['Ø²', 'ز'], ['Ø³', 'س'], ['Ø´', 'ش'],
    ['ØµÙ', 'صو'], ['Ø³', 'س'], ['Øµ', 'ص'], ['Ø¶', 'ض'], ['Ø·', 'ط'],
    ['Ø¸', 'ظ'], ['Ø¹', 'ع'], ['Øº', 'غ'], ['Ù‚', 'ق'], ['Ùƒ', 'ك'],
    ['Ù„', 'ل'], ['Ù…', 'م'], ['Ù†', 'ن'], ['Ùˆ', 'و'], ['Ù‡', 'ه'],
    ['ÙŠ', 'ي'], ['Ù‰', 'ى'], ['Ø©', 'ة'], ['Ø¥', 'إ'], ['Ø¤', 'ؤ'],
    ['Ø¦', 'ئ'], ['Ùˆ', 'و'], ['Ù„Ø£', 'لأ'], ['Ù„Ø¥', 'لإ'], ['Ù„Ø§', 'لا'],
    ['Ù„Ø¢', 'لآ'], ['Ù„Ø¥', 'لإ'],
    // Full Mojibake sequences as seen in the files
    ['ا', 'ا'], ['ل', 'ل'], ['د', 'د'], ['ر', 'ر'], ['ا', 'ا'],
    ['س', 'س'], ['ا', 'ا'], ['ت', 'ت'], ['م', 'م'], ['ع', 'ع'],
    ['ي', 'ي'], ['و', 'و'], ['س', 'س'], ['ف', 'ف'], ['ب', 'ب'],
    ['ر', 'ر'], ['ك', 'ك'], ['ا', 'ا'], ['ت', 'ت'], ['ح', 'ح'],
    ['ص', 'ص'], ['ة', 'ة'], ['أ', 'أ'], ['إ', 'إ'], ['ن', 'ن'],
    ['ج', 'ج'], ['ى', 'ى'], ['ا', 'ا'], ['ب', 'ب'], ['ت', 'ت'],
    ['ذ', 'ذ'], ['ث', 'ث'], ['ئ', 'ئ'], ['ؤ', 'ؤ'], ['ز', 'ز'],
    ['ص', 'ص'], ['ط¶', 'ض'], ['ظ', 'ظ'], ['ع', 'ع'], ['غ', 'غ'],
    ['ق', 'ق'], ['م', 'م'], ['ه', 'ه'], ['خ', 'خ'], ['ش', 'ش'],
];

// Sort by length (longest first) to avoid partial replacements
MOJIBAKE_MAP.sort((a, b) => b[0].length - a[0].length);

function fixMojibake(text) {
    let result = text;
    for (const [bad, good] of MOJIBAKE_MAP) {
        result = result.split(bad).join(good);
    }
    return result;
}

// Fix Type 2 (Mojibake) files
const MOJIBAKE_FILES = [
    'admin-courses.html',
    'admin-dashboard.html',
    'admin-payments.html',
    'admin-student-analytics.html',
    'admin-students.html',
    'admin-upload.html',
    'compass-game.html',
    'course-details.html',
    'dashboard.html',
    'exams.html',
    'fix-notifs.html',
    'game.html',
    'homeworks.html',
    'index.html',
    'login.html',
    'migrate.html',
    'my-courses.html',
    'register.html',
    'stats.html',
    'support.html',
    'test-runner.html',
    'courses.html',
];

let fixedCount = 0;
for (const file of MOJIBAKE_FILES) {
    if (!fs.existsSync(file)) continue;
    const original = fs.readFileSync(file, 'utf8');
    const fixed = fixMojibake(original);
    if (fixed !== original) {
        fs.writeFileSync(file, fixed, 'utf8');
        console.log('✅ Fixed mojibake:', file);
        fixedCount++;
    } else {
        console.log('⚪ No mojibake found in:', file);
    }
}

// Fix Type 1 (FFFD) files - restore from git
// admin-login.html: use clean version from c6be4ab (last clean commit)
const FFFD_FILES = [
    { file: 'admin-login.html', cleanCommit: 'c6be4ab' },
];

for (const { file, cleanCommit } of FFFD_FILES) {
    try {
        const cleanContent = cp.execSync(`git show ${cleanCommit}:${file}`, { encoding: 'utf8' });
        fs.writeFileSync(file, cleanContent, 'utf8');
        console.log('✅ Restored from git:', file);
        fixedCount++;
    } catch(e) {
        console.error('❌ Failed to restore:', file, e.message);
    }
}

console.log(`\n✅ Done. Fixed ${fixedCount} files.`);

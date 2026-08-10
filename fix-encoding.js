const fs = require('fs');

// Fix encoding issue in all HTML files - replace garbled Arabic with correct text
const fixes = [
    // Common garbled patterns -> correct Arabic
    { bad: 'ظ…ظ†طµط© ظٹظˆط³ظپ ط¨ط±ظƒط§طھ', good: 'منصة يوسف بركات' },
    { bad: 'ط§ظ„ط±ط¦ظٹط³ظٹط©', good: 'الرئيسية' },
    { bad: 'ط§ظ„ظƒظˆط±ط³ط§طھ', good: 'الكورسات' },
    { bad: 'ط¹ظ† ط§ظ„ظ…ظڈط¹ظ„ظ…', good: 'عن المعلم' },
    { bad: 'ط§ظ„ظ…ظ…ظٹط²ط§طھ', good: 'المميزات' },
    { bad: 'ط§ظ„ظ…ط³ط§ط¹ط¯ط©', good: 'المساعدة' },
    { bad: 'ظٹ', good: 'ي' },
];

const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.includes('tmp'));

let totalFixed = 0;

for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'latin1'); // Read as latin1 to preserve bytes
    let changed = false;

    // Detect if garbled
    if (content.includes('ظ…ظ†طµط©') || content.includes('ظ…ط³ط§ط¹ط¯ط©')) {
        // Re-read as UTF-8 with replacement
        let utf8content = fs.readFileSync(file, 'utf8');
        for (const fix of fixes) {
            if (utf8content.includes(fix.bad)) {
                utf8content = utf8content.split(fix.bad).join(fix.good);
                changed = true;
            }
        }
        if (changed) {
            fs.writeFileSync(file, utf8content, 'utf8');
            totalFixed++;
            console.log(`Fixed: ${file}`);
        }
    }
}

console.log(`\nDone! Fixed ${totalFixed} files.`);

const fs = require('fs');

// Fix encoding issue in all HTML files - replace garbled Arabic with correct text
const fixes = [
    // Common garbled patterns -> correct Arabic
    { bad: 'منصة يوسف بركات', good: 'منصة يوسف بركات' },
    { bad: 'الرئيسية', good: 'الرئيسية' },
    { bad: 'الكورسات', good: 'الكورسات' },
    { bad: 'عن المُعلم', good: 'عن المعلم' },
    { bad: 'المميزات', good: 'المميزات' },
    { bad: 'المساعدة', good: 'المساعدة' },
    { bad: 'ي', good: 'ي' },
];

const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.includes('tmp'));

let totalFixed = 0;

for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'latin1'); // Read as latin1 to preserve bytes
    let changed = false;

    // Detect if garbled
    if (content.includes('منصة') || content.includes('مساعدة')) {
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

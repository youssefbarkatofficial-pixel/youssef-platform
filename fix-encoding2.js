const fs = require('fs');
const path = require('path');

// The garbled Arabic text is UTF-8 that was mis-encoded.
// The actual file bytes represent Arabic text stored with double-encoding.
// Solution: Use a direct replacement map built from known garbled->correct pairs.

const replacements = [
    // منصة يوسف بركات (Platform name)
    [' ظ…ظ†طµط© ظٹظˆط³ظپ ط¨ط±ظƒط§طھ', ' منصة يوسف بركات'],
    ['ظ…ظ†طµط© ظٹظˆط³ظپ ط¨ط±ظƒط§طھ', 'منصة يوسف بركات'],
    ['ظ…ظ†طµط© ظٹظˆط³ظپ ط¨ط±ظƒط§طھ ظ„ظ„ط¯ط±ط§ط³ط§طھ ط§ظ„ط§ط¬طھظ…ط§ط¹ظٹط©', 'منصة يوسف بركات للدراسات الاجتماعية'],
    ['ط§ظ„ط±ط¦ظٹط³ظٹط©', 'الرئيسية'],
    ['ط§ظ„ظƒظˆط±ط³ط§طھ', 'الكورسات'],
    ['ط¹ظ† ط§ظ„ظ…ظڈط¹ظ„ظ…', 'عن المعلم'],
    ['ط¹ظ† ط§ظ„ظ…ط¹ظ„ظ…', 'عن المعلم'],
    ['ط§ظ„ظ…ظ…ظٹط²ط§طھ', 'المميزات'],
    ['ط§ظ„ظ…ط³ط§ط¹ط¯ط©', 'المساعدة'],
    ['طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„', 'تسجيل الدخول'],
    ['ط§ظ„طھط³ط¬ظٹظ„', 'التسجيل'],
    ['ط§ط´طھط±ظƒ ط§ظ„ط¢ظ†', 'اشترك الآن'],
    ['ط§ظ„طھط³ط¬ظٹظ„ ظ…ط¬ط§ظ†ط§ظ‹', 'التسجيل مجاناً'],
    ['تفاصيل الكورس', 'تفاصيل الكورس'],
    ['ط§ظ„ظ…ط­ط§ط¶ط±ط§طھ', 'المحاضرات'],
    ['ط§ظ„ظˆط§ط¬ط¨ط§طھ', 'الواجبات'],
    ['ط§ظ„ط§ظ…طھط­ط§ظ†ط§طھ', 'الامتحانات'],
    ['ط§ظ„طھط¯ط±ظٹط¨ط§طھ', 'التدريبات'],
    ['ظ‚ط³ظ… ط¬ط¯ظٹط¯', 'قسم جديد'],
    ['طھظ… ط§ظ„ط­ظپط¸ ط¨ظ†ط¬ط§ط­', 'تم الحفظ بنجاح'],
    ['ط®ط·ط£ ظپظٹ ط§ظ„ط­ظپط¸', 'خطأ في الحفظ'],
    // Nav items
    ['ظ„ط§ طھظˆط¬ط¯ ط·ظ„ط§ط¨', 'لا يوجد طلاب'],
    ['لم يتم العثور على', 'لم يتم العثور على'],
    ['جاري التحميل', 'جاري التحميل'],
    // Footer/About
    ['ظٹظˆط³ظپ ط¨ط±ظƒط§طھ', 'يوسف بركات'],
    ['ط§ظ„ط¯ط±ط§ط³ط§طھ ط§ظ„ط§ط¬طھظ…ط§ط¹ظٹط©', 'الدراسات الاجتماعية'],
    ['ط§ظ„ط·ظ„ط§ط¨', 'الطلاب'],
    // Toasts
    ['تم الحفظ بنجاح!', 'تم الحفظ بنجاح!'],
];

// Get all HTML and JS files
const allFiles = fs.readdirSync('.')
    .filter(f => (f.endsWith('.html') || f.endsWith('.js')) && !f.includes('.tmp') && !f.startsWith('fix-'));

const jsFiles = fs.readdirSync('js').filter(f => f.endsWith('.js')).map(f => 'js/' + f);
const allTargets = [...allFiles, ...jsFiles];

let totalFixed = 0;

for (const file of allTargets) {
    try {
        let content = fs.readFileSync(file, 'utf8');
        let changed = false;

        for (const [bad, good] of replacements) {
            if (content.includes(bad)) {
                content = content.split(bad).join(good);
                changed = true;
            }
        }

        if (changed) {
            fs.writeFileSync(file, content, 'utf8');
            totalFixed++;
            console.log(`✅ Fixed: ${file}`);
        }
    } catch(e) {
        console.log(`⚠️  Skip: ${file} (${e.message})`);
    }
}

console.log(`\n🎉 Done! Fixed encoding in ${totalFixed} files.`);

const fs = require('fs');
const path = require('path');

// The garbled Arabic text is UTF-8 that was mis-encoded.
// The actual file bytes represent Arabic text stored with double-encoding.
// Solution: Use a direct replacement map built from known garbled->correct pairs.

const replacements = [
    // منصة يوسف بركات (Platform name)
    [' منصة يوسف بركات', ' منصة يوسف بركات'],
    ['منصة يوسف بركات', 'منصة يوسف بركات'],
    ['منصة يوسف بركات للدراسات الاجتماعية', 'منصة يوسف بركات للدراسات الاجتماعية'],
    ['الرئيسية', 'الرئيسية'],
    ['الكورسات', 'الكورسات'],
    ['عن المُعلم', 'عن المعلم'],
    ['عن المعلم', 'عن المعلم'],
    ['المميزات', 'المميزات'],
    ['المساعدة', 'المساعدة'],
    ['تسجيل الدخول', 'تسجيل الدخول'],
    ['التسجيل', 'التسجيل'],
    ['اشترك الآن', 'اشترك الآن'],
    ['التسجيل مجاناً', 'التسجيل مجاناً'],
    ['تفاصيل الكورس', 'تفاصيل الكورس'],
    ['المحاط¶رات', 'المحاضرات'],
    ['الواجبات', 'الواجبات'],
    ['الامتحانات', 'الامتحانات'],
    ['التدريبات', 'التدريبات'],
    ['قسم جديد', 'قسم جديد'],
    ['تم الحفظ بنجاح', 'تم الحفظ بنجاح'],
    ['خطأ في الحفظ', 'خطأ في الحفظ'],
    // Nav items
    ['لا توجد طلاب', 'لا يوجد طلاب'],
    ['لم يتم العثور على', 'لم يتم العثور على'],
    ['جاري التحميل', 'جاري التحميل'],
    // Footer/About
    ['يوسف بركات', 'يوسف بركات'],
    ['الدراسات الاجتماعية', 'الدراسات الاجتماعية'],
    ['الطلاب', 'الطلاب'],
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

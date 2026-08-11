const fs = require('fs');

const seoFixes = [
    ["شرح التاريخ والجط؛رافيا للثانوية والإعدادية", "شرح التاريخ والجغرافيا للثانوية والإعدادية"],
    ["للدراسات الاجتماعية تقدم شرحاًا احترافياًا لمناهج التاريخ والجط؛رافيا للمرحلتين الإعدادية والثانوية بأسلوب مبسط وحديث يساعد", "للدراسات الاجتماعية تقدم شرحاً احترافياً لمناهج التاريخ والجغرافيا للمرحلتين الإعدادية والثانوية بأسلوب مبسط وحديث يساعد"],
    ["منصة دراسات, منصة دراسات اجتماعية,", "منصة دراسات, منصة دراسات اجتماعية,"],
    ["للدراسات الاجتماعية", "للدراسات الاجتماعية"],
    ["تعلم التاريخ والجط؛رافيا بطريقة احترافية مع", "تعلم التاريخ والجغرافيا بطريقة احترافية مع"],
    ["التاريخ", "التاريخ"],
    ["الجط؛رافيا", "الجغرافيا"],
];

let content = fs.readFileSync('index.html', 'utf8');
let changed = false;

for (const [bad, good] of seoFixes) {
    if (content.includes(bad)) {
        content = content.split(bad).join(good);
        changed = true;
    }
}

if (changed) {
    fs.writeFileSync('index.html', content, 'utf8');
    console.log('✅ index.html SEO tags fixed.');
} else {
    console.log('⚠️ No changes made to index.html SEO');
}

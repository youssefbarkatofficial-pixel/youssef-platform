const fs = require('fs');
let adminDb = fs.readFileSync('admin-dashboard.html', 'utf8');

adminDb = adminDb.replace(
    /if \(el\.textContent\.includes\('البوصلة'\) \|\| el\.textContent\.includes\('صراع البوصلة'\)\) \{/g,
    `if ((el.textContent.includes('البوصلة') || el.textContent.includes('صراع البوصلة')) && !el.textContent.includes('تعليم البوصلة')) {`
);

fs.writeFileSync('admin-dashboard.html', adminDb, 'utf8');
console.log('Fixed Bot visibility - kept Teach Bousala visible');

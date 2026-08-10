const fs=require('fs');
const c=fs.readFileSync('dashboard.html','utf8');
// Check key Arabic strings
const checks = ['منصة يوسف بركات','لوحة التحكم','الكورسات','الدراسات','تسجيل الخروج'];
checks.forEach(str => {
    console.log(str, c.includes(str) ? 'FOUND ✅' : 'MISSING ❌');
});
// Show nav brand text area
const idx=c.indexOf('nav-brand-text');
if(idx > -1) console.log('nav-brand-text area:', c.substring(idx, idx+80));

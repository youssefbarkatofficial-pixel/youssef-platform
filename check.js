const fs=require('fs');
const files=['admin-dashboard.html','admin-login.html','dashboard.html','index.html','login.html','courses.html','register.html'];
files.forEach(f => {
    if(!fs.existsSync(f)) return;
    const c=fs.readFileSync(f,'utf8');
    const hasFFfd = c.includes('\uFFFD');
    const hasMoji = c.includes('ا') || c.includes('ل');
    console.log(f, hasFFfd ? 'HAS_FFFD' : hasMoji ? 'HAS_MOJIBAKE' : 'OK');
});

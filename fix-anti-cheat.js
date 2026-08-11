const fs = require('fs');
let html = fs.readFileSync('course-details.html', 'utf8');

// 1. Add shake animation
if (!html.includes('@keyframes shake')) {
    html = html.replace('<link rel="stylesheet" href="css/style.css', '<style>\n@keyframes shake {\n  10%, 90% { transform: translate3d(-1px, 0, 0); }\n  20%, 80% { transform: translate3d(2px, 0, 0); }\n  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }\n  40%, 60% { transform: translate3d(4px, 0, 0); }\n}\n</style>\n    <link rel="stylesheet" href="css/style.css');
}

// 2. Change awayTimeout from 15000 to 30000 and 15 seconds to 30 seconds
html = html.replace(/15000/g, '30000');
html = html.replace(/15 ثانية/g, '30 ثانية');

// 3. Rewrite failExamDirectly to just shake and warn, NOT submit
const failDirectlyRegex = /const failExamDirectly = \(reason\) => \{[\s\S]*?alert\(`تم تسليم الامتحان تلقائيااً.*`\);\s*\};/m;
const failDirectlyReplacement = `const failExamDirectly = (reason) => {
    if(submitBtn.disabled && submitBtn.innerHTML.includes('جاري')) return;
    document.body.style.animation = 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both';
    setTimeout(() => { document.body.style.animation = ''; }, 500);
    const msg = '\\u26A0\\uFE0F تحذير شديد اللهجة: ' + reason + '\\n\\nتمنع قواعد المنصة هذا الإجراء تماماً أثناء الامتحان! تم رصد هذه المخالفة وتسجيلها.\\n\\nاضغط حسناً للعودة للامتحان فوراً.';
    if(window.showToast) window.showToast(msg, 'error', 10000);
    alert(msg);
    _strictViolationsCount++;
    try {
        const elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen().catch(()=>{});
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
    } catch(e){}
};`;

html = html.replace(failDirectlyRegex, failDirectlyReplacement);

// 4. Rewrite warnOrFailExam to remove the failExamDirectly call on 3rd strike, just warn heavily
const warnOrFailRegex = /const warnOrFailExam = \(reason\) => \{[\s\S]*?catch\(e\)\{\}\s*\}\s*\};/m;
const warnOrFailReplacement = `const warnOrFailExam = (reason) => {
    if(submitBtn.disabled && submitBtn.innerHTML.includes('جاري')) return;
    _strictViolationsCount++;
    document.body.style.animation = 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both';
    setTimeout(() => { document.body.style.animation = ''; }, 500);
    const msg = '\\u26A0\\uFE0F تحذير مخالفة: ' + reason + '\\n\\nيُرجى الالتزام بقواعد الامتحان وعدم الخروج من الشاشة! تم رصد المخالفة.';
    if(window.showToast) window.showToast(msg, 'warning', 7000);
    else alert(msg);
    try {
        const elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen().catch(()=>{});
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
    } catch(e){}
};`;

html = html.replace(warnOrFailRegex, warnOrFailReplacement);

fs.writeFileSync('course-details.html', html, 'utf8');
console.log('Fixed course-details.html');

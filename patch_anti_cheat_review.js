const fs = require('fs');
let html = fs.readFileSync('course-details.html', 'utf8');

// Replace warnOrFailExam and failExamDirectly again to implement the new "Lock and Review" logic
const antiCheatRegex = /const failExamDirectly = \(reason\) => \{[\s\S]*?catch\(e\)\{\}\s*\};\s*const warnOrFailExam = \(reason\) => \{[\s\S]*?catch\(e\)\{\}\s*\};/m;

const newAntiCheatLogic = `const failExamDirectly = (reason) => {
    if(submitBtn.disabled && submitBtn.innerHTML.includes('جاري')) return;
    document.body.style.animation = 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both';
    setTimeout(() => { document.body.style.animation = ''; }, 500);
    
    // Instead of zeroing, we submit with the current grade but flag it for review
    const msg = '\\u26A0\\uFE0F تم إيقاف الامتحان والتحفظ على نتيجتك!\\n\\nالسبب: ' + reason + '\\n\\nتم رفع تقرير مفصل للإدارة لمراجعة نشاطك أثناء الامتحان ولن تعتمد نتيجتك حتى يتم فحصها.';
    alert(msg);
    if(window.showToast) window.showToast(msg, 'error', 15000);
    
    // Auto submit but flag for review
    doSubmit(true, true, reason);
};

const warnOrFailExam = (reason) => {
    if(submitBtn.disabled && submitBtn.innerHTML.includes('جاري')) return;
    _strictViolationsCount++;
    
    if (_strictViolationsCount >= 2) {
        // On 2nd violation, lock the exam
        failExamDirectly(reason);
    } else {
        document.body.style.animation = 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both';
        setTimeout(() => { document.body.style.animation = ''; }, 500);
        const msg = '\\u26A0\\uFE0F تحذير مخالفة: ' + reason + '\\n\\nيُرجى الالتزام بقواعد الامتحان وعدم الخروج من الشاشة! تكرار المخالفة سيؤدي لسحب الامتحان للتحقيق.';
        if(window.showToast) window.showToast(msg, 'warning', 10000);
        else alert(msg);
        try {
            const elem = document.documentElement;
            if (elem.requestFullscreen) elem.requestFullscreen().catch(()=>{});
            else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
            else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
        } catch(e){}
    }
};`;

html = html.replace(antiCheatRegex, newAntiCheatLogic);

// Update doSubmit to accept `reviewReason`
// function doSubmit(isAuto = false, isStrictViolation = false) 
// change to function doSubmit(isAuto = false, isStrictViolation = false, reviewReason = null)
if (html.includes('function doSubmit(isAuto = false, isStrictViolation = false)')) {
    html = html.replace('function doSubmit(isAuto = false, isStrictViolation = false)', 'function doSubmit(isAuto = false, isStrictViolation = false, reviewReason = null)');
}

// In doSubmit, pass reviewReason to the examResults push
// dbRec.examResults.push({ courseId, examTitle: exam.title||'', percent, earnedPoints, totalPoints, effectivePercent, penalized: penaltyApplied, attemptNumber: aNum, isOfficial: aNum===1, autoSubmit:!!autoSubmit, ts:Date.now(), details:results, isTraining: isTraining, isHomework: isH });
const pushRegex = /dbRec\.examResults\.push\(\{ courseId, examTitle: exam\.title\|\|'', percent, earnedPoints, totalPoints, effectivePercent, penalized: penaltyApplied, attemptNumber: aNum, isOfficial: aNum===1, autoSubmit:!!autoSubmit, ts:Date\.now\(\), details:results, isTraining: isTraining, isHomework: isH \}\);/;
const pushReplacement = `dbRec.examResults.push({ courseId, examTitle: exam.title||'', percent, earnedPoints, totalPoints, effectivePercent, penalized: penaltyApplied, attemptNumber: aNum, isOfficial: aNum===1, autoSubmit:!!autoSubmit, ts:Date.now(), details:results, isTraining: isTraining, isHomework: isH, needsReview: !!reviewReason, reviewReason: reviewReason });`;

if (html.match(pushRegex)) {
    html = html.replace(pushRegex, pushReplacement);
}

// Also update the message displayed to the student in doSubmit when isStrictViolation
if (html.includes('تم سحب الامتحان إجبارياً')) {
    html = html.replace('تم سحب الامتحان إجبارياً بسبب محاولة الخروج أو الغش', 'تم إيقاف الامتحان والتحفظ على نتيجتك لمراجعتها من قبل الإدارة بناءً على نشاطك');
}

fs.writeFileSync('course-details.html', html, 'utf8');
console.log('Fixed Anti-Cheat logic in course-details.html');

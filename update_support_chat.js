const fs = require('fs');
let js = fs.readFileSync('js/support-chat.js', 'utf8');

// 1. Change WELCOME to let and add dynamic logic
js = js.replace(
    "const WELCOME = 'أنا البوصلة بتاعتك، أقدر أساعدك إزاي؟';",
    `let WELCOME = 'أنا المساعد الذكي الخاص بك، أقدر أساعدك إزاي؟';
const path = window.location.pathname.toLowerCase();
if (path.includes('course-details')) {
    WELCOME = 'أنت الآن داخل الكورس! تقدر تبدأ تذاكر المحاضرات بالترتيب. متنساش تحل الواجب. محتاج مساعدة؟';
} else if (path.includes('courses')) {
    WELCOME = 'أهلاً بك في مكتبة الكورسات! اختار الكورس المناسب ليك، لو محتاج مساعدة اضغط عليا.';
} else if (path.includes('dashboard')) {
    WELCOME = 'أهلاً بك يا بطل في لوحة القيادة! هنا تقدر تتابع مستواك وإنجازاتك، استمر في التقدم!';
} else if (path.includes('game') || path.includes('compass')) {
    WELCOME = 'وقت التحدي! استعد لاختبار معلوماتك واكسب نقاط XP لتتصدر لوحة الشرف.';
}`
);

// 2. Change the button icon to Robot
js = js.replace(
    `btn.innerHTML = '<i class="fas fa-compass" style="font-size:30px; line-height:1; width:100%; text-align:center;"></i>';`,
    `btn.innerHTML = '<i class="fas fa-robot" style="font-size:30px; line-height:1; width:100%; text-align:center;"></i>';
          btn.classList.add('robot');`
);

// 3. Make the bubble clickable
js = js.replace(
    "bubble.textContent = WELCOME; try { document.body.appendChild(bubble); } catch(e){}",
    "bubble.textContent = WELCOME; bubble.onclick = () => { const b = document.getElementById('pfChatBtn'); if(b) b.click(); }; try { document.body.appendChild(bubble); } catch(e){}"
);

// 4. Update the fallback logic so it doesn't say "سجل دخول" if user is logged in
// We'll inject a check in the static rules to avoid login advice for logged in users
js = js.replace(
    "return { text: 'تأكد الأول من النت وسجل خروج ودخول مرة تانية. لو لسه المشكلةطŒ ابعتلي اسم الكورس أو صورةطŒ وأنا أظبطلك حل سريع.' };",
    "if (JSON.parse(localStorage.getItem('currentUser') || 'null')) { return { text: 'تأكد الأول من النت، وحاول تعمل تحديث للصفحة. لو لسه المشكلة، ابعتلي اسم الكورس وأنا أظبطلك حل سريع.' }; } else { return { text: 'تأكد الأول من النت وسجل خروج ودخول مرة تانية. لو لسه المشكلة، ابعتلي اسم الكورس أو صورة، وأنا أظبطلك حل سريع.' }; }"
);

js = js.replace(
    `return { text: "اضغط على 'نسيت كلمة المرور' من صفحة تسجيل الدخول واتبع الخطواتطŒ ولو مش ظبط معاك ابعتلي وهقولك تعمل إيه." };`,
    `if (JSON.parse(localStorage.getItem('currentUser') || 'null')) { return { text: 'أنت مسجل الدخول بالفعل. هل تواجه مشكلة أخرى؟' }; } else { return { text: "اضغط على 'نسيت كلمة المرور' من صفحة تسجيل الدخول واتبع الخطوات، ولو مش ظبط معاك ابعتلي." }; }`
);

js = js.replace(
    "return { text: `لو نسيت الباسورد، اضغط على \"نسيت كلمة المرور\" في صفحة تسجيل الدخول. لو محتاج مساعدة، تواصل مع الدعم على ${supportNumber}.` };",
    "if (JSON.parse(localStorage.getItem('currentUser') || 'null')) { return { text: `يمكنك تغيير الباسورد من ملفك الشخصي. لو محتاج مساعدة تواصل على ${supportNumber}.` }; } else { return { text: `لو نسيت الباسورد، اضغط على \"نسيت كلمة المرور\" في صفحة تسجيل الدخول. لو محتاج مساعدة، تواصل مع الدعم على ${supportNumber}.` }; }"
);

fs.writeFileSync('js/support-chat.js', js);
console.log('support-chat.js updated successfully.');

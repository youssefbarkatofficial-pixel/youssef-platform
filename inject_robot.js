const fs = require('fs');

const robotCode = `
// ============================================================
// Smart Robot Guide System
// ============================================================
(function initSmartRobotGuide() {
    if (window.top !== window.self) return; // Don't run in iframes
    if (document.getElementById('smart-robot-guide')) return;

    // Run after full page load to avoid blocking render
    window.addEventListener('load', () => {
        setTimeout(() => {
            const pagePath = window.location.pathname.split('/').pop().split('?')[0] || 'index.html';
            
            const guideMessages = {
                'dashboard.html': 'أهلاً بك يا بطل! من هنا تقدر تتابع كورساتك، وتعرف إحصائياتك ونقاطك، وتشوف ترتيبك في لوحة الشرف.',
                'course-details.html': 'أنت الآن داخل الكورس. لازم تسمع المحاضرة وتخلصها عشان يفتحلك التدريب والواجب بتاعها.',
                'exams.html': 'صفحة الامتحانات! ركز كويس وتأكد إن الإنترنت مستقر قبل ما تفتح أي امتحان.',
                'homeworks.html': 'هنا هتلاقي الواجبات. متنساش تحل الواجب عشان تقدر تدخل امتحان الحصة اللي بعدها.',
                'my-courses.html': 'دي كورساتك اللي إنت مشترك فيها. لو في كورس ناقص، تقدر تتواصل مع الدعم الفني.',
                'index.html': 'أهلاً بك في منصة مستر يوسف بركات! سجل دخولك عشان تبدأ رحلتك.'
            };

            const defaultMessage = 'أنا مساعدك الذكي! لو احتجت أي مساعدة، اضغط عليا في أي وقت.';
            let message = guideMessages[pagePath] || defaultMessage;

            const dismissedPages = JSON.parse(localStorage.getItem('robot_dismissed_pages') || '[]');
            let isDismissed = dismissedPages.includes(pagePath);
            
            const style = document.createElement('style');
            style.innerHTML = \`
                #smart-robot-guide {
                    position: fixed;
                    bottom: 25px;
                    left: 25px;
                    z-index: 999999;
                    display: flex;
                    align-items: flex-end;
                    pointer-events: none;
                    direction: rtl;
                }
                .robot-icon-wrapper {
                    pointer-events: auto;
                    cursor: pointer;
                    width: 65px;
                    height: 65px;
                    background: linear-gradient(135deg, #161f36 0%, #0d1425 100%);
                    border: 2px solid #d4a64f;
                    border-radius: 50%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.6), 0 0 15px rgba(212, 166, 79, 0.4);
                    animation: floatingRobot 3.5s ease-in-out infinite;
                    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    position: relative;
                }
                .robot-icon-wrapper:hover {
                    transform: scale(1.15) rotate(-5deg);
                }
                .robot-icon-wrapper svg {
                    width: 38px;
                    height: 38px;
                    fill: #d4a64f;
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
                }
                .robot-pulse {
                    position: absolute;
                    top: -2px; left: -2px; right: -2px; bottom: -2px;
                    border-radius: 50%;
                    border: 2px solid rgba(212, 166, 79, 0.6);
                    animation: robotPulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    pointer-events: none;
                }
                .robot-message-bubble {
                    pointer-events: auto;
                    background: rgba(10, 15, 25, 0.95);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(212, 166, 79, 0.5);
                    border-radius: 20px 20px 20px 0px;
                    padding: 16px 24px;
                    max-width: 280px;
                    box-shadow: 0 15px 35px rgba(0,0,0,0.5), 0 0 20px rgba(212, 166, 79, 0.1);
                    margin-left: 18px;
                    margin-bottom: 35px;
                    position: relative;
                    transform-origin: bottom left;
                    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    opacity: 0;
                    transform: scale(0.5) translateY(20px);
                }
                .robot-message-bubble.active {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
                .robot-message-bubble::after {
                    content: '';
                    position: absolute;
                    bottom: -10px;
                    left: 0px;
                    width: 0;
                    height: 0;
                    border-style: solid;
                    border-width: 15px 20px 0 0;
                    border-color: rgba(10, 15, 25, 0.95) transparent transparent transparent;
                    filter: drop-shadow(0 2px 1px rgba(212,166,79,0.3));
                }
                .robot-message-bubble p {
                    color: #f1f1f1;
                    margin: 0;
                    font-size: 0.98rem;
                    line-height: 1.6;
                    font-family: 'Cairo', sans-serif;
                }
                .robot-close-btn {
                    position: absolute;
                    top: -10px;
                    left: -10px;
                    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                    color: white;
                    border: 2px solid #111;
                    width: 26px;
                    height: 26px;
                    border-radius: 50%;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                    transition: transform 0.2s, background 0.3s;
                }
                .robot-close-btn:hover {
                    transform: scale(1.15);
                    background: linear-gradient(135deg, #ff5252 0%, #d32f2f 100%);
                }
                
                @keyframes floatingRobot {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-12px); }
                    100% { transform: translateY(0px); }
                }
                @keyframes robotPulse {
                    0% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(1.5); opacity: 0; }
                }

                @media (max-width: 768px) {
                    #smart-robot-guide {
                        bottom: 20px;
                        left: 20px;
                    }
                    .robot-icon-wrapper {
                        width: 55px; height: 55px;
                    }
                    .robot-icon-wrapper svg {
                        width: 30px; height: 30px;
                    }
                    .robot-message-bubble {
                        max-width: 230px;
                        padding: 14px 18px;
                        margin-left: 12px;
                        margin-bottom: 25px;
                    }
                    .robot-message-bubble p {
                        font-size: 0.88rem;
                    }
                }
            \`;
            document.head.appendChild(style);

            const container = document.createElement('div');
            container.id = 'smart-robot-guide';
            container.innerHTML = \`
                <div class="robot-message-bubble" id="robotMessageBubble">
                    <button class="robot-close-btn" id="robotCloseBtn">&times;</button>
                    <p id="robotMessageText">\${message}</p>
                </div>
                <div class="robot-icon-wrapper" id="robotIconBtn" title="المساعد الذكي">
                    <div class="robot-pulse"></div>
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2a2 2 0 0 1 2 2v2h3a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-1v1a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-1H7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h3V4a2 2 0 0 1 2-2zm4 11h-8v4h8v-4zm-1.5-6h-5a1 1 0 0 0-1 1v2h7V8a1 1 0 0 0-1-1zM9 10a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                    </svg>
                </div>
            \`;
            document.body.appendChild(container);

            const iconBtn = document.getElementById('robotIconBtn');
            const bubble = document.getElementById('robotMessageBubble');
            const closeBtn = document.getElementById('robotCloseBtn');
            const msgText = document.getElementById('robotMessageText');

            setTimeout(() => {
                if (!isDismissed) {
                    bubble.classList.add('active');
                }
            }, 1200);

            iconBtn.addEventListener('click', () => {
                if (bubble.classList.contains('active')) {
                    bubble.classList.remove('active');
                } else {
                    msgText.textContent = guideMessages[pagePath] || defaultMessage;
                    bubble.classList.add('active');
                    let saved = JSON.parse(localStorage.getItem('robot_dismissed_pages') || '[]');
                    saved = saved.filter(p => p !== pagePath);
                    localStorage.setItem('robot_dismissed_pages', JSON.stringify(saved));
                    isDismissed = false;
                }
            });

            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                bubble.classList.remove('active');
                let saved = JSON.parse(localStorage.getItem('robot_dismissed_pages') || '[]');
                if (!saved.includes(pagePath)) {
                    saved.push(pagePath);
                    localStorage.setItem('robot_dismissed_pages', JSON.stringify(saved));
                }
                isDismissed = true;
            });
        }, 500);
    });
})();
`;

let c = fs.readFileSync('js/main.js', 'utf8');
if (!c.includes('Smart Robot Guide System')) {
    fs.writeFileSync('js/main.js', c + '\n' + robotCode);
    console.log('Injected Smart Robot Guide');
}

const fs = require('fs');

// Add professional PWA install banner to index.html
let content = fs.readFileSync('index.html', 'utf8');

const pwaCSS = `
    <!-- PWA Install Banner Styles -->
    <style>
    #pwaInstallBanner {
        display: none;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 999999;
        background: linear-gradient(135deg, rgba(7,19,38,0.97) 0%, rgba(15,30,60,0.97) 100%);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-top: 1px solid rgba(212,166,79,0.4);
        box-shadow: 0 -10px 40px rgba(0,0,0,0.5);
        padding: 16px 20px;
        direction: rtl;
        font-family: 'Cairo', sans-serif;
        animation: slideUpBanner 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideUpBanner {
        from { transform: translateY(100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
    }
    #pwaInstallBanner .pwa-inner {
        max-width: 600px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        gap: 14px;
    }
    #pwaInstallBanner .pwa-icon {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        background: linear-gradient(135deg, #D4A64F, #f0c060);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.6rem;
        flex-shrink: 0;
        box-shadow: 0 4px 15px rgba(212,166,79,0.4);
    }
    #pwaInstallBanner .pwa-text {
        flex: 1;
        min-width: 0;
    }
    #pwaInstallBanner .pwa-text strong {
        display: block;
        color: #fff;
        font-size: 0.95rem;
        font-weight: 700;
        margin-bottom: 2px;
    }
    #pwaInstallBanner .pwa-text span {
        color: rgba(255,255,255,0.6);
        font-size: 0.8rem;
    }
    #pwaInstallBanner .pwa-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
    }
    #pwaBtnInstall {
        background: linear-gradient(135deg, #D4A64F, #e8b860);
        color: #000;
        border: none;
        padding: 10px 20px;
        border-radius: 25px;
        font-weight: 700;
        font-size: 0.88rem;
        cursor: pointer;
        font-family: 'Cairo', sans-serif;
        white-space: nowrap;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 4px 12px rgba(212,166,79,0.4);
    }
    #pwaBtnInstall:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(212,166,79,0.6); }
    #pwaBtnDismiss {
        background: transparent;
        color: rgba(255,255,255,0.5);
        border: 1px solid rgba(255,255,255,0.15);
        padding: 10px 14px;
        border-radius: 25px;
        font-size: 1rem;
        cursor: pointer;
        transition: color 0.2s;
        line-height: 1;
    }
    #pwaBtnDismiss:hover { color: #fff; }
    @media (max-width: 480px) {
        #pwaInstallBanner .pwa-inner { gap: 10px; }
        #pwaBtnInstall { padding: 9px 14px; font-size: 0.82rem; }
        #pwaInstallBanner .pwa-text strong { font-size: 0.88rem; }
    }
    </style>
`;

const pwaBanner = `
    <!-- PWA Install Banner -->
    <div id="pwaInstallBanner" role="banner" aria-label="تثبيت التطبيق">
        <div class="pwa-inner">
            <div class="pwa-icon">📚</div>
            <div class="pwa-text">
                <strong>ثبّت تطبيق منصة يوسف بركات</strong>
                <span>استمتع بتجربة أسرع وأفضل — بدون متجر تطبيقات!</span>
            </div>
            <div class="pwa-actions">
                <button id="pwaBtnInstall" onclick="pwaInstallNow()">📥 تثبيت</button>
                <button id="pwaBtnDismiss" onclick="pwaDismiss()" title="إغلاق">✕</button>
            </div>
        </div>
    </div>
`;

const pwaScript = `
    <!-- PWA Install Logic -->
    <script>
    let _pwaPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        _pwaPrompt = e;
        // Only show if user hasn't dismissed in the last 7 days
        const dismissed = localStorage.getItem('pwaBannerDismissed');
        if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 3600 * 1000) {
            setTimeout(() => {
                const banner = document.getElementById('pwaInstallBanner');
                if (banner) banner.style.display = 'block';
            }, 3000);
        }
    });
    window.addEventListener('appinstalled', () => {
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) banner.style.display = 'none';
        localStorage.setItem('pwaBannerDismissed', Date.now());
        if(window.showToast) window.showToast('🎉 تم تثبيت التطبيق بنجاح!', 'success');
    });
    function pwaInstallNow() {
        if (_pwaPrompt) {
            _pwaPrompt.prompt();
            _pwaPrompt.userChoice.then(choice => {
                if (choice.outcome === 'accepted') {
                    document.getElementById('pwaInstallBanner').style.display = 'none';
                }
                _pwaPrompt = null;
            });
        }
    }
    function pwaDismiss() {
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) banner.style.display = 'none';
        localStorage.setItem('pwaBannerDismissed', Date.now());
    }
    </script>
`;

// Inject CSS in <head> before </head>
if (!content.includes('pwaInstallBanner')) {
    content = content.replace('</head>', pwaCSS + '</head>');
    // Inject Banner HTML before </body>
    content = content.replace('</body>', pwaBanner + pwaScript + '\n</body>');
    fs.writeFileSync('index.html', content, 'utf8');
    console.log('✅ PWA install banner added to index.html');
} else {
    console.log('⚠️  Banner already exists');
}

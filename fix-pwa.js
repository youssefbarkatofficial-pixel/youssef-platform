const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Remove old PWA script block and floating button
const oldStart = html.indexOf('    <!-- PWA Install Logic -->');
const oldEnd = html.indexOf('</button>\n</body>') + '</button>\n</body>'.length;

if (oldStart === -1) {
    console.log('Could not find PWA block, searching differently...');
    // Try another marker
    const alt = html.indexOf('let _pwaPrompt = null;');
    console.log('_pwaPrompt found at:', alt);
    process.exit(1);
}

console.log('Found PWA block from', oldStart, 'to', oldEnd);

const before = html.substring(0, oldStart);
const after = '</body>\n\n</html>\n';

const newBlock = `    <!-- PWA Install Logic - Unified -->
    <script>
    window._pwaPrompt = null;

    window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        window._pwaPrompt = e;
        // Show the floating install button
        var btn = document.getElementById('floatingInstallBtn');
        if (btn) btn.style.display = 'flex';
        // Show banner after 3s if not dismissed
        var dismissed = localStorage.getItem('pwaBannerDismissed');
        if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 3600 * 1000) {
            setTimeout(function() {
                var banner = document.getElementById('pwaInstallBanner');
                if (banner) banner.style.display = 'block';
            }, 3000);
        }
    });

    window.addEventListener('appinstalled', function() {
        window._pwaPrompt = null;
        var btn = document.getElementById('floatingInstallBtn');
        if (btn) btn.style.display = 'none';
        var banner = document.getElementById('pwaInstallBanner');
        if (banner) banner.style.display = 'none';
        localStorage.setItem('pwaBannerDismissed', Date.now());
        if (window.showToast) window.showToast('تم تثبيت التطبيق بنجاح!', 'success');
    });

    function pwaInstallNow() {
        if (window._pwaPrompt) {
            window._pwaPrompt.prompt();
            window._pwaPrompt.userChoice.then(function(choice) {
                if (choice.outcome === 'accepted') {
                    var banner = document.getElementById('pwaInstallBanner');
                    if (banner) banner.style.display = 'none';
                    var btn = document.getElementById('floatingInstallBtn');
                    if (btn) btn.style.display = 'none';
                }
                window._pwaPrompt = null;
            });
        }
        // No prompt = already installed or not supported, do nothing silently
    }

    function pwaDismiss() {
        var banner = document.getElementById('pwaInstallBanner');
        if (banner) banner.style.display = 'none';
        localStorage.setItem('pwaBannerDismissed', Date.now());
    }
    </script>

    <!-- Floating Install App Button (Left Side) - hidden until browser fires beforeinstallprompt -->
    <button onclick="pwaInstallNow()" id="floatingInstallBtn"
        style="display: none; position: fixed; bottom: 30px; left: 30px; background: linear-gradient(135deg, #2ecc71, #27ae60); color: #fff; border: none; width: 60px; height: 60px; border-radius: 50%; box-shadow: 0 0 15px rgba(46,204,113,0.5); cursor: pointer; z-index: 9998; justify-content: center; align-items: center; font-size: 1.8rem; transition: transform 0.3s; animation: safePulse 2s infinite;"
        title="تثبيت تطبيق المنصة"
        onmouseover="this.style.transform='scale(1.1)'"
        onmouseout="this.style.transform='scale(1)'">
        <i class="fas fa-download"></i>
    </button>
</body>

</html>
`;

const newHtml = before + newBlock;
fs.writeFileSync('index.html', newHtml, 'utf8');
console.log('Done! PWA logic unified and floating button fixed.');

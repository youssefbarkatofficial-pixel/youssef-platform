const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');
if (c.includes('installAppBtn')) {
    console.log('Already has installAppBtn');
} else {
    c = c.replace(
        /<div class="hero-buttons"[^>]*>/,
        `$&
                <button id="installAppBtn" class="btn btn-outline" style="display:none;"><i class="fas fa-download"></i> تحميل التطبيق</button>`
    );
    c = c.replace(
        /<\/body>/,
        `<script>
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            const installBtn = document.getElementById('installAppBtn');
            if (installBtn) {
                installBtn.style.display = 'inline-flex';
                installBtn.addEventListener('click', () => {
                    installBtn.style.display = 'none';
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult) => {
                        if (choiceResult.outcome === 'accepted') {
                            console.log('User accepted the install prompt');
                        } else {
                            console.log('User dismissed the install prompt');
                        }
                        deferredPrompt = null;
                    });
                });
            }
        });
    </script>
</body>`
    );
    fs.writeFileSync('index.html', c, 'utf8');
    console.log('Added install button and script');
}

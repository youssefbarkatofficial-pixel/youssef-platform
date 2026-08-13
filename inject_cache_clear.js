const fs = require('fs');
let c = fs.readFileSync('js/main.js', 'utf8');
const updateCode = `
// AUTO CACHE CLEAR SCRIPT (Forces refresh across all browsers)
(function() {
    const APP_VER = 'v19_cache_buster';
    if (localStorage.getItem('app_version') !== APP_VER) {
        localStorage.setItem('app_version', APP_VER);
        if ('caches' in window) {
            caches.keys().then(names => {
                for (let name of names) caches.delete(name);
            });
        }
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) {
                    registration.unregister();
                }
            });
        }
        // Small delay to ensure deletion happens before reload
        setTimeout(() => {
            window.location.reload(true);
        }, 300);
    }
})();
`;
if (!c.includes('AUTO CACHE CLEAR SCRIPT')) {
    fs.writeFileSync('js/main.js', updateCode + '\n' + c);
    console.log('Injected auto cache clear');
}

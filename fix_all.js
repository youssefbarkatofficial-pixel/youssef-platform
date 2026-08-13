const fs = require('fs');

// 1. Update logo in all HTML files
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
const v = Date.now();
const newLogoHtml = `<img src="images/logo.png?v=${v}" alt="Logo" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;

let filesModified = 0;
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Regex to match <div class="logo-circle" ...> ... </div>
    const regex = /(<div[^>]*class="[^"]*logo-circle[^"]*"[^>]*>)(.*?)(<\/div>)/gs;
    content = content.replace(regex, (match, p1, p2, p3) => {
        return `${p1}${newLogoHtml}${p3}`;
    });
    
    // Also fix PWA Banner overlap (make it bottom: 90px instead of 20px)
    content = content.replace(/bottom:\s*20px;([^}]*z-index:\s*10000;)/g, 'bottom: 90px;$1');
    
    if (content !== original) {
        fs.writeFileSync(file, content);
        filesModified++;
    }
});
console.log(`Updated logos in ${filesModified} HTML files.`);

// 2. Update add-pwa-banner.js
if (fs.existsSync('add-pwa-banner.js')) {
    let pwaJs = fs.readFileSync('add-pwa-banner.js', 'utf8');
    pwaJs = pwaJs.replace(/bottom:\s*20px;/g, 'bottom: 90px;');
    fs.writeFileSync('add-pwa-banner.js', pwaJs);
    console.log('Updated add-pwa-banner.js');
}

// 3. Update admin-auth.js for Maryam
let authJs = fs.readFileSync('js/admin-auth.js', 'utf8');
if (!authJs.includes('mariamassistant')) {
    const injection = `
            if (admin.role === 'assistant' || admin.email === 'mariamassistant@gmail.com') {
                const style = document.createElement('style');
                style.innerHTML = \`
                    a[href="admin-compass.html"], 
                    a[href="admin-bot-monitor.html"], 
                    .owner-compass-summary,
                    #complaintsRequestsPanel {
                        display: none !important;
                    }
                \`;
                document.head.appendChild(style);
                
                if (window.location.pathname.includes('admin-compass') || window.location.pathname.includes('admin-bot-monitor')) {
                    window.location.replace('admin-dashboard.html');
                }
            }
`;
    authJs = authJs.replace(/(if \(admin\) \{)/, `$1${injection}`);
    fs.writeFileSync('js/admin-auth.js', authJs);
    console.log('Updated admin-auth.js for Maryam');
}


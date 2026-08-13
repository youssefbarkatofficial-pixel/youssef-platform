const fs = require('fs');

let authJs = fs.readFileSync('js/admin-auth.js', 'utf8');
if (!authJs.includes('admin-compass.html')) {
    const injection = `
            if (admin.role === 'assistant' || admin.email === 'mariamassistant@gmail.com') {
                const style = document.createElement('style');
                style.innerHTML = \`
                    a[href="admin-compass.html"], 
                    a[href="admin-bot-monitor.html"], 
                    .dash-panel:has(.fa-compass),
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


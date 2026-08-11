const fs = require('fs');

let adminDb = fs.readFileSync('admin-dashboard.html', 'utf8');

// The original script looks for .btn-danger etc.
// We will update it to also find links to admin-compass, admin-bot-monitor, and any div containing 'تعليم البوصلة'
const newScript = `
    <!-- Apply Assistant Restrictions -->
    <script>
    document.addEventListener('DOMContentLoaded', () => {
        const adminStr = sessionStorage.getItem('currentAdmin');
        if (adminStr) {
            try {
                const adm = JSON.parse(adminStr);
                if (adm.role === 'assistant') {
                    // Hide delete buttons periodically as content might load dynamically
                    setInterval(() => {
                        document.querySelectorAll('.btn-danger, [onclick*="delete"], [onclick*="remove"], [onclick*="wipe"]').forEach(btn => {
                            if (!btn.classList.contains('assistant-allowed')) {
                                btn.style.display = 'none';
                            }
                        });
                        
                        // Hide Bot/Compass related elements silently
                        document.querySelectorAll('a[href="admin-compass.html"], a[href="admin-bot-monitor.html"]').forEach(el => {
                            el.style.display = 'none';
                        });
                        
                        // Look for panel titles containing 'البوصلة' and hide their parent .dashboard-section
                        document.querySelectorAll('.panel-title, h3').forEach(el => {
                            if (el.textContent.includes('البوصلة') || el.textContent.includes('صراع البوصلة')) {
                                const section = el.closest('.dashboard-section') || el.closest('.glass-panel');
                                if (section) section.style.display = 'none';
                            }
                        });
                        
                        // Hide floating bot button if exists
                        const gameBtn = document.querySelector('[onclick*="gameWidgetModal"]');
                        if (gameBtn) gameBtn.style.display = 'none';
                    }, 500);
                }
            } catch(e) {}
        }
    });
    </script>
`;

adminDb = adminDb.replace(/<!-- Apply Assistant Restrictions -->[\s\S]*?<\/script>/, newScript);
fs.writeFileSync('admin-dashboard.html', adminDb, 'utf8');
console.log('Fixed bot visibility for assistant.');

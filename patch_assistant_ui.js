const fs = require('fs');

let adminDb = fs.readFileSync('admin-dashboard.html', 'utf8');

if (!adminDb.includes('// Apply assistant restrictions')) {
    const restrictHtml = `
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
                    }, 1000);
                }
            } catch(e) {}
        }
    });
    </script>
    `;
    adminDb = adminDb.replace('</body>', restrictHtml + '\n</body>');
    fs.writeFileSync('admin-dashboard.html', adminDb, 'utf8');
}

// Similarly for courses and students and upload
const filesToPatch = ['admin-courses.html', 'admin-students.html', 'admin-upload.html', 'admin-student-analytics.html'];

filesToPatch.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        if (!content.includes('// Apply assistant restrictions')) {
            const restrictHtml = `
    <!-- Apply Assistant Restrictions -->
    <script>
    document.addEventListener('DOMContentLoaded', () => {
        const adminStr = sessionStorage.getItem('currentAdmin');
        if (adminStr) {
            try {
                const adm = JSON.parse(adminStr);
                if (adm.role === 'assistant') {
                    setInterval(() => {
                        document.querySelectorAll('.btn-danger, [onclick*="delete"], [onclick*="remove"], [onclick*="wipe"]').forEach(btn => {
                            if (!btn.classList.contains('assistant-allowed')) {
                                btn.style.display = 'none';
                            }
                        });
                    }, 1000);
                }
            } catch(e) {}
        }
    });
    </script>
    `;
            content = content.replace('</body>', restrictHtml + '\n</body>');
            fs.writeFileSync(file, content, 'utf8');
        }
    }
});

console.log('Fixed assistant UI restrictions.');

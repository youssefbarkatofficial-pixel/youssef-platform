const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.startsWith('admin-') && f.endsWith('.html') && f !== 'admin-login.html');

const style_tag = `    <style>
        @media (max-width: 768px) {
            .desktop-text { display: none !important; }
            .mobile-only-text { display: inline !important; }
        }
    </style>
</head>`;

const profile_html = `            <div class="user-profile-mini" style="text-align: center;">
                <div class="avatar-name" style="display:flex; justify-content:center; margin-bottom: 12px;">
                    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='40' fill='%23071326'/%3E%3Ccircle cx='40' cy='30' r='16' fill='%23D4A64F'/%3E%3Cellipse cx='40' cy='70' rx='24' ry='18' fill='%23D4A64F'/%3E%3C/svg%3E" alt="المدير العام" style="width:65px; height:65px; border-radius:50%; object-fit:cover; border:2px solid var(--royal-gold);">
                </div>
                <h4 style="margin:0; font-size: 1.1rem; color: #fff;">يوسف بركات</h4>
                <p style="margin:5px 0 0; color: var(--accent-cyan); font-size: 0.85rem;">المدير العام (Owner)</p>
                <div class="badge badge-active" style="display: inline-block; margin-top: 10px; background: rgba(212,175,55,0.2); color: var(--royal-gold); border: 1px solid var(--royal-gold);">مالك المنصة</div>
            </div>
            <ul class="sidebar-nav"`;

const toggle_script = `    <!-- Mobile Sidebar Toggle Script -->
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const sidebar = document.getElementById('sidebar');
            const navActions = document.querySelector('.nav-actions');
            if (sidebar && navActions && !document.getElementById('mobileSidebarToggle')) {
                if (!document.getElementById('sidebarOverlay')) {
                    const overlay = document.createElement('div');
                    overlay.className = 'sidebar-overlay';
                    overlay.id = 'sidebarOverlay';
                    overlay.addEventListener('click', () => {
                        sidebar.classList.remove('active');
                        sidebar.style.cssText = '';
                        overlay.classList.remove('active');
                        document.body.style.overflow = '';
                    });
                    sidebar.parentNode.insertBefore(overlay, sidebar);
                }
                
                const toggleBtn = document.createElement('button');
                toggleBtn.id = 'mobileSidebarToggle';
                toggleBtn.className = 'btn btn-outline mobile-only-btn';
                toggleBtn.style.cssText = 'border: none; font-size: 1.5rem; padding: 5px 10px; margin-right: auto; order: -1; display: inline-flex;';
                toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
                toggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    sidebar.classList.toggle('active');
                    if (sidebar.classList.contains('active')) {
                        sidebar.style.cssText = 'right: 0 !important; visibility: visible !important; transform: none !important; opacity: 1 !important; display: block !important;';
                        document.body.style.overflow = 'hidden';
                        document.getElementById('sidebarOverlay').classList.add('active');
                    } else {
                        sidebar.style.cssText = '';
                        document.body.style.overflow = '';
                        document.getElementById('sidebarOverlay').classList.remove('active');
                    }
                });
                
                navActions.insertBefore(toggleBtn, navActions.firstChild);
            }
        });
    </script>
</body>`;

const old_header = '<span class="nav-brand-text text-gold">لوحة الإدارة - يوسف بركات</span>';
const new_header = '<span class="nav-brand-text text-gold"><span class="desktop-text">لوحة الإدارة - يوسف بركات</span><span class="mobile-only-text" style="display: none;">لوحة الإدارة</span></span>';

const old_logout = '<a href="#" id="logoutBtn" class="btn btn-outline" style="border-color: #e74c3c; color: #e74c3c; padding: 8px 15px; border-radius: 20px;">خروج <i class="fas fa-sign-out-alt"></i></a>';
const new_logout = '<a href="#" id="logoutBtn" class="btn btn-outline" style="border-color: #e74c3c; color: #e74c3c; padding: 8px 15px; border-radius: 20px;"><span class="desktop-text">خروج</span> <i class="fas fa-sign-out-alt"></i></a>';

for (const f of files) {
    if (f === 'admin-dashboard.html') continue;
    
    let content = fs.readFileSync(f, 'utf-8');
    let modified = false;

    if (!content.includes('<style>') && content.includes('</head>')) {
        content = content.replace('</head>', style_tag);
        modified = true;
    }

    if (content.includes(old_header)) {
        content = content.replace(old_header, new_header);
        modified = true;
    }

    if (content.includes(old_logout)) {
        content = content.replace(old_logout, new_logout);
        modified = true;
    }

    if (!content.includes('user-profile-mini')) {
        content = content.replace('<ul class="sidebar-nav"', profile_html);
        content = content.replace('<ul class="sidebar-nav" style="margin-top: 20px;">', profile_html + '>');
        modified = true;
    }

    if (!content.includes('Mobile Sidebar Toggle Script') && content.includes('</body>')) {
        content = content.replace('</body>', toggle_script);
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(f, content, 'utf-8');
        console.log(`Updated ${f}`);
    }
}
console.log("Done");

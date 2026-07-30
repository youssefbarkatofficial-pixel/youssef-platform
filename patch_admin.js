const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.startsWith('admin-') && f.endsWith('.html') && f !== 'admin-login.html');

const style_tag = `    <style>
        @media (max-width: 768px) {
            .desktop-text { display: none !important; }
            .mobile-only-text { display: inline !important; }
        }
    </style>
</head>`;

const profile_html = `            <div class="user-profile-mini" style="text-align: center; margin-bottom: 20px; padding: 15px;">
                <div class="avatar-name" style="display:flex; justify-content:center; margin-bottom: 12px;">
                    <div style="width:70px; height:70px; border-radius:50%; background: linear-gradient(135deg, var(--royal-gold), #b8860b); display:flex; align-items:center; justify-content:center; border: 3px solid rgba(212,175,55,0.3); box-shadow: 0 4px 15px rgba(212,175,55,0.2);">
                        <i class="fas fa-user-tie" style="font-size: 2rem; color: #fff;"></i>
                    </div>
                </div>
                <h4 style="margin:0; font-size: 1.2rem; color: var(--royal-gold);">يوسف بركات</h4>
                <p style="margin:5px 0 0; color: rgba(255,255,255,0.6); font-size: 0.85rem;">المدير العام (Owner)</p>
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

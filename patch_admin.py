import os
import glob

files = glob.glob('admin-*.html')
files = [f for f in files if f != 'admin-login.html']

style_tag = '''    <style>
        @media (max-width: 768px) {
            .desktop-text { display: none !important; }
            .mobile-only-text { display: inline !important; }
        }
    </style>
</head>'''

profile_html = '''            <div class="user-profile-mini" style="text-align: center; margin-bottom: 20px; padding: 15px;">
                <div class="avatar-name" style="display:flex; justify-content:center; margin-bottom: 12px;">
                    <div style="width:70px; height:70px; border-radius:50%; background: linear-gradient(135deg, var(--royal-gold), #b8860b); display:flex; align-items:center; justify-content:center; border: 3px solid rgba(212,175,55,0.3); box-shadow: 0 4px 15px rgba(212,175,55,0.2);">
                        <i class="fas fa-user-tie" style="font-size: 2rem; color: #fff;"></i>
                    </div>
                </div>
                <h4 style="margin:0; font-size: 1.2rem; color: var(--royal-gold);">يوسف بركات</h4>
                <p style="margin:5px 0 0; color: rgba(255,255,255,0.6); font-size: 0.85rem;">المدير العام (Owner)</p>
            </div>
            <ul class="sidebar-nav"'''

toggle_script = '''    <!-- Mobile Sidebar Toggle Script -->
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
</body>'''

old_header = '<span class="nav-brand-text text-gold">لوحة الإدارة - يوسف بركات</span>'
new_header = '<span class="nav-brand-text text-gold"><span class="desktop-text">لوحة الإدارة - يوسف بركات</span><span class="mobile-only-text" style="display: none;">لوحة الإدارة</span></span>'

old_logout = '<a href="#" id="logoutBtn" class="btn btn-outline" style="border-color: #e74c3c; color: #e74c3c; padding: 8px 15px; border-radius: 20px;">خروج <i class="fas fa-sign-out-alt"></i></a>'
new_logout = '<a href="#" id="logoutBtn" class="btn btn-outline" style="border-color: #e74c3c; color: #e74c3c; padding: 8px 15px; border-radius: 20px;"><span class="desktop-text">خروج</span> <i class="fas fa-sign-out-alt"></i></a>'


for f in files:
    if f == 'admin-dashboard.html':
        continue
        
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    modified = False

    if '<style>' not in content[:content.find('</head>')]:
        content = content.replace('</head>', style_tag)
        modified = True

    if old_header in content:
        content = content.replace(old_header, new_header)
        modified = True

    if old_logout in content:
        content = content.replace(old_logout, new_logout)
        modified = True

    if 'user-profile-mini' not in content:
        content = content.replace('<ul class="sidebar-nav"', profile_html)
        content = content.replace('<ul class="sidebar-nav" style="margin-top: 20px;">', profile_html + '>')
        modified = True

    if 'Mobile Sidebar Toggle Script' not in content:
        content = content.replace('</body>', toggle_script)
        modified = True

    if modified:
        with open(f, 'w', encoding='utf-8') as out_file:
            out_file.write(content)
        print(f"Updated {f}")

print("Done")

/**
 * Owner Admin Authentication System
 * Mock Database and Role-based Authentication for Platform
 */

const DEFAULT_ADMIN = {
    id: 'admin_001',
    name: 'يوسف بركات',
    email: 'youssefbarkatofficial@gmail.com',
    password: 'YoussefMBarakat175235',
    role: 'admin'
};

// Initialize Mock Database
function initAdminDB() {
    if (!localStorage.getItem('platformAdmins')) {
        localStorage.setItem('platformAdmins', JSON.stringify([DEFAULT_ADMIN]));
    }
}

// Admin Login Function
function adminLogin(email, password) {
    const admins = JSON.parse(localStorage.getItem('platformAdmins') || '[]');
    const admin = admins.find(a => a.email === email && a.password === password);

    if (!admin) {
        return { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
    }

    // Save session
    sessionStorage.setItem('currentAdmin', JSON.stringify(admin));
    return { success: true, admin };
}

// Admin Logout Function
function adminLogout() {
    sessionStorage.removeItem('currentAdmin');
    localStorage.removeItem('currentAdmin');
    window.location.href = 'index.html';
}

// Check Admin Authentication
async function checkAdminAuth() {
    const adminStr = sessionStorage.getItem('currentAdmin');
    
    // If not logged in as admin, redirect to admin login
    if (!adminStr) {
        window.location.href = 'admin-login.html';
        return null;
    }

    const admin = JSON.parse(adminStr);
    
    // Check against local valid admins first
    const validAdmins = JSON.parse(localStorage.getItem('platformAdmins') || '[]');
    const isValidLocal = validAdmins.find(a => a.email === admin.email && a.password === admin.password);
    
    if (!isValidLocal) {
        sessionStorage.removeItem('currentAdmin');
        window.location.href = 'admin-login.html';
        return null;
    }

    // Optional: Firebase strict verification (if firebase is ready)
    if (window.firebaseDb) {
        try {
            const adminDoc = await window.firebaseDb.collection('platformAdmins').doc(admin.email).get();
            if (adminDoc.exists) {
                const remoteAdmin = adminDoc.data();
                if (remoteAdmin.password !== admin.password) {
                    sessionStorage.removeItem('currentAdmin');
                    window.location.href = 'admin-login.html';
                    return null;
                }
            } else {
                // Seed admin if first time
                await window.firebaseDb.collection('platformAdmins').doc(admin.email).set(admin);
            }
        } catch(e) { console.warn("Admin Firebase verify failed", e); }
    }

    // VIP Admin Welcome Experience
    if (!sessionStorage.getItem('adminWelcomeShown') && window.audioManager) {
        sessionStorage.setItem('adminWelcomeShown', 'true');
        setTimeout(() => {
            window.audioManager.play('welcomeAdmin');
            
            const vipOverlay = document.createElement('div');
            vipOverlay.className = 'modal-overlay active';
            vipOverlay.style.cssText = 'z-index: 999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(15px); background: rgba(0,0,0,0.8); animation: fadeIn 0.5s ease;';
            
            vipOverlay.innerHTML = `
                <div class="glass-panel modal-content" style="text-align: center; padding: 50px; max-width: 500px; border: 2px solid var(--royal-gold); box-shadow: 0 0 50px rgba(212, 166, 79, 0.3); animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);">
                    <button class="close-modal" id="closeVipBtn" style="position:absolute; top:15px; left:15px; background:transparent; border:none; color:rgba(255,255,255,0.5); font-size:1.5rem; cursor:pointer; transition:all 0.3s;"><i class="fas fa-times"></i></button>
                    <i class="fas fa-crown" style="font-size: 4rem; color: var(--royal-gold); margin-bottom: 20px; filter: drop-shadow(0 0 10px rgba(212,166,79,0.5));"></i>
                    <h2 style="color: var(--text-primary); font-family: 'Aref Ruqaa', serif; font-size: 2.2rem; margin-bottom: 10px;">مرحباً بعودتك</h2>
                    <h1 style="color: var(--royal-gold); font-size: 2.5rem; margin-bottom: 20px;">يا أستاذ يوسف بركات</h1>
                    <p style="color: rgba(255,255,255,0.7); font-size: 1.1rem;">منصتك التعليمية جاهزة لإبداعك اليومي.</p>
                </div>
            `;
            
            document.body.appendChild(vipOverlay);
            
            const closeBtn = document.getElementById('closeVipBtn');
            closeBtn.onmouseover = () => closeBtn.style.color = '#fff';
            closeBtn.onmouseout = () => closeBtn.style.color = 'rgba(255,255,255,0.5)';
            closeBtn.onclick = () => {
                window.audioManager.play('click');
                vipOverlay.style.animation = 'fadeOut 0.5s ease forwards';
                vipOverlay.querySelector('.modal-content').style.animation = 'slideDown 0.5s ease forwards';
                setTimeout(() => vipOverlay.remove(), 500);
            };
        }, 800);
    }

    if (admin.role !== 'admin') {
        window.location.href = 'admin-login.html';
        return null;
    }

    return admin;
}

// Initialize on load
initAdminDB();

document.addEventListener('DOMContentLoaded', () => {
    // If we are on any admin page except login
    if (window.location.pathname.includes('admin-') && !window.location.pathname.includes('admin-login.html')) {
        const admin = checkAdminAuth();
        if (admin) {
            // Setup logout button
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    adminLogout();
                });
            }
            
            // Welcome message update (optional)
            const adminNameDisplay = document.querySelector('.nav-brand-text');
            if (adminNameDisplay && admin.name) {
                adminNameDisplay.textContent = `لوحة الإدارة - ${admin.name}`;
            }
        }
    }

    // If we are on admin login page
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        // If already logged in, redirect to dashboard
        if (sessionStorage.getItem('currentAdmin')) {
            window.location.href = 'admin-dashboard.html';
        }

        adminLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('adminEmail').value;
            const password = document.getElementById('adminPassword').value;
            const errorMsg = document.getElementById('adminLoginError');
            
            const result = adminLogin(email, password);
            
            if (result.success) {
                if(window.showToast) {
                    window.showToast('تم تسجيل الدخول بنجاح. جاري التوجيه...', 'success');
                }
                setTimeout(() => {
                    window.location.href = 'admin-dashboard.html';
                }, 1000);
            } else {
                if(errorMsg) {
                    errorMsg.textContent = result.message;
                    errorMsg.style.display = 'block';
                } else {
                    alert(result.message);
                }
            }
        });
    }

    // --- Global Logo Loader for Admin Pages ---
    const savedLogo = localStorage.getItem('ownerNavLogoImage') || localStorage.getItem('customLogo');
    if (savedLogo) {
        document.querySelectorAll('.logo-circle').forEach(circle => {
            if (circle.id === 'footerLogoContainer' || circle.id === 'featuresCenterLogoContainer') return;
            
            let img = circle.querySelector('img');
            if (img) {
                img.src = savedLogo;
                img.style.display = 'block';
                const textSpan = circle.querySelector('span');
                if (textSpan) textSpan.style.display = 'none';
            } else {
                circle.innerHTML = `<img src="${savedLogo}" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover;">`;
                circle.style.position = 'relative';
                circle.style.overflow = 'hidden';
            }
        });
    }
});

/**
 * Owner Admin Authentication System
 * Firebase Auth and Role-based Authentication for Platform
 */

// Admin Logout Function
async function adminLogout() {
    sessionStorage.removeItem('currentAdmin');
    if (window.firebase && window.firebase.auth) {
        try {
            await firebase.auth().signOut();
        } catch (e) {
            console.error('Logout error', e);
        }
    }
    window.location.href = 'index.html';
}

// Check Admin Authentication
function checkAdminAuth() {
    return new Promise((resolve) => {
        // Use sessionStorage for immediate UI unhiding to prevent flicker if already logged in
        const cachedAdminStr = sessionStorage.getItem('currentAdmin');
        
        if (cachedAdminStr) {
            document.documentElement.style.display = '';
        }

        if (!window.firebase || !window.firebase.auth || !window.firebaseDb) {
            if (cachedAdminStr) {
                resolve(JSON.parse(cachedAdminStr));
            } else {
                window.location.replace('admin-login.html');
                resolve(null);
            }
            return;
        }

        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const normalizedEmail = user.email.toLowerCase();
                    const adminDocRef = window.firebaseDb.collection('platformAdmins').doc(normalizedEmail);
                    const adminDoc = await adminDocRef.get();
                    
                    if (adminDoc.exists) {
                        const adminData = adminDoc.data();
                        adminData.email = normalizedEmail;
                        sessionStorage.setItem('currentAdmin', JSON.stringify(adminData));
                        
                        document.documentElement.style.display = '';

                        // VIP Admin Welcome Experience
                        if (!sessionStorage.getItem('adminWelcomeShown') && window.audioManager && adminData.role === 'admin') {
                            sessionStorage.setItem('adminWelcomeShown', 'true');
                            setTimeout(() => {
                                window.audioManager.play('welcomeAdmin');
                                
                                const vipOverlay = document.createElement('div');
                                vipOverlay.className = 'modal-overlay active';
                                vipOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(15px); background: rgba(0,0,0,0.8); animation: fadeIn 0.5s ease;';
                                
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
                        resolve(adminData);
                    } else {
                        sessionStorage.removeItem('currentAdmin');
                        await firebase.auth().signOut();
                        window.location.replace('admin-login.html');
                        resolve(null);
                    }
                } catch (error) {
                    console.error("Admin verification error", error);
                    window.location.replace('admin-login.html');
                    resolve(null);
                }
            } else {
                sessionStorage.removeItem('currentAdmin');
                window.location.replace('admin-login.html');
                resolve(null);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // If we are on any admin page except login
    if (window.location.pathname.includes('admin-') && !window.location.pathname.includes('admin-login')) {
        checkAdminAuth().then(admin => {
            if (admin) {
                if (admin.role === 'assistant' || admin.email === 'mariamassistant@gmail.com') {
                    const style = document.createElement('style');
                    style.innerHTML = `
                        a[href="admin-compass.html"], 
                        a[href="admin-bot-monitor.html"], 
                        .dash-panel:has(.fa-compass),
                        .owner-compass-summary,
                        #complaintsRequestsPanel {
                            display: none !important;
                        }
                    `;
                    document.head.appendChild(style);

                    const assistantMobileFixes = document.createElement('style');
                    assistantMobileFixes.id = 'assistantMobileFixes';
                    assistantMobileFixes.textContent = `
                        @media (max-width: 768px) {
                            .dashboard-layout {
                                display: block !important;
                                padding-top: 0 !important;
                            }
                            .sidebar {
                                position: static !important;
                                width: 100% !important;
                                height: auto !important;
                                overflow: visible !important;
                                padding: 12px !important;
                                border-left: none !important;
                                border-bottom: 1px solid rgba(212, 166, 79, 0.2) !important;
                            }
                            .sidebar-nav {
                                display: grid !important;
                                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                                gap: 8px !important;
                            }
                            .sidebar-nav li a {
                                padding: 10px 12px !important;
                                border-right: none !important;
                                border-bottom: 2px solid transparent !important;
                                font-size: 0.8rem !important;
                            }
                            .main-content {
                                margin-right: 0 !important;
                                padding: 14px !important;
                                min-width: 0 !important;
                            }
                            .page-header {
                                flex-direction: column !important;
                                align-items: stretch !important;
                                gap: 8px !important;
                            }
                            #ownerWelcomeBanner {
                                display: none !important;
                            }
                            #btnAddCourseTop {
                                position: static !important;
                                width: 100% !important;
                                margin-bottom: 12px !important;
                                border-radius: 12px !important;
                                box-shadow: none !important;
                                z-index: auto !important;
                            }
                            .dash-cards {
                                display: grid !important;
                                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                                gap: 12px !important;
                            }
                            .dash-card {
                                padding: 14px !important;
                                border-radius: 12px !important;
                                flex-direction: column !important;
                                align-items: flex-start !important;
                                text-align: left !important;
                            }
                            .dash-card-info h3 {
                                font-size: 0.75rem !important;
                            }
                            .dash-card-info .value {
                                font-size: 1.2rem !important;
                            }
                            .dash-panel,
                            .glass-panel {
                                padding: 14px !important;
                                border-radius: 12px !important;
                                margin-bottom: 16px !important;
                            }
                            #paymentRequestsPanel {
                                position: relative !important;
                                z-index: 1 !important;
                                margin-bottom: 20px !important;
                                overflow: visible !important;
                            }
                            .modal-overlay {
                                z-index: 30 !important;
                            }
                        }
                    `;
                    document.head.appendChild(assistantMobileFixes);
                    
                    if (window.location.pathname.includes('admin-compass') || window.location.pathname.includes('admin-bot-monitor')) {
                        window.location.replace('admin-dashboard.html');
                    }
                }

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
        });
    }

    // If we are on admin login page
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        // Setup Firebase auth state listener
        let checkingAuth = true;
        
        // Wait for Firebase to initialize
        const checkFirebaseReady = setInterval(() => {
            if (window.firebase && window.firebase.auth) {
                clearInterval(checkFirebaseReady);
                firebase.auth().onAuthStateChanged(async (user) => {
                    if (user && checkingAuth) {
                        try {
                            const adminDoc = await window.firebaseDb.collection('platformAdmins').doc(user.email.toLowerCase()).get();
                            if (adminDoc.exists) {
                                window.location.href = 'admin-dashboard.html';
                            } else {
                                await firebase.auth().signOut();
                            }
                        } catch(e) {
                            console.error(e);
                        }
                    }
                });
            }
        }, 100);

        adminLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            checkingAuth = false; // Disable auto-redirect to avoid conflicts during manual login
            const email = document.getElementById('adminEmail').value.trim().toLowerCase();
            const password = document.getElementById('adminPassword').value;
            const errorMsg = document.getElementById('adminLoginError');
            
            try {
                // Try to sign in
                const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
                
                // Verify admin role in Firestore
                const adminDoc = await window.firebaseDb.collection('platformAdmins').doc(email).get();
                
                if (adminDoc.exists) {
                    const adminData = adminDoc.data();
                    sessionStorage.setItem('currentAdmin', JSON.stringify(adminData));
                    if(window.showToast) {
                        window.showToast('تم تسجيل الدخول بنجاح. جاري التوجيه...', 'success');
                    }
                    setTimeout(() => {
                        window.location.href = 'admin-dashboard.html';
                    }, 1000);
                } else {
                    // Log out if not an admin
                    await firebase.auth().signOut();
                    if(errorMsg) {
                        errorMsg.textContent = 'هذا الحساب ليس لديه صلاحيات الإدارة.';
                        errorMsg.style.display = 'block';
                    } else {
                        alert('هذا الحساب ليس لديه صلاحيات الإدارة.');
                    }
                }
            } catch (error) {
                console.warn("Firebase admin auth failed:", error);
                let message = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
                if(errorMsg) {
                    errorMsg.textContent = message;
                    errorMsg.style.display = 'block';
                } else {
                    alert(message);
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

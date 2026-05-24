// js/owner-editor.js

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Always load dynamic content (so students can see it too)
    const savedHeroImage = localStorage.getItem('ownerHeroImage');
    const heroImgEl = document.getElementById('teacherHeroImg');
    const heroClippedImgEl = document.getElementById('teacherFgImgClipped');
    if (savedHeroImage) {
        if(heroImgEl) heroImgEl.src = savedHeroImage;
        if(heroClippedImgEl) heroClippedImgEl.src = savedHeroImage;
    }

    const savedBgImage = localStorage.getItem('ownerBgImage');
    const bgImgEl = document.getElementById('teacherBgImg');
    if (savedBgImage && bgImgEl) {
        bgImgEl.src = savedBgImage;
    }

    const savedNavLogo = localStorage.getItem('ownerNavLogoImage');
    const navLogoImg = document.getElementById('navLogoImg');
    const navLogoText = document.getElementById('navLogoText');
    if (savedNavLogo && navLogoImg && navLogoText) {
        navLogoImg.src = savedNavLogo;
        navLogoImg.style.display = 'block';
        navLogoText.style.display = 'none';
    }

    const savedFeaturesLogo = localStorage.getItem('ownerFeaturesLogoImage');
    const featuresCenterImg = document.getElementById('featuresCenterImg');
    const featuresCenterText = document.getElementById('featuresCenterText');
    if (savedFeaturesLogo && featuresCenterImg && featuresCenterText) {
        featuresCenterImg.src = savedFeaturesLogo;
        featuresCenterImg.style.display = 'block';
        featuresCenterText.style.display = 'none';
    }

    const savedFooterLogo = localStorage.getItem('ownerFooterLogoImage');
    const footerLogoImg = document.getElementById('footerLogoImg');
    const footerLogoText = document.getElementById('footerLogoText');
    if (savedFooterLogo && footerLogoImg && footerLogoText) {
        footerLogoImg.src = savedFooterLogo;
        footerLogoImg.style.display = 'block';
        footerLogoText.style.display = 'none';
    }

    // Load dynamic courses onto homepage if we have a courses container
    // We can do this later, for now we ensure the image works.
    
    // 2. Check if the Owner is logged in
    const adminStr = sessionStorage.getItem('currentAdmin');
    let isAdmin = false;
    if (adminStr) {
        const adminUser = JSON.parse(adminStr);
        if (adminUser.role === 'admin') isAdmin = true;
    }

    if (isAdmin) {
        console.log("👑 Owner Mode Activated on Live Site");

            // A. Modify the Navbar to show Admin Controls
            const navActions = document.querySelector('.nav-actions');
            if (navActions) {
                // Keep the theme toggle and mobile menu, but replace login/register
                const themeBtn = document.getElementById('themeToggle');
                const mobileBtn = document.querySelector('.mobile-menu-btn');
                
                navActions.innerHTML = '';
                if(themeBtn) navActions.appendChild(themeBtn);
                
                // Add Admin Dashboard Link
                const dashboardBtn = document.createElement('a');
                dashboardBtn.href = 'admin-dashboard.html';
                dashboardBtn.className = 'btn btn-outline';
                dashboardBtn.style.padding = '8px 15px';
                dashboardBtn.style.borderRadius = '20px';
                dashboardBtn.innerHTML = '<i class="fas fa-tachometer-alt"></i> لوحة الإدارة';
                navActions.appendChild(dashboardBtn);

                // Add "Edit Site" Link
                const editBtn = document.createElement('a');
                editBtn.href = '#';
                editBtn.id = 'ownerEditBtn';
                editBtn.className = 'btn btn-gold';
                editBtn.style.padding = '8px 15px';
                editBtn.style.borderRadius = '20px';
                editBtn.innerHTML = '<i class="fas fa-edit mr-2"></i> تعديل المنصة';
                navActions.appendChild(editBtn);
                
                // Add Logout
                const logoutBtn = document.createElement('a');
                logoutBtn.href = '#';
                logoutBtn.className = 'btn';
                logoutBtn.style.color = '#e74c3c';
                logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
                logoutBtn.onclick = (e) => {
                    e.preventDefault();
                    sessionStorage.removeItem('currentAdmin');
                    localStorage.removeItem('currentAdmin');
                    window.location.reload();
                };
                navActions.appendChild(logoutBtn);

                if(mobileBtn) navActions.appendChild(mobileBtn);
            }

            // --- UNIFIED SAVING SYSTEM ---
            let unsavedEdits = {};
            let hasUnsavedChanges = false;
            
            // Create Floating Save Button
            const saveBtnContainer = document.createElement('div');
            saveBtnContainer.style.position = 'fixed';
            saveBtnContainer.style.bottom = '30px';
            saveBtnContainer.style.left = '30px';
            saveBtnContainer.style.zIndex = '9999';
            saveBtnContainer.style.display = 'none';
            saveBtnContainer.style.animation = 'glowPulse 2s infinite alternate';
            saveBtnContainer.innerHTML = `
                <button id="btnGlobalSave" class="btn btn-gold" style="padding: 15px 30px; font-size: 1.1rem; box-shadow: 0 10px 30px rgba(212, 166, 79, 0.4);">
                    <i class="fas fa-save mr-2"></i> حفظ التعديلات (Ctrl+S)
                </button>
            `;
            document.body.appendChild(saveBtnContainer);
            const btnGlobalSave = document.getElementById('btnGlobalSave');

            function markAsDirty() {
                hasUnsavedChanges = true;
                saveBtnContainer.style.display = 'block';
            }

            function saveAllChanges() {
                if (!hasUnsavedChanges) return;
                
                try {
                    Object.keys(unsavedEdits).forEach(key => {
                        localStorage.setItem(key, unsavedEdits[key]);
                    });
                    unsavedEdits = {};
                    hasUnsavedChanges = false;
                    saveBtnContainer.style.display = 'none';
                    if(window.showToast) window.showToast('تم حفظ جميع التعديلات بنجاح!', 'success');
                } catch(e) {
                    console.error("Storage error:", e);
                    if(window.showToast) window.showToast('خطأ: حجم الصور كبير جداً ومساحة التخزين لا تكفي. يرجى اختيار صور أصغر.', 'error');
                }
            }

            btnGlobalSave.addEventListener('click', saveAllChanges);

            window.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    if (hasUnsavedChanges) {
                        e.preventDefault();
                        saveAllChanges();
                    }
                }
            });

            window.addEventListener('beforeunload', (e) => {
                if (hasUnsavedChanges) {
                    e.preventDefault();
                    e.returnValue = 'لديك تعديلات لم يتم حفظها، هل أنت متأكد من المغادرة؟';
                }
            });
            // --- END SAVING SYSTEM ---

            // B. Hero Image Control Panel
            const teacherFrame = document.getElementById('editableTeacherFrame');
            if (teacherFrame) {
                // Disable direct clicks on images to avoid confusion
                if(heroImgEl) { heroImgEl.style.pointerEvents = 'none'; heroImgEl.removeAttribute('title'); }
                if(bgImgEl) { bgImgEl.style.pointerEvents = 'none'; bgImgEl.removeAttribute('title'); }

                const controlsBox = document.createElement('div');
                controlsBox.className = 'hero-edit-controls';
                controlsBox.style.position = 'absolute';
                controlsBox.style.top = '20px';
                controlsBox.style.right = '20px';
                controlsBox.style.zIndex = '100';
                controlsBox.style.display = 'flex';
                controlsBox.style.flexDirection = 'column';
                controlsBox.style.gap = '10px';
                controlsBox.style.background = 'rgba(10, 30, 58, 0.85)';
                controlsBox.style.padding = '15px';
                controlsBox.style.borderRadius = '15px';
                controlsBox.style.border = '1px solid var(--royal-gold)';
                controlsBox.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
                controlsBox.style.opacity = '0.3';
                controlsBox.style.transition = 'opacity 0.3s ease';

                controlsBox.innerHTML = `
                    <h4 style="color: var(--soft-gold); margin: 0 0 5px 0; font-size: 0.9rem; text-align: center;">إدارة صور البطل</h4>
                    <button id="btnEditBg" class="btn btn-outline" style="padding: 8px 15px; font-size: 0.85rem;"><i class="fas fa-image"></i> تغيير الخلفية</button>
                    <button id="btnEditFg" class="btn btn-gold" style="padding: 8px 15px; font-size: 0.85rem;"><i class="fas fa-user"></i> تغيير الشخصية</button>
                `;
                teacherFrame.appendChild(controlsBox);

                teacherFrame.addEventListener('mouseenter', () => controlsBox.style.opacity = '1');
                teacherFrame.addEventListener('mouseleave', () => controlsBox.style.opacity = '0.3');
            }

            function setupImageUpload(triggerBtn, targetImgEl, storageKey, callback) {
                if (!triggerBtn || !targetImgEl) return;
                
                triggerBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.accept = 'image/*';
                    
                    fileInput.onchange = (ev) => {
                        const file = ev.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                const img = new Image();
                                img.onload = () => {
                                    // Compress image to fit within localStorage limits
                                    const canvas = document.createElement('canvas');
                                    let width = img.width;
                                    let height = img.height;
                                    const MAX_SIZE = 1000;
                                    
                                    if (width > height) {
                                        if (width > MAX_SIZE) {
                                            height *= MAX_SIZE / width;
                                            width = MAX_SIZE;
                                        }
                                    } else {
                                        if (height > MAX_SIZE) {
                                            width *= MAX_SIZE / height;
                                            height = MAX_SIZE;
                                        }
                                    }
                                    
                                    canvas.width = width;
                                    canvas.height = height;
                                    const ctx = canvas.getContext('2d');
                                    ctx.drawImage(img, 0, 0, width, height);
                                    
                                    // Use webp for better compression with transparency, fallback to png
                                    let base64 = canvas.toDataURL('image/webp', 0.85);
                                    if(base64.indexOf('data:image/webp') === -1) {
                                        base64 = canvas.toDataURL('image/png'); // fallback
                                    }
                                    
                                    targetImgEl.src = base64;
                                    
                                    unsavedEdits[storageKey] = base64;
                                    markAsDirty();

                                    if (callback) callback(base64);
                                };
                                img.src = event.target.result;
                            };
                            reader.readAsDataURL(file);
                        }
                    };
                    
                    fileInput.click();
                });
            }

            if (teacherFrame) {
                const btnEditBg = teacherFrame.querySelector('#btnEditBg');
                const btnEditFg = teacherFrame.querySelector('#btnEditFg');
                setupImageUpload(btnEditBg, bgImgEl, 'ownerBgImage');
                setupImageUpload(btnEditFg, heroImgEl, 'ownerHeroImage', (base64) => {
                    if (heroClippedImgEl) heroClippedImgEl.src = base64;
                });
            }

            // C. Independent Nav Logo Control
            const navBrandLogoBtn = document.getElementById('navBrandLogoBtn');
            if (navBrandLogoBtn && navLogoImg && navLogoText) {
                navBrandLogoBtn.style.position = 'relative';
                navBrandLogoBtn.title = 'اضغط لتغيير لوجو الشريط العلوي';
                navBrandLogoBtn.addEventListener('click', (e) => e.preventDefault()); // Prevent link navigation for admin
                
                setupImageUpload(navBrandLogoBtn, navLogoImg, 'ownerNavLogoImage', (base64) => {
                    navLogoImg.style.display = 'block';
                    navLogoText.style.display = 'none';
                });
            }

            // D. Independent Features Center Logo Control
            const featuresCenterLogoContainer = document.getElementById('featuresCenterLogoContainer');
            if (featuresCenterLogoContainer && featuresCenterImg && featuresCenterText) {
                featuresCenterLogoContainer.title = 'اضغط لتغيير اللوجو المركزي';
                setupImageUpload(featuresCenterLogoContainer, featuresCenterImg, 'ownerFeaturesLogoImage', (base64) => {
                    featuresCenterImg.style.display = 'block';
                    featuresCenterText.style.display = 'none';
                });
            }

            // E. Independent Footer Logo Control
            const footerBrandLogoBtn = document.getElementById('footerBrandLogoBtn');
            if (footerBrandLogoBtn && footerLogoImg && footerLogoText) {
                footerBrandLogoBtn.style.position = 'relative';
                footerBrandLogoBtn.title = 'اضغط لتغيير لوجو الفوتر';
                footerBrandLogoBtn.addEventListener('click', (e) => e.preventDefault()); // Prevent link navigation for admin
                
                setupImageUpload(footerBrandLogoBtn, footerLogoImg, 'ownerFooterLogoImage', (base64) => {
                    footerLogoImg.style.display = 'block';
                    footerLogoText.style.display = 'none';
                });
            }

            // C. Build the "Quick Edit Modal" for adding courses from Homepage
            const editModalHtml = `
            <div id="quickEditModal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 3000; justify-content: center; align-items: center;">
                <div class="glass-panel" style="width: 90%; max-width: 500px; padding: 30px; position: relative;">
                    <button id="closeQuickEdit" style="position: absolute; top: 15px; right: 15px; background: transparent; border: none; color: white; font-size: 1.5rem; cursor: pointer;"><i class="fas fa-times"></i></button>
                    <h2 class="text-gold mb-2"><i class="fas fa-magic mr-2"></i> تعديل المنصة السريع</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 20px;">أضف كورسات أو إعلانات تظهر للطلبة فوراً</p>
                    
                    <div class="form-group">
                        <label>اسم الكورس الجديد</label>
                        <input type="text" id="quickCourseTitle" class="form-control" placeholder="مثال: المراجعة النهائية">
                    </div>
                    <div class="form-group">
                        <label>صورة الكورس</label>
                        <input type="file" id="quickCourseImageFile" accept="image/*" class="form-control" style="background: rgba(255,255,255,0.05); cursor: pointer;">
                        <input type="hidden" id="quickCourseImage" value="https://via.placeholder.com/400x250/071326/D4A64F?text=Course">
                        <img id="quickCourseImagePreview" src="https://via.placeholder.com/400x250/071326/D4A64F?text=Course" style="width: 100%; height: 100px; object-fit: cover; border-radius: 10px; margin-top: 10px; border: 1px solid var(--royal-gold);">
                    </div>
                    
                    <button id="quickAddCourseBtn" class="btn btn-green btn-block mt-2">إضافة الكورس للمنصة</button>
                    
                    <hr style="border-color: rgba(255,255,255,0.1); margin: 20px 0;">
                    
                    <button class="btn btn-outline btn-block" onclick="window.location.href='admin-dashboard.html'">الذهاب للوحة التحكم الكاملة</button>
                </div>
            </div>`;
            
            document.body.insertAdjacentHTML('beforeend', editModalHtml);
            
            const quickEditModal = document.getElementById('quickEditModal');
            document.getElementById('ownerEditBtn').addEventListener('click', (e) => {
                e.preventDefault();
                quickEditModal.style.display = 'flex';
            });
            
            document.getElementById('closeQuickEdit').addEventListener('click', () => {
                quickEditModal.style.display = 'none';
            });

            // Handle Quick Course Image Upload
            const quickCourseImageFile = document.getElementById('quickCourseImageFile');
            if (quickCourseImageFile) {
                quickCourseImageFile.addEventListener('change', (ev) => {
                    const file = ev.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            const img = new Image();
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                let width = img.width;
                                let height = img.height;
                                const MAX_SIZE = 800; 
                                
                                if (width > height) {
                                    if (width > MAX_SIZE) {
                                        height *= MAX_SIZE / width;
                                        width = MAX_SIZE;
                                    }
                                } else {
                                    if (height > MAX_SIZE) {
                                        width *= MAX_SIZE / height;
                                        height = MAX_SIZE;
                                    }
                                }
                                
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, width, height);
                                
                                let base64 = canvas.toDataURL('image/webp', 0.85);
                                if(base64.indexOf('data:image/webp') === -1) {
                                    base64 = canvas.toDataURL('image/jpeg', 0.85);
                                }
                                
                                document.getElementById('quickCourseImagePreview').src = base64;
                                document.getElementById('quickCourseImage').value = base64;
                            };
                            img.src = event.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }

            // Quick Add Course Logic
            document.getElementById('quickAddCourseBtn').addEventListener('click', () => {
                const title = document.getElementById('quickCourseTitle').value.trim();
                if(!title) {
                    alert('يرجى كتابة اسم الكورس');
                    return;
                }
                
                // Add to adminUploads (same logic used in dashboard)
                const imageStr = document.getElementById('quickCourseImage').value;
                const newUpload = {
                    title: title,
                    fileName: 'كورس مضاف من الصفحة الرئيسية',
                    date: new Date().toLocaleDateString('ar-EG'),
                    image: imageStr
                };
                
                const uploads = JSON.parse(localStorage.getItem('adminUploads') || '[]');
                uploads.push(newUpload);
                localStorage.setItem('adminUploads', JSON.stringify(uploads));
                
                // Also add to adminCourses directly for display
                const adminCourses = JSON.parse(localStorage.getItem('adminCourses') || '[]');
                const newCourse = {
                    id: 'c' + Date.now(),
                    title: title,
                    desc: 'كورس جديد تمت إضافته سريعاً',
                    price: '0',
                    grade: 'prep1',
                    image: imageStr
                };
                adminCourses.push(newCourse);
                localStorage.setItem('adminCourses', JSON.stringify(adminCourses));
                
                if(window.showToast) window.showToast('تم إضافة الكورس بنجاح وسيظهر للطلبة!', 'success');
                document.getElementById('quickCourseTitle').value = '';
                document.getElementById('quickCourseImageFile').value = '';
                const defaultImg = 'https://via.placeholder.com/400x250/071326/D4A64F?text=Course';
                document.getElementById('quickCourseImage').value = defaultImg;
                document.getElementById('quickCourseImagePreview').src = defaultImg;
                
                quickEditModal.style.display = 'none';
            });
    } else {
        // Not an Admin (Visitor or Student)
        // Clicking the hero image should act as a login shortcut or go to dashboard
        if (heroImgEl) {
            heroImgEl.style.cursor = 'pointer';
            heroImgEl.title = 'اضغط لتسجيل الدخول أو الذهاب لدروسك';
            heroImgEl.addEventListener('click', () => {
                if (sessionStorage.getItem('currentStudent')) {
                    window.location.href = 'dashboard.html';
                } else {
                    const loginModal = document.getElementById('loginModal');
                    if (loginModal) loginModal.classList.add('active');
                }
            });
        }
    }
});

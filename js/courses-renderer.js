// js/courses-renderer.js
document.addEventListener('DOMContentLoaded', () => {
    // Helper: load courses and restore separated base64 images from cache
    function loadAdminCourses() {
        var raw = JSON.parse(localStorage.getItem('adminCourses') || '[]');
        return raw.map(function(c) {
            if (c.image && c.image.startsWith('__local__')) {
                var img = localStorage.getItem('img_' + c.id);
                c.image = img || 'https://via.placeholder.com/400x250/071326/D4A64F?text=Course';
            }
            if (!c.contents || (!c.contents.lectures && !c.contents.homeworks)) {
                var stored = localStorage.getItem('contents_' + c.id);
                if (stored) { try { c.contents = JSON.parse(stored); } catch(e) {} }
            }
            return c;
        });
    }

    let adminCourses = loadAdminCourses();

    function seedDefaultCourses() {
        if (!adminCourses || adminCourses.length === 0) {
            adminCourses = [];
            if (typeof window.safeStorageSaveCourses === 'function') {
                window.safeStorageSaveCourses(adminCourses);
            } else {
                try { localStorage.setItem('adminCourses', JSON.stringify(adminCourses)); } catch(e) {}
            }
        }
    }
    seedDefaultCourses();

    function generateCourseCard(course) {
        const grades = {
            'prep1': 'أولى إعدادي',
            'prep2': 'تانية إعدادي',
            'prep3': 'تالتة إعدادي',
            'sec1': 'أولى ثانوي'
        };
        const gradeName = grades[course.grade] || course.grade;
        
        let actionBtnHTML = `<a href="#" class="btn btn-gold btn-subscribe" onclick="openPaymentModal(event, '${course.id}')">الاشتراك في الكورس</a>`;
        let userStr = sessionStorage.getItem('currentStudent');
        if(userStr) {
            let user = JSON.parse(userStr);
            let paymentRequests = JSON.parse(localStorage.getItem('paymentRequests')) || [];
            let existingReq = paymentRequests.find(req => req.courseId === course.id && req.userId === user.phone);
            
            let dbUser = JSON.parse(localStorage.getItem(`db_${user.phone}`)) || { courses: [] };
            
            if (dbUser.courses && dbUser.courses.includes(course.id)) {
                actionBtnHTML = `<a href="#" class="btn btn-green" onclick="openCourseDetails(event, '${course.id}')">دخول الكورس</a>`;
            } else if (existingReq && existingReq.status === 'pending') {
                actionBtnHTML = `<a href="#" class="btn btn-outline" style="color:var(--accent-orange); border-color:var(--accent-orange);" onclick="showPendingMessage(event)">طلبك قيد المراجعة</a>`;
            }
        }
        
        let detailsBtnHTML = `<a href="#" class="btn btn-outline" onclick="openCourseDetails(event, '${course.id}')">تفاصيل أكثر</a>`;
        if (userStr && JSON.parse(localStorage.getItem(`db_${JSON.parse(userStr).phone}`))?.courses?.includes(course.id)) {
            detailsBtnHTML = '';
        }
        
        const generalSettings = JSON.parse(localStorage.getItem('generalSettings') || '{}');
        const statusText = generalSettings.courseStatus || 'يبدأ فوراً';

                let priceHTML = `<span class="course-price">${course.price} ج.م</span>`;
                let countdownHTML = '';
                
                if (course.hasDiscount && course.discountPrice) {
                    if (!course.discountExpiry || course.discountExpiry > Date.now()) {
                        priceHTML = `
                        <div style="display:flex; flex-direction:column; align-items:flex-start;">
                            <span style="text-decoration: line-through; font-size: 0.8rem; color: var(--text-muted); opacity: 0.8;">${course.price} ج.م</span>
                            <span class="course-price" style="color: #2ecc71; font-size: 1.3rem;">${course.discountPrice} ج.م</span>
                        </div>`;
                        
                        if (course.discountExpiry) {
                            countdownHTML = `<div class="discount-countdown" data-expiry="${course.discountExpiry}" style="background: rgba(231, 76, 60, 0.1); border: 1px solid rgba(231, 76, 60, 0.3); border-radius: 5px; padding: 5px; margin-top: 10px; margin-bottom: 15px; text-align: center; color: #e74c3c; font-weight: bold; font-size: 0.9rem; animation: pulse 2s infinite;"><i class="fas fa-clock"></i> ينتهي الخصم خلال: <span class="cd-timer">...</span></div>`;
                        }
                    }
                }

        return `
        <div class="glass-panel course-card" data-grade="${course.grade}" data-course-id="${course.id}">
            <div class="course-img-wrapper">
                <span class="course-badge">${gradeName}</span>
                <img src="${course.image}" alt="${course.title}">
            </div>
            <div class="course-content">
                <h3 class="course-title">${course.title}</h3>
                <p class="course-desc">${course.desc}</p>
                <div class="course-meta">
                    ${priceHTML}
                    <span class="course-date"><i class="fas fa-calendar-alt"></i> ${statusText}</span>
                </div>
                ${countdownHTML}
                <div class="course-actions">
                    ${actionBtnHTML}
                    ${detailsBtnHTML}
                </div>
            </div>
        </div>
        `;
    }

    const coursesGrid = document.getElementById('coursesGrid');
    const filterBtns = document.querySelectorAll('.filter-btn');

    function attachCourseFilters() {
        if (!coursesGrid) return;
        if (!filterBtns.length) return;

        filterBtns.forEach(btn => {
            btn.removeEventListener('click', btn._courseFilterHandler);
            const handler = (e) => {
                filterBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const filterValue = e.target.getAttribute('data-filter');
                const allCards = coursesGrid.querySelectorAll('.course-card');
                allCards.forEach(card => {
                    card.style.display = (filterValue === 'all' || card.getAttribute('data-grade') === filterValue) ? 'flex' : 'none';
                });
            };
            btn._courseFilterHandler = handler;
            btn.addEventListener('click', handler);
        });
    }

    window.renderCourses = async function() {
        // Initial quick render from cache
        if (coursesGrid) {
            coursesGrid.innerHTML = adminCourses.map(generateCourseCard).join('');
            attachCourseFilters();
        }
        const homeCoursesContainer = document.getElementById('homeCoursesContainer');
        if (homeCoursesContainer) {
            homeCoursesContainer.innerHTML = adminCourses.slice(-3).reverse().map(generateCourseCard).join('');
        }

        // Fetch fresh from Firebase if available
        if (window.FirebaseService && typeof window.FirebaseService.getCourses === 'function') {
            try {
                const fbCourses = await window.FirebaseService.getCourses();
                if (fbCourses && fbCourses.length > 0) {
                    adminCourses = fbCourses;
                    if (typeof window.safeStorageSaveCourses === 'function') {
                        window.safeStorageSaveCourses(adminCourses);
                    } else {
                        try { localStorage.setItem('adminCourses', JSON.stringify(adminCourses)); } catch(e) {}
                    }
                    
                    // Re-render with fresh data
                    if (coursesGrid) {
                        coursesGrid.innerHTML = adminCourses.map(generateCourseCard).join('');
                        attachCourseFilters();
                    }
                    if (homeCoursesContainer) {
                        homeCoursesContainer.innerHTML = adminCourses.slice(-3).reverse().map(generateCourseCard).join('');
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch courses from Firebase for rendering', e);
            }
        }
    };

    // Execute render flow
    window.renderCourses().then(() => {
        if (coursesGrid) {
            const params = new URLSearchParams(window.location.search);
            const focusCourse = params.get('focusCourse');
            if (focusCourse) focusCourseCard(focusCourse);
        }
    });
    
    window.openPaymentModal = function(e, courseId) {
        e.preventDefault();
        
        let userStr = sessionStorage.getItem('currentStudent');
        if(!userStr) {
            const loginModal = document.getElementById('loginModal');
            if(loginModal) loginModal.classList.add('active');
            else window.location.href = 'courses.html';
            return;
        }

        let user = JSON.parse(userStr);
        let paymentRequests = JSON.parse(localStorage.getItem('paymentRequests')) || [];
        let existingReq = paymentRequests.find(req => req.courseId === courseId && req.userId === user.phone);
        
        if (existingReq && existingReq.status === 'pending') {
            showPendingMessage(e);
            return;
        }

        const modal = document.getElementById('paymentModal');
        if(modal) {
            // Load Payment Settings
            let paymentSettings = JSON.parse(localStorage.getItem('paymentSettings'));
            if(paymentSettings) {
                const vCashNumEl = document.getElementById('vCashNum');
                if(vCashNumEl) vCashNumEl.textContent = paymentSettings.vCashNum || '01023675235';
                
                const vodafoneDetails = document.getElementById('vodafoneDetails');
                if(vodafoneDetails) {
                    const p = vodafoneDetails.querySelector('p');
                    if(p) p.textContent = paymentSettings.paymentInstructions || 'قم بتحويل المبلغ على الرقم التالي عبر فودافون كاش:';
                }
                
                const fawryMethodBtn = document.querySelector('.pay-method[data-type="fawry"]');
                if(fawryMethodBtn) {
                    if(paymentSettings.enableFawry) {
                        fawryMethodBtn.style.opacity = '1';
                        fawryMethodBtn.style.pointerEvents = 'auto';
                        fawryMethodBtn.style.filter = 'none';
                        const badge = fawryMethodBtn.querySelector('span');
                        if (badge) badge.style.display = 'none';
                    } else {
                        fawryMethodBtn.style.opacity = '0.5';
                        fawryMethodBtn.style.pointerEvents = 'none';
                        fawryMethodBtn.style.filter = 'grayscale(100%)';
                        const badge = fawryMethodBtn.querySelector('span');
                        if (badge) badge.style.display = 'block';
                        
                        // Switch active to vodafone if fawry was active
                        if(fawryMethodBtn.classList.contains('active')) {
                            fawryMethodBtn.classList.remove('active');
                            const vBtn = document.querySelector('.pay-method[data-type="vodafone"]');
                            if(vBtn) vBtn.classList.add('active');
                            const fDetails = document.getElementById('fawryDetails');
                            if(fDetails) fDetails.style.display = 'none';
                            const vDetails = document.getElementById('vodafoneDetails');
                            if(vDetails) vDetails.style.display = 'block';
                        }
                    }
                }
            }

            modal.classList.add('active');
            modal.setAttribute('data-course-id', courseId);
        } else {
            window.location.href = 'courses.html';
        }
    };

    window.showPendingMessage = function(e) {
        if(e) e.preventDefault();
        
        // Show pending message with WhatsApp/Call
        let msgHTML = `
            <div style="text-align: center;">
                <i class="fas fa-clock" style="font-size: 3rem; color: var(--accent-orange); margin-bottom: 15px;"></i>
                <h3 style="color: var(--text-primary); margin-bottom: 10px;">طلبك قيد المراجعة</h3>
                <p style="color: rgba(255,255,255,0.8); margin-bottom: 20px;">تم استلام طلبك، وسيتم تفعيله بعد تدقيق الدفع وتم التأكد من الصورة.</p>
                <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <p style="font-size: 0.9rem; margin-bottom: 10px;">إذا قمت بالتحويل بالفعل ولم يتم التفعيل بعد، تواصل عبر الرقم:<br><strong style="font-size: 1.2rem; color: var(--accent-cyan);">01023675235</strong></p>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <a href="https://wa.me/201023675235" target="_blank" class="btn btn-green" style="background-color: #25D366; border-color: #25D366;"><i class="fab fa-whatsapp"></i> واتساب</a>
                    <a href="tel:01023675235" class="btn btn-outline"><i class="fas fa-phone"></i> اتصال</a>
                </div>
            </div>
        `;
        
        // Use an existing toast or modal. Let's create a dynamic modal if it doesn't exist.
        let pendingModal = document.getElementById('pendingMsgModal');
        if (!pendingModal) {
            pendingModal = document.createElement('div');
            pendingModal.id = 'pendingMsgModal';
            pendingModal.className = 'modal-overlay';
            pendingModal.innerHTML = `
                <div class="glass-panel modal-content" style="padding: 30px; max-width: 400px; position: relative;">
                    <button class="close-modal" onclick="document.getElementById('pendingMsgModal').classList.remove('active')"><i class="fas fa-times"></i></button>
                    ${msgHTML}
                </div>
            `;
            document.body.appendChild(pendingModal);
        } else {
            pendingModal.querySelector('.modal-content').innerHTML = `
                <button class="close-modal" onclick="document.getElementById('pendingMsgModal').classList.remove('active')"><i class="fas fa-times"></i></button>
                ${msgHTML}
            `;
        }
        
        pendingModal.classList.add('active');
    };

    window.openCourseDetails = function(e, courseId) {
        if(e) e.preventDefault();
        window.location.href = `course-details.html?id=${courseId}`;
    };

    function focusCourseCard(courseId) {
        const card = document.querySelector(`.course-card[data-course-id="${courseId}"]`);
        if (!card) return;
        card.style.boxShadow = '0 0 0 3px rgba(212,166,79,0.8)';
        card.style.transform = 'scale(1.01)';
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            card.style.boxShadow = '';
            card.style.transform = '';
        }, 4000);
    }

    // Global Countdown Timer for Discounts
    setInterval(() => {
        const countdowns = document.querySelectorAll('.discount-countdown');
        countdowns.forEach(el => {
            const expiryStr = el.getAttribute('data-expiry');
            if (!expiryStr) return;
            const expiry = parseInt(expiryStr);
            const remaining = expiry - Date.now();
            
            if (remaining <= 0) {
                el.innerHTML = 'انتهى الخصم';
                el.style.animation = 'none';
                el.style.opacity = '0.5';
                setTimeout(() => {
                    // Refresh the display slightly after expiration
                    if(typeof window.renderCourses === 'function') window.renderCourses();
                }, 2000);
            } else {
                let seconds = Math.floor(remaining / 1000);
                let d = Math.floor(seconds / (3600 * 24));
                let h = Math.floor((seconds % (3600 * 24)) / 3600);
                let m = Math.floor((seconds % 3600) / 60);
                let s = Math.floor(seconds % 60);
                
                let parts = [];
                if (d > 0) parts.push(`${d} يوم`);
                if (h > 0) parts.push(`${h} ساعة`);
                if (m > 0) parts.push(`${m} دقيقة`);
                parts.push(`${s} ثانية`);
                
                const timerSpan = el.querySelector('.cd-timer');
                if (timerSpan) {
                    timerSpan.textContent = parts.join(' و ');
                }
            }
        });
    }, 1000);

});

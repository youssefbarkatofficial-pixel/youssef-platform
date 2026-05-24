/**
 * Platform Storage Service
 * Centralized yearly promotion and grade persistence logic.
 */
window.PlatformStorage = window.PlatformStorage || {
    studentMetaPrefix: 'studentMeta_',

    getStudentMetaKey(studentId) {
        return `${this.studentMetaPrefix}${studentId}`;
    },

    getCurrentAcademicYear(date = new Date()) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = d.getMonth();
        const day = d.getDate();
        return (month > 6 || (month === 6 && day >= 25)) ? year : year - 1;
    },

    hasPromotionWindowStarted(date = new Date()) {
        const d = new Date(date);
        const year = d.getFullYear();
        const july25 = new Date(year, 6, 25, 0, 0, 0, 0);
        return d >= july25;
    },

    getStoredState(studentId) {
        if (!studentId) return {};
        let state = {};
        try {
            state = JSON.parse(localStorage.getItem(this.getStudentMetaKey(studentId)) || '{}') || {};
        } catch (e) {
            console.warn('Invalid promotion meta for', studentId, e);
            state = {};
        }

        if (!state.lastUpdatedYear) {
            try {
                const legacy = JSON.parse(localStorage.getItem(`db_${studentId}`) || '{}');
                if (legacy && typeof legacy === 'object') {
                    if (legacy.lastUpdatedAcademicYear) {
                        state.lastUpdatedYear = legacy.lastUpdatedAcademicYear;
                        state.promotionCompleted = state.promotionCompleted || true;
                    }
                    if (legacy.grade && !state.grade) {
                        state.grade = legacy.grade;
                    }
                }
            } catch (legacyError) {
                console.warn('Failed to load legacy student record for', studentId, legacyError);
            }
        }

        return state;
    },

    saveState(studentId, state = {}) {
        if (!studentId) return null;
        const sanitized = {
            lastUpdatedYear: state.lastUpdatedYear || null,
            promotionCompleted: !!state.promotionCompleted,
            grade: state.grade || null,
            createdAt: state.createdAt || null,
            updatedAt: state.updatedAt || new Date().toISOString()
        };
        localStorage.setItem(this.getStudentMetaKey(studentId), JSON.stringify(sanitized));
        return sanitized;
    },

    markPromotionCompleted(studentId, grade) {
        if (!studentId) return null;
        const currentYear = this.getCurrentAcademicYear();
        const state = this.getStoredState(studentId);
        return this.saveState(studentId, {
            ...state,
            lastUpdatedYear: currentYear,
            promotionCompleted: true,
            grade: grade || state.grade || null,
            updatedAt: new Date().toISOString()
        });
    },

    initializeNewStudent(studentId, grade, registrationDate) {
        if (!studentId) return null;
        const createdAt = registrationDate ? new Date(registrationDate) : new Date();
        const currentYear = this.getCurrentAcademicYear(createdAt);
        return this.saveState(studentId, {
            lastUpdatedYear: currentYear,
            promotionCompleted: true,
            grade: grade || null,
            createdAt: createdAt.toISOString(),
            updatedAt: new Date().toISOString()
        });
    },

    needsPromotion(student, currentDate = new Date()) {
        if (!student || !student.phone) return false;
        if (!this.hasPromotionWindowStarted(currentDate)) return false;
        const currentYear = this.getCurrentAcademicYear(currentDate);
        const state = this.getStoredState(student.phone);
        if (state.promotionCompleted && state.lastUpdatedYear === currentYear) {
            return false;
        }
        if (state.lastUpdatedYear && state.lastUpdatedYear >= currentYear) {
            return false;
        }
        return true;
    },

    checkYearlyPromotion(student) {
        if (!student || student.role === 'admin') return { required: false, currentAcademicYear: this.getCurrentAcademicYear(), record: {} };
        return {
            required: this.needsPromotion(student),
            currentAcademicYear: this.getCurrentAcademicYear(),
            record: this.getStoredState(student.phone)
        };
    },

    renderYearlyPromotionModal(options = {}) {
        const {
            currentAcademicYear,
            gradeOptions = [],
            onConfirm = () => {}
        } = options;

        if (document.getElementById('yearlyUpdateModal')) return;

        const modal = document.createElement('div');
        modal.id = 'yearlyUpdateModal';
        modal.style.cssText = 'position: fixed; inset: 0; z-index: 9999999; display: flex; align-items: center; justify-content: center; background: rgba(6, 13, 31, 0.92); backdrop-filter: blur(12px); padding: 20px;';
        modal.innerHTML = `
            <div class="promotion-modal-card" style="width:100%; max-width:480px; border-radius:24px; background:rgba(8,18,38,0.98); border:1px solid rgba(212,166,79,0.3); box-shadow:0 25px 80px rgba(0,0,0,0.38); padding: 32px; position: relative;">
                <div style="display:flex; align-items:center; justify-content:center; margin-bottom: 22px; gap: 14px;">
                    <div style="width:70px; height:70px; border-radius:24px; background:linear-gradient(135deg,#d4a64f,#0ea5e9); display:flex; align-items:center; justify-content:center; color:#071326; font-size:2rem;"><i class="fas fa-graduation-cap"></i></div>
                    <div style="text-align:right; flex:1;">
                        <h2 style="margin:0; font-size:1.75rem; color:#fff;">تحديث الصف الدراسي للسنة الجديدة</h2>
                        <p style="margin:6px 0 0; color:rgba(255,255,255,0.75); line-height:1.7;">الرجاء اختيار صفك الدراسي الجديد للسنة الأكاديمية ${currentAcademicYear}.</p>
                    </div>
                </div>
                <div style="margin-bottom: 18px; text-align:right; color:rgba(255,255,255,0.85); font-size:0.95rem;">هذا التحديث إلزامي لبدء الاستخدام الكامل للمنصة بعد بداية العام الدراسي.</div>
                <div style="margin-bottom: 24px; text-align:right;">
                    <label for="yearlyGradeSelect" style="display:block; margin-bottom:10px; font-weight:700; color:#d4a64f;">الصف الدراسي الجديد</label>
                    <select id="yearlyGradeSelect" style="width:100%; padding:14px 16px; border-radius:14px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); color:#ffffff; font-size:1rem;">
                        ${gradeOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                    </select>
                </div>
                <button id="btnConfirmYearlyUpdate" style="width:100%; padding:16px 20px; border-radius:14px; border:none; background:linear-gradient(135deg,#d4a64f,#ffcc3c); color:#071326; font-size:1rem; font-weight:800; cursor:pointer;">تأكيد وتحديث الصف الدراسي</button>
            </div>
        `;

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                event.stopPropagation();
            }
        });

        document.body.appendChild(modal);

        const confirmButton = modal.querySelector('#btnConfirmYearlyUpdate');
        confirmButton.addEventListener('click', () => {
            const select = modal.querySelector('#yearlyGradeSelect');
            const selectedGrade = select ? select.value : null;
            if (!selectedGrade) {
                alert('الرجاء اختيار الصف الدراسي قبل المتابعة.');
                return;
            }
            onConfirm(selectedGrade, modal);
        });

        return modal;
    }
};

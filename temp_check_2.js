
        document.addEventListener('DOMContentLoaded', () => {
            const forgotLink = document.getElementById('forgotPasswordLink');
            const loginPhone = document.getElementById('loginPhone');
            const fpStudent = document.getElementById('fpStudentPhone');
            const fpParent = document.getElementById('fpParentPhone');
            const fpOtp = document.getElementById('fpOtpCode');
            const OTP_LEN = 5;
            if (fpOtp) fpOtp.maxLength = OTP_LEN;
            if (forgotLink) {
                forgotLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    const forgotModal = document.getElementById('forgotPasswordModal');
                    if (loginPhone && loginPhone.value && fpStudent) fpStudent.value = loginPhone.value.trim();
                    if (forgotModal) forgotModal.style.display = 'flex';
                    setTimeout(() => { if (fpParent) fpParent.focus(); }, 150);
                    const status = document.getElementById('fpStatusText');
                    if (status) {
                        status.style.display = 'block';
                        status.textContent = `سيتم إرسال كود مكون من ${OTP_LEN} أرقام لرقم ولي الأمر عبر واتساب. لا تشاركه مع أي شخص.`;
                        status.style.color = '#f8f1d4';
                        status.style.background = 'rgba(212, 166, 79, 0.12)';
                        status.style.border = '1px solid rgba(212, 166, 79, 0.24)';
                    }
                });
            }
        });
    
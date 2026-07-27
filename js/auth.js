document.addEventListener('DOMContentLoaded', () => {
  const savedAdmin = localStorage.getItem('currentAdmin');
  if (savedAdmin && !sessionStorage.getItem('currentAdmin')) {
    sessionStorage.setItem('currentAdmin', savedAdmin);
  }
  const savedStudent = localStorage.getItem('currentStudent');
  if (savedStudent && !sessionStorage.getItem('currentStudent')) {
    sessionStorage.setItem('currentStudent', savedStudent);
  }

  // Add password visibility toggles
  ['loginPassword', 'password', 'confirmPassword', 'fpNewPassword', 'fpConfirmPassword', 'adminPassword', 'tempAdminPwd'].forEach(id => {
    const input = document.getElementById(id);
    if (input && input.parentElement) {
      input.parentElement.style.position = 'relative';
      // Add padding to input so text doesn't overlap eye icon (RTL layout: icon on left)
      input.style.paddingLeft = '45px';
      const toggleBtn = document.createElement('span');
      toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
      toggleBtn.style.cssText = 'position:absolute; left:14px; top:50%; transform:translateY(-50%); cursor:pointer; color:var(--royal-gold); z-index:10; font-size:1.1rem; padding:5px; line-height:1; display:flex; align-items:center;';
      // If there's a label, shift toggle down to align with input
      const label = input.parentElement.querySelector('label');
      if (label) {
        toggleBtn.style.top = 'calc(50% + 14px)';
      }
      toggleBtn.addEventListener('click', () => {
        const icon = toggleBtn.querySelector('i');
        if (input.type === 'password') {
          input.type = 'text';
          icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
          input.type = 'password';
          icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
      });
      input.parentElement.appendChild(toggleBtn);
    }
  });

  // === Password Strength Meter ===
  const pwdInput = document.getElementById('password');
  const strengthBar = document.getElementById('passwordStrengthBar');
  const strengthLabel = document.getElementById('passwordStrengthLabel');
  const strengthContainer = document.getElementById('passwordStrengthContainer');
  if (pwdInput && strengthBar && strengthLabel && strengthContainer) {
    function calcPasswordStrength(pwd) {
      if (!pwd) return { score: 0, label: 'â€”', color: '#888', percent: 0 };
      let score = 0;
      if (pwd.length >= 4) score += 1;
      if (pwd.length >= 6) score += 1;
      if (pwd.length >= 8) score += 1;
      if (/[A-Z]/.test(pwd) || /[ط£-ظٹ]/.test(pwd)) score += 1;
      if (/[0-9]/.test(pwd)) score += 1;
      if (/[!@#$%^&*?_\-+=]/.test(pwd)) score += 1;
      if (pwd.length >= 12) score += 1;
      // Map score to levels
      if (score <= 2) return { score, label: 'ط¶ط¹ظٹظپط©', color: '#e74c3c', percent: 25 };
      if (score <= 4) return { score, label: 'ظ…طھظˆط³ط·ط©', color: '#f1c40f', percent: 55 };
      return { score, label: 'ظ‚ظˆظٹط©', color: '#2ecc71', percent: 100 };
    }
    pwdInput.addEventListener('input', () => {
      const val = pwdInput.value;
      if (val.length > 0) {
        strengthContainer.style.display = 'block';
        const result = calcPasswordStrength(val);
        strengthBar.style.width = result.percent + '%';
        strengthBar.style.background = result.color;
        strengthLabel.textContent = result.label;
        strengthLabel.style.color = result.color;
      } else {
        strengthContainer.style.display = 'none';
        strengthBar.style.width = '0%';
        strengthLabel.textContent = 'â€”';
      }
    });
  }

  const loginPhoneInput = document.getElementById('loginPhone');
  if (loginPhoneInput) {
    const dropdown = document.createElement('div');
    dropdown.id = 'savedAccountsDropdown';
    dropdown.style.cssText = 'display:none; position:absolute; background:var(--glass-bg); backdrop-filter:blur(10px); border:1px solid var(--royal-gold); border-radius:8px; width:100%; max-height:150px; overflow-y:auto; z-index:1000; top:calc(100% + 5px); left:0; padding:5px 0; box-shadow:0 5px 15px rgba(0,0,0,0.5);';
    const parent = loginPhoneInput.parentElement;
    if (parent) parent.style.position = 'relative';
    parent.appendChild(dropdown);

    loginPhoneInput.addEventListener('focus', () => {
      const accounts = JSON.parse(localStorage.getItem('savedLocalAccounts') || '[]');
      if (accounts.length > 0) {
        dropdown.innerHTML = '';
        accounts.forEach(acc => {
          const item = document.createElement('div');
          item.style.cssText = 'padding:10px 15px; cursor:pointer; color:var(--text-primary); border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;';
          item.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:30px; height:30px; border-radius:50%; background:var(--royal-gold); display:flex; align-items:center; justify-content:center; color:#1a1a2e; font-size:0.8rem;"><i class="fas fa-user"></i></div>
              <span style="font-weight:bold;">${acc.phone}</span>
            </div>
            <span style="font-size:0.8rem; color:var(--royal-gold);">${acc.name}</span>
          `;
          item.addEventListener('click', () => {
            loginPhoneInput.value = acc.phone;
            const pwdInput = document.getElementById('loginPassword');
            if (pwdInput) pwdInput.value = acc.pwd;
            dropdown.style.display = 'none';
          });
          dropdown.appendChild(item);
        });
        dropdown.style.display = 'block';
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target !== loginPhoneInput && e.target !== dropdown && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  const currentStudentStr = sessionStorage.getItem('currentStudent');
  if (currentStudentStr && (window.location.pathname.includes('index.html') || window.location.pathname === '/')) {
    const heroSubscribeBtn = document.getElementById('heroSubscribeBtn');
    if (heroSubscribeBtn) {
      heroSubscribeBtn.href = 'courses.html';
      heroSubscribeBtn.innerHTML = 'طھطµظپط­ ظƒظˆط±ط³ط§طھظƒ <i class="fas fa-arrow-left mr-2" style="margin-right: 10px;"></i>';
    }
    const navActions = document.querySelector('.nav-actions');
    if (navActions && !sessionStorage.getItem('currentAdmin')) {
      const themeBtn = document.getElementById('themeToggle');
      const mobileBtn = document.querySelector('.mobile-menu-btn');
      navActions.innerHTML = '';
      if (themeBtn) navActions.appendChild(themeBtn);
      const profileBtn = document.createElement('a');
      profileBtn.href = 'profile.html';
      profileBtn.className = 'btn btn-green';
      profileBtn.style.borderRadius = '20px';
      profileBtn.innerHTML = '<i class="fas fa-user" style="margin-left: 8px;"></i> ط­ط³ط§ط¨ظٹ';
      navActions.appendChild(profileBtn);
      const ytBtn = document.createElement('a');
      ytBtn.href = 'https://www.youtube.com/@youssefstudies';
      ytBtn.target = '_blank';
      ytBtn.id = 'ytNavBtn';
      ytBtn.className = 'btn btn-outline';
      ytBtn.style.cssText = 'color: #ff0000; border-color: rgba(255,0,0,0.5); padding: 8px 15px; border-radius: 20px; margin-right: 5px;';
      ytBtn.innerHTML = '<i class="fab fa-youtube" style="margin-left: 5px;"></i> ظ‚ظ†ط§ط© ط§ظ„ظٹظˆطھظٹظˆط¨';
      navActions.appendChild(ytBtn);
      const bellBtn = document.createElement('a');
      bellBtn.href = '#';
      bellBtn.className = 'btn btn-outline';
      bellBtn.style.cssText = 'padding: 8px 15px; border-radius: 20px;';
      bellBtn.innerHTML = '<i class="fas fa-bell"></i>';
      navActions.appendChild(bellBtn);
      const logoutBtn = document.createElement('a');
      logoutBtn.href = '#';
      logoutBtn.id = 'logoutBtn';
      logoutBtn.className = 'btn btn-outline';
      logoutBtn.style.cssText = 'border-color: #e74c3c; color: #e74c3c; padding: 8px 15px; border-radius: 20px; margin-right: 5px;';
      logoutBtn.innerHTML = 'ط®ط±ظˆط¬ <i class="fas fa-sign-out-alt" style="margin-right: 5px;"></i>';
      navActions.appendChild(logoutBtn);
      if (mobileBtn) navActions.appendChild(mobileBtn);
    }
  }

  const steps = document.querySelectorAll('.form-step');
  const stepIndicators = document.querySelectorAll('.step');
  const nextBtns = document.querySelectorAll('.next-step');
  const prevBtns = document.querySelectorAll('.prev-step');
  const registerForm = document.getElementById('registerForm');
  const registerError = document.getElementById('registerError');
  const loginError = document.getElementById('loginError');
  let currentStep = 0;

  function showStep(index) {
    steps.forEach((step, i) => {
      step.classList.toggle('active', i === index);
    });
    stepIndicators.forEach((indicator, i) => {
      indicator.classList.toggle('active', i === index);
      indicator.classList.toggle('completed', i < index);
    });
    
    // Update Dynamic Step Guide
    const guideBox = document.getElementById('dynamicStepGuide');
    const guideTitle = document.getElementById('guideTitle');
    const guideText = document.getElementById('guideText');
    if (guideBox && guideTitle && guideText) {
      guideBox.classList.add('fade-out');
      setTimeout(() => {
        if (index === 0) {
          guideTitle.textContent = 'ط§ظ„ط¨ظٹط§ظ†ط§طھ ط§ظ„ط´ط®طµظٹط©';
          guideText.textContent = 'ط§ظƒطھط¨ ط§ط³ظ…ظƒطŒ ظˆط±ظ‚ظ… ظ…ظˆط¨ط§ظٹظ„ظƒ ظˆط±ظ‚ظ… ظˆظ„ظٹ ط§ظ„ط£ظ…ط± ط¨ط¯ظ‚ط© ظ„ط³ظ‡ظˆظ„ط© ط§ظ„طھظˆط§طµظ„.';
        } else if (index === 1) {
          guideTitle.textContent = 'ط§ظ„ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¯ط±ط§ط³ظٹط©';
          guideText.textContent = 'ط§ط®طھط± طµظپظƒ ظˆظ…ط­ط§ظپط¸طھظƒ ظ„ظٹط¸ظ‡ط± ظ„ظƒ ط§ظ„ظ…ظ†ظ‡ط¬ ط§ظ„ظ…ط®طµطµ ظ„ظƒ.';
        } else if (index === 2) {
          guideTitle.textContent = 'طھط£ظ…ظٹظ† ط§ظ„ط­ط³ط§ط¨';
          guideText.textContent = 'ط£ظ†ط´ط¦ ظƒظ„ظ…ط© ظ…ط±ظˆط± ظ‚ظˆظٹط©طŒ ظˆط³ظٹظƒظˆظ† ط±ظ‚ظ… ظ…ظˆط¨ط§ظٹظ„ظƒ ظ‡ظˆ ط§ط³ظ… ط§ظ„ظ…ط³طھط®ط¯ظ… ط§ظ„ط®ط§طµ ط¨ظƒ.';
        }
        guideBox.classList.remove('fade-out');
      }, 300);
    }
  }

  function showRegisterError(message) {
    if (!registerError) return;
    registerError.textContent = message || '';
    registerError.style.display = message ? 'block' : 'none';
  }

  function showLoginError(message) {
    if (!loginError) return;
    loginError.textContent = message || '';
    loginError.style.display = message ? 'block' : 'none';
  }

  function setButtonState(button, text, disabled = false) {
    if (!button) return;
    button.textContent = text;
    button.disabled = disabled;
    button.style.opacity = disabled ? '0.7' : '1';
  }

  function validateStep1() {
    const firstName = document.getElementById('firstName')?.value.trim();
    const lastName = document.getElementById('lastName')?.value.trim();
    const middleName = document.getElementById('middleName')?.value.trim();
    const familyName = document.getElementById('familyName')?.value.trim();
    const studentPhone = document.getElementById('studentPhone')?.value.trim();
    const parentPhone = document.getElementById('parentPhone')?.value.trim();
    const errorMsg = document.getElementById('phoneError');
    if (!firstName || !lastName || !middleName || !familyName || !studentPhone || !parentPhone) {
      if (errorMsg) {
        errorMsg.textContent = 'ظٹط¬ط¨ ط¥ظƒظ…ط§ظ„ ط¬ظ…ظٹط¹ ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ط´ط®طµظٹط© ظ‚ط¨ظ„ ط§ظ„ظ…طھط§ط¨ط¹ط©.';
        errorMsg.style.display = 'block';
      }
      return false;
    }
    if (studentPhone === parentPhone) {
      if (errorMsg) {
        errorMsg.textContent = 'ط±ظ‚ظ… ط§ظ„ط·ط§ظ„ط¨ ظ„ط§ ظٹظ…ظƒظ† ط£ظ† ظٹظƒظˆظ† ظ†ظپط³ ط±ظ‚ظ… ظˆظ„ظٹ ط§ظ„ط£ظ…ط±.';
        errorMsg.style.display = 'block';
      }
      return false;
    }
    if (errorMsg) errorMsg.style.display = 'none';
    return true;
  }

  function validateStep2() {
    const grade = document.getElementById('grade')?.value;
    const governorate = document.getElementById('governorate')?.value;
    const foreignCountry = document.getElementById('foreignCountry')?.value.trim();
    if (!grade || !governorate) {
      showRegisterError('ظ…ظ† ظپط¶ظ„ظƒ ط§ط®طھط± ط§ظ„طµظپ ط§ظ„ط¯ط±ط§ط³ظٹ ظˆط§ظ„ظ…ط­ط§ظپط¸ط© ظ„ظ„ظ…طھط§ط¨ط¹ط©.');
      return false;
    }
    if (governorate === 'outside' && !foreignCountry) {
      showRegisterError('ط§ظƒطھط¨ ط§ط³ظ… ط§ظ„ط¯ظˆظ„ط© ط¹ظ†ط¯ ط§ط®طھظٹط§ط± ط®ط§ط±ط¬ ظ…طµط±.');
      return false;
    }
    showRegisterError('');
    return true;
  }

  if (steps.length > 0) {
    nextBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (currentStep === 0 && !validateStep1()) {
          return;
        }
        if (currentStep === 1 && !validateStep2()) {
          return;
        }
        if (currentStep < steps.length - 1) {
          currentStep += 1;
          showStep(currentStep);
        }
      });
    });
    prevBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (currentStep > 0) {
          currentStep -= 1;
          showStep(currentStep);
        }
      });
    });

    showStep(currentStep);

    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showRegisterError('');
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const phone = document.getElementById('studentPhone')?.value.trim();
        const pwd = document.getElementById('password')?.value || '';
        const confirmPwd = document.getElementById('confirmPassword')?.value || '';
        const governorate = document.getElementById('governorate')?.value;
        const foreignCountry = document.getElementById('foreignCountry')?.value.trim();
        const firstName = document.getElementById('firstName')?.value.trim();
        const lastName = document.getElementById('lastName')?.value.trim();
        const middleName = document.getElementById('middleName')?.value.trim();
        const familyName = document.getElementById('familyName')?.value.trim();
        if (pwd !== confirmPwd) {
          showRegisterError('ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط؛ظٹط± ظ…طھط·ط§ط¨ظ‚ط©.');
          return;
        }
        if (!pwd || pwd.length < 6) {
          showRegisterError('ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† 6 ط£ط­ط±ظپ ط¹ظ„ظ‰ ط§ظ„ط£ظ‚ظ„.');
          return;
        }
        if (!phone || !governorate) {
          showRegisterError('ظٹط±ط¬ظ‰ ط¥ظƒظ…ط§ظ„ ط¬ظ…ظٹط¹ ط¨ظٹط§ظ†ط§طھ ط§ظ„طھط³ط¬ظٹظ„ ظ‚ط¨ظ„ ط§ظ„ط¥ط±ط³ط§ظ„.');
          return;
        }
        if (governorate === 'outside' && !foreignCountry) {
          showRegisterError('ط§ظƒطھط¨ ط§ط³ظ… ط§ظ„ط¯ظˆظ„ط© ط¥ظ† ط§ط®طھط±طھ ط®ط§ط±ط¬ ظ…طµط±.');
          return;
        }
        if (!firstName || !lastName || !middleName || !familyName) {
          showRegisterError('ظٹط±ط¬ظ‰ ط¥ظƒظ…ط§ظ„ ط¬ظ…ظٹط¹ ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ط´ط®طµظٹط©.');
          return;
        }
        let govValue = governorate;
        if (governorate === 'outside') {
          govValue = foreignCountry;
        }
        const userData = {
          name: [firstName, lastName, middleName, familyName].filter(Boolean).join(' '),
          phone: window.BousalaPhoneFix ? window.BousalaPhoneFix.normPhone(phone) : phone,
          parentPhone: document.getElementById('parentPhone')?.value.trim(),
          grade: document.getElementById('grade')?.value,
          gov: govValue,
          date: new Date().toISOString(),
          role: 'student'
        };
        const email = `${userData.phone}@student.youssefbarakat.com`;
        userData.email = email;
        setButtonState(submitBtn, 'ط¬ط§ط±ظٹ ط¥ظ†ط´ط§ط، ط§ظ„ط­ط³ط§ط¨...', true);
        let finalUserData = userData;
        try {
          if (window.FirebaseService && window.FirebaseService.isReady()) {
            finalUserData = await window.FirebaseService.registerStudent(userData, pwd);
          } else {
            throw new Error('Firebase not configured');
          }
        } catch (error) {
          console.error('Registration failed:', error);
          let errorMsg = 'ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط¥ظ†ط´ط§ط، ط§ظ„ط­ط³ط§ط¨. طھط£ظƒط¯ ظ…ظ† ط§طھطµط§ظ„ظƒ ط¨ط§ظ„ط¥ظ†طھط±ظ†طھ.';
          if (error.code === 'auth/email-already-in-use') {
              errorMsg = 'ظ‡ط°ط§ ط§ظ„ط±ظ‚ظ… ظ…ط³ط¬ظ„ ط¨ط§ظ„ظپط¹ظ„ ظپظٹ ظ‚ط§ط¹ط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ.';
          } else if (error.message) {
              errorMsg = error.message;
          }
          showRegisterError(errorMsg);
          setButtonState(submitBtn, 'ط¥ظ†ط´ط§ط، ط§ظ„ط­ط³ط§ط¨', false);
          return;
        }
        try {
          if (window.PlatformStorage && finalUserData.phone) {
            window.PlatformStorage.initializeNewStudent(finalUserData.phone, finalUserData.grade, finalUserData.date);
          }
        } catch (error) {
          console.warn('PlatformStorage initialization failed after registration', error);
        }
        try {
          if (window.showToast) {
            if (window.triggerConfetti) window.triggerConfetti();
            window.showToast('ظ…ط¨ط±ظˆظƒ ط§ظ†ط¶ظ…ط§ظ…ظƒ ظ„ط£ظ‚ظˆظ‰ ظ…ظ†طµط© ط¯ط±ط§ط³ط§طھ ظپظٹ ظ…طµط±!\nط±ط­ظ„طھظƒ ظ†ط­ظˆ ط§ظ„طھظپظˆظ‚ طھط¨ط¯ط£ ط§ظ„ط¢ظ† ظٹط§ ط¨ط·ظ„.', 'majestic', { title: 'ًںژ‰ ط£ظ‡ظ„ط§ ط¨ظƒ ظپظٹ ط¨ظٹطھظƒ ط§ظ„ط«ط§ظ†ظٹ', duration: 0, closeBtn: true, isMajestic: true });
          }
        } catch (error) {
          console.warn('Registration celebration failed', error);
        }
        try {
          sessionStorage.setItem('currentStudent', JSON.stringify(finalUserData));
          sessionStorage.setItem('justRegistered', 'true');
        } catch (e) {
          console.warn('sessionStorage setItem failed', e);
        }
        
        try {
          if (typeof window.pfTransferGuestSupportSessionToAccount === 'function') {
            window.pfTransferGuestSupportSessionToAccount(finalUserData);
          }
        } catch (error) {
          console.warn('Guest session transfer failed', error);
        }

        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1500);
      });
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const prefillPhone = params.get('prefillPhone');
      const prefillEmail = params.get('prefillEmail');
      if (prefillPhone) {
        const el = document.getElementById('studentPhone');
        if (el && !el.value) el.value = prefillPhone;
      }
      if (prefillEmail && prefillEmail.includes('@')) {
        const local = prefillEmail.split('@')[0];
        const el = document.getElementById('studentPhone');
        if (el && /^\d+$/.test(local) && !el.value) el.value = local;
      }
      if (prefillPhone || prefillEmail) {
        if (window.showToast) window.showToast('ظ†ظ…ظˆط°ط¬ ط§ظ„طھط³ط¬ظٹظ„ ظ…ظ…ظ„ظˆط، ط¬ط²ط¦ظٹط§ ظ„طھط³ظ‡ظٹظ„ ط¥طھظ…ط§ظ… ط§ظ„ط­ط³ط§ط¨', 'info', { duration: 4000 });
      }
    } catch (e) {
      console.warn('prefill registration failed', e);
    }
    window.registerStepNavActive = true;
  }

  const loginForm = document.getElementById('loginForm');
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const forgotPasswordModal = document.getElementById('forgotPasswordModal');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const fpStep2 = document.getElementById('fpStep2');
  const fpParentError = document.getElementById('fpParentError');
  const fpStatusText = document.getElementById('fpStatusText');
  const fpResendBtn = document.getElementById('fpResendBtn');
  const fpSubmitBtn = document.getElementById('fpSubmitBtn');
  const fpPasswordError = document.getElementById('fpPasswordError');

  function normalizePhoneValue(phone) {
    return (phone || '').toString().replace(/[^0-9]/g, '');
  }

  function formatEgyptPhone(phone) {
    const digits = normalizePhoneValue(phone);
    if (digits.length === 10 && digits.startsWith('0')) return '2' + digits;
    if (digits.length === 11 && digits.startsWith('20')) return digits;
    if (digits.length === 9) return '20' + digits;
    return digits;
  }

  function arePhonesSame(a, b) {
    return formatEgyptPhone(a) === formatEgyptPhone(b);
  }

  async function hashText(text) {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const OTP_LENGTH = 5;
  function generateOtp() {
    const numbers = new Uint32Array(OTP_LENGTH);
    window.crypto.getRandomValues(numbers);
    return Array.from(numbers).map(n => String(n % 10)).join('');
  }

  function saveResetToken(studentPhone, tokenData) {
    localStorage.setItem(`pwdReset_${normalizePhoneValue(studentPhone)}`, JSON.stringify(tokenData));
  }

  function loadResetToken(studentPhone) {
    const data = localStorage.getItem(`pwdReset_${normalizePhoneValue(studentPhone)}`);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }

  function cleanupExpiredResetTokens() {
    const now = Date.now();
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pwdReset_')) keys.push(key);
    }
    keys.forEach(key => {
      const token = loadResetToken(key.replace('pwdReset_', ''));
      if (!token || token.used || (token.expiresAt && now > token.expiresAt + 1000 * 60 * 15)) {
        localStorage.removeItem(key);
      }
    });
  }

  async function validateParentBinding(studentPhone, parentPhone) {
    const strictUsers = JSON.parse(localStorage.getItem('strictUsers') || '[]');
    const normalizedStudent = normalizePhoneValue(studentPhone);
    let user = strictUsers.find(u => normalizePhoneValue(u.phone) === normalizedStudent);
    if (!user && window.firebaseDb) {
      try {
        const query = await window.firebaseDb.collection('users').where('phone', '==', normalizedStudent).limit(1).get();
        if (!query.empty) {
          const doc = query.docs[0];
          user = { ...doc.data(), id: doc.id };
        }
      } catch (e) {
        console.warn('Firebase parent lookup failed', e);
      }
    }
    if (!user) return null;
    return arePhonesSame(user.parentPhone, parentPhone) ? user : null;
  }

  function showForgotStatus(message = '', type = 'info') {
    if (!fpStatusText) return;
    if (!message) {
      fpStatusText.style.display = 'none';
      return;
    }
    fpStatusText.textContent = message;
    fpStatusText.style.display = 'block';
    fpStatusText.style.color = type === 'error' ? '#ffb3b3' : '#f8f1d4';
    fpStatusText.style.background = type === 'error' ? 'rgba(183, 54, 54, 0.14)' : 'rgba(212, 166, 79, 0.12)';
    fpStatusText.style.border = type === 'error' ? '1px solid rgba(255, 99, 71, 0.18)' : '1px solid rgba(212, 166, 79, 0.24)';
  }

  function setForgotButtonState(text, disabled = false) {
    if (!fpSubmitBtn) return;
    fpSubmitBtn.textContent = text;
    fpSubmitBtn.disabled = disabled;
    fpSubmitBtn.style.opacity = disabled ? '0.7' : '1';
  }

  let resendTimer = null;
  function startResendCooldown(seconds = 60) {
    if (!fpResendBtn) return;
    let remaining = seconds;
    fpResendBtn.disabled = true;
    fpResendBtn.style.opacity = '0.7';
    fpResendBtn.textContent = `ط¥ط¹ط§ط¯ط© ط§ظ„ط¥ط±ط³ط§ظ„ ط¨ط¹ط¯ ${remaining}s`;
    if (resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(resendTimer);
        resendTimer = null;
        fpResendBtn.disabled = false;
        fpResendBtn.style.opacity = '1';
        fpResendBtn.textContent = 'ط¥ط¹ط§ط¯ط© ط¥ط±ط³ط§ظ„ ط§ظ„ظƒظˆط¯';
        return;
      }
      fpResendBtn.textContent = `ط¥ط¹ط§ط¯ط© ط§ظ„ط¥ط±ط³ط§ظ„ ط¨ط¹ط¯ ${remaining}s`;
    }, 1000);
  }

  function isStrongPassword(password) {
    return typeof password === 'string' && password.length >= 8 && /[A-Zط£-ظٹ]/.test(password) && /[0-9]/.test(password) && /[!@#\$%\^&\*\?]/.test(password);
  }

  async function createAndSendResetToken(studentPhone, parentPhone) {
    cleanupExpiredResetTokens();
    const existing = loadResetToken(studentPhone);
    const now = Date.now();
    if (existing && existing.lockUntil && now < existing.lockUntil) {
      throw new Error('ظ„ظ‚ط¯ طھظ… ط­ط¸ط± ظ…ط­ط§ظˆظ„ط§طھ ط§ظ„ط§ط³طھط¹ط§ط¯ط© ظ…ط¤ظ‚طھط§. ط­ط§ظˆظ„ ظپظٹ ظˆظ‚طھ ظ„ط§ط­ظ‚.');
    }
    if (existing && existing.resendCooldownExpiresAt && now < existing.resendCooldownExpiresAt) {
      const wait = Math.ceil((existing.resendCooldownExpiresAt - now) / 1000);
      throw new Error(`ط§ظ†طھط¸ط± ${wait} ط«ط§ظ†ظٹط© ط«ظ… ط£ط¹ط¯ ط§ظ„ظ…ط­ط§ظˆظ„ط©.`);
    }
    if (existing && existing.requestCount >= 3 && now - existing.createdAt < 1000 * 60 * 60) {
      throw new Error('طھظ… ط§ظ„ظˆطµظˆظ„ ط¥ظ„ظ‰ ط§ظ„ط­ط¯ ط§ظ„ط£ظ‚طµظ‰ ظ„ط·ظ„ط¨ط§طھ ط¥ط¹ط§ط¯ط© طھط¹ظٹظٹظ† ظƒظ„ظ…ط© ط§ظ„ط³ط±. ط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰ ط¨ط¹ط¯ ط³ط§ط¹ط©.');
    }
    if (existing) {
      existing.used = true;
      saveResetToken(studentPhone, existing);
    }
    const otpCode = generateOtp();
    const tokenHash = await hashText(`${studentPhone}|${otpCode}|${now}`);
    const tokenData = {
      codeHash: tokenHash,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000,
      used: false,
      attempts: 0,
      requestCount: existing ? existing.requestCount + 1 : 1,
      resendCooldownExpiresAt: now + 60 * 1000,
      lockUntil: null,
      parentPhone: formatEgyptPhone(parentPhone)
    };
    saveResetToken(studentPhone, tokenData);
    return { otpCode, tokenData };
  }

  // Admin utility: overwrite student's stored password (local + Firestore document if available)
  window.adminOverwriteStudentPassword = async function(studentPhone, newPassword) {
    try {
      const normalized = normalizePhoneValue(studentPhone);
      // Update local strictUsers
      let users = JSON.parse(localStorage.getItem('strictUsers') || '[]');
      let updated = false;
      users = users.map(u => {
        try {
          if (normalizePhoneValue(u.phone) === normalized) {
            u.password = newPassword;
            updated = true;
          }
        } catch(e) {}
        return u;
      });
      if (updated) localStorage.setItem('strictUsers', JSON.stringify(users));

      // Update Firestore user document if available (best-effort)
      if (window.firebaseDb) {
        try {
          const query = await window.firebaseDb.collection('users').where('phone', '==', normalized).limit(1).get();
          if (!query.empty) {
            const doc = query.docs[0];
            await window.firebaseDb.collection('users').doc(doc.id).update({ password: newPassword });
            updated = true;
          }
        } catch (e) { console.warn('Firebase password overwrite failed', e); }
      }
      return updated;
    } catch (e) {
      console.error('adminOverwriteStudentPassword failed', e);
      return false;
    }
  };

  async function verifyResetToken(studentPhone, code) {
    const token = loadResetToken(studentPhone);
    if (!token) return { valid: false, reason: 'expired' };
    if (token.used) return { valid: false, reason: 'used' };
    const now = Date.now();
    if (token.expiresAt && now > token.expiresAt) return { valid: false, reason: 'expired' };
    const tryHash = await hashText(`${studentPhone}|${code}|${token.createdAt}`);
    if (token.codeHash !== tryHash) {
      token.attempts = (token.attempts || 0) + 1;
      if (token.attempts >= 5) {
        token.lockUntil = now + 15 * 60 * 1000;
      }
      saveResetToken(studentPhone, token);
      return { valid: false, reason: 'wrong', attempts: token.attempts };
    }
    return { valid: true, token };
  }

  if (forgotPasswordLink && forgotPasswordModal) {
    forgotPasswordLink.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const loginPhoneEl = document.getElementById('loginPhone');
        const rawId = loginPhoneEl ? loginPhoneEl.value.trim() : '';
        if (!rawId) {
          showForgotStatus('ظ…ظ† ظپط¶ظ„ظƒ ط§ظƒطھط¨ ط±ظ‚ظ… ط§ظ„ظ…ظˆط¨ط§ظٹظ„ ظپظٹ ط®ط§ظ†ط© طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„ ط£ظˆظ„ط§ظ‹.', 'error');
          if (loginPhoneEl) loginPhoneEl.focus();
          return;
        }

        // Try find user in local strictUsers first
        const normalized = normalizePhoneValue(rawId);
        let foundUser = null;
        // Check local strictUsers
        try {
          const users = JSON.parse(localStorage.getItem('strictUsers') || '[]');
          foundUser = users.find(u => normalizePhoneValue(u.phone) === normalized || (u.email && u.email.toLowerCase() === rawId.toLowerCase()));
        } catch (e) { console.warn('local strictUsers lookup failed', e); }

        // If not found locally, try Firebase (best-effort)
        if (!foundUser && window.firebaseDb) {
          try {
            let query = await window.firebaseDb.collection('users').where('phone', '==', normalized).limit(1).get();
            if (!query.empty) {
              const doc = query.docs[0];
              foundUser = { ...doc.data(), id: doc.id };
            } else {
              // try email
              query = await window.firebaseDb.collection('users').where('email', '==', rawId).limit(1).get();
              if (!query.empty) {
                const doc = query.docs[0];
                foundUser = { ...doc.data(), id: doc.id };
              }
            }
          } catch (e) { console.warn('Firebase lookup failed', e); }
        }

        if (!foundUser) {
          showForgotStatus('ظ„ظ… ظٹطھظ… ط§ظ„ط¹ط«ظˆط± ط¹ظ„ظ‰ ط­ط³ط§ط¨ ط¨ظ‡ط°ط§ ط§ظ„ط±ظ‚ظ…. طھط­ظ‚ظ‚ ظ…ظ† ط¥ط¯ط®ط§ظ„ظƒ.', 'error');
          return;
        }

        // Ask for parent phone via secure prompt
        const promptMsg = 'ظ„طھط£ظƒظٹط¯ ظ‡ظˆظٹطھظƒطŒ ط§ظ„ط±ط¬ط§ط، ط¥ط¯ط®ط§ظ„ ط±ظ‚ظ… ظ‡ط§طھظپ ظˆظ„ظٹ ط§ظ„ط£ظ…ط± ط§ظ„ظ…ط³ط¬ظ„ ظپظٹ ط­ط³ط§ط¨ظƒ:';
        const enteredParent = window.prompt(promptMsg, '');
        if (enteredParent === null) {
          // user cancelled
          return;
        }

        // Validate parent phone
        const storedParent = foundUser.parentPhone || foundUser.parent || '';
        if (!storedParent) {
          showForgotStatus('ظ„ط§ ظٹظˆط¬ط¯ ط±ظ‚ظ… ظˆظ„ظٹ ط£ظ…ط± ظ…ط®ط²ظ† ظ„ظ‡ط°ط§ ط§ظ„ط­ط³ط§ط¨. طھظˆط§طµظ„ ظ…ط¹ ط§ظ„ط¯ط¹ظ….', 'error');
          return;
        }
        if (!arePhonesSame(enteredParent, storedParent)) {
          window.alert('ط¹ط°ط±ط§ظ‹طŒ ط±ظ‚ظ… ظˆظ„ظٹ ط§ظ„ط£ظ…ط± ط؛ظٹط± طµط­ظٹط­. ظ„ط§ ظٹظ…ظƒظ† ط§ط³طھط¹ط§ط¯ط© ط§ظ„ط­ط³ط§ط¨!');
          return;
        }

        // Confirm and open WhatsApp to support number
        const confirmMsg = 'طھظ… طھط£ظƒظٹط¯ ط§ظ„ظ‡ظˆظٹط© ط¨ظ†ط¬ط§ط­. ط³ظٹطھظ… طھظˆط¬ظٹظ‡ظƒ ط§ظ„ط¢ظ† ط¥ظ„ظ‰ ط§ظ„ظˆط§طھط³ط§ط¨ ظ„ظپطھط­ ظ…ط­ط§ط¯ط«ط© ظ…ط¹ ط§ظ„ط¯ط¹ظ… ط§ظ„ظپظ†ظٹ ظ„ظ„ظ…ظ†طµط© ظ„ط¥ط±ط³ط§ظ„ ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط§ظ„ط¬ط¯ظٹط¯ط© ظ„ظƒ. ظ‡ظ„ طھط±ظٹط¯ ط§ظ„ظ…طھط§ط¨ط¹ط©طں';
        const proceed = window.confirm(confirmMsg);
        if (!proceed) return;

        // Build message
        const studentName = foundUser.fullName || foundUser.name || foundUser.email || foundUser.phone || 'ط·ط§ظ„ط¨';
        const studentPhone = foundUser.phone || rawId;
        const supportNumber = '201023675235';
        const msg = `ظ…ط±ط­ط¨ط§ظ‹ ظ…ظ†طµط© ظٹظˆط³ظپ ط¨ط±ظƒط§طھ ط§ظ„طھط¹ظ„ظٹظ…ظٹط©طŒ ط£ظ†ط§ ط§ظ„ط·ط§ظ„ط¨: ${studentName}طŒ ظˆط±ظ‚ظ… ظ‡ط§طھظپظٹ: ${studentPhone}. ظ„ظ‚ط¯ ظ‚ظ…طھ ط¨طھط£ظƒظٹط¯ ظ‡ظˆظٹطھظٹ ط¨ط±ظ‚ظ… ظˆظ„ظٹ ط£ظ…ط±ظٹ ط¨ظ†ط¬ط§ط­طŒ ظˆط£ط±ظٹط¯ ط§ظ„ط­طµظˆظ„ ط¹ظ„ظ‰ ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط§ظ„ط®ط§طµط© ط¨ط­ط³ط§ط¨ظٹ ظ„طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„.`;
        const url = `https://wa.me/${supportNumber}?text=${encodeURIComponent(msg)}`;
        // Use location.href to avoid popup blockers (navigate in same tab)
        window.location.href = url;

      } catch (err) {
        console.error('forgot password flow failed', err);
        showForgotStatus('ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط¹ظ…ظ„ظٹط© ط§ط³طھط¹ط§ط¯ط© ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±. ط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰ ظ„ط§ط­ظ‚ط§ظ‹.', 'error');
      }
    });
    forgotPasswordModal.addEventListener('click', (e) => {
      if (e.target === forgotPasswordModal) forgotPasswordModal.style.display = 'none';
    });
  }

  if (fpResendBtn) {
    fpResendBtn.addEventListener('click', async () => {
      const studentPhone = document.getElementById('fpStudentPhone')?.value.trim();
      const parentPhone = document.getElementById('fpParentPhone')?.value.trim();
      if (!studentPhone || !parentPhone) return;
      try {
        setForgotButtonState('ط¬ط§ط±ظٹ ط¥ط¹ط§ط¯ط© ط§ظ„ط¥ط±ط³ط§ظ„...', true);
        const matchedUser = await validateParentBinding(studentPhone, parentPhone);
        if (!matchedUser) {
          if (fpParentError) fpParentError.style.display = 'block';
          showForgotStatus('ط§ظ„ط±ظ‚ظ… ط؛ظٹط± طµط­ظٹط­ طھط£ظƒط¯ ظ…ظ† ط±ظ‚ظ… ظˆظ„ظٹ ط§ظ„ط£ظ…ط± ط§ظ„ظ…ط±طھط¨ط· ط¨ط§ظ„ط­ط³ط§ط¨ ًں™ڈ', 'error');
          setForgotButtonState('ط¥ط±ط³ط§ظ„ ط§ظ„ظƒظˆط¯ ط¹ط¨ط± ظˆط§طھط³ط§ط¨', false);
          return;
        }
        if (fpParentError) fpParentError.style.display = 'none';
        const { otpCode } = await createAndSendResetToken(studentPhone, parentPhone);
        const formattedParent = formatEgyptPhone(parentPhone);
        const message = `ظƒظˆط¯ ط§ط³طھط¹ط§ط¯ط© ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط§ظ„ط®ط§طµ ط¨ظ…ظ†طµط© ظٹظˆط³ظپ ط¨ط±ظƒط§طھ ظ‡ظˆ:%0A${otpCode}%0A%0Aâڑ ï¸ڈ ظ„ط§ طھط´ط§ط±ظƒ ظ‡ط°ط§ ط§ظ„ظƒظˆط¯ ظ…ط¹ ط£ظٹ ط´ط®طµ ط­ظپط§ط¸ط§ ط¹ظ„ظ‰ ط£ظ…ط§ظ† ط­ط³ط§ط¨ظƒ.%0Aط§ظ„ظƒظˆط¯ طµط§ظ„ط­ ظ„ظ…ط¯ط© 10 ط¯ظ‚ط§ط¦ظ‚ ظپظ‚ط·.`;
        window.open(`https://wa.me/${formattedParent}?text=${message}`, '_blank');
        showForgotStatus('طھظ… ط¥ط¹ط§ط¯ط© ط¥ط±ط³ط§ظ„ ط§ظ„ظƒظˆط¯ ط¹ط¨ط± ظˆط§طھط³ط§ط¨. ط§ظپط­طµ ط±ط³ط§ظ„ط© ظˆظ„ظٹ ط§ظ„ط£ظ…ط±.', 'info');
        if (fpResendBtn) fpResendBtn.style.display = 'inline-flex';
        startResendCooldown(60);
      } catch (error) {
        showForgotStatus(error.message || 'ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط¥ط¹ط§ط¯ط© ط§ظ„ط¥ط±ط³ط§ظ„.', 'error');
      } finally {
        setForgotButtonState('طھط£ظƒظٹط¯ ط§ظ„ظƒظˆط¯ ظˆطھط­ط¯ظٹط« ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±', false);
      }
    });
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const studentPhone = document.getElementById('fpStudentPhone')?.value.trim();
      const parentPhone = document.getElementById('fpParentPhone')?.value.trim();
      const otpInput = document.getElementById('fpOtpCode');
      const newPasswordInput = document.getElementById('fpNewPassword');
      const confirmPasswordInput = document.getElementById('fpConfirmPassword');
      if (!fpStep2 || fpStep2.style.display === 'none') {
        try {
          setForgotButtonState('ط¬ط§ط±ظٹ ط¥ظ†ط´ط§ط، ط§ظ„ظƒظˆط¯...', true);
          const matchedUser = await validateParentBinding(studentPhone, parentPhone);
          if (!matchedUser) {
            if (fpParentError) fpParentError.style.display = 'block';
            showForgotStatus('ط§ظ„ط±ظ‚ظ… ط؛ظٹط± طµط­ظٹط­ طھط£ظƒط¯ ظ…ظ† ط±ظ‚ظ… ظˆظ„ظٹ ط§ظ„ط£ظ…ط± ط§ظ„ظ…ط±طھط¨ط· ط¨ط§ظ„ط­ط³ط§ط¨ ًں™ڈ', 'error');
            return;
          }
          if (fpParentError) fpParentError.style.display = 'none';
          const { otpCode } = await createAndSendResetToken(studentPhone, parentPhone);
          const formattedParent = formatEgyptPhone(parentPhone);
          const message = `ظƒظˆط¯ ط§ط³طھط¹ط§ط¯ط© ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط§ظ„ط®ط§طµ ط¨ظ…ظ†طµط© ظٹظˆط³ظپ ط¨ط±ظƒط§طھ ظ‡ظˆ:%0A${otpCode}%0A%0Aâڑ ï¸ڈ ظ„ط§ طھط´ط§ط±ظƒ ظ‡ط°ط§ ط§ظ„ظƒظˆط¯ ظ…ط¹ ط£ظٹ ط´ط®طµ ط­ظپط§ط¸ط§ ط¹ظ„ظ‰ ط£ظ…ط§ظ† ط­ط³ط§ط¨ظƒ.%0Aط§ظ„ظƒظˆط¯ طµط§ظ„ط­ ظ„ظ…ط¯ط© 10 ط¯ظ‚ط§ط¦ظ‚ ظپظ‚ط·.`;
          window.open(`https://wa.me/${formattedParent}?text=${message}`, '_blank');
          fpStep2.style.display = 'block';
          if (fpResendBtn) fpResendBtn.style.display = 'inline-flex';
          fpSubmitBtn.textContent = 'طھط£ظƒظٹط¯ ط§ظ„ظƒظˆط¯ ظˆطھط­ط¯ظٹط« ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±';
          showForgotStatus('طھظ… ط¥ط±ط³ط§ظ„ ط§ظ„ظƒظˆط¯ ط¹ط¨ط± ظˆط§طھط³ط§ط¨. ظپط¶ظ„ط§ ط§ظƒطھط¨ ط§ظ„ظƒظˆط¯ ط«ظ… ط§ط®طھط± ظƒظ„ظ…ط© ظ…ط±ظˆط± ط¬ط¯ظٹط¯ط©.', 'info');
          startResendCooldown(60);
          return;
        } catch (error) {
          showForgotStatus(error.message || 'ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط¥ط±ط³ط§ظ„ ط§ظ„ظƒظˆط¯.', 'error');
          return;
        } finally {
          setForgotButtonState('طھط£ظƒظٹط¯ ط§ظ„ظƒظˆط¯ ظˆطھط­ط¯ظٹط« ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±', false);
        }
      }
      const otpCode = otpInput?.value.trim();
      const newPassword = newPasswordInput?.value || '';
      const confirmPassword = confirmPasswordInput?.value || '';
      if (fpPasswordError) fpPasswordError.style.display = 'none';
      if (newPassword !== confirmPassword || !isStrongPassword(newPassword)) {
        if (fpPasswordError) fpPasswordError.style.display = 'block';
        showForgotStatus('ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط؛ظٹط± ظ…طھط·ط§ط¨ظ‚ط© ط£ظˆ ط¶ط¹ظٹظپط©. ط§ط³طھط®ط¯ظ… 8 ط£ط­ط±ظپ ط¹ظ„ظ‰ ط§ظ„ط£ظ‚ظ„ ظ…ط¹ ط£ط±ظ‚ط§ظ… ظˆط±ظ…ظˆط².', 'error');
        return;
      }
      try {
        setForgotButtonState('ط¬ط§ط±ظٹ ط§ظ„طھط­ظ‚ظ‚...', true);
        const result = await verifyResetToken(studentPhone, otpCode);
        if (!result.valid) {
          showForgotStatus('ط§ظ„ظƒظˆط¯ ط؛ظٹط± طµط­ظٹط­ ط£ظˆ ط§ظ†طھظ‡طھ طµظ„ط§ط­ظٹطھظ‡ ًں™ڈ', 'error');
          return;
        }
        const strictUsers = JSON.parse(localStorage.getItem('strictUsers') || '[]');
        const normalizedStudent = normalizePhoneValue(studentPhone);
        const userIndex = strictUsers.findIndex(u => normalizePhoneValue(u.phone) === normalizedStudent);
        if (userIndex === -1) {
          showForgotStatus('ظ„ظ… ظٹطھظ… ط§ظ„ط¹ط«ظˆط± ط¹ظ„ظ‰ ط§ظ„ط­ط³ط§ط¨ ط§ظ„ظ…ط±طھط¨ط· ط¨ظ‡ط°ط§ ط§ظ„ط±ظ‚ظ….', 'error');
          return;
        }
        strictUsers[userIndex].password = newPassword;
        localStorage.setItem('strictUsers', JSON.stringify(strictUsers));
        localStorage.removeItem(`pwdReset_${normalizePhoneValue(studentPhone)}`);
        showForgotStatus('طھظ… طھط؛ظٹظٹط± ظƒظ„ظ…ط© ط§ظ„ط³ط± ط¨ظ†ط¬ط§ط­ âœ…', 'info');
        if (window.showToast) window.showToast('طھظ… طھط؛ظٹظٹط± ظƒظ„ظ…ط© ط§ظ„ط³ط± ط¨ظ†ط¬ط§ط­ âœ…', 'success');
        setTimeout(() => {
          if (forgotPasswordModal) forgotPasswordModal.style.display = 'none';
        }, 1200);
        forgotPasswordForm.reset();
        if (fpStep2) fpStep2.style.display = 'none';
        if (fpResendBtn) fpResendBtn.style.display = 'none';
        if (fpSubmitBtn) fpSubmitBtn.textContent = 'ط¥ط±ط³ط§ظ„ ط§ظ„ظƒظˆط¯ ط¹ط¨ط± ظˆط§طھط³ط§ط¨';
      } finally {
        setForgotButtonState('طھط£ظƒظٹط¯ ط§ظ„ظƒظˆط¯ ظˆطھط­ط¯ظٹط« ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±', false);
      }
    });
  }


  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showLoginError('');
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const rawId = document.getElementById('loginPhone')?.value.trim();
      const pwd = document.getElementById('loginPassword')?.value || '';
      const isEmailInput = rawId?.includes('@');
      const rememberMe = document.getElementById('rememberMe') ? document.getElementById('rememberMe').checked : false;
      if (!rawId || !pwd) {
        showLoginError('ظ…ظ† ظپط¶ظ„ظƒ ط§ظƒطھط¨ ط±ظ‚ظ… ط§ظ„ظ…ظˆط¨ط§ظٹظ„ ط£ظˆ ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ ظˆظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±.');
        return;
      }
      setButtonState(submitBtn, 'ط¬ط§ط±ظٹ طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„...', true);
      try {
        if ((rawId === 'youssefbarkatofficial@gmail.com' && pwd === 'YoussefMBarakat175235') || 
            (rawId === 'youssef@barakat.com' && pwd === 'YoussefMBarakat175235')) {
          const ownerAdmin = {
            name: 'ظٹظˆط³ظپ ظ…ط­ظ…ط¯ ط¨ط±ظƒط§طھ',
            email: rawId,
            role: 'admin'
          };
          sessionStorage.setItem('currentAdmin', JSON.stringify(ownerAdmin));
          if (rememberMe) {
            localStorage.setItem('currentAdmin', JSON.stringify(ownerAdmin));
            let savedAccounts = JSON.parse(localStorage.getItem('savedLocalAccounts') || '[]');
            savedAccounts = savedAccounts.filter(a => a.phone !== rawId);
            savedAccounts.push({ phone: rawId, pwd, name: 'ط§ظ„ظ…ط§ظ„ظƒ - ط§ظ„ط¥ط¯ط§ط±ط©' });
            localStorage.setItem('savedLocalAccounts', JSON.stringify(savedAccounts));
          }
          if (window.showToast) window.showToast('ط£ظ‡ظ„ط§ ط¨ظƒ ظٹط§ طµط§ظ†ط¹ ط§ظ„ظ…ط¬ط¯ ظپظٹ ظ…ظ…ظ„ظƒطھظƒ.\nظ…ظ†طµطھظƒ ط¬ط§ظ‡ط²ط© ظ„ط¥ط¨ط¯ط§ط¹ظƒ ط§ظ„ظٹظˆظ…ظٹ.', 'majestic', { title: 'ًں‘‘ ظ…ط±ط­ط¨ط§ ط¨ظƒ ظٹط§ ط£ط³طھط§ط° ظٹظˆط³ظپ', duration: 1500 });
          setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 1500);
          return;
        } else if (rawId === 'youssefda3m@gmail.com' && pwd === 'Da3mYoussef@36') {
          const supportStudent = {
            name: 'ط§ظ„ط¯ط¹ظ… ط§ظ„ظپظ†ظٹ',
            email: 'youssefda3m@gmail.com',
            phone: 'support_000',
            grade: 'prep2',
            role: 'student',
            isTestAccount: true
          };
          sessionStorage.setItem('currentStudent', JSON.stringify(supportStudent));
          sessionStorage.setItem('pfJustLoggedIn', 'true');
          if (rememberMe) {
            localStorage.setItem('currentStudent', JSON.stringify(supportStudent));
            let savedAccounts = JSON.parse(localStorage.getItem('savedLocalAccounts') || '[]');
            savedAccounts = savedAccounts.filter(a => a.phone !== rawId);
            savedAccounts.push({ phone: rawId, pwd, name: 'ط§ظ„ط¯ط¹ظ… ط§ظ„ظپظ†ظٹ' });
            localStorage.setItem('savedLocalAccounts', JSON.stringify(savedAccounts));
          }
          if (typeof window.pfTransferGuestSupportSessionToAccount === 'function') {
            window.pfTransferGuestSupportSessionToAccount(supportStudent);
          }
          if (window.showToast) window.showToast('طھظ… طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„ ط¨ط­ط³ط§ط¨ ط§ظ„ط¯ط¹ظ… ط§ظ„ظپظ†ظٹ ط§ظ„طھط¬ط±ظٹط¨ظٹ.', 'info');
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
          return;
        }
        const phone = rawId;
        const email = isEmailInput ? rawId : `${phone}@student.youssefbarakat.com`;
        if (window.FirebaseService && window.FirebaseService.isReady()) {
          try {
              const user = await window.FirebaseService.loginStudent(phone, pwd);
              if (user && user.role === 'student') {
                sessionStorage.setItem('currentStudent', JSON.stringify(user));
                sessionStorage.setItem('pfJustLoggedIn', 'true');
                if (rememberMe) localStorage.setItem('currentStudent', JSON.stringify(user));
                if (typeof window.pfTransferGuestSupportSessionToAccount === 'function') {
                  window.pfTransferGuestSupportSessionToAccount(user);
                }
                try { if (window.audioManager && window.audioManager.play) window.audioManager.play('login'); } catch(e) {}
                window.location.href = 'dashboard.html';
                return;
              } else if (user && user.role !== 'student') {
                showLoginError('ظ‡ط°ط§ ط§ظ„ط­ط³ط§ط¨ ط؛ظٹط± ظ…ط®طµطµ ظ„ظ„ط·ظ„ط§ط¨.');
                setButtonState(submitBtn, 'طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„', false);
                return;
              }
          } catch(error) {
              console.warn('Firebase login rejected, trying rescue layer:', error);
              if (window.BousalaPhoneFix) {
                  const rescue = await window.BousalaPhoneFix.rescueLogin(phone, pwd);
                  if (rescue.ok) {
                      const rescuedUser = await window.FirebaseService.getStudentByPhone(rescue.normPhone);
                      if (rescuedUser && rescuedUser.role === 'student') {
                          sessionStorage.setItem('currentStudent', JSON.stringify(rescuedUser));
                          sessionStorage.setItem('pfJustLoggedIn', 'true');
                          if (rememberMe) localStorage.setItem('currentStudent', JSON.stringify(rescuedUser));
                          if (typeof window.pfTransferGuestSupportSessionToAccount === 'function') {
                              window.pfTransferGuestSupportSessionToAccount(rescuedUser);
                          }
                          try { if (window.audioManager && window.audioManager.play) window.audioManager.play('login'); } catch(e) {}
                          window.location.href = 'dashboard.html';
                          return;
                      } else {
                          showLoginError("طھظ… ط§ظ„ط¯ط®ظˆظ„ ط¨ظ†ط¬ط§ط­ ظˆظ„ظƒظ† طھط¹ط°ط± ط¬ظ„ط¨ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط·ط§ظ„ط¨ ط£ظˆ ط§ظ„ط­ط³ط§ط¨ ظ„ظٹط³ ظ„ط·ط§ظ„ط¨.");
                          setButtonState(submitBtn, 'طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„', false);
                          return;
                      }
                  } else {
                      showLoginError(rescue.msg);
                      setButtonState(submitBtn, 'طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„', false);
                      return;
                  }
              }

              let userMsg = 'ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط§ظ„ط§طھطµط§ظ„ ط¨ط§ظ„ط®ط§ط¯ظ…. ظٹط±ط¬ظ‰ ط§ظ„ظ…ط­ط§ظˆظ„ط© ظ„ط§ط­ظ‚ط§ظ‹.';
              if (error.code === 'custom/user-not-found' || error.code === 'auth/user-not-found') {
                  userMsg = 'ظ‡ط°ط§ ط§ظ„ط­ط³ط§ط¨ ط؛ظٹط± ظ…ط³ط¬ظ„ ط¹ظ„ظ‰ ط§ظ„ظ…ظ†طµط©طŒ ط§ط¶ط؛ط· ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ ط¬ط¯ظٹط¯ ظ„ظ„ط¯ط®ظˆظ„';
              } else if (error.code === 'auth/invalid-email' || error.code === 'auth/invalid-credential') {
                  userMsg = 'ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط؛ظٹط± طµط­ظٹط­ط©. ظٹط±ط¬ظ‰ ط§ظ„طھط£ظƒط¯ ظˆط§ظ„ظ…ط­ط§ظˆظ„ط© ظ…ط±ط© ط£ط®ط±ظ‰.';
              } else if (error.code === 'auth/wrong-password') {
                  userMsg = 'ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط§ظ„طھظٹ ط£ط¯ط®ظ„طھظ‡ط§ ط®ط§ط·ط¦ط©. ط§ظ„ط±ط¬ط§ط، ط§ظ„طھط£ظƒط¯ ظ…ظ†ظ‡ط§ ظˆط§ظ„ظ…ط­ط§ظˆظ„ط© ظ…ط¬ط¯ط¯ط§ظ‹.';
              } else if (error.code === 'auth/too-many-requests') {
                  userMsg = 'ظ„ظ‚ط¯ ط­ط§ظˆظ„طھ ط§ظ„ط¯ط®ظˆظ„ ظ…ط±ط§طھ ظƒط«ظٹط±ط© ط¬ط¯ط§ظ‹. ظٹط±ط¬ظ‰ ط§ظ„ط§ظ†طھط¸ط§ط± ظ‚ظ„ظٹظ„ط§ظ‹ ط«ظ… ط§ظ„ظ…ط­ط§ظˆظ„ط©.';
              } else if (error.code === 'auth/network-request-failed') {
                  userMsg = 'ظٹظˆط¬ط¯ ظ…ط´ظƒظ„ط© ظپظٹ ط§طھطµط§ظ„ظƒ ط¨ط§ظ„ط¥ظ†طھط±ظ†طھ. ظٹط±ط¬ظ‰ ط§ظ„طھط£ظƒط¯ ظ…ظ† ط§طھطµط§ظ„ظƒ ظˆط§ظ„ظ…ط­ط§ظˆظ„ط© ظ…ط±ط© ط£ط®ط±ظ‰.';
              } else if (error.message) {
                  userMsg = error.message;
              }
              showLoginError(userMsg);
              setButtonState(submitBtn, 'طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„', false);
              return;
          }
        } else {
        throw new Error('Firebase not configured');
      } } catch (error) {
        console.warn('Firebase login failed, trying STRICT Local Storage fallback:', error);
        
        // Try local storage first!
        const users = JSON.parse(localStorage.getItem('strictUsers') || '[]');
        let user = null;
        if (isEmailInput) {
          user = users.find(u => u.email && u.email.toLowerCase() === rawId.toLowerCase());
        } else {
          user = users.find(u => u.phone === rawId);
        }
        
        if (user && user.password === pwd) {
          // Local fallback success!
          sessionStorage.setItem('currentStudent', JSON.stringify(user));
          sessionStorage.setItem('pfJustLoggedIn', 'true');
          if (rememberMe) localStorage.setItem('currentStudent', JSON.stringify(user));
          if (typeof window.pfTransferGuestSupportSessionToAccount === 'function') {
            window.pfTransferGuestSupportSessionToAccount(user);
          }
          try { if (window.audioManager && window.audioManager.play) window.audioManager.play('login'); } catch(e) {}
          window.location.href = 'dashboard.html';
          return;
        }

        // If not found locally, then show Firebase error
        if (window.FirebaseService && window.FirebaseService.isReady()) {
            console.warn('Firebase login rejected:', error);
            let userMsg = 'ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط§ظ„ط§طھطµط§ظ„ ط¨ط§ظ„ط®ط§ط¯ظ…. ظٹط±ط¬ظ‰ ط§ظ„ظ…ط­ط§ظˆظ„ط© ظ„ط§ط­ظ‚ط§ظ‹.';
            if (error.code === 'custom/user-not-found' || error.code === 'auth/user-not-found') {
                userMsg = 'ظ‡ط°ط§ ط§ظ„ط­ط³ط§ط¨ ط؛ظٹط± ظ…ط³ط¬ظ„ ط¹ظ„ظ‰ ط§ظ„ظ…ظ†طµط©طŒ ط§ط¶ط؛ط· ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ ط¬ط¯ظٹط¯ ظ„ظ„ط¯ط®ظˆظ„';
            } else if (error.code === 'auth/invalid-email' || error.code === 'auth/invalid-credential') {
                userMsg = 'ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط؛ظٹط± طµط­ظٹط­ط©. ظٹط±ط¬ظ‰ ط§ظ„طھط£ظƒط¯ ظˆط§ظ„ظ…ط­ط§ظˆظ„ط© ظ…ط±ط© ط£ط®ط±ظ‰.';
            } else if (error.code === 'auth/wrong-password') {
                userMsg = 'ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط§ظ„طھظٹ ط£ط¯ط®ظ„طھظ‡ط§ ط®ط§ط·ط¦ط©. ط§ظ„ط±ط¬ط§ط، ط§ظ„طھط£ظƒط¯ ظ…ظ†ظ‡ط§ ظˆط§ظ„ظ…ط­ط§ظˆظ„ط© ظ…ط¬ط¯ط¯ط§ظ‹.';
            } else if (error.code === 'auth/too-many-requests') {
                userMsg = 'ظ„ظ‚ط¯ ط­ط§ظˆظ„طھ ط§ظ„ط¯ط®ظˆظ„ ظ…ط±ط§طھ ظƒط«ظٹط±ط© ط¬ط¯ط§ظ‹. ظٹط±ط¬ظ‰ ط§ظ„ط§ظ†طھط¸ط§ط± ظ‚ظ„ظٹظ„ط§ظ‹ ط«ظ… ط§ظ„ظ…ط­ط§ظˆظ„ط©.';
            } else if (error.code === 'auth/network-request-failed') {
                userMsg = 'طھط£ظƒط¯ ظ…ظ† ط§طھطµط§ظ„ظƒ ط¨ط§ظ„ط¥ظ†طھط±ظ†طھ ظˆط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰.';
            } else if (error.message && error.message.includes('طھظ… ظ…ط³ط­ ظ‡ط°ط§ ط§ظ„ط­ط³ط§ط¨')) {
                userMsg = error.message;
            }
            showLoginError(userMsg);
            return;
        }

        showLoginError('ظ„ظ… ظٹطھظ… ط§ظ„ط¹ط«ظˆط± ط¹ظ„ظ‰ ط­ط³ط§ط¨ ط¨ظ‡ط°ط§ ط§ظ„ط±ظ‚ظ… ط£ظˆ ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ. ظٹظ…ظƒظ†ظƒ ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ ط¬ط¯ظٹط¯.');
        return;
      } finally {
        setButtonState(submitBtn, 'ط¯ط®ظˆظ„ ظ„ظ„ظ…ظ†طµط©', false);
      }
    });
  }

  const govSelect = document.getElementById('governorate');
  const foreignCountryGroup = document.getElementById('foreignCountryGroup');
  const foreignCountryInput = document.getElementById('foreignCountry');
  if (govSelect) {
    const govs = ['ط§ظ„ط¥ط³ظƒظ†ط¯ط±ظٹط©', 'ط§ظ„ط¥ط³ظ…ط§ط¹ظٹظ„ظٹط©', 'ط§ظ„ط£ظ‚طµط±', 'ط§ظ„ط¨ط­ط± ط§ظ„ط£ط­ظ…ط±', 'ط§ظ„ط¨ط­ظٹط±ط©', 'ط§ظ„ط¬ظٹط²ط©', 'ط§ظ„ط¯ظ‚ظ‡ظ„ظٹط©', 'ط§ظ„ط³ظˆظٹط³', 'ط§ظ„ط´ط±ظ‚ظٹط©', 'ط§ظ„ط؛ط±ط¨ظٹط©', 'ط§ظ„ظپظٹظˆظ…', 'ط§ظ„ظ‚ط§ظ‡ط±ط©', 'ط§ظ„ظ‚ظ„ظٹظˆط¨ظٹط©', 'ط§ظ„ظ…ظ†ظˆظپظٹط©', 'ط§ظ„ظ…ظ†ظٹط§', 'ط§ظ„ظˆط§ط¯ظٹ ط§ظ„ط¬ط¯ظٹط¯', 'ط£ط³ظˆط§ظ†', 'ط£ط³ظٹظˆط·', 'ط¨ظ†ظٹ ط³ظˆظٹظپ', 'ط¨ظˆط±ط³ط¹ظٹط¯', 'ط¬ظ†ظˆط¨ ط³ظٹظ†ط§ط،', 'ط¯ظ…ظٹط§ط·', 'ط³ظˆظ‡ط§ط¬', 'ط´ظ…ط§ظ„ ط³ظٹظ†ط§ط،', 'ظ‚ظ†ط§', 'ظƒظپط± ط§ظ„ط´ظٹط®', 'ظ…ط·ط±ظˆط­'];
    govs.forEach(gov => {
      const option = document.createElement('option');
      option.value = gov;
      option.textContent = gov;
      govSelect.appendChild(option);
    });
    govSelect.addEventListener('change', () => {
      if (govSelect.value === 'outside') {
        if (foreignCountryGroup) foreignCountryGroup.classList.add('active');
        if (foreignCountryInput) foreignCountryInput.required = true;
      } else {
        if (foreignCountryGroup) foreignCountryGroup.classList.remove('active');
        if (foreignCountryInput) {
          foreignCountryInput.required = false;
          foreignCountryInput.value = '';
        }
      }
    });
  }
});

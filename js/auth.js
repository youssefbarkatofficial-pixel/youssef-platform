document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('/login') && (sessionStorage.getItem('currentStudent') || localStorage.getItem('currentStudent'))) {
    window.location.href = 'dashboard.html';
    return;
  }

  const savedAdmin = localStorage.getItem('currentAdmin');
  if (savedAdmin && !sessionStorage.getItem('currentAdmin')) {
    sessionStorage.setItem('currentAdmin', savedAdmin);
  }
  const savedStudent = localStorage.getItem('currentStudent');
  if (savedStudent && !sessionStorage.getItem('currentStudent')) {
    sessionStorage.setItem('currentStudent', savedStudent);
  }

  // === AUTO-FILL REMEMBERED CREDENTIALS ===
  const loginPhoneEl = document.getElementById('loginPhone');
  const loginPasswordEl = document.getElementById('loginPassword');
  const rememberMeEl = document.getElementById('rememberMe');
  if (loginPhoneEl && loginPasswordEl) {
    const remembered = localStorage.getItem('rememberedCredentials');
    if (remembered) {
      try {
        const creds = JSON.parse(remembered);
        if (creds.phone) loginPhoneEl.value = creds.phone;
        if (creds.pwd) loginPasswordEl.value = creds.pwd;
        if (rememberMeEl) rememberMeEl.checked = true;
      } catch(e) { localStorage.removeItem('rememberedCredentials'); }
    }
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
      if (!pwd) return { score: 0, label: '—', color: '#888', percent: 0 };
      let score = 0;
      if (pwd.length >= 4) score += 1;
      if (pwd.length >= 6) score += 1;
      if (pwd.length >= 8) score += 1;
      if (/[A-Z]/.test(pwd) || /[أ-ي]/.test(pwd)) score += 1;
      if (/[0-9]/.test(pwd)) score += 1;
      if (/[!@#$%^&*?_\-+=]/.test(pwd)) score += 1;
      if (pwd.length >= 12) score += 1;
      // Map score to levels
      if (score <= 2) return { score, label: 'ضعيفة', color: '#e74c3c', percent: 25 };
      if (score <= 4) return { score, label: 'متوسطة', color: '#f1c40f', percent: 55 };
      return { score, label: 'قوية', color: '#2ecc71', percent: 100 };
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
        strengthLabel.textContent = '—';
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
          guideTitle.textContent = 'البيانات الشخصية';
          guideText.textContent = 'اكتب اسمك، ورقم موبايلك ورقم ولي الأمر بدقة لسهولة التواصل.';
        } else if (index === 1) {
          guideTitle.textContent = 'البيانات الدراسية';
          guideText.textContent = 'اختر صفك ومحافظتك ليظهر لك المنهج المخصص لك.';
        } else if (index === 2) {
          guideTitle.textContent = 'تأمين الحساب';
          guideText.textContent = 'أنشئ كلمة مرور قوية، وسيكون رقم موبايلك هو اسم المستخدم الخاص بك.';
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
        errorMsg.textContent = 'يجب إكمال جميع الحقول الشخصية قبل المتابعة.';
        errorMsg.style.display = 'block';
      }
      return false;
    }
    if (studentPhone === parentPhone) {
      if (errorMsg) {
        errorMsg.textContent = 'رقم الطالب لا يمكن أن يكون نفس رقم ولي الأمر.';
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
      showRegisterError('من فضلك اختر الصف الدراسي والمحافظة للمتابعة.');
      return false;
    }
    if (governorate === 'outside' && !foreignCountry) {
      showRegisterError('اكتب اسم الدولة عند اختيار خارج مصر.');
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
          showRegisterError('كلمة المرور غير متطابقة.');
          return;
        }
        if (!pwd || pwd.length < 6) {
          showRegisterError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
          return;
        }
        if (!phone || !governorate) {
          showRegisterError('يرجى إكمال جميع بيانات التسجيل قبل الإرسال.');
          return;
        }
        if (governorate === 'outside' && !foreignCountry) {
          showRegisterError('اكتب اسم الدولة إن اخترت خارج مصر.');
          return;
        }
        if (!firstName || !lastName || !middleName || !familyName) {
          showRegisterError('يرجى إكمال جميع الحقول الشخصية.');
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
          role: 'student',
          studentCode: (function(){
              const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
              const symbols = '@#$&*';
              const numbers = '0123456789';
              const generateCode = () => {
                  let code = '';
                  for(let i=0; i<3; i++) code += letters.charAt(Math.floor(Math.random()*letters.length));
                  for(let i=0; i<2; i++) code += symbols.charAt(Math.floor(Math.random()*symbols.length));
                  for(let i=0; i<5; i++) code += numbers.charAt(Math.floor(Math.random()*numbers.length));
                  return code.split('').sort(()=>0.5-Math.random()).join('');
              };
              let newCode;
              const existingStudents = JSON.parse(localStorage.getItem('adminStudents') || '[]');
              do {
                  newCode = generateCode();
              } while(existingStudents.some(s => s.studentCode === newCode));
              return newCode;
          })()
        };
        const email = `${userData.phone}@student.youssefbarakat.com`;
        userData.email = email;
        setButtonState(submitBtn, 'جاري إنشاء الحساب...', true);
        let finalUserData = userData;
        try {
          if (window.FirebaseService && window.FirebaseService.isReady()) {
            finalUserData = await window.FirebaseService.registerStudent(userData, pwd);
          } else {
            throw new Error('Firebase not configured');
          }
        } catch (error) {
          console.error('Registration failed:', error);
          let errorMsg = 'حدث خطأ أثناء إنشاء الحساب. تأكد من اتصالك بالإنترنت.';
          if (error.code === 'auth/email-already-in-use') {
              errorMsg = 'هذا الرقم مسجل بالفعل في قاعدة البيانات.';
          } else if (error.message) {
              errorMsg = error.message;
          }
          showRegisterError(errorMsg);
          setButtonState(submitBtn, 'إنشاء الحساب', false);
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
            window.showToast('مبروك انضمامك لأقوى منصة دراسات في مصر!\nرحلتك نحو التفوق تبدأ الآن يا بطل.', 'majestic', { title: '🎉 أهلا بك في بيتك الثاني', duration: 0, closeBtn: true, isMajestic: true });
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
        if (window.showToast) window.showToast('نموذج التسجيل مملوء جزئيا لتسهيل إتمام الحساب', 'info', { duration: 4000 });
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
    fpResendBtn.textContent = `إعادة الإرسال بعد ${remaining}s`;
    if (resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(resendTimer);
        resendTimer = null;
        fpResendBtn.disabled = false;
        fpResendBtn.style.opacity = '1';
        fpResendBtn.textContent = 'إعادة إرسال الكود';
        return;
      }
      fpResendBtn.textContent = `إعادة الإرسال بعد ${remaining}s`;
    }, 1000);
  }

  function isStrongPassword(password) {
    return typeof password === 'string' && password.length >= 8 && /[A-Zأ-ي]/.test(password) && /[0-9]/.test(password) && /[!@#\$%\^&\*\?]/.test(password);
  }

  async function createAndSendResetToken(studentPhone, parentPhone) {
    cleanupExpiredResetTokens();
    const existing = loadResetToken(studentPhone);
    const now = Date.now();
    if (existing && existing.lockUntil && now < existing.lockUntil) {
      throw new Error('لقد تم حظر محاولات الاستعادة مؤقتا. حاول في وقت لاحق.');
    }
    if (existing && existing.resendCooldownExpiresAt && now < existing.resendCooldownExpiresAt) {
      const wait = Math.ceil((existing.resendCooldownExpiresAt - now) / 1000);
      throw new Error(`انتظر ${wait} ثانية ثم أعد المحاولة.`);
    }
    if (existing && existing.requestCount >= 3 && now - existing.createdAt < 1000 * 60 * 60) {
      throw new Error('تم الوصول إلى الحد الأقصى لطلبات إعادة تعيين كلمة السر. حاول مرة أخرى بعد ساعة.');
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
          showForgotStatus('من فضلك اكتب رقم الموبايل في خانة تسجيل الدخول أولاً.', 'error');
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
          showForgotStatus('لم يتم العثور على حساب بهذا الرقم. تحقق من إدخالك.', 'error');
          return;
        }

        // Ask for parent phone via secure prompt
        const promptMsg = 'لتأكيد هويتك، الرجاء إدخال رقم هاتف ولي الأمر المسجل في حسابك:';
        const enteredParent = window.prompt(promptMsg, '');
        if (enteredParent === null) {
          // user cancelled
          return;
        }

        // Validate parent phone
        const storedParent = foundUser.parentPhone || foundUser.parent || '';
        if (!storedParent) {
          showForgotStatus('لا يوجد رقم ولي أمر مخزن لهذا الحساب. تواصل مع الدعم.', 'error');
          return;
        }
        if (!arePhonesSame(enteredParent, storedParent)) {
          window.alert('عذراً، رقم ولي الأمر غير صحيح. لا يمكن استعادة الحساب!');
          return;
        }

        // Confirm and open WhatsApp to support number
        const confirmMsg = 'تم تأكيد الهوية بنجاح. سيتم توجيهك الآن إلى الواتساب لفتح محادثة مع الدعم الفني للمنصة لإرسال كلمة المرور الجديدة لك. هل تريد المتابعة؟';
        const proceed = window.confirm(confirmMsg);
        if (!proceed) return;

        // Build message
        const studentName = foundUser.fullName || foundUser.name || foundUser.email || foundUser.phone || 'طالب';
        const studentPhone = foundUser.phone || rawId;
        const supportNumber = '201023675235';
        const msg = `مرحباً منصة يوسف بركات التعليمية، أنا الطالب: ${studentName}، ورقم هاتفي: ${studentPhone}. لقد قمت بتأكيد هويتي برقم ولي أمري بنجاح، وأريد الحصول على كلمة المرور الخاصة بحسابي لتسجيل الدخول.`;
        const url = `https://wa.me/${supportNumber}?text=${encodeURIComponent(msg)}`;
        // Use location.href to avoid popup blockers (navigate in same tab)
        window.location.href = url;

      } catch (err) {
        console.error('forgot password flow failed', err);
        showForgotStatus('حدث خطأ أثناء عملية استعادة كلمة المرور. حاول مرة أخرى لاحقاً.', 'error');
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
        setForgotButtonState('جاري إعادة الإرسال...', true);
        const matchedUser = await validateParentBinding(studentPhone, parentPhone);
        if (!matchedUser) {
          if (fpParentError) fpParentError.style.display = 'block';
          showForgotStatus('الرقم غير صحيح تأكد من رقم ولي الأمر المرتبط بالحساب 🙏', 'error');
          setForgotButtonState('إرسال الكود عبر واتساب', false);
          return;
        }
        if (fpParentError) fpParentError.style.display = 'none';
        const { otpCode } = await createAndSendResetToken(studentPhone, parentPhone);
        const formattedParent = formatEgyptPhone(parentPhone);
        const message = `كود استعادة كلمة المرور الخاص بمنصة يوسف بركات هو:%0A${otpCode}%0A%0A⚠️ لا تشارك هذا الكود مع أي شخص حفاظا على أمان حسابك.%0Aالكود صالح لمدة 10 دقائق فقط.`;
        window.open(`https://wa.me/${formattedParent}?text=${message}`, '_blank');
        showForgotStatus('تم إعادة إرسال الكود عبر واتساب. افحص رسالة ولي الأمر.', 'info');
        if (fpResendBtn) fpResendBtn.style.display = 'inline-flex';
        startResendCooldown(60);
      } catch (error) {
        showForgotStatus(error.message || 'حدث خطأ أثناء إعادة الإرسال.', 'error');
      } finally {
        setForgotButtonState('تأكيد الكود وتحديث كلمة المرور', false);
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
          setForgotButtonState('جاري إنشاء الكود...', true);
          const matchedUser = await validateParentBinding(studentPhone, parentPhone);
          if (!matchedUser) {
            if (fpParentError) fpParentError.style.display = 'block';
            showForgotStatus('الرقم غير صحيح تأكد من رقم ولي الأمر المرتبط بالحساب 🙏', 'error');
            return;
          }
          if (fpParentError) fpParentError.style.display = 'none';
          const { otpCode } = await createAndSendResetToken(studentPhone, parentPhone);
          const formattedParent = formatEgyptPhone(parentPhone);
          const message = `كود استعادة كلمة المرور الخاص بمنصة يوسف بركات هو:%0A${otpCode}%0A%0A⚠️ لا تشارك هذا الكود مع أي شخص حفاظا على أمان حسابك.%0Aالكود صالح لمدة 10 دقائق فقط.`;
          window.open(`https://wa.me/${formattedParent}?text=${message}`, '_blank');
          fpStep2.style.display = 'block';
          if (fpResendBtn) fpResendBtn.style.display = 'inline-flex';
          fpSubmitBtn.textContent = 'تأكيد الكود وتحديث كلمة المرور';
          showForgotStatus('تم إرسال الكود عبر واتساب. فضلا اكتب الكود ثم اختر كلمة مرور جديدة.', 'info');
          startResendCooldown(60);
          return;
        } catch (error) {
          showForgotStatus(error.message || 'حدث خطأ أثناء إرسال الكود.', 'error');
          return;
        } finally {
          setForgotButtonState('تأكيد الكود وتحديث كلمة المرور', false);
        }
      }
      const otpCode = otpInput?.value.trim();
      const newPassword = newPasswordInput?.value || '';
      const confirmPassword = confirmPasswordInput?.value || '';
      if (fpPasswordError) fpPasswordError.style.display = 'none';
      if (newPassword !== confirmPassword || !isStrongPassword(newPassword)) {
        if (fpPasswordError) fpPasswordError.style.display = 'block';
        showForgotStatus('كلمة المرور غير متطابقة أو ضعيفة. استخدم 8 أحرف على الأقل مع أرقام ورموز.', 'error');
        return;
      }
      try {
        setForgotButtonState('جاري التحقق...', true);
        const result = await verifyResetToken(studentPhone, otpCode);
        if (!result.valid) {
          showForgotStatus('الكود غير صحيح أو انتهت صلاحيته 🙏', 'error');
          return;
        }
        const strictUsers = JSON.parse(localStorage.getItem('strictUsers') || '[]');
        const normalizedStudent = normalizePhoneValue(studentPhone);
        const userIndex = strictUsers.findIndex(u => normalizePhoneValue(u.phone) === normalizedStudent);
        if (userIndex === -1) {
          showForgotStatus('لم يتم العثور على الحساب المرتبط بهذا الرقم.', 'error');
          return;
        }
        strictUsers[userIndex].password = newPassword;
        localStorage.setItem('strictUsers', JSON.stringify(strictUsers));
        localStorage.removeItem(`pwdReset_${normalizePhoneValue(studentPhone)}`);
        showForgotStatus('تم تغيير كلمة السر بنجاح ✅', 'info');
        if (window.showToast) window.showToast('تم تغيير كلمة السر بنجاح ✅', 'success');
        setTimeout(() => {
          if (forgotPasswordModal) forgotPasswordModal.style.display = 'none';
        }, 1200);
        forgotPasswordForm.reset();
        if (fpStep2) fpStep2.style.display = 'none';
        if (fpResendBtn) fpResendBtn.style.display = 'none';
        if (fpSubmitBtn) fpSubmitBtn.textContent = 'إرسال الكود عبر واتساب';
      } finally {
        setForgotButtonState('تأكيد الكود وتحديث كلمة المرور', false);
      }
    });
  }


  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showLoginError('');
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const rawId = document.getElementById('loginPhone')?.value.trim();
      const pwd = (document.getElementById('loginPassword')?.value || '').trim();
      const isEmailInput = rawId?.includes('@');
      const rememberMe = document.getElementById('rememberMe') ? document.getElementById('rememberMe').checked : false;
      if (!rawId || !pwd) {
        showLoginError('من فضلك اكتب رقم الموبايل أو البريد الإلكتروني وكلمة المرور.');
        return;
      }
      setButtonState(submitBtn, 'جاري تسجيل الدخول...', true);
      try {
        const checkId = rawId.toLowerCase();
        
        // STUDENT PREVIEW BYPASS
        if ((rawId === '0000' && pwd === '0000') || (rawId === '01099616091' && pwd === '0000')) {
          const fakeStudent = {
            name: 'حساب الفحص السريع',
            phone: rawId,
            grade: '3',
            password: pwd,
            timestamp: new Date().toISOString()
          };
          sessionStorage.setItem('currentStudent', JSON.stringify(fakeStudent));
          sessionStorage.setItem('pfJustLoggedIn', 'true');
          if (rememberMe) {
            localStorage.setItem('rememberedCredentials', JSON.stringify({ phone: rawId, pwd }));
            localStorage.setItem('currentStudent', JSON.stringify(fakeStudent));
          } else {
            localStorage.removeItem('rememberedCredentials');
          }
          window.location.href = 'dashboard.html';
          return;
        }
        
        
        // ASSISTANT DASHBOARD BYPASS
        if (checkId === 'mariamassistant@gmail.com' && pwd === '01023675235') {
            const assistantAdmin = {
                id: 'admin_assistant_001',
                name: 'مريم عباس (مساعدة)',
                email: 'mariamassistant@gmail.com',
                password: '01023675235',
                role: 'assistant'
            };
            
            try {
                sessionStorage.setItem('currentAdmin', JSON.stringify(assistantAdmin));
            } catch(e) {}
            
            if (rememberMe) {
                try { localStorage.setItem('rememberedCredentials', JSON.stringify({ phone: rawId, pwd })); } catch(e){}
                try { localStorage.setItem('currentAdmin', JSON.stringify(assistantAdmin)); } catch(e){}
            } else {
                localStorage.removeItem('rememberedCredentials');
            }
            
            if (window.showToast) window.showToast('أهلاً بكِ أستاذة مريم في لوحة التحكم.', 'success', { title: 'مرحباً', duration: 1500 });
            setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 1500);
            return;
        }
        
        // ADMIN DASHBOARD BYPASS
        if ((checkId === 'youssefbarkatofficial@gmail.com' && pwd === 'YoussefMBarakat175235') || 
            (checkId === 'youssef@barakat.com' && pwd === 'YoussefMBarakat175235')) {
          const ownerAdmin = {
            id: 'admin_001',
            name: 'يوسف محمد بركات',
            email: 'youssefbarkatofficial@gmail.com',
            password: 'YoussefMBarakat175235',
            role: 'admin'
          };
          
          try {
            sessionStorage.setItem('currentAdmin', JSON.stringify(ownerAdmin));
          } catch(e) { console.warn("Admin session save failed", e); }
          
          if (rememberMe) {
            try { localStorage.setItem('rememberedCredentials', JSON.stringify({ phone: rawId, pwd })); } catch(e){}
            try { localStorage.setItem('currentAdmin', JSON.stringify(ownerAdmin)); } catch(e){}
            try {
              let savedAccounts = JSON.parse(localStorage.getItem('savedLocalAccounts') || '[]');
              savedAccounts = savedAccounts.filter(a => a.phone !== rawId);
              savedAccounts.push({ phone: rawId, pwd, name: 'المالك - الإدارة' });
              localStorage.setItem('savedLocalAccounts', JSON.stringify(savedAccounts));
            } catch(e){}
          } else {
            localStorage.removeItem('rememberedCredentials');
          }
          
          if (window.showToast) window.showToast('أهلا بك يا صانع المجد في مملكتك.\nمنصتك جاهزة لإبداعك اليومي.', 'majestic', { title: '👑 مرحبا بك يا أستاذ يوسف', duration: 1500 });
          setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 1500);
          return;
        } else if (rawId === 'youssefda3m@gmail.com' && pwd === 'Da3mYoussef@36') {
          const supportStudent = {
            name: 'الدعم الفني',
            email: 'youssefda3m@gmail.com',
            phone: 'support_000',
            grade: 'prep2',
            role: 'student',
            isTestAccount: true
          };
          sessionStorage.setItem('currentStudent', JSON.stringify(supportStudent));
          sessionStorage.setItem('pfJustLoggedIn', 'true');
          if (rememberMe) {
            localStorage.setItem('rememberedCredentials', JSON.stringify({ phone: rawId, pwd }));
            localStorage.setItem('currentStudent', JSON.stringify(supportStudent));
            let savedAccounts = JSON.parse(localStorage.getItem('savedLocalAccounts') || '[]');
            savedAccounts = savedAccounts.filter(a => a.phone !== rawId);
            savedAccounts.push({ phone: rawId, pwd, name: 'الدعم الفني' });
            localStorage.setItem('savedLocalAccounts', JSON.stringify(savedAccounts));
          } else {
            localStorage.removeItem('rememberedCredentials');
          }
          if (typeof window.pfTransferGuestSupportSessionToAccount === 'function') {
            window.pfTransferGuestSupportSessionToAccount(supportStudent);
          }
          if (window.showToast) window.showToast('تم تسجيل الدخول بحساب الدعم الفني التجريبي.', 'info');
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
          return;
        }
        const phone = rawId;
        const email = isEmailInput ? rawId : `${phone}@student.youssefbarakat.com`;
        if (window.FirebaseService && window.FirebaseService.isReady()) {
          try {
              const user = await window.FirebaseService.loginStudent(phone, pwd);
              if (user && user.role === 'student') {
                if (!user.studentCode) {
                    user.studentCode = (function(){
                        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
                        const symbols = '@#$&*';
                        const numbers = '0123456789';
                        const generateCode = () => {
                            let code = '';
                            for(let i=0; i<3; i++) code += letters.charAt(Math.floor(Math.random()*letters.length));
                            for(let i=0; i<2; i++) code += symbols.charAt(Math.floor(Math.random()*symbols.length));
                            for(let i=0; i<5; i++) code += numbers.charAt(Math.floor(Math.random()*numbers.length));
                            return code.split('').sort(()=>0.5-Math.random()).join('');
                        };
                        let newCode;
                        const existingStudents = JSON.parse(localStorage.getItem('adminStudents') || '[]');
                        do {
                            newCode = generateCode();
                        } while(existingStudents.some(s => s.studentCode === newCode));
                        return newCode;
                    })();
                    if (window.FirebaseService.updateStudentData) {
                        window.FirebaseService.updateStudentData(user.phone, { studentCode: user.studentCode });
                    }
                }
                try {
                    localStorage.setItem(`db_${user.phone}`, JSON.stringify(user));
                } catch(e) {
                    console.warn("Quota exceeded for db_", e);
                }
                
                if (window.PlatformStorage && user.lastUpdatedAcademicYear) {
                  const state = window.PlatformStorage.getStoredState(user.phone);
                  window.PlatformStorage.saveState(user.phone, { ...state, lastUpdatedYear: user.lastUpdatedAcademicYear, promotionCompleted: true, grade: user.grade || state.grade });
                }
                
                const safeSetStudent = (storageObj, key, userData) => {
                    try {
                        storageObj.setItem(key, JSON.stringify(userData));
                    } catch(e) {
                        console.warn(`Quota exceeded for ${key}, trimming data...`);
                        let slimUser = {...userData};
                        if (slimUser.notifications) slimUser.notifications = slimUser.notifications.slice(-10);
                        if (slimUser.examResults) slimUser.examResults = slimUser.examResults.slice(-20);
                        if (slimUser.image && slimUser.image.length > 100000) slimUser.image = 'img/default-avatar.png';
                        if (slimUser.recentLectures) slimUser.recentLectures = slimUser.recentLectures.slice(-5);
                        try { storageObj.setItem(key, JSON.stringify(slimUser)); } catch(e2) { console.error("Still exceeding quota!", e2); }
                    }
                };

                safeSetStudent(sessionStorage, 'currentStudent', user);
                sessionStorage.setItem('pfJustLoggedIn', 'true');
                if (rememberMe) {
                  localStorage.setItem('rememberedCredentials', JSON.stringify({ phone: rawId, pwd }));
                  safeSetStudent(localStorage, 'currentStudent', user);
                } else {
                  localStorage.removeItem('rememberedCredentials');
                }
                if (typeof window.pfTransferGuestSupportSessionToAccount === 'function') {
                  window.pfTransferGuestSupportSessionToAccount(user);
                }
                try { if (window.audioManager && window.audioManager.play) window.audioManager.play('login'); } catch(e) {}
                window.location.href = 'dashboard.html';
                return;
              } else if (user && user.role !== 'student') {
                showLoginError('هذا الحساب غير مخصص للطلاب.');
                setButtonState(submitBtn, 'تسجيل الدخول', false);
                return;
              }
          } catch(error) {
              console.warn('Firebase login rejected, trying rescue layer:', error);
              if (window.BousalaPhoneFix) {
                  const rescue = await window.BousalaPhoneFix.rescueLogin(phone, pwd);
                  if (rescue.ok) {
                      const rescuedUser = await window.FirebaseService.getStudentByPhone(rescue.normPhone);
                      if (rescuedUser && rescuedUser.role === 'student') {
                          if (!rescuedUser.studentCode) {
                              rescuedUser.studentCode = (function(){
                                  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
                                  const symbols = '@#$&*';
                                  const numbers = '0123456789';
                                  const generateCode = () => {
                                      let code = '';
                                      for(let i=0; i<3; i++) code += letters.charAt(Math.floor(Math.random()*letters.length));
                                      for(let i=0; i<2; i++) code += symbols.charAt(Math.floor(Math.random()*symbols.length));
                                      for(let i=0; i<5; i++) code += numbers.charAt(Math.floor(Math.random()*numbers.length));
                                      return code.split('').sort(()=>0.5-Math.random()).join('');
                                  };
                                  let newCode;
                                  const existingStudents = JSON.parse(localStorage.getItem('adminStudents') || '[]');
                                  do {
                                      newCode = generateCode();
                                  } while(existingStudents.some(s => s.studentCode === newCode));
                                  return newCode;
                              })();
                              if (window.FirebaseService.updateStudentData) {
                                  window.FirebaseService.updateStudentData(rescuedUser.phone, { studentCode: rescuedUser.studentCode });
                              }
                          }
                          try {
                              localStorage.setItem(`db_${rescuedUser.phone}`, JSON.stringify(rescuedUser));
                          } catch(e) { console.warn("Quota exceeded db_"); }
                          
                          if (window.PlatformStorage && rescuedUser.lastUpdatedAcademicYear) {
                            const state = window.PlatformStorage.getStoredState(rescuedUser.phone);
                            window.PlatformStorage.saveState(rescuedUser.phone, { ...state, lastUpdatedYear: rescuedUser.lastUpdatedAcademicYear, promotionCompleted: true, grade: rescuedUser.grade || state.grade });
                          }
                          const safeSet = (storageObj, key, userData) => {
                              try { storageObj.setItem(key, JSON.stringify(userData)); } catch(e) {
                                  let slim = {...userData};
        if (slim.email && ['mariamassistant@gmail.com', 'youssefbarakatofficial@gmail.com'].includes(slim.email.toLowerCase())) {
            slim.isStaff = true;
        }
                                  if (slim.notifications) slim.notifications = slim.notifications.slice(-10);
                                  if (slim.examResults) slim.examResults = slim.examResults.slice(-20);
                                  if (slim.image && slim.image.length > 100000) slim.image = 'img/default-avatar.png';
                                  try { storageObj.setItem(key, JSON.stringify(slim)); } catch(e2) {}
                              }
                          };
                          safeSet(sessionStorage, 'currentStudent', rescuedUser);
                          sessionStorage.setItem('pfJustLoggedIn', 'true');
                          if (rememberMe) {
                            localStorage.setItem('rememberedCredentials', JSON.stringify({ phone: rawId, pwd }));
                            safeSet(localStorage, 'currentStudent', rescuedUser);
                          } else {
                            localStorage.removeItem('rememberedCredentials');
                          }
                          if (typeof window.pfTransferGuestSupportSessionToAccount === 'function') {
                              window.pfTransferGuestSupportSessionToAccount(rescuedUser);
                          }
                          try { if (window.audioManager && window.audioManager.play) window.audioManager.play('login'); } catch(e) {}
                          window.location.href = 'dashboard.html';
                          return;
                      } else {
                          showLoginError("تم الدخول بنجاح ولكن تعذر جلب بيانات الطالب أو الحساب ليس لطالب.");
                          setButtonState(submitBtn, 'تسجيل الدخول', false);
                          return;
                      }
                  } else {
                      showLoginError(rescue.msg);
                      setButtonState(submitBtn, 'تسجيل الدخول', false);
                      return;
                  }
              }

              let userMsg = 'حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة لاحقاً.';
              if (error.code === 'custom/user-not-found' || error.code === 'auth/user-not-found') {
                  userMsg = 'هذا الحساب غير مسجل على المنصة، اضغط إنشاء حساب جديد للدخول';
              } else if (error.code === 'auth/invalid-email' || error.code === 'auth/invalid-credential') {
                  userMsg = 'كلمة المرور غير صحيحة. يرجى التأكد والمحاولة مرة أخرى.';
              } else if (error.code === 'auth/wrong-password') {
                  userMsg = 'كلمة المرور التي أدخلتها خاطئة. الرجاء التأكد منها والمحاولة مجدداً.';
              } else if (error.code === 'auth/too-many-requests') {
                  userMsg = 'لقد حاولت الدخول مرات كثيرة جداً. يرجى الانتظار قليلاً ثم المحاولة.';
              } else if (error.code === 'auth/network-request-failed') {
                  userMsg = 'يوجد مشكلة في اتصالك بالإنترنت. يرجى التأكد من اتصالك والمحاولة مرة أخرى.';
              } else if (error.message) {
                  userMsg = error.message;
              }
              showLoginError(userMsg);
              setButtonState(submitBtn, 'تسجيل الدخول', false);
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
          if (rememberMe) {
            localStorage.setItem('rememberedCredentials', JSON.stringify({ phone: rawId, pwd }));
            localStorage.setItem('currentStudent', JSON.stringify(user));
          } else {
            localStorage.removeItem('rememberedCredentials');
          }
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
            let userMsg = 'حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة لاحقاً.';
            if (error.code === 'custom/user-not-found' || error.code === 'auth/user-not-found') {
                userMsg = 'هذا الحساب غير مسجل على المنصة، اضغط إنشاء حساب جديد للدخول';
            } else if (error.code === 'auth/invalid-email' || error.code === 'auth/invalid-credential') {
                userMsg = 'كلمة المرور غير صحيحة. يرجى التأكد والمحاولة مرة أخرى.';
            } else if (error.code === 'auth/wrong-password') {
                userMsg = 'كلمة المرور التي أدخلتها خاطئة. الرجاء التأكد منها والمحاولة مجدداً.';
            } else if (error.code === 'auth/too-many-requests') {
                userMsg = 'لقد حاولت الدخول مرات كثيرة جداً. يرجى الانتظار قليلاً ثم المحاولة.';
            } else if (error.code === 'auth/network-request-failed') {
                userMsg = 'تأكد من اتصالك بالإنترنت وحاول مرة أخرى.';
            } else if (error.message && error.message.includes('تم مسح هذا الحساب')) {
                userMsg = error.message;
            }
            showLoginError(userMsg);
            return;
        }

        showLoginError('لم يتم العثور على حساب بهذا الرقم أو البريد الإلكتروني. يمكنك إنشاء حساب جديد.');
        return;
      } finally {
        setButtonState(submitBtn, 'تسجيل الدخول', false);
      }
    });
  }

  const govSelect = document.getElementById('governorate');
  const foreignCountryGroup = document.getElementById('foreignCountryGroup');
  const foreignCountryInput = document.getElementById('foreignCountry');
  if (govSelect) {
    const govs = ['الإسكندرية', 'الإسماعيلية', 'الأقصر', 'البحر الأحمر', 'البحيرة', 'الجيزة', 'الدقهلية', 'السويس', 'الشرقية', 'الغربية', 'الفيوم', 'القاهرة', 'القليوبية', 'المنوفية', 'المنيا', 'الوادي الجديد', 'أسوان', 'أسيوط', 'بني سويف', 'بورسعيد', 'جنوب سيناء', 'دمياط', 'سوهاج', 'شمال سيناء', 'قنا', 'كفر الشيخ', 'مطروح'];
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

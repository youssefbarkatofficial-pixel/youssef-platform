document.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  const userStr = sessionStorage.getItem('currentStudent');
  const isDashboardPage = window.location.pathname.includes('dashboard.html') && !window.location.pathname.includes('admin-dashboard.html');
  
  if(!userStr && isDashboardPage) {
    window.location.href = 'index.html';
    return;
  }
  
  if(userStr) {
    const user = JSON.parse(userStr);
    const userNameEl = document.getElementById('userNameDisplay');
    const userGradeEl = document.getElementById('userGradeDisplay');
    
    if(userNameEl) userNameEl.textContent = user.name;
    if(userGradeEl) {
        const grades = {
            'prep1': 'الصف الأول الإعدادي',
            'prep2': 'الصف الثاني الإعدادي',
            'prep3': 'الصف الثالث الإعدادي',
            'sec1': 'الصف الأول الثانوي'
        };
        userGradeEl.textContent = grades[user.grade] || 'طالب';
    }

    // Load Profile Picture if exists
    const avatarImg = document.getElementById('userAvatarImg');
    let profilePic = localStorage.getItem(`profilePic_${user.phone}`);
    if (!profilePic && window.FirebaseService && typeof window.FirebaseService.getUser === 'function') {
        try {
            const remoteUser = await window.FirebaseService.getUser(user.phone);
            profilePic = remoteUser?.profilePic;
            if (profilePic) {
                localStorage.setItem(`profilePic_${user.phone}`, profilePic);
            }
        } catch (e) {
            console.warn('Failed to fetch profile picture from Firebase', e);
        }
    }
    if (profilePic && avatarImg) {
        avatarImg.src = profilePic;
    }

    // Fetch Real Data from DB/LocalStorage
    let dbUser = JSON.parse(localStorage.getItem(`db_${user.phone}`)) || {
        stats: { commitment: 0, videosWatched: 0, homeworkCompleted: 0, homeworkTotal: 0 },
        courses: [],
        notifications: []
    };
    
    try {
        if (window.FirebaseService && typeof window.FirebaseService.getUser === 'function') {
            const onlineUser = await window.FirebaseService.getUser(user.phone);
            if (onlineUser) {
                dbUser = Object.assign(dbUser, onlineUser);
                localStorage.setItem(`db_${user.phone}`, JSON.stringify(dbUser));
            }
        }
    } catch(e) { console.warn('Failed to fetch user from Firebase', e); }

    if (!dbUser.stats) {
        dbUser.stats = { commitment: 0, videosWatched: 0, homeworkCompleted: 0, homeworkTotal: 0 };
    }

    // Update Stats
    const statCommitment = document.getElementById('statCommitment');
    const statVideosWatched = document.getElementById('statVideosWatched');
    const statHomework = document.getElementById('statHomework');
    if(statCommitment) statCommitment.textContent = `${dbUser.stats.commitment}%`;
    if(statVideosWatched) statVideosWatched.textContent = dbUser.stats.videosWatched;
    if(statHomework) statHomework.textContent = `${dbUser.stats.homeworkCompleted}/${dbUser.stats.homeworkTotal}`;

    // Update Courses Progress (My Courses)
    const coursesProgressContainer = document.getElementById('coursesProgressContainer');
    const coursesEmptyState = document.getElementById('coursesEmptyState');
    if(coursesProgressContainer && coursesEmptyState) {
        if(dbUser.courses && dbUser.courses.length > 0) {
            coursesProgressContainer.style.display = 'grid';
            coursesEmptyState.style.display = 'none';
            
            let adminCourses = JSON.parse(localStorage.getItem('adminCourses')) || [];
            try {
                if (window.FirebaseService && typeof window.FirebaseService.getCourses === 'function') {
                    const onlineCourses = await window.FirebaseService.getCourses();
                    if (onlineCourses && onlineCourses.length > 0) {
                        adminCourses = onlineCourses;
                        localStorage.setItem('adminCourses', JSON.stringify(adminCourses));
                    }
                }
            } catch(e) {}

            coursesProgressContainer.innerHTML = '';
            
            dbUser.courses.forEach(cId => {
                const c = adminCourses.find(course => course.id === cId);
                if(c) {
                    const card = document.createElement('div');
                    card.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; border: 1px solid var(--border-color);';
                    card.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <img src="${c.image}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">
                            <div>
                                <h4 style="color: var(--text-primary); margin-bottom: 5px;">${c.title}</h4>
                                <span class="badge" style="background: rgba(88, 196, 221, 0.2); color: var(--accent-cyan); font-size: 0.8rem;">${c.grade === 'prep1' ? 'أولى إعدادي' : c.grade === 'prep2' ? 'تانية إعدادي' : c.grade === 'prep3' ? 'تالتة إعدادي' : 'أولى ثانوي'}</span>
                            </div>
                        </div>
                        <a href="course-details.html?id=${c.id}" class="btn btn-green" style="padding: 8px 15px; font-size: 0.9rem;">دخول الكورس</a>
                    `;
                    coursesProgressContainer.appendChild(card);
                }
            });
            
        } else {
            coursesProgressContainer.style.display = 'none';
            coursesEmptyState.style.display = 'block';
        }
    }

    // Update Notifications
    const notificationsContainer = document.getElementById('notificationsContainer');
    const notificationsEmptyState = document.getElementById('notificationsEmptyState');
    const viewAllTasksBtn = document.getElementById('viewAllTasksBtn');
    if(notificationsContainer && notificationsEmptyState) {
        if(dbUser.notifications && dbUser.notifications.length > 0) {
            notificationsContainer.style.display = 'block';
            notificationsEmptyState.style.display = 'none';
            if(viewAllTasksBtn) viewAllTasksBtn.style.display = 'block';
            // Render notifications dynamically here
            notificationsContainer.innerHTML = '';
            const notifs = (dbUser.notifications || []).slice().reverse(); // newest first
            notifs.forEach(n => {
              const item = document.createElement('div');
              item.className = 'notification-item';
              item.style.cssText = 'padding:12px; border-bottom:1px solid rgba(255,255,255,0.03); cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:12px;';
              const left = document.createElement('div');
              left.style.cssText = 'flex:1;';
              left.innerHTML = `<div style="font-weight:700;color:var(--text-primary)">${n.title || 'إشعار جديد'}</div><div style="font-size:0.9rem;color:var(--text-secondary);margin-top:4px;">${n.message || ''}</div>`;
              const right = document.createElement('div');
              right.innerHTML = `<small style="color:var(--text-secondary);font-size:0.8rem;">${n.timestamp ? new Date(n.timestamp).toLocaleString() : ''}</small>`;
              item.appendChild(left);
              item.appendChild(right);
              item.addEventListener('click', (e) => {
                e.preventDefault();
                try { if (window.audioManager) window.audioManager.play('whatsapp'); } catch(e){}
                
                if (!n.read) {
                    n.read = true;
                    let u = JSON.parse(localStorage.getItem(`db_${user.phone}`)) || dbUser;
                    u.notifications = dbUser.notifications;
                    localStorage.setItem(`db_${user.phone}`, JSON.stringify(u));
                    if (window.FirebaseService && window.FirebaseService.updateStudentData) {
                        window.FirebaseService.updateStudentData(user.phone, { notifications: dbUser.notifications }).catch(e=>console.error(e));
                    }
                }

                if (n.courseId) {
                  try { if (window.triggerConfetti) window.triggerConfetti(); } catch(e){}
                  try { if (window.showToast) window.showToast('تهانينا! تم تفعيل كورسك. توجه الآن لمحتوى الكورس.', 'majestic', { title: '🎉 مبروك!', duration: 4500, isMajestic: true, playSound: 'celebration' }); } catch(e){}
                  try { 
                      if (!localStorage.getItem('has_celebrated_' + n.courseId)) {
                          sessionStorage.setItem('celebrate_course_' + n.courseId, '1'); 
                          localStorage.setItem('has_celebrated_' + n.courseId, '1');
                      }
                  } catch(e){}
                  window.location.href = `courses.html?highlight=${encodeURIComponent(n.courseId)}`;
                } else {
                  try { if (window.showToast) window.showToast(n.message || 'تم استلام الإشعار', 'success', { playSound: 'notifArrive' }); } catch(e){}
                }
              });
              notificationsContainer.appendChild(item);
            });
        } else {
            notificationsContainer.style.display = 'none';
            notificationsEmptyState.style.display = 'block';
            if(viewAllTasksBtn) viewAllTasksBtn.style.display = 'none';
        }
    }
  }

  // Sidebar active state
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.sidebar-nav a');
  navLinks.forEach(link => {
    // Basic match for active state
    if(link.getAttribute('href') && currentPath.includes(link.getAttribute('href')) && link.getAttribute('href') !== '#') {
      link.classList.add('active');
    }
  });

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sessionStorage.removeItem('currentStudent');
      localStorage.removeItem('currentStudent');
      window.location.href = 'index.html';
    });
  }

  // Course Filtering
  const filterBtns = document.querySelectorAll('.filter-btn');
  const courses = document.querySelectorAll('.course-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all
      filterBtns.forEach(b => b.classList.remove('active'));
      // Add active to current
      btn.classList.add('active');
      
      const filterValue = btn.getAttribute('data-filter');
      
      courses.forEach(course => {
        if(filterValue === 'all' || course.getAttribute('data-grade') === filterValue) {
          course.style.display = 'flex';
          // Add small animation
          course.style.animation = 'fadeIn 0.5s ease forwards';
        } else {
          course.style.display = 'none';
        }
      });
    });
  });

  // Payment Modal Logic
  const payMethods = document.querySelectorAll('.pay-method');
  payMethods.forEach(method => {
    method.addEventListener('click', () => {
      payMethods.forEach(m => m.classList.remove('active'));
      method.classList.add('active');
      
      // Update details view based on selected method
      const type = method.getAttribute('data-type');
      document.getElementById('vodafoneDetails').style.display = type === 'vodafone' ? 'block' : 'none';
      document.getElementById('fawryDetails').style.display = type === 'fawry' ? 'block' : 'none';
    });
  });

  // Copy to clipboard
  const copyBtns = document.querySelectorAll('.copy-btn');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const text = document.getElementById(targetId).innerText;
      navigator.clipboard.writeText(text).then(() => {
        if(window.showToast) window.showToast('تم النسخ بنجاح!');
        
        // Change icon temporarily
        const icon = btn.querySelector('i');
        icon.classList.replace('fa-copy', 'fa-check');
        setTimeout(() => {
          icon.classList.replace('fa-check', 'fa-copy');
        }, 2000);
      });
    });
  });

  function readImageFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        return reject('لا يوجد ملف لاستخدامه.');
      }
      if (!file.type.startsWith('image/')) {
        return reject('يجب رفع صورة بصيغة صحيحة.');
      }

      const maxBytes = 4 * 1024 * 1024;
      const reader = new FileReader();
      reader.onerror = () => reject('فشل قراءة الصورة. حاول مرة أخرى.');
      reader.onabort = () => reject('تم إيقاف قراءة الصورة.');
      reader.onload = () => {
        const dataUrl = reader.result;
        if (file.size <= maxBytes) {
          return resolve(dataUrl);
        }

        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > width && height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          } else if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject('تعذر معالجة الصورة.');
          }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (!blob) {
              return reject('فشل ضغط الصورة. حاول بحجم أقل.');
            }
            const reader2 = new FileReader();
            reader2.onerror = () => reject('فشل تحويل الصورة بعد الضغط.');
            reader2.onload = () => resolve(reader2.result);
            reader2.readAsDataURL(blob);
          }, 'image/jpeg', 0.8);
        };
        img.onerror = () => reject('تعذر فتح الصورة للضغط. حاول رفع صورة أخرى.');
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  function openPaymentProofDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('platformPaymentDB', 1);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('paymentProofs')) {
          db.createObjectStore('paymentProofs', { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject('فشل فتح تخزين الصور. حاول مرة أخرى.');
    });
  }

  async function savePaymentProofImage(key, dataUrl) {
    const db = await openPaymentProofDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('paymentProofs', 'readwrite');
      const store = tx.objectStore('paymentProofs');
      const req = store.put({ key, dataUrl });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject('فشل حفظ صورة التحويل. حاول رفع صورة أصغر.');
    });
  }

  async function getPaymentProofImage(key) {
    if (!key) return null;
    const db = await openPaymentProofDB();
    return new Promise((resolve) => {
      const tx = db.transaction('paymentProofs', 'readonly');
      const store = tx.objectStore('paymentProofs');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.dataUrl : null);
      req.onerror = () => resolve(null);
    });
  }

  function getPaymentModalElements() {
    const modal = document.getElementById('paymentModal');
    const proofInput = document.getElementById('paymentProofImage');
    const confirmBtn = document.getElementById('confirmPayment');
    return { modal, proofInput, confirmBtn };
  }

  async function submitPaymentRequest() {
    const { modal, proofInput, confirmBtn } = getPaymentModalElements();
    if (window._submittingPayment) return;
    window._submittingPayment = true;
    
    if (!proofInput || !proofInput.files || proofInput.files.length === 0) {
      if(window.showToast) window.showToast('رجاءاً قم برفع صورة التحويل أولاً', 'error');
      else alert('رجاءاً قم برفع صورة التحويل أولاً');
      window._submittingPayment = false;
      return;
    }

    const courseId = modal ? modal.getAttribute('data-course-id') : null;
    if (!courseId) {
      if(window.showToast) window.showToast('حدث خطأ في تحديد الكورس. أعد فتح النافذة وحاول مرة أخرى.', 'error');
      else alert('حدث خطأ في تحديد الكورس. أعد فتح النافذة وحاول مرة أخرى.');
      window._submittingPayment = false;
      return;
    }

    if (confirmBtn) confirmBtn.disabled = true;
    const originalText = confirmBtn ? confirmBtn.innerHTML : 'استمرار';
    if (confirmBtn) confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إرسال الطلب...';

    try {
      console.log('[PAYMENT SUBMIT START]');
      const file = proofInput.files[0];
      const proofImageBase64 = await readImageFileAsDataUrl(file);

      const userStr = sessionStorage.getItem('currentStudent');
      const user = userStr ? JSON.parse(userStr) : { name: 'زائر', phone: 'غير معروف' };

      const proofImageKey = 'proof_' + Date.now() + '_' + encodeURIComponent(user.phone);
      await savePaymentProofImage(proofImageKey, proofImageBase64);

      let courseName = 'غير معروف';
      const cTitleEl = document.querySelector(`.course-card[data-course-id="${courseId}"] .course-title`);
      if (cTitleEl) courseName = cTitleEl.innerText;

      const requestData = {
        courseId: courseId,
        courseName: courseName,
        userId: user.phone,
        userName: user.name,
        userPhone: user.phone,
        userEmail: user.email || `${user.phone}@student.youssefbarakat.com`,
        proofImageKey: proofImageKey,
        proofImage: proofImageBase64
      };

      console.log('[PAYMENT DATA]', requestData);

      if (window.FirebaseService && typeof window.FirebaseService.addPaymentRequest === 'function') {
          const result = await window.FirebaseService.addPaymentRequest(requestData);
          if (result && result.success) {
              console.log('[FIRESTORE WRITE SUCCESS]');
              if (window.showToast) window.showToast('تم إرسال طلب الاشتراك بنجاح، بانتظار موافقة الأدمن', 'success');
              
              const pModal = document.getElementById('paymentModal');
              if (pModal) pModal.style.display = 'none';

              const courseCardBtn = document.querySelector(`.course-card[data-course-id="${courseId}"] .btn-subscribe`) || document.querySelector(`.btn-subscribe[onclick*="${courseId}"]`);
              if (courseCardBtn) {
                  courseCardBtn.innerText = 'قيد مراجعة الطلب';
                  courseCardBtn.disabled = true;
                  courseCardBtn.style.backgroundColor = '#64748b';
                  courseCardBtn.style.color = '#fff';
                  courseCardBtn.style.cursor = 'not-allowed';
                  courseCardBtn.style.pointerEvents = 'none';
              }
          } else {
              console.error(result ? result.error : 'Unknown error');
              if (window.showToast) window.showToast('تعذر الاتصال بالسحابة. تم حفظ طلبك محلياً مؤقتاً.', 'error');
          }
      } else {
          if (window.showToast) window.showToast('خدمة قاعدة البيانات غير متوفرة حالياً.', 'error');
      }

    } catch (error) {
      const message = typeof error === 'string' ? error : (error?.message || 'حدث خطأ أثناء رفع الصورة.');
      if(window.showToast) window.showToast(message, 'error');
      else alert(message);
    } finally {
      if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = originalText;
      }
      window._submittingPayment = false;
    }
  }

  window.submitPaymentRequest = submitPaymentRequest;

  const confirmPayBtn = document.getElementById('confirmPayment');
  if(confirmPayBtn) {
    confirmPayBtn.addEventListener('click', (event) => {
      event.preventDefault();
      submitPaymentRequest();
    });
  }
  

  // Open Payment Modal (Fallback if courses-renderer.js isn't handling it)
  const subscribeBtns = document.querySelectorAll('.btn-subscribe');
  subscribeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = document.getElementById('paymentModal');
      if(modal) modal.classList.add('active');
    });
  });
});

// Sidebar toggle logic moved to mobile.js

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  const userStr = sessionStorage.getItem('currentStudent') || localStorage.getItem('currentStudent');
  const isDashboardPage = window.location.pathname.includes('dashboard.html') && !window.location.pathname.includes('admin-dashboard.html');
  
  if(!userStr && isDashboardPage) {
    window.location.href = 'index.html';
    return;
  }
  
    if(userStr) {
      const user = JSON.parse(userStr);
      const userNameEl = document.getElementById('userNameDisplay');
      const userGradeEl = document.getElementById('userGradeDisplay');
      const userCodeEl = document.getElementById('userCodeDisplay');
      
      if(userNameEl) userNameEl.textContent = user.name;
      if(userCodeEl && user.studentCode) userCodeEl.textContent = user.studentCode;
      
      // Auto-sync failed local payments
      setTimeout(async () => {
          if (!window.FirebaseService || !window.FirebaseService.addPaymentRequest) return;
          let localReqs = JSON.parse(localStorage.getItem('paymentRequests')) || [];
          let hasSynced = false;
          for (let r of localReqs) {
              if (String(r.id).startsWith('local_') && (r.status === 'pending' || !r.status) && (r.userId === user.phone || r.userPhone === user.phone)) {
                  try {
                      // Attempt to send again without the image (since it failed last time)
                      let fallbackReq = { ...r };
                      delete fallbackReq.proofImage;
                      fallbackReq.proofImageKey = 'failed_upload_fallback';
                      const res = await window.FirebaseService.addPaymentRequest(fallbackReq);
                      if (res && res.success) {
                          r.id = res.id;
                          r.status = 'pending';
                          hasSynced = true;
                      }
                  } catch (e) { console.warn('Background payment sync failed:', e); }
              }
          }
          if (hasSynced) {
              localStorage.setItem('paymentRequests', JSON.stringify(localReqs));
          }
      }, 3000);
      
      if(userGradeEl) {
          // استخدام الدوال المشتركة من main.js للحصول على المرحلة الفعلية المحدّثة
          const effectiveGrade = (window.getEffectiveStudentGrade && window.getGradeLabel)
              ? window.getGradeLabel(window.getEffectiveStudentGrade(user))
              : (user.grade || 'طالب');
          userGradeEl.textContent = effectiveGrade || 'طالب';

      // Load Leaderboard
      loadLeaderboard(effectiveGrade || user.grade);
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

    let totalVideosWatched = 0;
    let totalExamsCompleted = 0;
    let sumExamScores = 0;
    let examsCountForAvg = 0;

    let adminCourses = JSON.parse(localStorage.getItem('adminCourses')) || [];

    let totalHomeworksCompleted = 0;
    
    if (dbUser.examResults) {
        const uniqueExams = {};
        dbUser.examResults.forEach(r => {
            const key = `${r.courseId}_${r.examTitle}`;
            if (!uniqueExams[key]) uniqueExams[key] = [];
            uniqueExams[key].push(r);
        });

        Object.values(uniqueExams).forEach(results => {
            const official = results.find(r => r.isOfficial || r.attemptNumber === 1) || results[0];
            // To properly distinguish, we check if it is a homework based on course structure,
            // but as a fallback, if the title contains 'واجب' or 'تدريب' we count it as homework.
            const title = official.examTitle || official.title || '';
            if (title.includes('واجب') || title.includes('تدريب')) {
                totalHomeworksCompleted++;
            } else {
                totalExamsCompleted++;
                sumExamScores += (official.effectivePercent || official.percent);
                examsCountForAvg++;
            }
        });
    }

    if (dbUser.progress) {
        Object.keys(dbUser.progress).forEach(courseId => {
            const course = adminCourses.find(c => c.id == courseId);
            const done = dbUser.progress[courseId].done || [];
            if (course && course.sections) {
                course.sections.forEach(sec => {
                    if (sec.items) {
                        sec.items.forEach(item => {
                            if (done.includes(item.id) && item.type === 'video') {
                                totalVideosWatched++;
                            }
                        });
                    }
                });
            }
        });
    }

    const commitmentPct = examsCountForAvg > 0 ? Math.round(sumExamScores / examsCountForAvg) : 0; // Using avg score as commitment for now or you can calculate completion %

    const statCommitment = document.getElementById('statCommitment');
    const statVideosWatched = document.getElementById('statVideosWatched');
    const statHomework = document.getElementById('statHomework');
    const statExams = document.getElementById('statExams');
    
    if(statCommitment) statCommitment.textContent = `${commitmentPct}%`;
    if(statVideosWatched) statVideosWatched.textContent = totalVideosWatched;
    if(statHomework) statHomework.textContent = `${totalHomeworksCompleted}`;
    if(statExams) statExams.textContent = `${totalExamsCompleted}`;

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
                        if (typeof window.safeStorageSaveCourses === 'function') {
                            window.safeStorageSaveCourses(adminCourses);
                        } else {
                            try { localStorage.setItem('adminCourses', JSON.stringify(adminCourses)); } catch(e) {}
                        }
                    }
                }
            } catch(e) {}

            if (window.StorageService) {
                for (let c of adminCourses) {
                    if (c.image && c.image.startsWith('__local__')) {
                        try {
                            const img = await window.StorageService.getFile(c.image);
                            c.image = img || 'https://via.placeholder.com/400x250/071326/D4A64F?text=Course';
                        } catch(e) {}
                    }
                }
            }

            coursesProgressContainer.innerHTML = '';
            
            dbUser.courses.forEach(cId => {
                const c = adminCourses.find(course => course.id === cId);
                if(c) {
                    const card = document.createElement('div');
                    card.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; border: 1px solid var(--border-color);';
                    card.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 60px; height: 60px; overflow: hidden; border-radius: 8px; flex-shrink: 0; background: var(--secondary-navy, #0a1e3a);">
                                <img src="${c.image}" style="width: 100%; height: 100%; object-fit: cover; object-position: center; display: block;">
                            </div>
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

    // Update Homeworks and Exams Progress (Recent Tasks)
    const homeworksContainer = document.getElementById('homeworksProgressContainer');
    const homeworksEmpty = document.getElementById('homeworksEmptyState');
    const examsContainer = document.getElementById('examsProgressContainer');
    const examsEmpty = document.getElementById('examsEmptyState');

    if (dbUser.examResults && dbUser.examResults.length > 0) {
        let recentHomeworks = [];
        let recentExams = [];
        
        // Filter unique by courseId + examTitle, get most recent attempt
        const uniqueResults = {};
        dbUser.examResults.forEach(r => {
            const key = `${r.courseId}_${r.examTitle}`;
            if (!uniqueResults[key] || r.ts > uniqueResults[key].ts) {
                uniqueResults[key] = r;
            }
        });

        Object.values(uniqueResults).sort((a,b) => b.ts - a.ts).forEach(r => {
            const title = r.examTitle || r.title || '';
            if (title.includes('واجب') || title.includes('تدريب')) {
                recentHomeworks.push(r);
            } else {
                recentExams.push(r);
            }
        });

        // Render Homeworks (limit to 3)
        if (homeworksContainer && homeworksEmpty) {
            if (recentHomeworks.length > 0) {
                homeworksContainer.style.display = 'grid';
                homeworksEmpty.style.display = 'none';
                homeworksContainer.innerHTML = '';
                recentHomeworks.slice(0, 3).forEach(hw => {
                    const card = document.createElement('div');
                    card.style.cssText = 'background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;';
                    card.innerHTML = `
                        <div>
                            <h4 style="color: var(--text-primary); margin-bottom: 5px;">${hw.examTitle}</h4>
                            <span style="color: var(--accent-cyan); font-size: 0.85rem;">الدرجة: ${hw.percent}%</span>
                        </div>
                        <a href="homeworks.html" class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;">عرض</a>
                    `;
                    homeworksContainer.appendChild(card);
                });
            } else {
                homeworksContainer.style.display = 'none';
                homeworksEmpty.style.display = 'block';
            }
        }

        // Render Exams (limit to 3)
        if (examsContainer && examsEmpty) {
            if (recentExams.length > 0) {
                examsContainer.style.display = 'grid';
                examsEmpty.style.display = 'none';
                examsContainer.innerHTML = '';
                recentExams.slice(0, 3).forEach(ex => {
                    const card = document.createElement('div');
                    card.style.cssText = 'background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;';
                    card.innerHTML = `
                        <div>
                            <h4 style="color: var(--text-primary); margin-bottom: 5px;">${ex.examTitle}</h4>
                            <span style="color: var(--accent-cyan); font-size: 0.85rem;">الدرجة: ${ex.percent}%</span>
                        </div>
                        <a href="exams.html?openExam=${encodeURIComponent(ex.examTitle)}" class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;">النتيجة</a>
                    `;
                    examsContainer.appendChild(card);
                });
            } else {
                examsContainer.style.display = 'none';
                examsEmpty.style.display = 'block';
            }
        }
    } else {
        if (homeworksContainer && homeworksEmpty) {
            homeworksContainer.style.display = 'none';
            homeworksEmpty.style.display = 'block';
        }
        if (examsContainer && examsEmpty) {
            examsContainer.style.display = 'none';
            examsEmpty.style.display = 'block';
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
              item.style.cssText = `padding:12px; border-bottom:1px solid rgba(255,255,255,0.03); cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:12px; border-right: 3px solid ${n.read ? 'transparent' : 'var(--accent-cyan)'}; transition: all 0.3s;`;
              item.setAttribute('data-timestamp', n.timestamp || '');
              const left = document.createElement('div');
              left.style.cssText = 'flex:1;';
              left.innerHTML = `<div style="font-weight:700;color:var(--text-primary)">${n.title || 'إشعار جديد'}</div><div style="font-size:0.9rem;color:var(--text-secondary);margin-top:4px;">${n.message || ''}</div>`;
              const right = document.createElement('div');
              right.innerHTML = `<small style="color:var(--text-secondary);font-size:0.8rem;">${n.timestamp ? new Date(n.timestamp).toLocaleString() : ''}</small>`;
              item.appendChild(left);
              item.appendChild(right);
              
              window.addEventListener('notificationRead', (ev) => {
                  if (ev.detail === n.timestamp) {
                      n.read = true;
                      item.style.borderRight = '3px solid transparent';
                  }
              });

              item.addEventListener('click', (e) => {
                e.preventDefault();
                // No click sound - sound plays only on notification arrival
                
                if (!n.read) {
                    n.read = true;
                    item.style.borderRight = '3px solid transparent';
                    window.dispatchEvent(new CustomEvent('notificationRead', { detail: n.timestamp }));
                    let u = JSON.parse(localStorage.getItem(`db_${user.phone}`)) || dbUser;
                    u.notifications = dbUser.notifications;
                    localStorage.setItem(`db_${user.phone}`, JSON.stringify(u));
                    if (window.FirebaseService && window.FirebaseService.updateStudentData) {
                        window.FirebaseService.updateStudentData(user.phone, { notifications: dbUser.notifications }).catch(e=>console.error(e));
                    }
                }

                if (n.courseId) {
                  const isPositive = n.title && (n.title.includes('قبول') || n.title.includes('تفعيل') || n.title.includes('مبروك') || n.title.includes('نجاح'));
                  
                  if (isPositive) {
                      try { 
                          if (!localStorage.getItem('has_celebrated_' + n.courseId)) {
                              if (window.triggerConfetti) window.triggerConfetti();
                              if (window.showToast) window.showToast('تهانينا! تم تفعيل كورسك. توجه الآن لمحتوى الكورس.', 'majestic', { title: '🎉 مبروك!', duration: 4500, isMajestic: true, playSound: 'celebration' });
                              sessionStorage.setItem('celebrate_course_' + n.courseId, '1'); 
                              localStorage.setItem('has_celebrated_' + n.courseId, '1');
                          }
                      } catch(e){}
                  } else {
                      // Negative or generic notification
                      try { if (window.showToast) window.showToast(n.message || 'يرجى مراجعة حالة الكورس', n.title && n.title.includes('مشكلة') ? 'error' : 'info'); } catch(e){}
                  }
                  
                  setTimeout(() => {
                      window.location.href = `courses.html?highlight=${encodeURIComponent(n.courseId)}`;
                  }, isPositive ? 1500 : 500);
                } else if (n.link) {
                  if (n.link === 'exams.html' && n.title && n.title.includes('تصحيح') && n.message) {
                      const match = n.message.match(/"([^"]+)"/);
                      if (match && match[1]) {
                          window.location.href = `exams.html?openExam=${encodeURIComponent(match[1])}`;
                      } else {
                          window.location.href = n.link;
                      }
                  } else {
                      window.location.href = n.link;
                  }
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
      if (!file) return reject('لا يوجد ملف لاستخدامه.');
      if (!file.type.startsWith('image/')) return reject('يجب رفع صورة بصيغة صحيحة.');

      const maxBytes = 500 * 1024; // 500 KB to fit within Firestore 1MB limit safely
      const objectUrl = URL.createObjectURL(file);
      
      const img = new Image();
      img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject('تعذر فتح الصورة للضغط. حاول رفع صورة أخرى.');
      };
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        
        let maxDim = 800; // Smaller dimension for aggressive compression
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
        if (!ctx) return reject('تعذر معالجة الصورة.');
        
        ctx.drawImage(img, 0, 0, width, height);
        
        let quality = 0.6;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Force compression loop to guarantee < 500KB
        while (dataUrl.length > maxBytes && quality > 0.1) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        
        resolve(dataUrl);
      };
      
      img.src = objectUrl;
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

      const userStr = sessionStorage.getItem('currentStudent') || localStorage.getItem('currentStudent');
      const user = userStr ? JSON.parse(userStr) : { name: 'زائر', phone: 'غير معروف' };

      const proofImageKey = 'proof_' + Date.now() + '_' + encodeURIComponent(user.phone);
      await savePaymentProofImage(proofImageKey, proofImageBase64);

      // Upload to Firebase Storage is disabled because it hangs for unauthenticated students.
      // The image is already compressed to <500KB, so it is safe to send directly to Firestore.
      let proofImageUrl = null;
              console.log('[UPLOAD] Image uploaded to Storage:', proofImageUrl);




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
        proofImageUrl: proofImageUrl,
        proofImage: proofImageBase64 // Compressed <500KB image sent directly to Firestore
      };

      console.log('[PAYMENT DATA]', requestData);

      if (window.FirebaseService && typeof window.FirebaseService.addPaymentRequest === 'function') {
          const result = await window.FirebaseService.addPaymentRequest(requestData);
          if (result && result.success) {
              console.log('[FIRESTORE WRITE SUCCESS]');
              if (window.showToast) window.showToast('تم إرسال طلب الاشتراك بنجاح، بانتظار موافقة الأدمن', 'success');
              
              // Save locally for UI persistence
              let localRequests = JSON.parse(localStorage.getItem('paymentRequests')) || [];
              
              // Cancel previous pending requests for this course by this student
              localRequests.forEach(r => {
                  if (r.id !== result.id && r.courseId === courseId && (r.userId === user.phone || r.userPhone === user.phone) && r.status === 'pending') {
                      r.status = 'cancelled';
                      if (window.FirebaseService && window.FirebaseService.updatePaymentStatus && r.id) {
                          window.FirebaseService.updatePaymentStatus(r.id, 'cancelled').catch(e => console.warn(e));
                      }
                  }
              });

              let savedReq = { ...requestData, status: 'pending', id: result.id || Date.now() };
              delete savedReq.proofImage; // Remove huge base64 image to prevent quota error
              localRequests.push(savedReq);
              try { localStorage.setItem('paymentRequests', JSON.stringify(localRequests)); } catch(e) { console.error('LocalStorage quota error on paymentRequests', e); }

              const pModal = document.getElementById('paymentModal');
              if (pModal) pModal.classList.remove('active');

              // Update in course-details.html
              const actionContainer = document.getElementById('cdActionBtnContainer');
              if (actionContainer) {
                  actionContainer.innerHTML = `<button class="btn btn-outline" style="color:var(--accent-orange); border-color:var(--accent-orange);" onclick="showPendingMessageDetails()"><i class="fas fa-clock mr-2"></i> طلبك قيد المراجعة</button>`;
              }

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
              if (window.showToast) window.showToast('تعذر الاتصال بالسحابة نهائياً. تم حفظ طلبك محلياً مؤقتاً.', 'error');
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


// --- LEADERBOARD LOGIC ---
async function loadLeaderboard(currentGrade) {
    const container = document.getElementById('leaderboardContainer');
    if (!container) return;

    try {
        let students = [];
        if (window.FirebaseService && typeof window.FirebaseService.getStudents === 'function') {
            students = await window.FirebaseService.getStudents();
        } else {
            students = JSON.parse(localStorage.getItem('strictUsers') || '[]');
        }

        // Filter by grade
        const sameGrade = students.filter(s => {
            const sGrade = (window.getEffectiveStudentGrade && window.getGradeLabel) 
                ? window.getGradeLabel(window.getEffectiveStudentGrade(s)) 
                : (s.grade || '');
            return sGrade === currentGrade && s.role !== 'admin';
        });

        // Calculate score
        sameGrade.forEach(s => {
            let score = 0;
            if (s.stats) {
                score += (s.stats.homeworkCompleted || 0) * 10;
                score += (s.stats.videosWatched || 0) * 5;
                score += (s.stats.commitment || 0);
            }
            if (s.gameXp) {
                score += s.gameXp;
            }
            s._leaderboardScore = score;
            
            // Assign Rank from Compass Game
            const RANKS = [
                { name: 'مستكشف ناشئ', minXp: 0 },
                { name: 'رحّالة مبتدئ', minXp: 200 },
                { name: 'قارئ الخرائط', minXp: 500 },
                { name: 'مستكشف الطرق', minXp: 1000 },
                { name: 'حامل البوصلة', minXp: 2000 },
                { name: 'كاشف الآثار', minXp: 3500 },
                { name: 'مؤرخ الحضارات', minXp: 6000 },
                { name: 'قائد الرحلات', minXp: 10000 },
                { name: 'سيد المسارات', minXp: 16000 },
                { name: 'حارس الأطالس', minXp: 25000 },
                { name: 'وريث البوصلة', minXp: 38000 },
                { name: 'أسطورة الحضارات', minXp: 55000 },
                { name: 'سيد القارات', minXp: 80000 },
                { name: 'حارس البوصلة الأعظم', minXp: Infinity }
            ];
            
            let rankObj = RANKS[0];
            for(let i=0; i<RANKS.length; i++){
                if(score >= RANKS[i].minXp && score < (RANKS[i+1]?.minXp || Infinity)) {
                    rankObj = RANKS[i];
                    break;
                }
            }
            s._rankName = rankObj.name;
        });

        // Sort descending
        sameGrade.sort((a, b) => b._leaderboardScore - a._leaderboardScore);
        
        // Take top 5
        const topStudents = sameGrade.slice(0, 5);

        if (topStudents.length === 0) {
            container.innerHTML = '<div style="text-align: center; width: 100%; padding: 20px; color: #94A3B8;">لا يوجد طلاب في لوحة الشرف بعد</div>';
            return;
        }

        let html = '';
        topStudents.forEach((student, index) => {
            let rankIcon = index === 0 ? '<i class="fas fa-crown" style="color: gold; font-size: 1.5rem; margin-bottom: 5px;"></i>' :
                           index === 1 ? '<i class="fas fa-medal" style="color: silver; font-size: 1.2rem; margin-bottom: 5px;"></i>' :
                           index === 2 ? '<i class="fas fa-medal" style="color: #cd7f32; font-size: 1.2rem; margin-bottom: 5px;"></i>' :
                           '<div style="font-weight: bold; font-size: 1.2rem; margin-bottom: 5px; color: #94A3B8;">#' + (index + 1) + '</div>';
            
            const avatar = student.profilePic || 'https://via.placeholder.com/80/071326/D4A64F?text=' + (student.name ? student.name.charAt(0) : '?');

            html += `
                <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(212,175,55,0.3); border-radius: 15px; padding: 15px; min-width: 120px; text-align: center; display: flex; flex-direction: column; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    ${rankIcon}
                    <img src="${avatar}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; border: 2px solid var(--royal-gold);">
                    <div style="font-weight: bold; font-size: 0.9rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">${student.name || 'طالب مجهول'}</div>
                    <div style="font-size: 0.75rem; color: #D4A64F; margin-top: 3px; font-weight: bold;">${student._rankName}</div>
                    <div style="font-size: 0.8rem; color: var(--accent-cyan); margin-top: 5px;">${student._leaderboardScore} نقطة</div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch(err) {
        console.error('Error loading leaderboard:', err);
        container.innerHTML = '<div style="text-align: center; width: 100%; padding: 20px; color: #ef4444;">حدث خطأ في تحميل لوحة الشرف</div>';
    }
}

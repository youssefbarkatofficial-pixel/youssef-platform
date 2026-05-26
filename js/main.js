document.addEventListener('DOMContentLoaded', () => {
  // --- Global Safety Check: Auto-logout deleted accounts ---
  const checkStudentStr = sessionStorage.getItem('currentStudent') || localStorage.getItem('currentStudent');
  if (checkStudentStr && !window.location.pathname.includes('admin-')) {
      try {
          const sObj = JSON.parse(checkStudentStr);
          setTimeout(async () => {
              if (window.firebaseDb) {
                  try {
                      // If user doesn't exist in DB anymore, kick them out
                      const doc = await window.firebaseDb.collection('students').doc(sObj.phone || sObj.uid).get();
                      if (!doc.exists) {
                          sessionStorage.removeItem('currentStudent');
                          localStorage.removeItem('currentStudent');
                          let accs = JSON.parse(localStorage.getItem('savedLocalAccounts') || '[]');
                          accs = accs.filter(a => a.phone !== sObj.phone);
                          localStorage.setItem('savedLocalAccounts', JSON.stringify(accs));
                          if (!window.location.pathname.includes('index.html')) {
                              window.location.href = 'index.html';
                          } else {
                              window.location.reload();
                          }
                      }
                  } catch(e) {}
              }
          }, 2000); // wait for firebase to initialize
      } catch(e) {}
  }

  // Navbar Scroll Effect
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (!navbar) return;
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // Dynamic Dashboard Link Visibility
  const dashboardLinks = document.querySelectorAll('.nav-links a[href="dashboard.html"]');
  dashboardLinks.forEach(link => {
      if (sessionStorage.getItem('currentAdmin')) {
          link.href = 'admin-dashboard.html';
      } else if (sessionStorage.getItem('currentStudent')) {
          link.href = 'dashboard.html';
      } else {
          if (link.parentElement && link.parentElement.tagName.toLowerCase() === 'li') {
              link.parentElement.style.display = 'none';
          } else {
              link.style.display = 'none';
          }
      }
  });

  // Mobile Menu & Sidebar Toggle with Click-Outside
  document.body.addEventListener('click', (e) => {
    const mobileBtn = e.target.closest('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    const sidebar = document.querySelector('.sidebar');
    
    if (mobileBtn) {
        if (window.audioManager) window.audioManager.play('menuOpen');
        if (navLinks) navLinks.classList.toggle('active');
        if (sidebar) sidebar.classList.toggle('active');
    } else {
        // Close if clicked outside
        if (navLinks && navLinks.classList.contains('active') && !e.target.closest('.nav-links')) {
            navLinks.classList.remove('active');
        }
        if (sidebar && sidebar.classList.contains('active') && !e.target.closest('.sidebar') && !e.target.closest('.mobile-menu-btn')) {
            sidebar.classList.remove('active');
        }
    }
  });

  // Login Modal Toggle
  const loginBtns = document.querySelectorAll('.open-login');
  const loginModal = document.getElementById('loginModal');
  const closeModal = document.querySelector('.close-modal');

  loginBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if(loginModal) loginModal.classList.add('active');
    });
  });

  if(closeModal && loginModal) {
    closeModal.addEventListener('click', () => {
      loginModal.classList.remove('active');
    });
    loginModal.addEventListener('click', (e) => {
      if(e.target === loginModal) loginModal.classList.remove('active');
    });
  }
    try { window.showStudentWelcomeToast = showStudentWelcomeToast; } catch(e) {}
    // Expose globally in case auth.js runs before this file's function scope
    try { window.showStudentWelcomeToast = showStudentWelcomeToast; } catch (e) {}

  // Dark/Light Mode Toggle (Optional enhancement)
  const themeToggle = document.getElementById('themeToggle');

  function updateThemeIcon() {
    if (!themeToggle) return;
    const icon = themeToggle.querySelector('i');
    if (!icon) return;
    if (document.body.classList.contains('light-mode')) {
      icon.classList.remove('fa-moon');
      icon.classList.add('fa-sun');
    } else {
      icon.classList.remove('fa-sun');
      icon.classList.add('fa-moon');
    }
  }

  function setThemeMode(mode) {
    if (mode === 'light') {
      document.body.classList.add('light-mode');
      localStorage.setItem('siteTheme', 'light');
    } else {
      document.body.classList.remove('light-mode');
      localStorage.setItem('siteTheme', 'dark');
    }
    updateThemeIcon();
  }

  function loadStoredTheme() {
    const stored = localStorage.getItem('siteTheme');
    if (stored === 'light') return 'light';
    if (stored === 'dark') return 'dark';
    const student = sessionStorage.getItem('currentStudent');
    if (student) {
      try {
        const prefs = JSON.parse(localStorage.getItem(`prefs_${JSON.parse(student).phone}`) || '{}');
        if (prefs.lightMode) return 'light';
      } catch (e) {}
    }
    return 'dark';
  }

  if (themeToggle) {
    setThemeMode(loadStoredTheme());
    themeToggle.addEventListener('click', (e) => {
      e.preventDefault();
      setThemeMode(document.body.classList.contains('light-mode') ? 'dark' : 'light');
    });
  } else {
    setThemeMode(loadStoredTheme());
  }

  // Feature Nodes Positioning (Home Page)
  const features = document.querySelectorAll('.feature-node');
  function updateFeatureNodes() {
    if (features.length === 0) return;
    const total = features.length;
    let radius = 250;
    if (window.innerWidth <= 992 && window.innerWidth > 480) {
        radius = 180;
    } else if (window.innerWidth <= 480) {
        radius = 120; // smaller radius for phones
    }
    features.forEach((node, index) => {
      const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      node.style.setProperty('--tx', `${x}px`);
      node.style.setProperty('--ty', `${y}px`);
    });
  }
  updateFeatureNodes();
  window.addEventListener('resize', updateFeatureNodes);

  // Enhanced Toast Notifications System
  window.showToast = function(message, type = 'success', options = {}) {
    const {
        duration = 3000, 
        title = '', 
        closeBtn = false,
        isMajestic = false
    } = options;

    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} ${isMajestic ? 'toast-majestic' : ''}`;
    
    let html = `
      <div class="toast-icon">
        <i class="fas ${type === 'success' ? 'fa-check-circle' : (type === 'majestic' ? 'fa-crown' : 'fa-info-circle')}"></i>
      </div>
      <div class="toast-content" style="flex: 1;">
        ${title ? `<h4 style="margin-bottom: 5px; color: var(--royal-gold);">${title}</h4>` : ''}
        <div style="line-height: 1.5; word-wrap: break-word; white-space: pre-wrap;">${message}</div>
      </div>
    `;

    if (closeBtn || duration === 0) {
        html += `<button class="toast-close" style="background:none; border:none; color: var(--text-secondary); cursor: pointer; font-size: 1.2rem; padding: 0 5px;"><i class="fas fa-times"></i></button>`;
    }

    toast.innerHTML = html;
    
    // Close button logic
    const closeEl = toast.querySelector('.toast-close');
    if (closeEl) {
        closeEl.addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
    }

    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    if (duration > 0) {
        setTimeout(() => {
          if(toast.parentElement) {
              toast.classList.remove('show');
              setTimeout(() => toast.remove(), 300);
          }
        }, duration);
    }
    // play optional sound for this toast
    try {
        if (options && options.playSound && window.audioManager && window.audioManager.play) {
            window.audioManager.play(options.playSound);
        }
    } catch (e) { console.warn('play toast sound failed', e); }
  };

  function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 15px;
      max-width: 400px;
      width: 90%;
    `;
    document.body.appendChild(container);
    
    // Add toast styles dynamically
    const style = document.createElement('style');
    style.textContent = `
      .toast {
        background: var(--glass-bg);
        backdrop-filter: blur(10px);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        padding: 15px 20px;
        border-radius: 10px;
        display: flex;
        align-items: flex-start;
        gap: 15px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        transform: translateX(-150%);
        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .toast.show {
        transform: translateX(0);
      }
      .toast-icon {
        color: var(--accent-cyan);
        font-size: 1.5rem;
        margin-top: 2px;
      }
      .toast-success .toast-icon { color: #2ecc71; }
      
      /* Majestic Toast for Owner and Big Celebrations */
      .toast-majestic {
        background: linear-gradient(135deg, var(--primary-navy), #0a192f);
        border: 2px solid var(--royal-gold);
        box-shadow: 0 10px 30px rgba(212, 166, 79, 0.2);
        padding: 20px 25px;
      }
      .toast-majestic .toast-icon {
        color: var(--royal-gold);
        font-size: 2rem;
        animation: pulseGold 2s infinite;
      }
      
      @keyframes pulseGold {
        0% { filter: drop-shadow(0 0 5px rgba(212,166,79,0.5)); transform: scale(1); }
        50% { filter: drop-shadow(0 0 15px rgba(212,166,79,0.9)); transform: scale(1.1); }
        100% { filter: drop-shadow(0 0 5px rgba(212,166,79,0.5)); transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
    
    return container;
  }

  // Confetti Animation System
  window.triggerConfetti = function() {
    if (!window.confetti) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
        script.onload = () => launchConfetti();
        document.head.appendChild(script);
    } else {
        launchConfetti();
    }
  };

  function launchConfetti() {
    try { if (window.audioManager) window.audioManager.play('fireworks'); } catch(e){}
    var duration = 4000;
    var end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#d4a64f', '#ffffff', '#00bcd4'],
            zIndex: 10001
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#d4a64f', '#ffffff', '#00bcd4'],
            zIndex: 10001
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
  }

    // Fireworks-style celebration (stronger side bursts + paper confetti + sound)
    window.triggerFireworks = function(duration = 4500) {
        // Play fireworks audio with custom fading (starts fading after 1s)
        try { 
            if (window.audioManager && window.audioManager.sounds.fireworks && !window.audioManager.muted) {
                const fwSound = window.audioManager.sounds.fireworks.cloneNode();
                fwSound.volume = window.audioManager.sounds.fireworks.volume || 0.6;
                fwSound.play().catch(e => {});
                
                setTimeout(() => {
                    const step = fwSound.volume / 20;
                    const fadeInterval = setInterval(() => {
                        if (fwSound.volume > step) {
                            fwSound.volume -= step;
                        } else {
                            fwSound.volume = 0;
                            fwSound.pause();
                            clearInterval(fadeInterval);
                        }
                    }, 100); // 20 steps * 100ms = 2 seconds fading
                }, 1000);
            } else if (window.audioManager) {
                window.audioManager.play('fireworks'); // fallback if sounds.fireworks doesn't exist
            }
        } catch(e){}

        // DOM-based paper confetti emitter (for a more paper-like float)
        function spawnPaperFireworks(side = 'left', count = 20) {
            if (!document.getElementById('paper-fireworks-container')) {
                const cont = document.createElement('div');
                cont.id = 'paper-fireworks-container';
                cont.style.cssText = 'position:fixed; left:0; top:0; width:100%; height:100%; pointer-events:none; overflow:visible; z-index:10002;';
                document.body.appendChild(cont);
            }
            const container = document.getElementById('paper-fireworks-container');
            const colors = ['#d4a64f','#f1c40f','#e74c3c','#00bcd4','#ffffff','#ff6b6b','#ffd166'];
            for (let i=0;i<count;i++) {
                const el = document.createElement('div');
                const size = 8 + Math.floor(Math.random()*12);
                el.style.width = size + 'px';
                el.style.height = Math.max(6, Math.floor(size*0.7)) + 'px';
                el.style.background = colors[Math.floor(Math.random()*colors.length)];
                el.style.position = 'fixed';
                el.style.zIndex = 10002;
                el.style.left = side === 'left' ? '6%' : '94%';
                el.style.top = (20 + Math.random()*50) + '%';
                el.style.borderRadius = (Math.random() > 0.6) ? '3px' : '0px';
                el.style.transform = `rotate(${Math.floor(Math.random()*360)}deg)`;
                el.style.opacity = '0.95';
                container.appendChild(el);

                const horizontal = (side === 'left' ? (30 + Math.random()*50) : -(30 + Math.random()*50));
                const vertical = 60 + Math.random()*40; // vh downward
                const rotateTo = (Math.random()*720 - 360);
                const durationMs = 1600 + Math.random()*1600;

                el.animate([
                    { transform: `translateX(0px) translateY(0px) rotate(${Math.floor(Math.random()*360)}deg)`, opacity: 1 },
                    { transform: `translateX(${horizontal}vw) translateY(${vertical}vh) rotate(${rotateTo}deg)`, opacity: 0.05 }
                ], { duration: durationMs, easing: 'cubic-bezier(.16,.72,.28,1)', fill: 'forwards' });

                // remove after animation
                setTimeout(() => { try { el.remove(); } catch(e){} }, durationMs + 80);
            }
        }

        const run = () => {
            const end = Date.now() + duration;
            const colors = ['#d4a64f', '#f1c40f', '#e74c3c', '#00bcd4', '#ffffff'];
            (function frame() {
                confetti({ particleCount: 12, angle: 60, spread: 50, origin: { x: 0, y: 0.7 }, colors, zIndex: 10001 });
                confetti({ particleCount: 12, angle: 120, spread: 50, origin: { x: 1, y: 0.7 }, colors, zIndex: 10001 });
                confetti({ particleCount: 6, angle: 90, spread: 100, origin: { x: 0.5, y: 0.2 }, colors, zIndex: 10001 });
                // floaty paper-like confetti using canvas for added depth
                confetti({ particleCount: 8, angle: 50, spread: 45, origin: { x: 0, y: 0.6 }, colors, gravity: 0.25, scalar: 0.9, decay: 0.98, zIndex: 10001 });
                confetti({ particleCount: 8, angle: 130, spread: 45, origin: { x: 1, y: 0.6 }, colors, gravity: 0.25, scalar: 0.9, decay: 0.98, zIndex: 10001 });
                if (Date.now() < end) requestAnimationFrame(frame);
            }());

            // spawn DOM paper confetti from both sides
            spawnPaperFireworks('left', 18);
            spawnPaperFireworks('right', 18);
        };

        if (!window.confetti) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
            script.onload = run;
            document.head.appendChild(script);
        } else run();
    };

  // --- Premium Audio Manager ---
  window.audioManager = {
      muted: localStorage.getItem('globalSoundMuted') === 'true',
      sounds: {
          click: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'),
          menuOpen: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
          notifOpen: new Audio('https://assets.mixkit.co/active_storage/sfx/1114/1114-preview.mp3'),
          notifArrive: new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'), // Simple mobile text message ping
          whatsapp: new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'), // Simple mobile text message ping
          success: new Audio('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3'), // Soft success chime
          login: new Audio('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3'), // Alias to success
          celebration: new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'), // Gentle magic sweep
          welcomeStudent: new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'), // Gentle magic sweep
          welcomeAdmin: new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3')
      },
      init() {
          // Pre-configure volumes
          this.sounds.click.volume = 0.2;
          this.sounds.menuOpen.volume = 0.3;
          this.sounds.notifOpen.volume = 0.3;
          this.sounds.notifArrive.volume = 0.75;
          this.sounds.success.volume = 0.4;
          this.sounds.login.volume = 0.4;
          this.sounds.celebration.volume = 0.5;
          this.sounds.welcomeStudent.volume = 0.4;
          this.sounds.welcomeAdmin.volume = 0.6;
          try { this.sounds.fireworks = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'); this.sounds.fireworks.volume = 0.3; } catch(e){}
      },
      play(soundName) {
          // Check user specific mute settings dynamically
          let muted = false;
          let userStr = sessionStorage.getItem('currentStudent');
          if (userStr) {
              let user = JSON.parse(userStr);
              let prefs = JSON.parse(localStorage.getItem(`prefs_${user.phone}`) || '{"sound":true,"globalSound":true}');
              if (soundName === 'notifArrive' || soundName === 'notifOpen') {
                  muted = (prefs.sound === false);
              } else {
                  muted = (prefs.globalSound === false);
              }
          } else {
              // Admin or guest fallback
              let adminStr = sessionStorage.getItem('currentAdmin');
              if(adminStr) {
                  let prefs = JSON.parse(localStorage.getItem('adminPrefs') || '{"sound":true,"globalSound":true}');
                  if (soundName === 'notifArrive' || soundName === 'notifOpen') muted = (prefs.sound === false);
                  else muted = (prefs.globalSound === false);
              } else {
                 muted = localStorage.getItem('globalSoundMuted') === 'true';
              }
          }
          if (muted) return;
          // Special-case: fireworks - prefer real audio, fallback to synth
          if (soundName === 'fireworks') {
              const sf = this.sounds.fireworks;
              if (sf) {
                  try { const clone = sf.cloneNode(); clone.volume = sf.volume; clone.play().catch(e=>{}); } catch(e) {}
              }
              return;
          }

          const sound = this.sounds[soundName];
          if (sound) {
              // Clone the node to allow rapid overlapping plays without cutting off (for clicks)
              const clone = sound.cloneNode();
              clone.volume = sound.volume;
              clone.play().catch(e => console.warn('Audio play prevented:', e));
          }
      },
      // Synth fallback for fireworks: small layered noise bursts via WebAudio
      playFireworksSynth() {
          try {
              if (!window.AudioContext && !window.webkitAudioContext) return;
              const Ctx = window.AudioContext || window.webkitAudioContext;
              const ctx = new Ctx();
              // create a short burst of noise + filtered tones
              const master = ctx.createGain();
              master.gain.value = 0.6;
              master.connect(ctx.destination);

              for (let i = 0; i < 3; i++) {
                  const o = ctx.createOscillator();
                  o.type = ['sine','triangle','sawtooth'][i%3];
                  o.frequency.value = 300 + Math.random()*800;
                  const g = ctx.createGain();
                  g.gain.value = 0.0001;
                  o.connect(g);
                  g.connect(master);
                  const now = ctx.currentTime + i*0.03;
                  g.gain.setValueAtTime(0.0001, now);
                  g.gain.exponentialRampToValueAtTime(0.6, now + 0.02);
                  g.gain.exponentialRampToValueAtTime(0.001, now + 0.6 + Math.random()*0.6);
                  o.start(now);
                  o.stop(now + 1.2);
              }

              // short noise burst
              const bufferSize = ctx.sampleRate * 1.2;
              const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
              const data = buffer.getChannelData(0);
              for (let i = 0; i < bufferSize; i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
              const noise = ctx.createBufferSource();
              noise.buffer = buffer;
              const nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 800;
              const ng = ctx.createGain(); ng.gain.value = 0.8;
              noise.connect(nf); nf.connect(ng); ng.connect(master);
              noise.start(ctx.currentTime + 0.06);
              noise.stop(ctx.currentTime + 0.9);

              try { window.__fireworksAudioPlayed = true; } catch(e){}
          } catch (e) {
              console.warn('fireworks synth failed', e);
          }
      },
      playStudentWelcome() {
          this.play('welcomeStudent');
      },
      playAdminWelcome() {
          this.play('welcomeAdmin');
      },
      playApproval() {
          this.play('celebration');
      },
      toggleMute() {
          let isMuted = localStorage.getItem('globalSoundMuted') === 'true';
          localStorage.setItem('globalSoundMuted', !isMuted);
          return !isMuted;
      }
  };
  window.audioManager.init();

  // Replace legacy playSafeSound
  window.playSafeSound = function(src, volume) {
      if (localStorage.getItem('globalSoundMuted') === 'true') return;
      try {
          let audio = new Audio(src);
          audio.volume = volume || 0.5;
          audio.play().catch(e => {});
      } catch(e) {}
  };

  // Fancy student welcome toast (styled to match owner toast)
  function showStudentWelcomeToast(firstName) {
      try {
          // Determine current student identifier to respect dismissal
          let studentStr = sessionStorage.getItem('currentStudent') || localStorage.getItem('currentStudent') || null;
          let identifier = 'guest';
          if (studentStr) {
              try { const s = JSON.parse(studentStr); identifier = s.phone || s.email || (s.name ? s.name.replace(/\s+/g,'_') : 'student'); } catch(e) {}
          }
          // If student already dismissed welcome, skip showing
          if (identifier && localStorage.getItem(`welcomeDismissed_${identifier}`) === 'true') return;

          // تشغيل صوت الدخول إن وُجد
          try { if (window.audioManager && window.audioManager.play) window.audioManager.play('login'); } catch(e) { console.warn('play login failed', e); }

          const container = document.createElement('div');
          container.id = 'student-welcome-toast-element';
          container.style.cssText = 'position:fixed; bottom:20px; left:20px; z-index:99999;';
          container.innerHTML = `
              <div style="display:flex; align-items:center; gap:12px; background:linear-gradient(135deg,#0b1120,#1e293b); color:#ffffff; border-right:4px solid #fbbf24; padding:16px 24px; border-radius:8px; box-shadow:0 8px 20px rgba(0,0,0,0.4); font-family:'Adelle Sans ARA Semibold',sans-serif; font-size:15px; position:relative;">
                  <div style="flex:1"><span>أهلاً بك يا <strong style=\"color:#fbbf24; font-size:17px;\">${firstName}</strong> في منصتك 🎓</span></div>
                  <button id="student-welcome-close" aria-label="إغلاق" style="background:transparent;border:none;color:#ffffff;font-size:18px;cursor:pointer;padding:4px 8px;">✕</button>
              </div>
          `;
          document.body.appendChild(container);

          const closeBtn = document.getElementById('student-welcome-close');
          const removeToast = (persist=true) => {
              const el = document.getElementById('student-welcome-toast-element');
              if (!el) return;
              el.style.opacity = '0';
              setTimeout(() => { try { el.remove(); } catch(e) {} }, 300);
              if (persist && identifier) {
                  try { localStorage.setItem(`welcomeDismissed_${identifier}`, 'true'); } catch(e) {}
              }
          };

          if (closeBtn) {
              closeBtn.addEventListener('click', (e) => {
                  e.preventDefault();
                  removeToast(true);
              });
          }

          // Auto-hide after 3 seconds if student doesn't close
          setTimeout(() => {
              removeToast(false);
          }, 3000);
      } catch (e) { console.warn('showStudentWelcomeToast failed', e); }
  }

  // --- Global Button Interaction Sounds ---
  document.body.addEventListener('click', (e) => {
      // Don't play default click if it's a notification bell (it has its own sound)
      if (e.target.closest('.fa-bell') || e.target.closest('#logoutBtn')) return;
      
      const btn = e.target.closest('.btn, button, .sidebar-nav a, .nav-brand');
      if (btn) {
          window.audioManager.play('click');
      }
  });

  // --- Audio System ---
  window.audioQueue = [];

  // Play queued sounds on first interaction
  const handleFirstInteraction = () => {
      if (window.audioQueue.length > 0) {
          const sound = window.audioQueue.shift();
          const audio = new Audio(sound.url);
          audio.volume = sound.volume;
          audio.play().catch(e => {}); // Ignore if still fails
      }
  };
  document.body.addEventListener('click', handleFirstInteraction, { once: false });
  document.body.addEventListener('touchstart', handleFirstInteraction, { once: false });

  // --- Global YouTube Channel Link ---
  setTimeout(() => {
      const navActionsContainer = document.querySelector('.nav-actions');
      if (navActionsContainer && !document.getElementById('ytNavBtn')) {
          const ytBtn = document.createElement('a');
          ytBtn.href = 'https://www.youtube.com/@youssefstudies';
          ytBtn.target = '_blank';
          ytBtn.id = 'ytNavBtn';
          ytBtn.className = 'btn btn-outline';
          ytBtn.style.cssText = 'color: #ff0000; border-color: rgba(255,0,0,0.5); padding: 8px 15px; border-radius: 20px; margin-right: 5px;';
          ytBtn.innerHTML = '<i class="fab fa-youtube" style="margin-left: 5px;"></i> قناة اليوتيوب';
          
          const mobileBtn = navActionsContainer.querySelector('.mobile-menu-btn');
          if (mobileBtn) navActionsContainer.insertBefore(ytBtn, mobileBtn);
          else navActionsContainer.appendChild(ytBtn);
      }
  }, 100);

  // --- Global Logo Loader ---
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

  // --- Global Student Logout Listener ---
  document.body.addEventListener('click', (e) => {
      const logoutBtn = e.target.closest('#logoutBtn');
      if (logoutBtn && !window.location.pathname.includes('admin-')) {
          e.preventDefault();
          sessionStorage.removeItem('currentStudent');
          localStorage.removeItem('currentStudent');
          window.location.href = 'index.html';
      }
  });

  // --- Mobile Drawer Navigation Injection ---
  setTimeout(() => {
      const navLinksUl = document.querySelector('.nav-links');
      const navActionsContainer = document.querySelector('.nav-actions');
      if (navLinksUl && navActionsContainer && window.innerWidth <= 768) {
          // Check if already injected
          if (!navLinksUl.querySelector('.mobile-injected-actions')) {
              const divider = document.createElement('li');
              divider.className = 'mobile-injected-actions';
              divider.innerHTML = '<hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">';
              navLinksUl.appendChild(divider);
              
              // Clone all buttons except mobile menu and theme toggle
              const btnsToClone = navActionsContainer.querySelectorAll('.btn:not(.mobile-menu-btn):not(#themeToggle)');
              btnsToClone.forEach(btn => {
                  const li = document.createElement('li');
                  li.className = 'mobile-injected-actions';
                  const clonedBtn = btn.cloneNode(true);
                  clonedBtn.style.display = 'flex';
                  clonedBtn.style.justifyContent = 'center';
                  clonedBtn.style.marginTop = '10px';
                  clonedBtn.style.width = '100%';
                  clonedBtn.style.textAlign = 'center';
                  li.appendChild(clonedBtn);
                  navLinksUl.appendChild(li);
              });
          }
      }
  }, 600); // give time for ytBtn and bellBtn to load

  // --- Dynamic Navbar Standardization for Students ---
  const currentStudentStr = sessionStorage.getItem('currentStudent');
  if (currentStudentStr && !sessionStorage.getItem('currentAdmin') && !window.location.pathname.includes('admin-')) {
      const navActions = document.querySelector('.nav-actions');
      if (navActions) {
          if (!navActions.querySelector('.fa-bell')) {
              const bellBtn = document.createElement('a');
              bellBtn.href = '#';
              bellBtn.className = 'btn btn-outline';
              bellBtn.style.cssText = 'padding: 8px 15px; border-radius: 20px;';
              bellBtn.innerHTML = '<i class="fas fa-bell"></i>';
              
              const mobileBtn = navActions.querySelector('.mobile-menu-btn');
              if (mobileBtn) navActions.insertBefore(bellBtn, mobileBtn);
              else navActions.appendChild(bellBtn);
          }
          if (!navActions.querySelector('#logoutBtn')) {
              const logoutBtn = document.createElement('a');
              logoutBtn.href = '#';
              logoutBtn.id = 'logoutBtn';
              logoutBtn.className = 'btn btn-outline';
              logoutBtn.style.cssText = 'border-color: #e74c3c; color: #e74c3c; padding: 8px 15px; border-radius: 20px; margin-right: 5px;';
              logoutBtn.innerHTML = 'خروج <i class="fas fa-sign-out-alt" style="margin-right: 5px;"></i>';
              
              const mobileBtn = navActions.querySelector('.mobile-menu-btn');
              if (mobileBtn) navActions.insertBefore(logoutBtn, mobileBtn);
              else navActions.appendChild(logoutBtn);
          }
      }
  }

  // --- Global Student Avatar Loader ---
  let userStr = sessionStorage.getItem('currentStudent');
  if (userStr) {
      let user = JSON.parse(userStr);
      let dbUser = JSON.parse(localStorage.getItem(`db_${user.phone}`)) || {};
      
      const profilePic = localStorage.getItem(`profilePic_${user.phone}`) || user.profilePic;
      if (profilePic) {
          const avatarImgs = document.querySelectorAll('.avatar img, #userAvatarImg, .avatar-name img');
          avatarImgs.forEach(img => {
              img.src = profilePic;
              img.style.display = 'block';
          });
      }

      // --- Yearly Grade Update Logic ---
      if (!window.location.pathname.includes('admin-') && window.PlatformStorage) {
          const promotionState = window.PlatformStorage.checkYearlyPromotion(user);
          if (promotionState.required && !document.getElementById('yearlyUpdateModal')) {
              const gradeOptions = [
                  { value: 'الصف السادس الابتدائي', label: 'الصف السادس الابتدائي' },
                  { value: 'الصف الأول الإعدادي', label: 'الصف الأول الإعدادي' },
                  { value: 'الصف الثاني الإعدادي', label: 'الصف الثاني الإعدادي' },
                  { value: 'الصف الثالث الإعدادي', label: 'الصف الثالث الإعدادي' }
              ];

              window.PlatformStorage.renderYearlyPromotionModal({
                  currentAcademicYear: promotionState.currentAcademicYear,
                  gradeOptions,
                  onConfirm: (newGrade, modalElement) => {
                      let strictUsers = JSON.parse(localStorage.getItem('strictUsers') || '[]');
                      const strictIndex = strictUsers.findIndex(u => u.phone === user.phone);
                      if (strictIndex > -1) {
                          strictUsers[strictIndex].grade = newGrade;
                          localStorage.setItem('strictUsers', JSON.stringify(strictUsers));
                      }

                      dbUser.grade = newGrade;
                      dbUser.lastUpdatedAcademicYear = promotionState.currentAcademicYear;
                      dbUser.courses = []; // Clear courses on promotion
                      localStorage.setItem(`db_${user.phone}`, JSON.stringify(dbUser));
                      
                      if (window.FirebaseService && typeof window.FirebaseService.updateStudentData === 'function') {
                          window.FirebaseService.updateStudentData(user.phone, {
                              grade: newGrade,
                              lastUpdatedAcademicYear: promotionState.currentAcademicYear,
                              courses: []
                          });
                      }
                      
                      user.grade = newGrade;
                      sessionStorage.setItem('currentStudent', JSON.stringify(user));
                      localStorage.setItem('currentStudent', JSON.stringify(user));
                      
                      window.PlatformStorage.markPromotionCompleted(user.phone, newGrade);

                      if (window.audioManager) window.audioManager.play('success');
                      if (window.showToast) window.showToast('تم تحديث الصف الدراسي للسنة الجديدة بنجاح.', 'success');

                      setTimeout(() => {
                          if (modalElement && modalElement.parentNode) {
                              modalElement.parentNode.removeChild(modalElement);
                          }
                      }, 250);
                  }
              });
          }
      }

      // --- Welcome Message on Dashboard ---
      let welcomeDelay = 0;
      if (window.location.pathname.includes('dashboard.html') && (!sessionStorage.getItem('welcomeShown') || sessionStorage.getItem('pfJustLoggedIn') === 'true')) {
          const genSettings = JSON.parse(localStorage.getItem('generalSettings') || '{}');
          const welcomeMsg = genSettings.welcomeMessage || 'مرحباً بك في منصتك التعليمية';
          welcomeDelay = 3500;
          setTimeout(() => {
                  const justLogged = sessionStorage.getItem('pfJustLoggedIn') === 'true';
                  if (justLogged) {
                      // Build first name from available student data
                      let firstName = 'يا بطل';
                      try {
                          const studentStr = sessionStorage.getItem('currentStudent') || localStorage.getItem('currentStudent');
                          if (studentStr) {
                              const s = JSON.parse(studentStr);
                              if (s.fullName) firstName = s.fullName.split(' ')[0];
                              else if (s.name) firstName = s.name.split(' ')[0];
                          }
                      } catch (e) {}
                      const personalized = `أهلاً ${firstName} بعودتك! استمر في التقدم نحو النجاح.`;
                      if (window.showToast) window.showToast(personalized, 'majestic', { duration: 3000 });
                      sessionStorage.setItem('welcomeShown', 'true');
                      sessionStorage.removeItem('pfJustLoggedIn');
                      try { if (window.audioManager) window.audioManager.play('login'); } catch(e) {}
                  } else {
                      window.showToast(welcomeMsg, 'majestic', { duration: 3000 });
                      sessionStorage.setItem('welcomeShown', 'true');
                      try { window.audioManager.play('welcomeStudent'); } catch(e) {}
                  }

                  if (justLogged) {
                      setTimeout(() => {
                          if (typeof window.showToast === 'function' && notifications && notifications.some(n => !n.read && (n.courseId || n.targetCourseId))) {
                              window.showToast('تم قبول طلب الكورس الخاص بك الآن، قم بزيارة صفحة الكورسات لمراجعته.', 'success', { duration: 4200 });
                          }
                      }, 2200);
                  }

                  // Play notification arrival sound AFTER welcome finishes if unread
                  setTimeout(() => {
                      if (unreadCount > 0) {
                          try { window.audioManager.play('whatsapp'); } catch(e) {}
                      }
                  }, 3000);
              }, 500);
      }

      // --- Celebration Check (Payment Approved) ---
      if (dbUser.celebrateCourse) {
          setTimeout(() => {
              // Trigger elegant Left/Right Confetti
              if (window.confetti) {
                  const end = Date.now() + 2.5 * 1000;
                  const colors = ['#d4a64f', '#f1c40f', '#e74c3c'];
                  (function frame() {
                      confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors: colors, zIndex: 10001 });
                      confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors: colors, zIndex: 10001 });
                      if (Date.now() < end) requestAnimationFrame(frame);
                  }());
              } else {
                  window.triggerConfetti();
              }
              
              window.showToast(`تم تفعيل كورس: ${dbUser.celebrateCourse} بنجاح!`, 'success', { title: 'تهانينا! 🎉', duration: 6000, isMajestic: true });
              window.audioManager.play('celebration');

              // Remove flag
              delete dbUser.celebrateCourse;
              localStorage.setItem(`db_${user.phone}`, JSON.stringify(dbUser));
          }, 1500);
      }

      // --- Notifications System ---
      let notifications = dbUser.notifications || [];
    // Sort notifications newest first (support both `timestamp` and legacy `date`)
    notifications.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));
      let unreadNotifs = notifications.filter(n => !n.read);
      let unreadCount = unreadNotifs.length;
      
      setTimeout(() => {
          const bellIcons = document.querySelectorAll('.fa-bell');
          bellIcons.forEach(bell => {
              const btn = bell.parentElement;
              if (btn && btn.tagName === 'A' && !btn.href.includes('admin-')) {
                  btn.style.position = 'relative';
                  btn.style.overflow = 'visible'; // Ensure badge is not cut off
                  bell.style.fontSize = '1.4rem'; // Enlarge the bell icon as requested
                  
                  if (unreadCount > 0) {
                      // Add red badge
                      let badge = document.createElement('span');
                      badge.id = 'notifBadge';
                      badge.style.cssText = 'position:absolute; top:0; right:0; background:#e74c3c; color:white; border-radius:50%; width:18px; height:18px; font-size:11px; display:flex; justify-content:center; align-items:center; font-weight:bold; box-shadow: 0 0 5px rgba(231,76,60,0.5); z-index: 100; pointer-events:none;';
                      badge.textContent = unreadCount;
                      btn.appendChild(badge);
                      
                      // Inject gentle shake keyframes
                      if (!document.getElementById('gentleShakeKeyframes')) {
                          const style = document.createElement('style');
                          style.id = 'gentleShakeKeyframes';
                          style.textContent = `
                              @keyframes gentleShake {
                                  0%, 100% { transform: rotate(0deg); }
                                  5% { transform: rotate(5deg); }
                                  10% { transform: rotate(-5deg); }
                                  15% { transform: rotate(3deg); }
                                  20% { transform: rotate(-3deg); }
                                  25% { transform: rotate(0deg); }
                              }
                          `;
                          document.head.appendChild(style);
                      }
                      // Apply infinite smooth shake
                      bell.style.transformOrigin = 'top center';
                      bell.style.animation = 'gentleShake 4s infinite ease-in-out';
                  }
              }
          });
      }, 150);
      // If redirected here from an approval notification, show fireworks on course page
      try {
          const curPath = window.location.pathname || '';
          if (curPath.includes('course-details')) {
              const u = new URL(window.location.href);
              const courseId = u.searchParams.get('id');
              if (courseId && sessionStorage.getItem('celebrate_course_' + courseId)) {
                  try { sessionStorage.removeItem('celebrate_course_' + courseId); } catch(e){}
                  setTimeout(() => {
                      try { if (window.triggerFireworks) window.triggerFireworks(4500); } catch(e){}
                      try { if (window.showToast) window.showToast('تهانينا! كورسك متاح الآن 🎉', 'majestic', { duration: 5000, isMajestic: true, playSound: 'celebration' }); } catch(e){}
                  }, 600);
              }
          }
      } catch(e) {}
      
      // Global Delegation for Bell Click
      document.body.addEventListener('click', (e) => {
          const btn = e.target.closest('a');
          if (btn && btn.querySelector('.fa-bell') && !btn.href.includes('admin-')) {
              e.preventDefault();
              
              // Stop shaking animation
              const bellIcon = btn.querySelector('.fa-bell');
              if (bellIcon) {
                  bellIcon.style.animation = 'none';
              }
              
              if(!document.getElementById('studentNotifDropdown')) {
                  window.audioManager.play('notifOpen');
              }
              
              openStudentNotifications(user.phone, notifications, btn);
          }
      });
  }

  window.openApprovedCourseNotification = function(courseId) {
      if (!courseId) return;
      try { 
          if (!localStorage.getItem('has_celebrated_' + courseId)) {
              sessionStorage.setItem('celebrate_course_' + courseId, '1'); 
              localStorage.setItem('has_celebrated_' + courseId, '1');
          }
      } catch(e){}
      const url = `courses.html?highlight=${encodeURIComponent(courseId)}`;
      window.location.href = url;
  };

  window.openStudentNotifications = function(phone, notifications, bellBtn) {
      let dropdown = document.getElementById('studentNotifDropdown');
      
      // Toggle if already exists
      if (dropdown) {
          dropdown.remove();
          return;
      }

      dropdown = document.createElement('div');
      dropdown.id = 'studentNotifDropdown';
      
      // Calculate position
      const rect = bellBtn.getBoundingClientRect();
      const leftPos = Math.max(10, rect.left - 150); // prevent going off left edge
      
      dropdown.style.cssText = `
          position: fixed;
          top: ${rect.bottom + 15}px;
          left: ${leftPos}px;
          width: 320px;
          max-height: 400px;
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          z-index: 99999;
          display: flex;
          flex-direction: column;
          animation: slideDownFade 0.2s ease-out;
      `;

      dropdown.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding:15px; background: rgba(0,0,0,0.2); border-radius: 12px 12px 0 0;">
              <h3 style="color:var(--royal-gold); margin:0; font-size:1.1rem;"><i class="fas fa-bell mr-2"></i> الإشعارات</h3>
          </div>
          
          <div style="display: flex; gap: 5px; padding: 10px 15px; border-bottom:1px solid rgba(255,255,255,0.05);">
              <button class="btn notif-filter-btn active" data-filter="all" style="flex:1; padding: 5px; background: rgba(255,255,255,0.1); font-size:0.85rem;">الكل</button>
              <button class="btn notif-filter-btn" data-filter="unread" style="flex:1; padding: 5px; background: transparent; color: var(--text-muted); font-size:0.85rem;">غير مقروءة</button>
              <button class="btn notif-filter-btn" data-filter="read" style="flex:1; padding: 5px; background: transparent; color: var(--text-muted); font-size:0.85rem;">مقروءة</button>
          </div>

          <div id="notifListContainer" style="overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:8px; padding: 15px; max-height: 280px;"></div>
      `;
      
      document.body.appendChild(dropdown);

      // Close when clicking outside
      setTimeout(() => {
          document.addEventListener('click', function closeDropdown(e) {
              if (dropdown && !dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
                  dropdown.remove();
                  document.removeEventListener('click', closeDropdown);
              }
          });
      }, 10);

      // Add filter logic
      const filterBtns = dropdown.querySelectorAll('.notif-filter-btn');
      filterBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
              e.stopPropagation();
              filterBtns.forEach(b => { b.classList.remove('active'); b.style.background = 'transparent'; b.style.color = 'var(--text-muted)'; });
              btn.classList.add('active');
              btn.style.background = 'rgba(255,255,255,0.1)';
              btn.style.color = 'var(--text-primary)';
              renderNotifs(btn.getAttribute('data-filter'));
          });
      });

      function renderNotifs(filter) {
          const container = document.getElementById('notifListContainer');
          if(!container) return;
          container.innerHTML = '';
          
          let filtered = notifications;
          if (filter === 'unread') filtered = notifications.filter(n => !n.read);
          if (filter === 'read') filtered = notifications.filter(n => n.read);

          if (filtered.length === 0) {
              container.innerHTML = '<div style="text-align:center; padding:20px; color:rgba(255,255,255,0.5);"><i class="fas fa-bell-slash" style="font-size:2rem; margin-bottom:10px;"></i><p style="font-size:0.9rem;">لا توجد إشعارات</p></div>';
          } else {
                  filtered.forEach(n => {
                  const targetId = n.courseId || n.targetCourseId || null;
                  const targetAttr = targetId ? `data-course-id="${targetId}"` : '';
                  const clickableStyle = targetId ? 'cursor:pointer;' : '';
                  const d = new Date(n.timestamp || n.date || Date.now());
                  container.innerHTML += `
                      <div class="notif-item" ${targetAttr} style="background:rgba(255,255,255,0.05); border-right: 3px solid ${n.read ? 'transparent' : 'var(--accent-cyan)'}; padding:12px; border-radius:5px; transition: all 0.3s; ${clickableStyle}">
                          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                              <h4 style="color:${n.read ? 'var(--text-primary)' : 'var(--accent-cyan)'}; margin-bottom:5px; font-size:0.95rem;">${n.title}</h4>
                          </div>
                          <p style="color:rgba(255,255,255,0.7); font-size:0.85rem; margin:0; line-height:1.4;">${n.message}</p>
                          <span style="font-size:0.75rem; color:rgba(255,255,255,0.4); display:block; margin-top:8px;"><i class="far fa-clock mr-1"></i> ${d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                  `;
              });

              const clickableItems = container.querySelectorAll('[data-course-id]');
              clickableItems.forEach(item => {
                  item.addEventListener('click', () => {
                      const courseId = item.getAttribute('data-course-id');
                      if (courseId) window.openApprovedCourseNotification(courseId);
                  });
              });
          }
      }

      // Initial render (shows all)
      dropdown.querySelector('.notif-filter-btn[data-filter="all"]').click();

      // Mark all as read
      let hasUnread = notifications.some(n => !n.read);
      if (hasUnread) {
          notifications.forEach(n => n.read = true);
          let dbUser = JSON.parse(localStorage.getItem(`db_${phone}`)) || {};
          dbUser.notifications = notifications;
          localStorage.setItem(`db_${phone}`, JSON.stringify(dbUser));
          
          if (window.FirebaseService && window.FirebaseService.updateStudentData) {
              window.FirebaseService.updateStudentData(phone, { notifications: notifications }).catch(e => console.error(e));
          }
          
          // Remove red badges globally
          const badges = document.querySelectorAll('#notifBadge');
          badges.forEach(b => b.remove());
      }
  };
  // --- SAFE UI PERFORMANCE & UX POLISH ---
  // 1. Lazy load all images
  document.querySelectorAll('img').forEach(img => {
      if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
  });

  // 2. Prevent Double-Clicks on generic forms
  document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', (e) => {
          const submitBtn = form.querySelector('button[type="submit"]');
          if (submitBtn) {
              if (submitBtn.disabled) {
                  e.preventDefault();
                  return;
              }
              submitBtn.dataset.originalText = submitBtn.innerHTML;
              submitBtn.disabled = true;
              submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-left: 8px;"></i> جاري المعالجة...';
              setTimeout(() => {
                  submitBtn.disabled = false;
                  submitBtn.innerHTML = submitBtn.dataset.originalText;
              }, 4000);
          }
      });
  });

  // 3. Scroll Reveal Animations (Intersection Observer)
  const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
          if (entry.isIntersecting) {
              entry.target.classList.add('is-revealed');
          }
      });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  // Dynamically add reveal classes to core elements without touching HTML files
  document.querySelectorAll('.course-card, .glass-panel, .stat-card, footer .footer-col').forEach(el => {
      el.classList.add('reveal-on-scroll');
      revealObserver.observe(el);
  });

  // 4. Ripple Effect on Action Buttons
  document.querySelectorAll('.btn-gold, .btn-outline, .btn-subscribe').forEach(btn => {
      btn.classList.add('ripple-btn');
      btn.addEventListener('click', function(e) {
          const rect = btn.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          const circle = document.createElement('span');
          circle.classList.add('ripple-circle');
          circle.style.left = x + 'px';
          circle.style.top = y + 'px';
          
          const size = Math.max(rect.width, rect.height);
          circle.style.width = circle.style.height = size + 'px';
          circle.style.marginLeft = circle.style.marginTop = -(size / 2) + 'px';
          
          btn.appendChild(circle);
          setTimeout(() => circle.remove(), 600);
      });
  });

});

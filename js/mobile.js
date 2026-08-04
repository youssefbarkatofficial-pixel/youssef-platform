/**
 * ============================================================
 *  📱 MOBILE.JS v3 — منصة يوسف بركات
 *  Bottom Nav · Sidebar Toggle · Update Notification · UX
 * ============================================================
 */

(function () {
  'use strict';

  /* ----------------------------------------------------------------
   *  CONFIG — غيّر PLATFORM_VERSION عند كل تحديث جديد للمنصة
   * ---------------------------------------------------------------- */
  var PLATFORM_VERSION = '2.5.0';
  var UPDATE_NOTES = [
    'تجربة تصفح كأنها تطبيق حقيقي على الهاتف والتابلت',
    'شريط تنقل سفلي سهل وسريع للوصول لكل صفحة',
    'إصلاح شامل لجميع صفحات اللوحة على الشاشات الصغيرة',
    'أداء وسرعة تحميل أفضل'
  ];

  /* ----------------------------------------------------------------
   *  UTILITY
   * ---------------------------------------------------------------- */
  function getCurrentPage() {
    var path = window.location.pathname;
    var page = path.split('/').pop() || 'index.html';
    return page.split('?')[0];
  }

  function isStudentPage() {
    var page = getCurrentPage();
    var skipPages = ['index.html', '', 'login.html', 'register.html'];
    var skipPrefixes = ['admin-'];
    if (skipPages.indexOf(page) !== -1) return false;
    for (var i = 0; i < skipPrefixes.length; i++) {
      if (page.indexOf(skipPrefixes[i]) === 0) return false;
    }
    return true;
  }

  /* ----------------------------------------------------------------
   *  1. BOTTOM NAVIGATION
   * ---------------------------------------------------------------- */
  function createBottomNav() {
    if (!isStudentPage()) return;
    if (document.querySelector('.mobile-bottom-nav')) return;

    var page = getCurrentPage();

    var navItems = [
      { href: 'dashboard.html',  icon: 'fa-home',           label: 'الرئيسية',  match: ['dashboard.html'] },
      { href: 'my-courses.html', icon: 'fa-graduation-cap', label: 'كورساتي',  match: ['my-courses.html', 'course-details.html'] },
      { href: 'homeworks.html',  icon: 'fa-tasks',          label: 'الواجبات', match: ['homeworks.html'] },
      { href: 'exams.html',      icon: 'fa-file-alt',       label: 'الامتحانات',match: ['exams.html'] },
      { href: 'stats.html',      icon: 'fa-chart-line',     label: 'إحصائياتي',match: ['stats.html'] }
    ];

    var nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'التنقل الرئيسي');

    var ul = document.createElement('ul');

    navItems.forEach(function(item) {
      var li = document.createElement('li');
      var a  = document.createElement('a');
      a.href = item.href;

      var isActive = item.match.indexOf(page) !== -1;
      if (isActive) a.classList.add('active');

      a.innerHTML = '<i class="fas ' + item.icon + '"></i><span>' + item.label + '</span>';
      a.setAttribute('aria-label', item.label);

      a.addEventListener('click', function(e) {
        if (a.href === window.location.href) { e.preventDefault(); return; }
        // Ripple feedback
        a.style.opacity = '0.7';
        setTimeout(function() { a.style.opacity = ''; }, 200);
      });

      li.appendChild(a);
      ul.appendChild(li);
    });

    nav.appendChild(ul);
    document.body.appendChild(nav);
  }

  /* ----------------------------------------------------------------
   *  2. SIDEBAR TOGGLE
   * ---------------------------------------------------------------- */
  function setupSidebarToggle() {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Ensure overlay exists
    var overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }

    // Create or find toggle button
    var toggleBtn = document.getElementById('mobileSidebarToggle');
    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.id = 'mobileSidebarToggle';
      toggleBtn.setAttribute('aria-label', 'القائمة');
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
      // Insert at start of nav-actions
      var navActions = document.querySelector('.nav-actions');
      if (navActions) {
        navActions.insertBefore(toggleBtn, navActions.firstChild);
      }
    }

    var isOpen = false;

    function openSidebar() {
      isOpen = true;
      sidebar.classList.add('active');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      toggleBtn.setAttribute('aria-expanded', 'true');
      toggleBtn.innerHTML = '<i class="fas fa-times"></i>';
    }

    function closeSidebar() {
      isOpen = false;
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    }

    toggleBtn.addEventListener('click', function() {
      if (isOpen) closeSidebar(); else openSidebar();
    });

    overlay.addEventListener('click', closeSidebar);

    // Close on sidebar link click
    var sidebarLinks = sidebar.querySelectorAll('a');
    sidebarLinks.forEach(function(link) {
      link.addEventListener('click', function() {
        if (isOpen) setTimeout(closeSidebar, 80);
      });
    });

    // Close on resize to desktop
    var resizeTimer;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        if (window.innerWidth > 992 && isOpen) closeSidebar();
      }, 100);
    });

    // Close on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isOpen) closeSidebar();
    });
  }

  /* ----------------------------------------------------------------
   *  3. UPDATE NOTIFICATION
   * ---------------------------------------------------------------- */
  function showUpdateNotification() {
    // Only for logged-in students
    var userStr = sessionStorage.getItem('currentStudent') || localStorage.getItem('currentStudent');
    if (!userStr) return;

    // Skip admin & auth pages
    if (!isStudentPage()) return;

    // Already seen this version?
    try {
      var seen = localStorage.getItem('platformVersionSeen');
      if (seen === PLATFORM_VERSION) return;
    } catch(e) {}

    // Delay to ensure page loads first
    setTimeout(function() {
      try {
        var banner = document.createElement('div');
        banner.className = 'platform-update-banner';
        banner.innerHTML =
          '<span class="update-icon">🚀</span>' +
          '<div class="update-title">تحديث جديد — الإصدار ' + PLATFORM_VERSION + ' 🎉</div>' +
          '<div class="update-desc"><ul>' +
            UPDATE_NOTES.map(function(n) { return '<li>' + n + '</li>'; }).join('') +
          '</ul></div>' +
          '<div class="update-actions">' +
            '<button class="btn-update-dismiss" id="dismissUpdateBtn">لاحقاً</button>' +
            '<button class="btn-update-ok" id="confirmUpdateBtn">رائع! 👍</button>' +
          '</div>';

        document.body.appendChild(banner);

        // Animate in (double rAF trick)
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            banner.classList.add('show');
          });
        });

        function dismissBanner() {
          banner.classList.remove('show');
          setTimeout(function() {
            if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
          }, 500);
          try { localStorage.setItem('platformVersionSeen', PLATFORM_VERSION); } catch(e) {}
        }

        document.getElementById('confirmUpdateBtn').addEventListener('click', function() {
          dismissBanner();
          // Brief celebration toast if available
          if (window.showToast && typeof window.showToast === 'function') {
            window.showToast('أهلاً بك في الإصدار الجديد! 🎉', 'majestic');
          }
        });

        document.getElementById('dismissUpdateBtn').addEventListener('click', dismissBanner);

        // Auto-dismiss after 12 seconds
        setTimeout(dismissBanner, 12000);

      } catch(err) {
        console.warn('[mobile.js] Update notification error:', err);
      }
    }, 3000);
  }

  /* ----------------------------------------------------------------
   *  4. iOS ZOOM PREVENTION (inputs on focus)
   * ---------------------------------------------------------------- */
  function preventIOSZoom() {
    if (window.innerWidth > 992) return;
    document.addEventListener('focusin', function(e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        // Already handled by CSS font-size:16px
      }
    });
  }

  /* ----------------------------------------------------------------
   *  5. SMOOTH OVERSCROLL for iOS Safari
   * ---------------------------------------------------------------- */
  function addIOSScrollFix() {
    var mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.style.webkitOverflowScrolling = 'touch';
    }
  }

  /* ----------------------------------------------------------------
   *  6. ACTIVE STATE FIX — ensure correct nav item is highlighted
   * ---------------------------------------------------------------- */
  function highlightActiveSidebarLink() {
    var page = getCurrentPage();
    var links = document.querySelectorAll('.sidebar-nav li a');
    links.forEach(function(link) {
      var href = link.getAttribute('href') || '';
      var linkPage = href.split('?')[0].split('/').pop();
      if (linkPage === page) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  /* ----------------------------------------------------------------
   *  7. PREVENT HEADING OVERFLOW globally
   * ---------------------------------------------------------------- */
  function fixHeadingOverflow() {
    if (window.innerWidth > 992) return;
    var headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, .heading-luxury');
    headings.forEach(function(h) {
      h.style.whiteSpace = 'normal';
      h.style.overflow = 'visible';
      h.style.textOverflow = 'unset';
    });
  }

  /* ----------------------------------------------------------------
   *  INIT
   * ---------------------------------------------------------------- */
  function init() {
    createBottomNav();
    setupSidebarToggle();
    showUpdateNotification();
    preventIOSZoom();
    addIOSScrollFix();
    highlightActiveSidebarLink();
    fixHeadingOverflow();

    // Re-fix on resize
    window.addEventListener('resize', function() {
      fixHeadingOverflow();
    });

    // Mark DOM as mobile-ready
    document.documentElement.setAttribute('data-mobile-ready', 'true');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

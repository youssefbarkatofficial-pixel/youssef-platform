/**
 * ============================================================
 * نظام الصورة الشخصية الإلزامية
 * profile-guard.js — يصطاد الطلاب اللي عندهم حسابات بدون صورة
 * ============================================================
 */

(function () {
  'use strict';

  // ======= ضغط الصورة بالكانفاس (نفس الجودة بحجم أصغر بكتير) =======
  function compressImage(file, maxWidthPx, qualityPct, callback) {
    maxWidthPx = maxWidthPx || 400;
    qualityPct = qualityPct || 0.82;

    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        var ratio = Math.min(maxWidthPx / img.width, maxWidthPx / img.height, 1);
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var compressed = canvas.toDataURL('image/jpeg', qualityPct);
        callback(null, compressed);
      };
      img.onerror = function () { callback(new Error('تعذّر قراءة الصورة'), null); };
      img.src = e.target.result;
    };
    reader.onerror = function () { callback(new Error('تعذّر قراءة الملف'), null); };
    reader.readAsDataURL(file);
  }

  // ======= حفظ الصورة في Firestore + localStorage =======
  async function saveProfilePic(user, base64Data) {
    var docId = user.uid || user.id || user.phone;
    if (!docId) throw new Error('لا يوجد معرف للمستخدم');

    // localStorage أولاً (فوري)
    try { localStorage.setItem('profilePic_' + user.phone, base64Data); } catch(e) {}

    // تحديث session
    user.profilePic = base64Data;
    try { sessionStorage.setItem('currentStudent', JSON.stringify(user)); } catch(e) {}

    // Firestore (سحابة — يشوفها الأدمن)
    if (window.firebaseDb) {
      var payload = { profilePic: base64Data, profilePicUpdatedAt: Date.now() };
      try { await window.firebaseDb.collection('students').doc(docId).set(payload, { merge: true }); } catch(e) { console.warn('[PROFILE-GUARD] Firestore save error:', e); }
      try { await window.firebaseDb.collection('users').doc(docId).set(payload, { merge: true }); } catch(e) {}
    }
  }

  // ======= رسم المودال الإلزامي =======
  function createModal(user, onSaved) {
    if (document.getElementById('pgOverlay')) return; // مش يتعمل مرتين

    var overlay = document.createElement('div');
    overlay.id = 'pgOverlay';
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:2147483647;',
      'background:rgba(0,0,0,0.92);backdrop-filter:blur(12px);',
      'display:flex;align-items:center;justify-content:center;',
      'animation:pgFadeIn 0.4s ease'
    ].join('');

    overlay.innerHTML = [
      '<style>',
      '@keyframes pgFadeIn{from{opacity:0}to{opacity:1}}',
      '@keyframes pgSlideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}',
      '#pgBox{',
        'background:linear-gradient(145deg,#0d1b2a,#071326);',
        'border:1px solid #D4A64F;',
        'border-radius:20px;padding:36px 28px;',
        'width:90%;max-width:420px;text-align:center;',
        'box-shadow:0 0 60px rgba(212,166,79,0.25);',
        'animation:pgSlideUp 0.5s cubic-bezier(0.16,1,0.3,1);',
      '}',
      '#pgPreview{',
        'width:120px;height:120px;border-radius:50%;',
        'object-fit:cover;margin:0 auto 16px;display:block;',
        'border:3px solid #D4A64F;',
        'background:#071326;',
      '}',
      '#pgBtn{',
        'background:linear-gradient(135deg,#D4A64F,#c8930a);',
        'color:#000;border:none;border-radius:25px;',
        'padding:12px 32px;font-size:1rem;font-weight:bold;',
        'cursor:pointer;width:100%;margin-top:10px;',
        'transition:opacity 0.2s;',
      '}',
      '#pgBtn:hover{opacity:0.88}',
      '#pgBtn:disabled{opacity:0.5;cursor:not-allowed}',
      '#pgFileLabel{',
        'display:inline-block;margin-top:14px;',
        'background:rgba(212,166,79,0.12);',
        'border:1.5px dashed #D4A64F;',
        'border-radius:12px;padding:12px 24px;',
        'color:#D4A64F;cursor:pointer;font-size:0.95rem;',
        'transition:background 0.2s;',
      '}',
      '#pgFileLabel:hover{background:rgba(212,166,79,0.22)}',
      '#pgNote{color:rgba(255,255,255,0.45);font-size:0.78rem;margin-top:8px;}',
      '</style>',
      '<div id="pgBox">',
        '<div style="font-size:2.8rem;margin-bottom:8px;">📸</div>',
        '<h2 style="color:#D4A64F;margin:0 0 6px;font-size:1.3rem;">أهلاً ' + (user.name || 'يا بطل') + '!</h2>',
        '<p style="color:rgba(255,255,255,0.7);font-size:0.9rem;margin:0 0 18px;">',
          'المنصة محتاجة صورة شخصية علشان تكتمل بياناتك.',
          '<br>اختار أي صورة تعجبك، إنت حر! 🎨',
        '</p>',
        '<img id="pgPreview" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'120\'%3E%3Ccircle cx=\'60\' cy=\'60\' r=\'60\' fill=\'%23071326\'/%3E%3Ccircle cx=\'60\' cy=\'46\' r=\'22\' fill=\'%23D4A64F\'/%3E%3Cellipse cx=\'60\' cy=\'105\' rx=\'32\' ry=\'24\' fill=\'%23D4A64F\'/%3E%3C/svg%3E" alt="معاينة">',
        '<label id="pgFileLabel" for="pgFileInput">',
          '<i class="fas fa-upload" style="margin-left:6px;"></i> اختار صورة',
        '</label>',
        '<input type="file" id="pgFileInput" accept="image/*" style="display:none">',
        '<p id="pgNote">📦 الصورة بتتضغط تلقائياً — أعلى جودة بأصغر حجم</p>',
        '<div id="pgStatus" style="color:#f39c12;font-size:0.85rem;min-height:20px;margin-top:6px;"></div>',
        '<button id="pgBtn" disabled>✅ حفظ الصورة وأكمل</button>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);

    var fileInput  = document.getElementById('pgFileInput');
    var preview    = document.getElementById('pgPreview');
    var statusEl   = document.getElementById('pgStatus');
    var saveBtn    = document.getElementById('pgBtn');
    var compressed = null;

    fileInput.addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (file.size > 15 * 1024 * 1024) {
        statusEl.textContent = '❌ الصورة كبيرة جداً (الحد 15MB)';
        return;
      }
      statusEl.textContent = '⏳ جاري الضغط والمعالجة...';
      saveBtn.disabled = true;

      compressImage(file, 400, 0.82, function (err, b64) {
        if (err) { statusEl.textContent = '❌ ' + err.message; return; }
        compressed = b64;
        preview.src = b64;
        var kbBefore = Math.round(file.size / 1024);
        var kbAfter  = Math.round(b64.length * 0.75 / 1024);
        statusEl.textContent = '✅ تم! الحجم: ' + kbBefore + 'KB → ' + kbAfter + 'KB';
        saveBtn.disabled = false;
      });
    });

    saveBtn.addEventListener('click', async function () {
      if (!compressed) return;
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ جاري الحفظ...';
      statusEl.textContent = '';
      try {
        await saveProfilePic(user, compressed);
        // تحديث الأفاتار في الصفحة لو موجود
        var avatarImg = document.getElementById('userAvatarImg');
        if (avatarImg) avatarImg.src = compressed;

        // إخفاء المودال بانيماشن
        overlay.style.animation = 'pgFadeIn 0.3s ease reverse';
        setTimeout(function () {
          overlay.remove();
          if (typeof onSaved === 'function') onSaved(compressed);
        }, 300);
      } catch (e) {
        statusEl.textContent = '❌ فشل الحفظ: ' + e.message;
        saveBtn.disabled = false;
        saveBtn.textContent = '✅ حفظ الصورة وأكمل';
      }
    });
  }

  // ======= نقطة الدخول الرئيسية =======
  function initProfileGuard() {
    // نستنى Firebase + بيانات الطالب يكونوا جاهزين
    var tries = 0;
    var interval = setInterval(function () {
      tries++;
      var userStr = sessionStorage.getItem('currentStudent');
      if (!userStr && tries < 60) return; // لسه مستنيين
      clearInterval(interval);
      if (!userStr) return; // مش طالب — أدمن أو زائر، مش محتاجين

      var user;
      try { user = JSON.parse(userStr); } catch(e) { return; }

      // فحص هل عنده صورة بالفعل
      var existingPic = localStorage.getItem('profilePic_' + user.phone) || user.profilePic;
      if (existingPic && existingPic.length > 50) return; // عنده صورة — عدّي

      // مفيش صورة — اعرض المودال
      // نستنى الـ DOM يبقى جاهز
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { createModal(user, null); });
      } else {
        // تأخير بسيط عشان الصفحة تكمل التحميل وتكون جميلة
        setTimeout(function () { createModal(user, null); }, 800);
      }
    }, 250);
  }

  window.ProfileGuard = { init: initProfileGuard, createModal: createModal };
  initProfileGuard();

})();

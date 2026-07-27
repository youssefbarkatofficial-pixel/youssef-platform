/**
 * ============================================================
 * بوابة العلم — bousala-teach.js
 * نظام RAG (Retrieval-Augmented Generation)
 * الترتيب: كاش ← استخراج مباشر ← RAG ← مفتاح API
 * ============================================================
 */

(function() {
  'use strict';

  // ===================== تطبيع النص =====================
  function norm(t) {
    if (!t) return '';
    return t
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[ؤئ]/g, 'ء')
      .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // ===================== استخراج كلمات مفتاحية =====================
  var STOPWORDS = new Set([
    'من','في','على','إلى','عن','مع','هذا','هذه','ذلك','التي','الذي','كان',
    'كانت','هو','هي','هم','هن','انا','نحن','انت','انتم','لا','ما','لم','لن',
    'قد','اي','كل','جميع','بعض','غير','اكثر','اقل','مثل','حتى','لكن','بين',
    'ان','او','اذا','عند','بعد','قبل','خلال','حول','عبر','منذ','لدى'
  ]);

  function keywords(text) {
    var words = norm(text).split(' ');
    var result = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i].trim();
      if (w.length >= 3 && !STOPWORDS.has(w)) {
        result.push(w);
      }
    }
    // إزالة المكررات
    return result.filter(function(v, i, a) { return a.indexOf(v) === i; });
  }

  // ===================== تشابه كوسين بسيط =====================
  function similarity(kw1, kw2) {
    if (!kw1.length || !kw2.length) return 0;
    var set2 = new Set(kw2);
    var matches = 0;
    for (var i = 0; i < kw1.length; i++) {
      if (set2.has(kw1[i])) matches++;
    }
    return matches / Math.sqrt(kw1.length * kw2.length);
  }

  // ===================== تقطيع الدرس لمقاطع =====================
  function chunkLesson(text, maxLen) {
    maxLen = maxLen || 350;
    var sentences = text.split(/[.؟!]\s+|\n+/).filter(function(s) {
      return s.trim().length > 10;
    });
    var chunks = [];
    var current = '';
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i].trim();
      if ((current + ' ' + s).length > maxLen && current) {
        chunks.push(current.trim());
        current = s;
      } else {
        current = current ? current + ' ' + s : s;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length ? chunks : [text.trim()];
  }

  // ===================== Firestore Helpers =====================
  function getDb() {
    return window.firebaseDb || null;
  }

  // ===================== حفظ درس في Firestore =====================
  async function teachBousala(lessonText, meta) {
    meta = meta || {};
    var db = getDb();
    if (!db) {
      console.warn('[BOUSALA-TEACH] Firebase not ready');
      return 'خطأ: قاعدة البيانات غير متصلة.';
    }

    var chunks = chunkLesson(lessonText);
    var saved = 0;

    for (var i = 0; i < chunks.length; i++) {
      var chunk = chunks[i];
      try {
        var kw = keywords(chunk);
        await db.collection('bousala_lessons').add({
          text: chunk,
          keywords: kw,
          subject: meta.subject || 'دراسات اجتماعية',
          grade: meta.grade || '',
          unit: meta.unit || '',
          createdAt: Date.now()
        });
        saved++;
      } catch(e) {
        console.error('[BOUSALA-TEACH] Save error:', e);
      }
    }

    return '🧠 تم! البوصلة اتعلمت ' + saved + ' مقطع من الدرس.';
  }

  // ===================== استرجاع المقاطع الأقرب للسؤال =====================
  async function findLessonContext(question, topK) {
    topK = topK || 3;
    var db = getDb();
    if (!db) return { chunks: [], bestScore: 0 };

    var kw = keywords(question);
    if (!kw.length) return { chunks: [], bestScore: 0 };

    try {
      // نأخذ مقاطع تحتوي على أي من كلمات السؤال (max 10 كلمات)
      var snap = await db.collection('bousala_lessons')
        .where('keywords', 'array-contains-any', kw.slice(0, 10))
        .limit(40)
        .get();

      var scored = [];
      snap.forEach(function(doc) {
        var data = doc.data();
        var s = similarity(kw, data.keywords || []);
        if (s > 0.1) {
          scored.push({ score: s, text: data.text, id: doc.id });
        }
      });

      scored.sort(function(a, b) { return b.score - a.score; });

      return {
        chunks: scored.slice(0, topK).map(function(c) { return c.text; }),
        bestScore: scored.length ? scored[0].score : 0
      };
    } catch(e) {
      console.warn('[BOUSALA-TEACH] Firestore query failed:', e);
      return { chunks: [], bestScore: 0 };
    }
  }

  // ===================== استخراج مباشر بدون API =====================
  function extractDirect(question, chunks) {
    var kw = keywords(question);
    var best = '';
    var bestScore = 0;

    for (var ci = 0; ci < chunks.length; ci++) {
      // نقطع كل مقطع لجمل
      var sents = chunks[ci].split(/[.؟!]/).filter(function(s) {
        return s.trim().length > 10;
      });
      for (var si = 0; si < sents.length; si++) {
        var sent = sents[si].trim();
        var s = similarity(kw, keywords(sent));
        if (s > bestScore) {
          bestScore = s;
          // خد الجملة + اللي بعدها للسياق
          best = sent + (sents[si + 1] ? '. ' + sents[si + 1].trim() : '');
        }
      }
    }

    return bestScore >= 0.25 ? best.trim() : null;
  }

  // ===================== حذف كل الدروس =====================
  async function clearAllLessons() {
    var db = getDb();
    if (!db) return 'خطأ: قاعدة البيانات غير متصلة.';
    try {
      var snap = await db.collection('bousala_lessons').limit(500).get();
      var batch = db.batch();
      snap.forEach(function(doc) { batch.delete(doc.ref); });
      await batch.commit();
      return '🗑️ تم مسح ' + snap.size + ' مقطع من ذاكرة البوصلة.';
    } catch(e) {
      return 'خطأ أثناء المسح: ' + e.message;
    }
  }

  // ===================== عدد الدروس المحفوظة =====================
  async function getLessonsCount() {
    var db = getDb();
    if (!db) return 0;
    try {
      var snap = await db.collection('bousala_lessons').get();
      return snap.size;
    } catch(e) { return 0; }
  }

  // ===================== تصدير للاستخدام الخارجي =====================
  window.BousalaTeach = {
    teachBousala: teachBousala,
    findLessonContext: findLessonContext,
    extractDirect: extractDirect,
    clearAllLessons: clearAllLessons,
    getLessonsCount: getLessonsCount,
    keywords: keywords,
    similarity: similarity,
    norm: norm
  };

  console.log('[BOUSALA-TEACH] RAG module ready ✅');

})();

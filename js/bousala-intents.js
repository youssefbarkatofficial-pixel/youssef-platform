/**
 * ============================================================
 * بوابة العلم — bousala-intents.js
 * نظام مطابقة النوايا الذكي (Semantic Intent Matching) للبوصلة
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
      'ان','او','اذا','عند','بعد','قبل','خلال','حول','عبر','منذ','لدى',
      'يا','ايه','اي','هيا','هي','صح','ولا'
    ]);
  
    function extractKeywords(text) {
      var words = norm(text).split(' ');
      var result = [];
      for (var i = 0; i < words.length; i++) {
        var w = words[i].trim();
        // تقليل الطول المطلوب لـ 2 عشان كلمات زي "كم", "من" لو مش في الـ stopwords
        if (w.length >= 2 && !STOPWORDS.has(w)) {
          result.push(w);
        }
      }
      return result.filter(function(v, i, a) { return a.indexOf(v) === i; });
    }
  
    // ===================== تشابه Jaccard =====================
    function calculateSimilarity(kw1, kw2) {
      if (!kw1.length || !kw2.length) return 0;
      var set1 = new Set(kw1);
      var set2 = new Set(kw2);
      var intersection = 0;
      set1.forEach(function(w) {
          if (set2.has(w)) intersection++;
      });
      var union = new Set([...kw1, ...kw2]).size;
      return intersection / union;
    }
  
    // ===================== المحرك الرئيسي =====================
    window.BousalaIntents = {
        /**
         * حفظ ملف JSON في التخزين المحلي
         */
        saveIntentsData: function(jsonData) {
            try {
                if (typeof jsonData === 'string') jsonData = JSON.parse(jsonData);
                if (!jsonData.core_questions || !Array.isArray(jsonData.core_questions)) {
                    throw new Error("تنسيق الملف غير صحيح. تأكد من وجود مصفوفة core_questions");
                }
                localStorage.setItem('bousala_intents_db', JSON.stringify(jsonData));
                return { success: true, count: jsonData.core_questions.length };
            } catch (err) {
                console.error("Save Intents Error:", err);
                return { success: false, error: err.message };
            }
        },
  
        /**
         * استرجاع ملف النوايا
         */
        getIntentsData: function() {
            try {
                var data = localStorage.getItem('bousala_intents_db');
                return data ? JSON.parse(data) : { core_questions: [] };
            } catch (err) {
                return { core_questions: [] };
            }
        },
  
        /**
         * مطابقة سؤال الطالب مع بنك النوايا
         * يُرجع الـ Intent والإجابة إذا تجاوزت نسبة التشابه 40% (0.4)
         */
        matchIntent: function(userMessage) {
            var db = this.getIntentsData();
            if (!db || !db.core_questions || db.core_questions.length === 0) return null;
  
            var msgKeywords = extractKeywords(userMessage);
            if (msgKeywords.length === 0) return null;
  
            var bestMatch = null;
            var highestScore = 0;
  
            // استثناءات الطوارئ: مواد غير مدعومة
            var firstSecNonHistory = /(اولى ثانوي|1ث|الصف الاول الثانوي).*(فيزياء|كيمياء|احياء|رياضيات|عربي|لغة|انجليزي|فرنساوي|فلسفة)/i;
            if (firstSecNonHistory.test(userMessage)) {
                return {
                    intent: "مادة_غير_مدعومة",
                    category: "system_override",
                    answer: "حالياً المنصة بتوفر شرح 'تاريخ' بس لأولى ثانوي، لكن باقي المواد متوفرة من أولى إعدادي."
                };
            }
  
            // البحث الدلالي في النوايا
            for (var i = 0; i < db.core_questions.length; i++) {
                var q = db.core_questions[i];
                var variations = q.variations || q.expected_variations || [];
                
                for (var j = 0; j < variations.length; j++) {
                    var varKeywords = extractKeywords(variations[j]);
                    var score = calculateSimilarity(msgKeywords, varKeywords);
                    
                    if (score > highestScore) {
                        highestScore = score;
                        bestMatch = q;
                    }
                }
            }
  
            // إذا كان التشابه قوي (أكثر من 40%)
            if (highestScore >= 0.4 && bestMatch) {
                return {
                    intent: bestMatch.intent,
                    category: bestMatch.category,
                    answer: bestMatch.answer,
                    score: highestScore
                };
            }
  
            return null;
        }
    };
  })();

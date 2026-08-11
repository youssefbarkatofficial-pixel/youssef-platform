// Local grading utilities — مصحح عادل ومنصف للإجابات العربية
(function(window){
  'use strict';

  // ===== تطبيع النص العربي =====
  function removeDiacritics(text){
    if(!text) return '';
    return text.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  }

  function normalizeArabic(text){
    if(!text || typeof text !== 'string') return '';
    let s = text.trim().toLowerCase();
    s = removeDiacritics(s);
    s = s.replace(/[إأآا]/g, 'ا');
    s = s.replace(/ى/g, 'ي');
    s = s.replace(/ؤ|ئ/g, 'ء');
    s = s.replace(/ة/g, 'ه');
    s = s.replace(/[^\p{L}0-9\s]/gu, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function tokenize(text){
    const n = normalizeArabic(text);
    if(!n) return [];
    return n.split(' ').filter(Boolean);
  }

  // ===== قائمة الكلمات الشائعة التي لا تُعدّ كلمات مفتاحية =====
  // (حروف الجر، الضمائر، أسماء الإشارة، الصفات الجغرافية، صيغ التفضيل)
  const STOPWORDS = new Set(([
    // حروف الجر والعطف الأساسية
    'في','من','على','إلى','الى','عن','و','يا','أو','أم','ثم','بل','لكن','إذ','إذا','عند',
    'عندما','حين','بين','خلال','منذ','إلا','غير','أما','بما','عما','فيما','مما','رغم',
    'وراء','أمام','خلف','فوق','تحت','قبل','بعد','حتى','كي','لو','حتي',
    // ضمائر وأسماء إشارة
    'هو','هي','هذا','هذه','ذلك','تلك','هم','هن','هما','انا','انت','انتم','نحن',
    // أدوات وحروف
    'ما','لم','لن','لا','قد','كل','مع','إنه','إنها','أن','إن','كان','كانت','كانوا',
    'يكون','صار','اصبح','بات','ظل','ليس','ليست','مازال','لازال',
    // الذي / التي وما يشبهها
    'الذي','التي','الذين','اللتي','اللذي','اللائي','اللواتي',
    // كلمات ربط وتعليل
    'لان','لأن','لانه','لأنه','بسبب','نتيجه','نتيجة','لذا','لذلك','لهذا','وبالتالي',
    'حيث','كيف','متى','أين','تاليا','اخيرا','اولا','ثانيا','ثالثا','رابعا','خامسا',
    // صفات جغرافية اتجاهية (لا تحمل محتوى إجابة بمفردها)
    'الشمالية','الجنوبية','الشرقية','الغربية','الوسطى','المركزية','الداخلية',
    'الخارجية','العليا','السفلى','البحرية','البرية','الجوية','الشمالي','الجنوبي',
    'الشرقي','الغربي','الاوسط','الاوسط',
    // صيغ التفضيل (تُصف دون أن تحدد)
    'اطول','اكبر','اصغر','اقدم','اقصر','اكثر','اقل','اعلى','ادنى','افضل','اسوا',
    'اهم','اقوى','ادق','اوسع','ابعد','اقرب','اعمق','اعرض',
    // كلمات عامة لا تحمل معنى إجابة
    'ان','اي','بعض','معظم','جميع','سائر','باقي','بقية','اجمالي','اغلب','نفس',
    'عدد','مقدار','نسبه','نسبة','حوالي','تقريبا','نحو','قدر','وفق','حسب','طبقا',
    'يتم','يجري','تجري','تتم','تقوم','يقوم','بطريقه','بشكل','بصوره',
    'ايضا','أيضا','كذلك','ذات','نفسه','نفسها','كما','مثل','مثلما',
    // أرقام ترتيبية
    'اول','اولي','ثاني','ثالث','رابع','خامس','سادس','سابع','ثامن','تاسع','عاشر',
    // كلمات وصفية شائعة جداً
    'كبير','صغير','جديد','قديم','طويل','قصير','كبيره','صغيره',
  ]).map(s=>normalizeArabic(s)));

  function extractKeywords(text, topN = 6){
    const tokens = tokenize(text);
    const freq = {};
    // فقط الكلمات التي ليست stopwords وأطول من حرفين
    tokens.forEach(t=>{
      if(!STOPWORDS.has(t) && t.length > 2) freq[t] = (freq[t]||0)+1;
    });
    const keys = Object.keys(freq).sort((a,b)=>freq[b]-freq[a]).slice(0, topN);
    return keys;
  }

  function jaccard(aTokens, bTokens){
    const A = new Set(aTokens);
    const B = new Set(bTokens);
    const inter = [...A].filter(x=>B.has(x)).length;
    const uni = new Set([...A,...B]).size || 1;
    return inter/uni;
  }

  function levenshtein(a,b){
    if(a===b) return 0;
    const m=a.length, n=b.length;
    if(m===0) return n;
    if(n===0) return m;
    let v0 = new Array(n+1), v1 = new Array(n+1);
    for(let j=0;j<=n;j++) v0[j]=j;
    for(let i=0;i<m;i++){
      v1[0]=i+1;
      for(let j=0;j<n;j++){
        const cost = a[i]===b[j]?0:1;
        v1[j+1] = Math.min(v1[j]+1, v0[j+1]+1, v0[j]+cost);
      }
      [v0,v1]=[v1,v0];
    }
    return v0[n];
  }

  function normalizedLevenshtein(a,b){
    a = (a||''); b = (b||'');
    const d = levenshtein(a,b);
    const max = Math.max(a.length, b.length, 1);
    return 1 - (d / max);
  }

  // ===== تغطية الكلمات المفتاحية مع تسامح إملائي وجذر مشترك =====
  function softKeywordCoverage(studentTokens, keywords){
    if(!keywords.length) return 1;
    let matched = 0;
    for(const kw of keywords){
      // مطابقة مباشرة
      if(studentTokens.includes(kw)){ matched += 1; continue; }
      // تسامح إملائي (82%)
      const hasClose = studentTokens.some(t => normalizedLevenshtein(t, kw) >= 0.82);
      if(hasClose){ matched += 0.85; continue; }
      // جذر مشترك (أول 4 أحرف)
      const hasRoot = kw.length > 3 && studentTokens.some(t =>
        t.length > 3 && (t.startsWith(kw.slice(0,4)) || kw.startsWith(t.slice(0,4)))
      );
      if(hasRoot){ matched += 0.65; }
    }
    return Math.min(1, matched / keywords.length);
  }

  // ===== فحص الاحتواء: هل جوهر الإجابة موجود؟ =====
  function containmentScore(sn, cn){
    if(!sn || !cn) return 0;
    if(sn.includes(cn)) return 1.0;
    if(cn.includes(sn) && sn.length > 5) return 0.92;
    // فحص جزئي: نصف cn موجود في sn
    const mid = cn.slice(Math.floor(cn.length*0.25), Math.floor(cn.length*0.75));
    if(mid.length > 4 && sn.includes(mid)) return 0.80;
    return 0;
  }

  // Parse multiple accepted answers separated by *, / or ،
  function parseMultipleAnswers(answerRaw){
    if(!answerRaw || typeof answerRaw !== 'string') return [answerRaw || ''];
    if(!answerRaw.match(/[*\/،]/)) return [answerRaw];
    return answerRaw.split(/[*\/،]/).map(a => a.trim()).filter(Boolean);
  }

  function scoreAnswer(studentRaw, correctRaw, qType){
    const allCorrects = parseMultipleAnswers(correctRaw);
    if(allCorrects.length > 1){
      let bestResult = null;
      for(const alt of allCorrects){
        const res = _scoreAnswerSingle(studentRaw, alt, qType);
        if(!bestResult || res.score > bestResult.score) bestResult = res;
        if(bestResult.score >= 1) break;
      }
      return bestResult;
    }
    return _scoreAnswerSingle(studentRaw, correctRaw, qType);
  }

  // ===== دالة التصحيح الرئيسية =====
  function _scoreAnswerSingle(studentRaw, correctRaw, qType){
    const student = (studentRaw||'').toString();
    const correct = (correctRaw||'').toString();
    const sn = normalizeArabic(student);
    const cn = normalizeArabic(correct);

    // ===== أسئلة موضوعية: اختياري / صح وخطأ / أكمل =====
    if(['choose','tf','fill'].includes(qType)){
      if(!sn && !cn) return { score:0, feedback:'لم يتم إدخال إجابة.' };
      if(sn === cn) return { score:1, feedback:'إجابة صحيحة بالضبط.' };
      const lev = normalizedLevenshtein(sn, cn);
      if(lev >= 0.85) return { score:1, feedback:'إجابة صحيحة (تفاوت إملائي بسيط مقبول).' };
      if(cn.length===1 && sn.length===1 && cn === sn) return { score:1, feedback:'إجابة صحيحة.' };
      return { score:0, feedback:'الإجابة غير صحيحة. الإجابة الصحيحة: ' + correctRaw };
    }

    // ===== أسئلة مقالية: خوارزمية عادلة ومنصفة =====
    if(!sn) return { score:0, feedback:'لم يتم إدخال إجابة.' };

    const sTokens = tokenize(sn);
    const cTokens = tokenize(cn);

    // 1. فحص الاحتواء (الأقوى — الطالب كتب نفس الجوهر)
    const contain = containmentScore(sn, cn);
    if(contain >= 1.0) return { score:1, feedback:'إجابة صحيحة ومتطابقة.' };
    if(contain >= 0.92) return { score:0.95, feedback:'إجابة صحيحة باختصار مقبول.' };

    // 2. الكلمات المفتاحية (بعد استبعاد الكلمات الوصفية والحروف)
    const keywords = extractKeywords(correct, 6);

    // 3. تغطية الكلمات المفتاحية مع تسامح
    const kwCoverage = softKeywordCoverage(sTokens, keywords);

    // 4. تشابه جاكارد على مستوى الكلمات الكلية
    const jack = jaccard(sTokens, cTokens);

    // 5. تشابه ليفنشتاين الكلي (مفيد للجمل القصيرة)
    const levSim = normalizedLevenshtein(sn, cn);

    // ===== صيغة التصحيح العادلة =====
    // الفكرة: الكلمات المفتاحية مهمة (40%) لكن ليست كل شيء
    // التشابه الجاكاردي (35%) يمنح نقاط للإجابة المتقاربة
    // ليفنشتاين (25%) يساعد في الجمل القصيرة والاختصار
    let rawScore = (0.40 * kwCoverage) + (0.35 * jack) + (0.25 * levSim);

    // مكافأة: إذا كانت الكلمات المفتاحية الأساسية كلها موجودة → رفع الدرجة
    if(kwCoverage >= 0.80) rawScore = Math.min(1, rawScore + 0.10);

    // مكافأة الاحتواء الجزئي
    if(contain >= 0.80) rawScore = Math.max(rawScore, 0.82);

    const score = Math.max(0, Math.min(1, rawScore));

    // ===== الملاحظة =====
    const matchedKeywords = keywords.filter(k => sTokens.includes(k));
    let feedback = '';
    if(score >= 0.88)      feedback = 'ممتاز — إجابة شاملة ومطابقة للفكرة الأساسية.';
    else if(score >= 0.70) feedback = 'إجابة جيدة لكن ناقصها بعض التفاصيل.';
    else if(score >= 0.45) feedback = 'فيها الفكرة الأساسية لكن تحتاج تفصيلاً أكثر.';
    else                    feedback = 'الإجابة غير كافية — حاول تضمين: ' + (keywords.slice(0,3).join('، ') || correctRaw.substring(0,80));

    return {
      score: Number(score.toFixed(3)),
      keywords,
      matchedKeywords,
      coverage: Number(kwCoverage.toFixed(3)),
      jaccard: Number(jack.toFixed(3)),
      levSim: Number(levSim.toFixed(3)),
      feedback
    };
  }

  // Enrich question metadata for faster grading later (non-destructive)
  function enrichQuestion(q){
    try{
      const copy = Object.assign({}, q);
      copy._normalizedAnswer = normalizeArabic(q.answer || '');
      copy._answerTokens = tokenize(copy._normalizedAnswer);
      copy._keywords = extractKeywords(q.answer || '', 12);
      return copy;
    }catch(e){ return q; }
  }

  // Public API
  const PF_Grader = {
    normalizeArabic,
    tokenize,
    extractKeywords,
    scoreAnswer,
    enrichQuestion
  };

  // دائماً حدّث للإصدار الأحدث
  window.PF_Grader = PF_Grader;

})(window);

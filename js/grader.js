// Local grading utilities — additive, no external APIs
(function(window){
  'use strict';

  // Basic Arabic normalization utilities
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
    s = s.replace(/ة/g, 'ه'); // treat ta marbuta ~ ه to be tolerant
    s = s.replace(/[^\p{L}0-9\s]/gu, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function tokenize(text){
    const n = normalizeArabic(text);
    if(!n) return [];
    return n.split(' ').filter(Boolean);
  }

  const STOPWORDS = new Set(([
    'في','من','على','إلى','الى','عن','ما','لم','لن','هو','هي','هذا','هذه','ذلك','تلك','و','يا','أن','إن','كان','قد','كل','مع','بعد','حتى','إنه','إنها'
  ]).map(s=>normalizeArabic(s)));

  function extractKeywords(text, topN = 8){
    const tokens = tokenize(text);
    const freq = {};
    tokens.forEach(t=>{ if(!STOPWORDS.has(t)) freq[t] = (freq[t]||0)+1; });
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

  // Main scoring function — returns score 0..1 and feedback
  function scoreAnswer(studentRaw, correctRaw, qType){
    const student = (studentRaw||'').toString();
    const correct = (correctRaw||'').toString();
    const sn = normalizeArabic(student);
    const cn = normalizeArabic(correct);

    // Exact / near-exact detection (for choose / tf / fill)
    if(['choose','tf','fill'].includes(qType)){
      if(!sn && !cn) return { score:0, feedback:'لم يتم إدخال إجابة.' };
      if(sn === cn) return { score:1, feedback:'إجابة صحيحة بالضبط.' };
      const lev = normalizedLevenshtein(sn, cn);
      if(lev >= 0.85) return { score:1, feedback:'إجابة صحيحة (تفاوت إملائي بسيط تم تسامحه).' };
      // check single-character option match (A/B/C) or letter
      if(cn.length===1 && sn.length===1 && cn === sn) return { score:1, feedback:'إجابة صحيحة.' };
      return { score:0, feedback:'الإجابة غير صحيحة.' };
    }

    // For essay-like questions: weighted keyword + semantic overlap
    const sTokens = tokenize(sn);
    const cTokens = tokenize(cn);
    const keywords = extractKeywords(correct, 8);
    const matchedKeywords = keywords.filter(k => sTokens.includes(k));
    const kwCoverage = keywords.length ? (matchedKeywords.length / keywords.length) : 0;
    const jack = jaccard(sTokens, cTokens);
    const levSim = normalizedLevenshtein(sn, cn);

    // weighted combination — tuned conservatively
    const score = Math.max(0, Math.min(1, (0.55 * kwCoverage) + (0.25 * jack) + (0.20 * levSim)));

    // feedback rules
    let feedback = '';
    if(score >= 0.9) feedback = 'ممتاز — إجابة شاملة ومطابقة للفكرة الأساسية.';
    else if(score >= 0.7) feedback = 'إجابة جيدة لكن ناقصها نقطة أو نقطتين مهمة.';
    else if(score >= 0.45) feedback = 'إجابة فيها الفكرة الأساسية لكن تحتاج ترتيب أو أمثلة أو كلمات مفتاحية.';
    else feedback = 'الإجابة غير كافية — حاول تضمين النقاط التالية: ' + (keywords.slice(0,4).join('، ') || correctRaw.substring(0,80));

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

  // Expose globally
  if(!window.PF_Grader) window.PF_Grader = PF_Grader;

})(window);

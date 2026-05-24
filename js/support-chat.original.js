// Upgraded Support chat widget ("ط§ظ„ط¨ظˆطµظ„ط©") - lightweight, private, and smarter
(function(){
  const BASE_HISTORY_KEY = 'pf_support_chat_history_v2';
  const BASE_TICKETS_KEY = 'pf_support_tickets_v1';
  const CUSTOM_ANSWERS_KEY = 'pf_custom_answers_v1';
  const GUEST_SESSION_ID_KEY = 'pf_support_chat_guest_id';
  const LOGIN_WELCOME_KEY = 'pfJustLoggedIn';
  const WELCOME = 'أنا البوصلة بتاعتك، أقدر أساعدك إزاي يا جميل؟';

  // Helper utilities
  function nowTs(){ return Date.now(); }
  function fmtTimestamp(ts){
    const d = new Date(ts);
    const time = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: false });
    const date = d.toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${time} • ${date}`;
  }

  function getGuestSessionId(){
    let id = safeGetItem(sessionStorage, GUEST_SESSION_ID_KEY);
    if (!id) {
      id = 'guest_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
      safeSetItem(sessionStorage, GUEST_SESSION_ID_KEY, id);
    }
    return id;
  }

  function getCurrentUser() {
    const student = safeGetItem(sessionStorage, 'currentStudent');
    if (student) {
      try { return JSON.parse(student); } catch(e) { return null; }
    }
    const admin = safeGetItem(sessionStorage, 'currentAdmin');
    if (admin) {
      try { return JSON.parse(admin); } catch(e) { return null; }
    }
    return null;
  }

  function getUserContext() {
    const student = safeGetItem(sessionStorage, 'currentStudent');
    if (student) return { type: 'student', id: JSON.parse(student).phone };
    const admin = safeGetItem(sessionStorage, 'currentAdmin');
    if (admin) return { type: 'admin', id: JSON.parse(admin).email };
    return { type: 'guest', id: getGuestSessionId() };
  }

  function getStorageKey(prefix) {
    const ctx = getUserContext();
    return `${prefix}_${ctx.type}_${ctx.id}`;
  }

  const TRAINING_KEY = 'pf_ai_training_v1';
  const ADMIN_LEARNING_KEY = 'pf_admin_learning_v1';
  const PLATFORM_CONTENT_KEY = 'pf_platform_content_v1';
  const chatContext = { lastTopic: null, lastIssue: null, lastQuestion: null, lastCourse: null };
  const TYPO_MAP = {
    'كمبيوتر': 'كمبيوتر',
    'اشترك': 'اشتراك',
    'اشتركم': 'اشتراك',
    'الكراس': 'الكورس',
    'البصورةه': 'الباسورد',
    'مش عارف': 'مش عارف',
    'مش عارفه': 'مش عارف',
    'مش شغالة': 'مش شغالة',
    'مش شغاله': 'مش شغالة',
    'الفيديو': 'الفيديو',
    'المنسه': 'المنصة',
    'البلاتفورم': 'المنصة',
    'منصة': 'المنصة',
    'مش عارف': 'مش عارف',
    'معرفش': 'مش عارف'
  };

    const STORAGE_FALLBACK = {};
  function safeGetItem(storage, key) {
    try { return storage.getItem(key); } catch (e) { return STORAGE_FALLBACK[key] || null; }
  }
  function safeSetItem(storage, key, value) {
    try {
      storage.setItem(key, value);
      return true;
    } catch (e) {
      try { sessionStorage.setItem(key, value); } catch (_) {}
      STORAGE_FALLBACK[key] = value;
      return false;
    }
  }
  function getStorageForKey(key) {
    return key.includes('_guest_') ? sessionStorage : localStorage;
  }

  function isElementBroken(el) {
    if (!el) return true;
    if (!document.body.contains(el)) return true;
    try {
      const cs = window.getComputedStyle(el);
      if (!cs) return true;
      return cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0' || cs.opacity === 0;
    } catch (e) {
      return true;
    }
  }

  function normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    let normalized = text.toLowerCase()

      .replace(/[\u000B\u000C\u001F]/g, ' ')
      .trim();

    // remove Arabic diacritics and normalize common letter variants
    try {
      normalized = normalized
        .replace(/[إأآا]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[ؤئ]/g, 'ء')
        .replace(/[^0-9A-Za-z\u0600-\u06FF\s،\.,\?\!\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (e) {
      normalized = normalized.replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
    }

    Object.keys(TYPO_MAP).forEach(wrong => {
      const right = TYPO_MAP[wrong];
      normalized = normalized.replace(new RegExp(`\\b${wrong}\\b`, 'g'), right);
    });

    return normalized;
  }

  function analyzeStudentIntent(text) {
    const normalized = normalizeText(text);
    const emotionalTone = isStudyEmotion(text) ? 'stressed'
      : /شكر|متشكر|جزاك الله/.test(normalized) ? 'gratitude'
      : /انت طيب|اخرس|مش دكي|احمق/.test(normalized) ? 'angry'
      : 'neutral';

    const intent = /(?:اشترك|اشتراك|دفع|تحويل|فتح الكورس|الكورس|مش موجود|مش شغال|نسيت الباسورد|حسابي?)/.test(normalized)
      ? 'platform_support'
      : /(?:ازي|كيف|ليه|ايه|ايه سبب|فهم|شرح|مفهوم|مشكلة|سؤال)/.test(normalized)
      ? 'academic_explanation'
      : /(?:سلام|مرحبا|اهلا|ازيّك|عامل ايه|شكر|متشكر)/.test(normalized)
      ? 'conversation'
      : 'general';

    return {
      raw: text,
      normalized,
      emotionalTone,
      intent,
      complexity: normalized.length > 120 ? 'detailed' : 'brief',
      needsResearch: /(?:مصدر|بحث|جواب|ويكيبيديا|بريطانيا|معلومة)/.test(normalized)
    };
  }

  function masterEducatorCompose(rawText, intentData) {
    const base = (rawText || '').replace(/\s+/g, ' ').trim();
    let intro = 'يا بطل';
    if (intentData.emotionalTone === 'stressed') intro = 'ماتقلقش، هاشرحلك ده ببساطة.';
    if (intentData.emotionalTone === 'angry') intro = 'خلينا نرجع الموضع بشكل سهل وبسيط.';
    if (intentData.intent === 'conversation') intro = 'تم، خليني أقولك اللي محتاجه بسرعة.';
    return `${intro} ${base}`.trim();
  }

  function validateFinalAnswer(text, question) {
    let final = (text || '').trim();
    if (final.length > 700) {
      final = final.slice(0, 660).trim() + ' ...';
    }
    if (/https?:\/\//.test(final) || /<script|function\(|=>/.test(final)) {
      return 'لا أستطيع تقديم إجابة دقيقة الآن، لكني سأبذل قصارى جهدي لتوجيهك إلى الحل أو الموارد المناسبة.';
    }
    return final;
  }

  function composeFinalResponse(rule, question, intentData) {
    const rawText = rule && typeof rule.text === 'string' ? rule.text : '';
    const personaReply = masterEducatorCompose(rawText, intentData);
    return validateFinalAnswer(personaReply, question);
  }

  function loadTraining() {
    try { return JSON.parse(localStorage.getItem(TRAINING_KEY) || '{}'); } catch(e) { return {}; }
  }

  function saveTraining(data){ safeSetItem(localStorage, TRAINING_KEY, JSON.stringify(data)); }

  // Debounced save to reduce frequent localStorage writes
  let TRAINING_SAVE_TIMER = null;
  function saveTrainingDebounced(data, delay = 800){
    try{
      if (TRAINING_SAVE_TIMER) clearTimeout(TRAINING_SAVE_TIMER);
      TRAINING_SAVE_TIMER = setTimeout(()=>{
        safeSetItem(localStorage, TRAINING_KEY, JSON.stringify(data));
        TRAINING_SAVE_TIMER = null;
      }, delay);
    }catch(e){ /* ignore */ }
  }

  function learnInteraction(question, response) {
    const normalized = normalizeText(question);
    const training = loadTraining();
    if (!training[normalized]) {
      training[normalized] = { count: 0, response: response, last: Date.now() };
    }
    training[normalized].count += 1;
    training[normalized].response = response;
    training[normalized].last = Date.now();
    saveTrainingDebounced(training);
  }

  // ==================================================
  // ADVANCED SELF-IMPROVING AI SYSTEM
  // FOR "ط§ظ„ط¨ظˆطµظ„ط©" ASSISTANT
  // ==================================================

  // ADMIN LEARNING SYSTEM
  // When owner/admin manually answers difficult question:
  // AI learns style professionally without copying rude language
  function loadAdminLearning() {
    try { return JSON.parse(localStorage.getItem(ADMIN_LEARNING_KEY) || '{}'); } catch(e) { return {}; }
  }

  function saveAdminLearning(data){ safeSetItem(localStorage, ADMIN_LEARNING_KEY, JSON.stringify(data)); }

  function learnFromAdmin(question, adminResponse, context = {}) {
    if (!question || !adminResponse) return;
    const normalized = normalizeText(question);
    const learning = loadAdminLearning();
    
    if (!learning[normalized]) {
      learning[normalized] = {
        response: adminResponse,
        context: context,
        learned: Date.now(),
        count: 0,
        professional: true
      };
    }
    learning[normalized].count += 1;
    learning[normalized].response = adminResponse;
    learning[normalized].lastUpdated = Date.now();
    saveAdminLearning(learning);
  }

  function getAdminLearnedResponse(question) {
    const normalized = normalizeText(question);
    const learning = loadAdminLearning();
    if (learning[normalized] && learning[normalized].count >= 1) {
      return { text: learning[normalized].response, tag: 'admin-learned', professional: true };
    }
    return null;
  }

  // SMART SEARCH & RESEARCH MODE
  // If assistant does NOT confidently know an answer:
  // It should attempt fast intelligent search and analyze trusted sources
  async function getSmartSearch(query) {
    if (!query || query.length < 3) return null;
    
    const searchQueries = {
      ar: query,
      en: query.split(' ').map(w => w.replace(/[ط،-ظٹ]/g, '')).join(' '),
    };

    try {
      // Attempt to search trusted educational sources
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQueries.ar)}+site:wikipedia.org OR site:britannica.com OR site:khan-academy.org`;
      
      return {
        hasSearch: true,
        searchUrl: searchUrl,
        query: searchQueries.ar,
        recommendation: 'ظٹظ…ظƒظ†ظƒ ط§ظ„ط¨ط­ط« ط¹ظ† ط§ظ„ظ…ط²ظٹط¯ ظ…ظ† ط§ظ„ظ…ط¹ظ„ظˆظ…ط§طھ'
      };
    } catch (e) {
      return null;
    }
  }

  // DYNAMIC KNOWLEDGE SYSTEM
  // Analyze platform lessons, PDFs, course titles dynamically
  function loadPlatformContent() {
    try { return JSON.parse(localStorage.getItem(PLATFORM_CONTENT_KEY) || '{}'); } catch(e) { return {}; }
  }

  function savePlatformContent(data){ safeSetItem(localStorage, PLATFORM_CONTENT_KEY, JSON.stringify(data)); }

  function analyzePlatformContent() {
    const courses = JSON.parse(localStorage.getItem('adminCourses') || '[]');
    const content = {};
    
    courses.forEach(course => {
      if (course && course.title && course.id) {
        content[normalizeText(course.title)] = {
          original: course.title,
          hasContent: !!(course.contents && Object.keys(course.contents).length > 0),
          contentTypes: course.contents ? Object.keys(course.contents) : [],
          description: course.description || ''
        };
      }
    });
    
    savePlatformContent(content);
    return content;
  }

  function getContentBasedResponse(question) {
    const normalized = normalizeText(question);
    const content = loadPlatformContent();
    
    for (let key in content) {
      if (normalized.includes(key.split(' ')[0])) {
        const info = content[key];
        return {
          text: `يمكنني إرشادك إلى محتوى الدورة "${info.original}" التي تحتوي على ${info.contentTypes.join(' و ')}.`,
          tag: 'content-based'
        };
      }
    }
    return null;
  }

  // FALLBACK RESPONSE SYSTEM
  // Professional fallback when assistant genuinely cannot answer
  function getFallbackResponse(question) {
    return {
      text: 'أنا آسف، لا أستطيع تقديم إجابة دقيقة على هذا السؤال الآن. إذا رغبت، يمكنني تسجيل طلبك للدعم المباشر أو توجيهك إلى الموارد المناسبة.',
      type: 'fallback-escalate',
      shouldEscalate: true
    };
  }

  // ANTI-CHEATING RULES ENHANCED
  // During exams, homework, trainings, quizzes:
  // Explain concept, guide student, teach method - NEVER provide direct answers
  function checkAntiCheatContext(text, context = {}) {
    const normalized = normalizeText(text);
    const isExamTime = context.examActive || false;
    const isHomeworkSubmission = context.homeworkDeadline || false;
    
    if (isCheatingRequest(normalized)) {
      if (isExamTime || isHomeworkSubmission) {
        return {
          isCheat: true,
          strict: true,
          response: 'ط®ظ„ط§ظ„ ظپطھط±ط© ط§ظ„ط§ظ…طھط­ط§ظ† ط£ظˆ طھط³ظ„ظٹظ… ط§ظ„ظˆط§ط¬ط¨طŒ ط£ظ‚ط¯ط± ط£ط´ط±ط­ظ„ظƒ ط§ظ„ظ…ظپظ‡ظˆظ… ط¨ط³ ظ…ط§ ط£ط­ظ„ط´ ط§ظ„ط³ط¤ط§ظ„ ط¨ط§ظ„ظƒط§ظ…ظ„. ط¥ط´ط±ط­ ظ„ظٹ ط§ظ„ط¬ط²ط، ط§ظ„ظ„ظٹ ظ…ط´ ظˆط§ط¶ط­ ظˆط§ط­ظ†ط§ ظ†ظ‚ط¯ظ‘ظ… ظ…ط¹ظ‹ط§ ط®ط·ظˆط© ط¨ط®ط·ظˆط©.',
          allowExplanation: true,
          allowGuidance: true,
          allowDirectAnswer: false
        };
      }
      return {
        isCheat: true,
        strict: false,
        response: 'ظ…ظ‚ط¯ط±ط´ ط£ط³ط§ط¹ط¯ظƒ ظپظ‰ ط¯ظ‡طŒ ط§ظ„ط£ط³طھط§ط° ظٹظˆط³ظپ ط¨ط±ظƒط§طھ ظ„ظˆ ظ„ظ…ط­ظ†ظٹ ظ‡ظٹظ…ط±ط¬ط­ظ†ظٹ ًںک‚',
        allowExplanation: false,
        allowGuidance: false,
        allowDirectAnswer: false
      };
    }
    return { isCheat: false };
  }

  // SMART UNDERSTANDING ENGINE
  // Understand Egyptian Arabic, spelling mistakes, slang, incomplete sentences, context
  function enhancedNormalization(text) {
    if (!text || typeof text !== 'string') return '';
    
    let enhanced = normalizeText(text);
    
    // Handle slang and colloquial phrases (fixed Arabic strings)
    const slangMap = {
      'كويس': 'جيد',
      'ممتاز': 'رائع',
      'سيء': 'سيئ',
      'وحش': 'سيئ',
      'ضبط': 'اصلاح',
      'شغال': 'يعمل',
      'شايف': 'أرى'
    };
    
    Object.keys(slangMap).forEach(slang => {
      enhanced = enhanced.replace(new RegExp(`\\b${slang}\\b`, 'g'), slangMap[slang]);
    });
    
    return enhanced;
  }

  // MEMORY & CONTEXT SYSTEM ENHANCED
  // Remember current conversation context, connect previous messages logically
  function enrichChatContext(question, response, metadata = {}) {
    chatContext.lastQuestion = question;
    chatContext.lastResponse = response;
    chatContext.metadata = metadata;
    chatContext.timestamp = Date.now();
  }

  function getContextAwareResponse(question) {
    if (!chatContext.lastQuestion) return null;
    
    const normalized = normalizeText(question);
    const lastNormalized = normalizeText(chatContext.lastQuestion);
    
    // Check if related to previous topic
    const words = normalized.split(' ');
    const lastWords = lastNormalized.split(' ');
    const commonWords = words.filter(w => lastWords.includes(w)).length;
    
    if (commonWords > 0 && chatContext.lastResponse) {
      return {
        text: `ط§ط³طھظ…ط±ط§ط±ظ‹ط§ ط¹ظ„ظ‰ ط§ظ„ط³ط¤ط§ظ„ ط§ظ„ط³ط§ط¨ظ‚طŒ ${chatContext.lastResponse}`,
        tag: 'context-aware'
      };
    }
    return null;
  }

  function getTrainedResponse(question) {
    const normalized = normalizeText(question);
    const training = loadTraining();
    if (training[normalized] && training[normalized].count >= 2) {
      return { text: training[normalized].response, tag: 'trained' };
    }
    return null;
  }

  function getPlatformFacts() {
    const courses = JSON.parse(localStorage.getItem('adminCourses') || '[]');
    const user = getCurrentUser();
    let subscribed = [];
    let dbUser = {
      stats: { commitment: 0, videosWatched: 0, homeworkCompleted: 0, homeworkTotal: 0 },
      courses: [],
      notifications: []
    };

    if (user && user.phone) {
      try {
        const raw = localStorage.getItem(`db_${user.phone}`);
        if (raw) dbUser = JSON.parse(raw) || dbUser;
      } catch (e) {
        dbUser = dbUser;
      }
      subscribed = Array.isArray(dbUser.courses) ? dbUser.courses : [];
    }

    const detailedCourses = Array.isArray(courses)
      ? subscribed.map(id => courses.find(c => c.id === id)).filter(Boolean)
      : [];
    const courseTitles = detailedCourses.map(c => c.title);
    const courseCount = courseTitles.length;
    const hasCourses = courseCount > 0;
    const notifications = Array.isArray(dbUser.notifications) ? dbUser.notifications : [];
    const notificationCount = notifications.length;
    const progressPercent = dbUser.stats && typeof dbUser.stats.commitment === 'number' ? dbUser.stats.commitment : 0;
    const videosWatched = dbUser.stats && typeof dbUser.stats.videosWatched === 'number' ? dbUser.stats.videosWatched : 0;
    const homeworkCompleted = dbUser.stats && typeof dbUser.stats.homeworkCompleted === 'number' ? dbUser.stats.homeworkCompleted : 0;
    const homeworkTotal = dbUser.stats && typeof dbUser.stats.homeworkTotal === 'number' ? dbUser.stats.homeworkTotal : 0;
    const contentHints = [];

    detailedCourses.forEach(course => {
      if (course.contents) {
        if (Array.isArray(course.contents.homeworks) && course.contents.homeworks.length > 0) contentHints.push(`ظپظٹ ${course.title} ظپظٹ ظˆط§ط¬ط¨ط§طھ`);
        if (Array.isArray(course.contents.exams) && course.contents.exams.length > 0) contentHints.push(`ظپظٹ ${course.title} ظپظٹ ط§ظ…طھط­ط§ظ†ط§طھ`);
      }
    });

    return {
      courses,
      subscribed,
      detailedCourses,
      courseTitles,
      courseTitlesString: courseTitles.join('طŒ '),
      hasCourses,
      courseCount,
      dbUser,
      notifications,
      notificationCount,
      progressPercent,
      videosWatched,
      homeworkCompleted,
      homeworkTotal,
      contentHints
    };
  }

  function getSmartResponse(text) {
    const normalized = normalizeText(text);
    if (!normalized) return null;

    if (/ط¹ط§ظ…ظ„ ط§ظٹظ‡|ط§ط²ظٹظƒ|ط§ظٹظ‡ ط§ط®ط¨ط§ط±ظƒ|ظˆط¶ط¹ظƒ ط§ظٹظ‡|طµط¨ط§ط­ ط§ظ„ط®ظٹط±|ظ…ط³ط§ط، ط§ظ„ط®ظٹط±/.test(normalized)) {
      return { text: 'ط§ظ„ط­ظ…ط¯ ظ„ظ„ظ‡ ظٹط§ ط¨ط·ظ„طŒ ط±ط¨ظ†ط§ ظ…ط¹ط§ظƒ. ظ‚ظ„ظ‘ظٹ ط¥ظٹظ‡ ط§ظ„ظ…ط·ظ„ظˆط¨ ظˆط£ظ†ط§ ط£ط¸ط¨ط·ظ„ظƒ ط§ظ„ط±ط¯.' };
    }
    if (/ط§ظ†طھ ظ…ظٹظ†|ظ…ظٹظ† ط§ظ†طھ|ط§ظ†طھ ظ…ظٹظ†/.test(normalized)) {
      return { text: 'ط£ظ†ط§ ط§ظ„ط¨ظˆطµظ„ط© ط¨طھط§ط¹طھظƒ ظپظٹ ط§ظ„ظ…ظ†طµط©طŒ طµط§ظٹط¹ ط§ظ„ط±ط¯ظˆط¯ ظˆط¯ط§ظٹظ…ظ‹ط§ ظ…ط¹ط§ظƒ ظپظٹ ط§ظ„ظ…ط°ط§ظƒط±ط© ظˆط§ظ„ط¯ط¹ظ….' };
    }
    if (/ظ…ط´ ظ‚ط§ط¯ط±.*ط°ط§ظƒط±|ظ…ط´ ظ‚ط§ط¯ط±.*ط§ظ„ط°ط§ظƒط±|ظ…ط¹ط±ظپط´|ظ…ط§ط¹ط±ظپط´|ظ…ط´ ط¹ط±ظپ|ظ…ط´ ظپط§ظ‡ظ…|ظ…ط´ ط¹ط§ط±ظپ\b/.test(normalized)) {
      return { text: 'ظˆظ„ط§ ظٹظ‡ظ…ظƒطŒ ظƒظ„ظ†ط§ ط¨ظ†ظ…ط± ط¨ط¯ظ‡. ظ‚ط³ظ‘ظ… ط§ظ„ظ…ط°ط§ظƒط±ط© ط¹ظ„ظ‰ ط£ط¬ط²ط§ط، طµط؛ظٹط±ط© ظˆط£ط¨ط¯ط£ ط¨ط­ط§ط¬ط© ط¨ط³ظٹط·ط©طŒ ظˆط£ظ†ط§ ط£ط³ط§ظ†ط¯ظƒ ط®ط·ظˆط© ط¨ط®ط·ظˆط©.' };
    }
    if (/ط®ط§ظٹظپ.*ط§ظ„ط§ظ…طھط­ط§ظ†|ط®ط§ظٹظپ ظ…ظ† ط§ظ„ط§ظ…طھط­ط§ظ†|ظ‚ظ„ظ‚ط§ظ†.*ط§ظ„ط§ظ…طھط­ط§ظ†/.test(normalized)) {
      return { text: 'ط§ظ„ط®ظˆظپ ط¯ظ‡ ط·ط¨ظٹط¹ظٹطŒ ط¨ط³ ظ„ظ…ط§ طھظƒظˆظ† ظ…ظ†ط¸ظ… ظˆط¨طھط±ط§ط¬ط¹ طµط­ ظ‡طھظ„ط§ظ‚ظٹ ظ†ظپط³ظƒ ظ…ط±طھط§ط­. ظ‚ظˆظ„ظ‘ظٹ ط§ظ†طھ ظ…ط­طھط§ط¬ طھط°ط§ظƒط± ظپظٹ ط¥ظٹظ‡ ط¨ط§ظ„ط¸ط¨ط·.' };
    }
    if (/ط§ظ†ط§ ظپط§ط´ظ„|ط§ظ†ط§ ظپط´ظ„|ط§ظ†ط§ ظˆط­ط´|ظ…ط´ ظ‡ظ‚ط¯ط±/.test(normalized)) {
      return { text: 'ظ…ط§ طھظ‚ظˆظ„ط´ ظƒط¯ظ‡طŒ ط§ظ„ظ„ظٹ ظٹظ‚ط¹ط¯ ظٹط­ط§ظˆظ„ ظ‡ظˆ ط§ظ„ظ„ظٹ ظٹظƒط³ط¨. ط£ظ†ط§ ظ‡ظ†ط§ ط£ط³ط§ط¹ط¯ظƒ ط¨ظƒظ„ ظˆظ‚طھ ظˆطھظ‚ط¯ط± طھط·ظˆط± ظ†ظپط³ظƒ ظ…ظ† ط¯ظ„ظˆظ‚طھظٹ.' };
    }
    if (/ط¹ط§ظˆط².*ط­ط¯.*ظٹط³ط§ط¹ط¯ظ†ظٹ|ط¹ط§ظٹط².*ط­ط¯.*ظٹط³ط§ط¹ط¯ظ†ظٹ|ط¹ط§ظٹط² ط­ط¯ ظٹط³ط§ط¹ط¯ظ†ظٹ|ط¹ط§ظٹط² ظ…ط³ط§ط¹ط¯ط©/.test(normalized)) {
      return { text: 'طھظ…ط§ظ… ظٹط§ ط¬ظ…ظٹظ„طŒ ط§ط¨ط¹طھظ„ظٹ ط¨ط§ظ„طµط±ط§ط­ط© ط§ظ„ظ…ط´ظƒظ„ط© ط£ظˆ ط§ظ„ظƒظˆط±ط³ ط§ظ„ظ„ظٹ ظ…ط¹ط·ظ„ ظ…ط¹ط§ظƒطŒ ظˆط£ظ†ط§ ظ‡ط¯ظٹظƒ ط­ظ„ ط¨ط§ظ„ظ…طµط±ظٹ ظˆط§ظ„ط¹ط±ط¨ظٹ.' };
    }
    if (/ط§ظ†طھ ط°ظƒظٹ|ظƒظˆظٹط³|ظ…ظ…طھط§ط²/.test(normalized)) {
      return { text: 'ط¨ط­ط§ظˆظ„ ط£ظƒظˆظ† ظƒظˆظٹط³ ط¯ظ„ظˆظ‚طھظٹطŒ ط¨ط³ ط§ظ„ظ„ظٹ ظپط¹ظ„ط§ظ‹ ط°ظƒظٹ ظ‡ظˆ ط§ظ„ظ„ظٹ ط¨ظٹطھط¹ط¨ ظˆظٹط¨ط°ظ„ ظ…ط¬ظ‡ظˆط¯.' };
    }
    if (/ط´ظƒط±ط§|ظ…طھط´ظƒط±|ظ…ظٹط±ط³ظٹ|طھط³ظ„ظ…|ط¬ط²ط§ظƒ ط§ظ„ظ„ظ‡|ط¬ط²ط§ظƒ ط§ظ„ظ„ظ‡ ط®ظٹط±/.test(normalized)) {
      return { text: 'ط¹ظ„ظ‰ ط¹ظٹظ†ظٹ ظٹط§ ط¨ط·ظ„طŒ ط±ط¨ظ†ط§ ظٹط®ظ„ظٹظƒ. ظ„ظˆ ط¹ظ†ط¯ظƒ ط³ط¤ط§ظ„ ط؛ط±ظٹط¨ ط£ظˆ ظ…ط´ ظˆط§ط¶ط­طŒ ظ‡ط§ط¨طµ ط¹ظ„ظٹظ‡ ط¨ط³ط±ط¹ط© ظˆط£ط­ط§ظˆظ„ ط£ط±ط¯ ط¹ظ„ظٹظƒ طµط­.' };
    }
    if (/ط¨ط­ط¨ظƒ/.test(normalized)) {
      return { text: 'ظˆط£ظ†ط§ ط¨ط­ط¨ ط§ظ„ط·ظ„ط¨ط© ط§ظ„ط´ط§ط·ط±ط© ط§ظ„ظ„ظٹ ط¨طھط¬طھظ‡ط¯طŒ ظˆط§ط­ظ†ط§ ظ…ط¹ ط¨ط¹ط¶ ظ‡ظ†ظƒط³ط± ط§ظ„ط¯ظ†ظٹط§.' };
    }
    if (/ط§ظ†طھ ط؛ط¨ظٹ|ط§ظ†طھ ط§ط­ظ…ظ‚|ظ…ط´ ط°ظƒظٹ|ط§ط­ظ…ظ‚|طھط§ظپظ‡/.test(normalized)) {
      return { text: 'ظٹط§ ط¹ظ… ظ…ط´ ظ„ط§ط²ظ… ظ†ط®ط´ ظپظٹ ط§ظ„ظƒظ„ط§ظ… ط¯ظ‡طŒ ط®ظ„ظٹظ†ظٹ ط£ظپظ‡ظ…ط§ظƒ ط¨ط´ظƒظ„ ط£ط¨ط³ط· ظˆط£ط¸ط¨ط·ظ„ظƒ ط§ظ„ط±ط¯ ط§ظ„ظ„ظٹ طھط­طھط§ط¬ظ‡.' };
    }
    if (/ط­ظ„ظˆ|ط¬ظ…ظٹظ„|ط¸ط±ظٹظپ/.test(normalized)) {
      return { text: 'ط§ظ„ط­ظ…ط¯ ظ„ظ„ظ‡طŒ ط®ظ„ظٹظ†ظٹ ط£ظƒظ…ظ„ ظ…ط¹ط§ظƒ ط¹ظ„ظ‰ ظ†ظپط³ ط§ظ„ظ…ظˆط¬ط© ظˆظ†ط¸ط¨ط· ظ„ظƒ ط­ظ„ ظٹط³ط§ط¹ط¯ظƒ.' };
    }
    return null;
  }

  function isVeryUnclearMessage(text) {
    const normalized = normalizeText(text);
    if (!normalized) return true;
    if (normalized.length <= 3) return true;
    const keywords = /(ظƒظˆط±ط³|ظˆط§ط¬ط¨|ط¯ط¹ظ…|ط¯ط®ظˆظ„|ط¨ط§ط³ظˆط±ط¯|ظپظٹط¯ظٹظˆ|ظ…ط´ظƒظ„|ظ…ط´ظƒظ„ظ‡|ظ…ط°ط§ظƒط±|ط§ظ…طھط­ط§ظ†|طھط³ط¬ظٹظ„|طھط­ظˆظٹظ„|ط¯ظپط¹|ط³ط¤ط§ظ„|ط§ظ‡ظ„ط§|ظ…ط±ط­ط¨ط§|ط¹ط§ظٹط²|ط§ظƒطھط¨)/;
    return normalized.split(' ').length <= 2 && !keywords.test(normalized);
  }

  function getRudeResponse(text) {
    const normalized = normalizeText(text);
    if (/ط§ظ†طھ ط؛ط¨ظٹ|ط§ظ†طھ ط§ط­ظ…ظ‚|ظ…ط´ ط°ظƒظٹ|طھط§ظپظ‡|ط§ط®ط±ط³/.test(normalized)) {
      return { text: 'ظ…ظ…ظƒظ† ط£ظƒظˆظ† ظپظ‡ظ…طھظƒ ط؛ظ„ط· ًںک… ط¬ط±ظ‘ط¨ طھظˆط¶ظ‘ط­ظ„ظٹ ط£ظƒطھط± ظˆط£ظ†ط§ ظ‡ط­ط§ظˆظ„ ط£ط³ط§ط¹ط¯ظƒ.' };
    }
    return null;
  }

  function isCheatingRequest(text) {
    const normalized = normalizeText(text);
    return /ط­ظ„ ط§ظ„ط³ط¤ط§ظ„ ط¯ظ‡|ط­ظ„ ط§ظ„ط³ط¤ط§ظ„|ط­ظ„ ط§ظ„ط§ظ…طھط­ط§ظ†|ط¹ط§ظٹط² ط­ظ„|ط§ظƒطھط¨ ط§ظ„ط§ط¬ط§ط¨ط©|ط¬ظٹط¨ظ„ظٹ ط§ظ„ط§ط¬ط§ط¨ط©|طھط³ط±ظٹط¨|ط؛ط´|ط§ط¬ط§ط¨ط© ظ…ط¨ط§ط´ط±ط©|ظ†ظ…ط±ظ‡|ط¯ط±ط¬ط©|ط§ط²ط§ظٹ ط§ط¹ظ…ظ„ ط­ظ„|ط§ظƒطھط¨ظ„ظٹ ط§ظ„ط­ظ„/.test(normalized);
  }

  function isStudyEmotion(text) {
    return /ط§ظ†ط§ طھط¹ط¨ط§ظ†|ظ…ط´ ظ‚ط§ط¯ط± ط£ط°ط§ظƒط±|ظ…ط´ ظ‚ط§ط¯ط± ط§ط°ظƒط±|ط®ط§ظٹظپ ظ…ظ† ط§ظ„ط§ظ…طھط­ط§ظ†|ط§ظ†ط§ ط®ط§ظٹظپ|ط§ظ„طھظˆطھط±|ط¶ط؛ط· ط§ظ„ط§ظ…طھط­ط§ظ†|ظ…ط¹ظ„ظ‚طھط´|ظ…ط´ ظ‚ط§ط¯ط±|طھط¹ط¨ط§ظ†/.test(normalizeText(text));
  }

  function isSameIssueFollowup(text) {
    return /(ظ„ط³ظ‡ ط§ظ„ظ…ط´ظƒظ„ط©|ظ„ط³ظ‡ ظ…ط´ظƒظ„ظ‡|ظ„ط³ظ‡ ط§ظ„ظ…ط´ظƒظ„ط© ظ…ظˆط¬ظˆط¯ظ‡|ظ„ط³ظ‡ ط§ظ„ظ…ط´ظƒظ„ط© ظ…ظˆط¬ظˆط¯ط©|ظ„ط³ظ‡ ظ†ظپط³ ط§ظ„ظ…ط´ظƒظ„ط©|ظ„ط³ظ‡ ط§ظ„ظ…ط´ظƒظ„ط©)/.test(normalizeText(text));
  }

  function getKnownResponses(text) {
    const normalized = normalizeText(text);
    const fallback = { text: null };
    if (/ط§ط´طھط±ظƒ|ط§ط²ط§ظٹ ط§ط´طھط±ظƒ|ط§ط´طھط±ط§ظƒ|ط§ط´طھط±ظٹ|ط¹ط§ظٹط² ط§ط´طھط±ظƒ/.test(normalized)) {
      return { text: 'ط§ط¯ط®ظ„ ط¹ظ„ظ‰ ظ‚ط³ظ… ط§ظ„ظƒظˆط±ط³ط§طھطŒ ط§ط®طھط§ط± ط§ظ„ظƒظˆط±ط³ ط§ظ„ظ…ظ†ط§ط³ط¨ ظ„طµظپظƒطŒ ظˆط§ط¶ط؛ط· ط§ط´طھط±ط§ظƒ. ط¨ط¹ط¯ ظƒط¯ظ‡ ظ‡طھط¸ظ‡ط±ظ„ظƒ ط·ط±ظٹظ‚ط© ط§ظ„ط¯ظپط¹ ظˆط§ظ„طھط¹ظ„ظٹظ…ط§طھ ط§ظ„ظƒط§ظ…ظ„ط© ظ„ظ„طھط­ظˆظٹظ„ ظˆط±ظپط¹ طµظˆط±ط© ط§ظ„طھط­ظˆظٹظ„.' };
    }
    if (/ط§ظ„ظƒظˆط±ط³ ظ…ط´ ط´ط؛ط§ظ„|ط§ظ„ظƒظˆط±ط³ ظ…ط´ ط´ط؛ظ‘ط§ظ„|ط§ظ„ظƒظˆط±ط³ ظ…ط´ ط´ط؛ط§ظ„ظ‡|ط§ظ„ظƒظˆط±ط³ ظ…ط´ ط´ط؛ط§ظ„/.test(normalized)) {
      return { text: 'طھط£ظƒط¯ ط§ظ„ط£ظˆظ„ ظ…ظ† ط§ظ„ظ†طھ ظˆط³ط¬ظ„ ط®ط±ظˆط¬ ظˆط¯ط®ظˆظ„ ظ…ط±ط© طھط§ظ†ظٹط©. ظ„ظˆ ظ„ط³ظ‡ ط§ظ„ظ…ط´ظƒظ„ط©طŒ ط§ط¨ط¹طھظ„ظٹ ط§ط³ظ… ط§ظ„ظƒظˆط±ط³ ط£ظˆ طµظˆط±ط©طŒ ظˆط£ظ†ط§ ط£ط¸ط¨ط·ظ„ظƒ ط­ظ„ ط³ط±ظٹط¹.' };
    }
    if (/ظ†ط³ظٹطھ.*ط§ظ„ط¨ط§ط³ظˆط±ط¯|ظ†ط³ظٹطھ.*ظƒظ„ظ…ظ‡ ط§ظ„ظ…ط±ظˆط±|ظ†ط³ظٹطھ ط§ظ„ط¨ط§ط³ظˆط±ط¯|ظ†ط³ظٹطھ ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±/.test(normalized)) {
      return { text: "ط§ط¶ط؛ط· ط¹ظ„ظ‰ 'ظ†ط³ظٹطھ ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±' ظ…ظ† طµظپط­ط© طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„ ظˆط§طھط¨ط¹ ط§ظ„ط®ط·ظˆط§طھطŒ ظˆظ„ظˆ ظ…ط´ ط¸ط¨ط· ظ…ط¹ط§ظƒ ط§ط¨ط¹طھظ„ظٹ ظˆظ‡ظ‚ظˆظ„ظƒ طھط¹ظ…ظ„ ط¥ظٹظ‡." };
    }
    if (/ظپظٹظ†.*ط§ظ„ظˆط§ط¬ط¨ط§طھ|ظپظٹظ†.*ط§ظ„ظˆط§ط¬ط¨|ط§ظ„ظˆط§ط¬ط¨ ظپظٹظ†/.test(normalized)) {
      return { text: 'ط§ظ„ظˆط§ط¬ط¨ط§طھ ط¨طھط¨ظ‚ظ‰ ط¬ظˆظ‡ ط§ظ„ظƒظˆط±ط³ ط§ظ„ظ„ظٹ ط§ظ†طھ ظ…ط´طھط±ظƒ ظپظٹظ‡ ط¨ط¹ط¯ ظƒظ„ ط­طµط©. ظ„ظˆ ظ…ط´ ظ„ط§ظ‚ظٹظ‡ط§طŒ ظ‚ظˆظ„ظ‘ظٹ ط§ط³ظ… ط§ظ„ظƒظˆط±ط³ ظˆط§ظ†ط§ ط£ظ‚ظˆظ„ظƒ طھظ…ط´ظٹ ظپظٹظ†.' };
    }
    if (/ط§ظ…طھظ‰.*ط§ظ„ط­طµط©|ط¥ظ…طھظ‰.*ط§ظ„ط­طµط©|ظ…ظٹط¹ط§ط¯.*ط§ظ„ط­طµط©|ظ…ظˆط¹ط¯.*ط§ظ„ط­طµط©/.test(normalized)) {
      return { text: 'ظ…ظˆط§ط¹ظٹط¯ ط§ظ„ط­طµطµ ط¨طھظƒظˆظ† ظ…ظˆط¬ظˆط¯ط© ط¬ظˆظ‡ ط§ظ„ظƒظˆط±ط³ ظˆظپظٹ ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ. ظ„ظˆ ظ…ط´ ط´ط§ظٹظپظ‡ط§ ط§ظپطھط­ ط§ظ„ظƒظˆط±ط³ ط£ظˆ ط§ط¨ط¹طھظ„ظٹ ط§ط³ظ… ط§ظ„ظƒظˆط±ط³.' };
    }
    if (/ط¯ظپط¹طھ.*ظ„ط³ظ‡|ظ„ط³ظ‡ ط§ظ„ظƒظˆط±ط³ ظ…ظپطھط­ط´|ظ„ط³ظ‡ ظپطھط­ط´|ط§ظ„ظƒظˆط±ط³ ظ…ط´ ظ…ظپطھظˆط­/.test(normalized)) {
      return { text: 'ط؛ط§ظ„ط¨ظ‹ط§ ط·ظ„ط¨ظƒ طھط­طھ ط§ظ„ظ…ط±ط§ط¬ط¹ط©طŒ ط§طھط£ظƒط¯ ط¥ظ† طµظˆط±ط© ط§ظ„طھط­ظˆظٹظ„ ظˆط§ط¶ط­ط©. ظ„ظˆ ظ„ط³ظ‡طŒ ط§ط¨ط¹طھظ„ظٹ ط§ط³ظ… ط§ظ„ظƒظˆط±ط³ ظˆظ‡ظ†ط§ط®ط¯ ط§ظ„ظ…ظˆط¶ظˆط¹ ظ…ط¹ ط§ظ„ط¯ط¹ظ….' };
    }
    if (/ط¹ط§ظˆط².*ط§ظƒظ„ظ… ط§ظ„ط¯ط¹ظ…|ط¹ط§ظٹط².*ط§ظƒظ„ظ… ط§ظ„ط¯ط¹ظ…|ط¹ط§ظˆط² ط£ظƒظ„ظ… ط§ظ„ط¯ط¹ظ…|ط§ظ„ظƒظ„ط§ظ… ظ…ط¹ ط§ظ„ط¯ط¹ظ…/.test(normalized)) {
      return { text: 'طھظ‚ط¯ط± طھظپطھط­ طµظپط­ط© ط§ظ„ظ…ط³ط§ط¹ط¯ط© ط£ظˆ طھط³طھط®ط¯ظ… ظˆط§طھط³ط§ط¨ ط§ظ„ط¯ط¹ظ… ط§ظ„ظ…ظˆط¬ظˆط¯ ظپظٹ ط§ظ„ظ…ظ†طµط©. ط£ظ†ط§ ظ…ظˆط¬ظˆط¯ ط£ط³ط§ط¹ط¯ظƒ ظپظٹ ط£ظٹ ط­ط§ط¬ط© ط¨ط¹ط¯ظٹظ†.' };
    }
    if (/ط£ظپط¶ظ„ ط·ط±ظٹظ‚ط©.*ط£ط°ط§ظƒط±|ط§ظپط¶ظ„ ط·ط±ظٹظ‚ط©.*ط§ط°ط§ظƒط±|ط§ط²ط§ظٹ ط£ط°ط§ظƒط±|ط§ط²ط§ظٹ ط§ط°ط§ظƒط±/.test(normalized)) {
      return { text: 'ط§ط¨ط¯ط£ ط¨ط´ط±ط­ ط§ظ„ط¯ط±ط³ ظˆط¨ط¹ط¯ظ‡ط§ ط­ظ„ ط§ظ„ظˆط§ط¬ط¨ ظپظˆط±ظ‹ط§طŒ ظˆط±ط§ط¬ط¹ ط£ط®ط·ط§ط،ظƒ ط£ظˆظ„ ط¨ط£ظˆظ„ ط¹ط´ط§ظ† ط§ظ„طھط±ط§ظƒظ…ط§طھ ظ…طھط²ظٹط¯ط´ ط¹ظ„ظٹظƒ.' };
    }
    if (/ط§ظ†ط§ ظ…ط´ ظپط§ظ‡ظ… ط§ظ„ط¯ط±ط³|ط§ظ†ط§ ظ…ط´ ظپط§ظ‡ظ…|ظ…ط´ ظپط§ظ‡ظ… ط§ظ„ط¯ط±ط³|ظ…ط´ ظپط§ظ‡ظ…/.test(normalized)) {
      return { text: 'ظˆظ„ط§ ظٹظ‡ظ…ظƒ â‌¤ï¸ڈ ظ‚ظˆظ„ظ‘ظٹ ط§ظ„ط¬ط²ط، ط§ظ„ظ„ظٹ ظˆط§ظ‚ظپ ظ…ط¹ط§ظƒ ظˆط£ظ†ط§ ظ‡ط­ط§ظˆظ„ ط£ط¨ط³ط·ظ‡ظˆظ„ظƒ ط®ط·ظˆط© ط¨ط®ط·ظˆط©.' };
    }
    if (/ط§ظ„ط§ط³طھط§ط° ظٹظˆط³ظپ.*ط±ط§ط¬ط¹|ظ‡ظˆ ط§ظ„ط£ط³طھط§ط° ظٹظˆط³ظپ.*ظ…ط±ط§ط¬ط¹ط§طھ|ظٹظ†ط²ظ„ ظ…ط±ط§ط¬ط¹ط§طھ|ظ…ط±ط§ط¬ط¹ط§طھ.*ظٹظˆط³ظپ/.test(normalized)) {
      return { text: 'ط£ظٹظˆط©طŒ ط§ظ„ظ…ظ†طµط© ظپظٹظ‡ط§ ظ…ط±ط§ط¬ط¹ط§طھ ط¯ظˆط±ظٹط© ظˆظ†ظ‡ط§ط¦ظٹط© ظˆطھط¬ظ…ظٹط¹ط§طھ ظ…ظ‡ظ…ط© ط¬ط¯ظ‹ط§ ظ‚ط¨ظ„ ط§ظ„ط§ظ…طھط­ط§ظ†ط§طھ.' };
    }
    if (/ط§ط²ط§ظٹ.*ï¸ڈ?ط§ط¬ظٹط¨ ط¯ط±ط¬ط© ط¹ط§ظ„ظٹط©|ط¥ط²ط§ظٹ.*ط¯ط±ط¬ط© ط¹ط§ظ„ظٹط©|ط§ط²ط§ظٹ ط§ط¬ظٹط¨ ط¯ط±ط¬ط© ط¹ط§ظ„ظٹط©|ط¹ط§ظٹط² ط¯ط±ط¬ط© ط¹ط§ظ„ظٹط©/.test(normalized)) {
      return { text: 'ط§ظ„ط§ط³طھظ…ط±ط§ط±ظٹط© ط£ظ‡ظ… ظ…ظ† ط¹ط¯ط¯ ط§ظ„ط³ط§ط¹ط§طھطŒ ط°ط§ظƒط± ط£ظˆظ„ ط¨ط£ظˆظ„ ظˆط­ظ„ ط§ظ„ط§ظ…طھط­ط§ظ†ط§طھ ظˆط§ظ„ظˆط§ط¬ط¨ط§طھ ط¨طھط±ظƒظٹط².' };
    }
    return fallback;
  }

  function getPlatformReply(text) {
    const facts = getPlatformFacts();
    const normalized = normalizeText(text);

    if (/(dashboard|ظ„ظˆط­ط©|ظ„ظˆط­ط© ط§ظ„طھط­ظƒظ…)/.test(normalized)) {
      if (facts.hasCourses) {
        return { text: `ط£ظ†طھ ط¯ظ„ظˆظ‚طھظٹ ظ…ط´طھط±ظƒ ظپظٹ ${facts.courseCount} ظƒظˆط±ط³${facts.courseCount > 1 ? 'ط§طھ' : ''} (${facts.courseTitlesString}). ظپطھط­ ظ„ظˆط­ط© ط§ظ„طھط­ظƒظ… ط¹ط´ط§ظ† طھط´ظˆظپ ط§ظ„طھظ‚ط¯ظ…طŒ ط§ظ„ظپظٹط¯ظٹظˆظ‡ط§طھطŒ ظˆط§ظ„ظˆط§ط¬ط¨ط§طھ.` };
      }
      return { text: 'ظ„ظˆط­ط© ط§ظ„طھط­ظƒظ… ط¬ط§ظ‡ط²ط© ظ„ظٹظƒطŒ ظ„ظƒظ† ظ„ط³ظ‡ ظ…ط¹ظ†ط¯ظƒط´ ط£ظٹ ظƒظˆط±ط³ ظ…ط´طھط±ظƒ ظپظٹظ‡. ط§ط®طھط§ط± ط£ظˆظ„ ظƒظˆط±ط³ ظ…ظ† طµظپط­ط© ط§ظ„ظƒظˆط±ط³ط§طھ.' };
    }

    if (/(progress|ظ†ط³ط¨ط©|طھظ‚ط¯ظ…|ظ…ط³طھظˆظ‰|performance)/.test(normalized)) {
      if (facts.hasCourses) {
        return { text: `ط§ظ„طھظ‚ط¯ظ… ط§ظ„ط­ط§ظ„ظٹ ط¨طھط§ط¹ظƒ: ${facts.progressPercent}% ط§ظ„طھط²ط§ظ…طŒ ط´ط§ظ‡ط¯طھ ${facts.videosWatched} ظپظٹط¯ظٹظˆ${facts.videosWatched === 1 ? '' : 'ط§طھ'}طŒ ظˆط£ظ†ط¬ط²طھ ${facts.homeworkCompleted}/${facts.homeworkTotal} ظˆط§ط¬ط¨ط§طھ.` };
      }
      return { text: 'ظ…ط§ظپظٹط´ ط¨ظٹط§ظ†ط§طھ طھظ‚ط¯ظ… ظ„ط­ط¯ ط¯ظ„ظˆظ‚طھظٹ ظ„ط£ظ†ظƒ ظ…ط´طھط±ظƒ ظپظٹط´ ظƒظˆط±ط³. ظ„ظˆ ط­ط¨ظٹطھ ط£ط³ط§ط¹ط¯ظƒ طھط®طھط§ط± ظƒظˆط±ط³ ظ…ظ†ط§ط³ط¨طŒ ظ‚ظˆظ„ظ‘ظٹ ط³ظ†ط© ط¯ط±ط§ط³طھظƒ.' };
    }

    if (/(notification|ط§ط´ط¹ط§ط±|ط§ط´ط¹ط§ط±ط§طھ)/.test(normalized)) {
      if (facts.notificationCount > 0) {
        return { text: `ط¹ظ†ط¯ظƒ ${facts.notificationCount} ط¥ط´ط¹ط§ط±${facts.notificationCount > 1 ? 'ط§طھ' : ''} ظپظٹ ط­ط³ط§ط¨ظƒ. طھظ‚ط¯ط± طھظپطھط­ ظ„ظˆط­ط© ط§ظ„طھط­ظƒظ… ظˆطھط´ظˆظپظ‡ظ… ط¯ظ„ظˆظ‚طھظٹ.` };
      }
      return { text: 'ظ…ط§ظپظٹط´ ط¥ط´ط¹ط§ط±ط§طھ ط¬ط¯ظٹط¯ط© ط¯ظ„ظˆظ‚طھظٹ. ظ„ظˆ ظ…ط­طھط§ط¬ ظ…ط³ط§ط¹ط¯ط©طŒ ط£ظ†ط§ ظ‡ظ†ط§.' };
    }

    if (/(homework|ظˆط§ط¬ط¨)/.test(normalized)) {
      if (facts.hasCourses) {
        const homeworkStatus = facts.homeworkTotal ? `ط£ظ†ط¬ط²طھ ${facts.homeworkCompleted}/${facts.homeworkTotal} ظˆط§ط¬ط¨ط§طھ` : 'ظ„ط³ظ‡ ظ…ط§ ط§ط¶ظپطھط´ ظˆط§ط¬ط¨ط§طھ ط±ط³ظ…ظٹط© ظ„ط¨ظٹط§ظ†ط§طھظƒ';
        const hint = facts.contentHints.length > 0 ? ` ${facts.contentHints.slice(0, 2).join('طŒ ')}.` : '';
        return { text: `ط£ظ†طھ ظ…ط´طھط±ظƒ ظپظٹ ${facts.courseCount} ظƒظˆط±ط³${facts.courseCount > 1 ? 'ط§طھ' : ''} (${facts.courseTitlesString}). ${homeworkStatus}.${hint} ط§ظپطھط­ طµظپط­ط© ط§ظ„ظƒظˆط±ط³ ط§ظ„ظ„ظٹ ط´ط؛ط§ظ„ ظپظٹظ‡ ط¹ط´ط§ظ† طھط¯ط®ظ„ ط¹ظ„ظ‰ ط§ظ„ظˆط§ط¬ط¨ط§طھ.` };
      }
      return { text: 'ظ„ظ…ط§ طھطھط£ظƒط¯ ط§ط´طھط±ط§ظƒظƒ ظپظٹ ظƒظˆط±ط³ طھظ‚ط¯ط± طھطھط§ط¨ط¹ ط§ظ„ظˆط§ط¬ط¨ط§طھ ظ…ظ† ظ„ظˆط­ط© ط§ظ„طھط­ظƒظ….' };
    }

    if (/(exam|ط§ظ…طھط­ط§ظ†|ط§ط®طھط¨ط§ط±)/.test(normalized)) {
      if (facts.hasCourses) {
        const examsHint = facts.contentHints.filter(h => h.includes('ط§ظ…طھط­ط§ظ†ط§طھ')).slice(0, 2).join('طŒ ');
        return { text: `ظپظٹ ط§ظ„ظƒظˆط±ط³ط§طھ ط§ظ„ظ„ظٹ ط§ظ†طھ ظ…ط´طھط±ظƒ ظپظٹظ‡ط§ ظ…ظ…ظƒظ† طھظ„ط§ظ‚ظٹ ط§ظ…طھط­ط§ظ†ط§طھ ظˆظ…ط±ط§ط¬ط¹ط§طھ. ${examsHint || 'ط§ظپطھط­ ط§ظ„ظƒظˆط±ط³ ط¹ط´ط§ظ† طھط¹ط±ظپ ط§ظ„طھظپط§طµظٹظ„'}.` };
      }
      return { text: 'ظ„ظ…ط§ طھط´طھط±ظƒ ظپظٹ ظƒظˆط±ط³ ظ‡ط¹ط±ظپ ط£ظ‚ظˆظ„ظƒ ط¥ط°ط§ ظƒط§ظ† ظپظٹظ‡ ط§ظ…طھط­ط§ظ†ط§طھ ظˆظ…ط±ط§ط¬ط¹ط§طھ ظ…طھط§ط­ط©.' };
    }

    if (/(course|ظƒظˆط±ط³)/.test(normalized) && facts.hasCourses) {
      return { text: `ط§ظ†طھ ظ…ط´طھط±ظƒ ظپظٹ ${facts.courseCount} ظƒظˆط±ط³${facts.courseCount > 1 ? 'ط§طھ' : ''}: ${facts.courseTitlesString}. طھظ‚ط¯ط± طھظپطھط­ طµظپط­ط© ط§ظ„ظƒظˆط±ط³ط§طھ ط£ظˆ ظ„ظˆط­ط© ط§ظ„طھط­ظƒظ… ط¹ط´ط§ظ† طھظƒظ…ظ„.` };
    }

    if (/(course|ظƒظˆط±ط³)/.test(normalized) && !facts.hasCourses) {
      return { text: 'ظ„ظˆ ظ„ط³ظ‡ ظ…ط´طھط±ظƒط´ ظپظٹ ط£ظٹ ظƒظˆط±ط³طŒ طھظ‚ط¯ط± طھط¯ط®ظ„ ط¹ظ„ظ‰ طµظپط­ط© ط§ظ„ظƒظˆط±ط³ط§طھ ظˆطھط´ظˆظپ ط§ظ„ط¹ط±ظˆط¶ ط§ظ„ظ…طھط§ط­ط© ظˆطھط®طھط§ط± ط§ظ„ظƒظˆط±ط³ ط§ظ„ظ…ظ†ط§ط³ط¨ ظ„طµظپظƒ.' };
    }

    return null;
  }

  function getFollowUpReply(text) {
    if (isSameIssueFollowup(text) && chatContext.lastIssue) {
      return { text: `ظ„ط³ظ‡ ظ†ظپط³ ط§ظ„ظ…ط´ظƒظ„ط©طں ط®ظ„ظٹظ†ظٹ ط£ط±ط§ط¬ط¹ ظ…ط¹ط§ظƒ طھط§ظ†ظٹ. ط§ظ„ظ…ط´ظƒظ„ط© ظƒط§ظ†طھ ظپظٹ: ${chatContext.lastIssue}.` };
    }
    if (isStudyEmotion(text)) {
      return { text: 'ط­ط³ظٹطھ ط¥ظ†ظƒ ظ…طھظˆطھط± ط´ظˆظٹط©طŒ ظˆط¯ظ‡ ط·ط¨ظٹط¹ظٹ. ط®ظ„ظٹظƒ ظ…ط±ظƒط² ط®ط·ظˆط© ط¨ط®ط·ظˆط©طŒ ظˆط®ط¯ ط¨ط±ظٹظƒ ط¨ط³ظٹط· ط¨ط¹ط¯ ظƒظ„ ط¬ظ„ط³ط© ظ…ط°ط§ظƒط±ط©طŒ ظˆط£ظٹ ط­ط§ط¬ط© ظ…ط­طھط§ط¬ طھظˆط¶ظٹط­ ظپظٹظ‡ط§ ط§ط¨ط¹طھظ„ظٹ ط¯ظ„ظˆظ‚طھظٹ.' };
    }
    return null;
  }

  function setLastContext(topic, issue, course) {
    chatContext.lastTopic = topic || chatContext.lastTopic;
    chatContext.lastIssue = issue || chatContext.lastIssue;
    chatContext.lastCourse = course || chatContext.lastCourse;
  }

  function ruleAnswerFor(text){
    const normalized = normalizeText(text);
    const custom = loadCustom();
    
    // Try admin learned response first
    const adminLearned = getAdminLearnedResponse(text);
    if (adminLearned) return adminLearned;
    
    const trained = getTrainedResponse(text);
    if (trained) return trained;

    const explicitAdmin = custom[normalized];
    if (explicitAdmin) return { text: explicitAdmin, tag:'custom' };

    const rude = getRudeResponse(text);
    if (rude) return rude;

    const smart = getSmartResponse(text);
    if (smart) return smart;

    // Anti-cheating rules with context awareness
    const antiCheatCheck = checkAntiCheatContext(text);
    if (antiCheatCheck.isCheat) {
      return { text: antiCheatCheck.response || 'ظ…ظ‚ط¯ط±ط´ ط£ط³ط§ط¹ط¯ظƒ ظپظ‰ ط¯ظ‡طŒ ط§ظ„ط£ط³طھط§ط° ظٹظˆط³ظپ ط¨ط±ظƒط§طھ ظ„ظˆ ظ„ظ…ط­ظ†ظٹ ظ‡ظٹظ…ط±ط¬ط­ظ†ظٹ ًںک‚', type:'anti-cheat', strict: antiCheatCheck.strict };
    }

    const followUp = getFollowUpReply(text);
    if (followUp) return followUp;

    const known = getKnownResponses(text);
    if (known.text) {
      if (/ط§ظ„ظƒظˆط±ط³ ظ…ط´ ط´ط؛ط§ظ„|ط§ظ„ظƒظˆط±ط³ ظ…ط´ ط´ط؛ظ‘ط§ظ„|ط§ظ„ظƒظˆط±ط³ ظ…ط´ ط´ط؛ط§ظ„ظ‡|ط§ظ„ظƒظˆط±ط³ ظ…ط´ ط´ط؛ط§ظ„/.test(normalized)) {
        setLastContext('course_issue', 'ط§ظ„ظƒظˆط±ط³ ظ…ط´ ط´ط؛ط§ظ„', null);
      }
      if (/ظ†ط³ظٹطھ.*ط§ظ„ط¨ط§ط³ظˆط±ط¯|ظ†ط³ظٹطھ.*ظƒظ„ظ…ظ‡ ط§ظ„ظ…ط±ظˆط±|ظ†ط³ظٹطھ ط§ظ„ط¨ط§ط³ظˆط±ط¯|ظ†ط³ظٹطھ ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±/.test(normalized)) {
        setLastContext('auth_issue', 'ظ†ط³ظٹطھ ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±', null);
      }
      return known;
    }

    const platformReply = getPlatformReply(text);
    if (platformReply) return platformReply;

    // Try context-aware response
    const contextAware = getContextAwareResponse(text);
    if (contextAware) return contextAware;

    // Try content-based response
    const contentBased = getContentBasedResponse(text);
    if (contentBased) return contentBased;

    if (isVeryUnclearMessage(text)) {
      return { text: 'ظ…ط¹ظ„ط´ ظٹط§ ط¬ظ…ظٹظ„ â‌¤ï¸ڈ\nظ…ظ…ظƒظ† طھظƒطھط¨ ط³ط¤ط§ظ„ظƒ ط¨ط´ظƒظ„ ط£ظˆط¶ط­ ط´ظˆظٹط© ط¹ط´ط§ظ† ط£ط¹ط±ظپ ط£ط³ط§ط¹ط¯ظƒ طµط­طں' };
    }

    if (/ظ„ظٹظ‡|ط§ط²ط§ظٹ|ط§ظٹظ‡ ط³ط¨ط¨|ظ…ط´ ظˆط§ط¶ط­|ظ…ط¹ظ„ط´|ظ…ظ…ظƒظ†|ط³ط¤ط§ظ„ ط؛ط±ظٹط¨|ط³ط¤ط§ظ„ ظ…ط´ ظˆط§ط¶ط­/.test(normalized)) {
      return { text: 'ط¯ط§ ط³ط¤ط§ظ„ ظ…ظ‡ظ…طŒ ظ‡ط§ط¨طµ ط¹ظ„ظٹظ‡ ط¨ط³ط±ط¹ط© ظپظٹ ط§ظ„ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ„ظٹ ط¹ظ†ط¯ظٹ ظˆط£ط­ط§ظˆظ„ ط£ط±ط¯ ط¹ظ„ظٹظƒ ط¨ط£ط¨ط³ط· ط´ظƒظ„. ظ„ظˆ ط§ظ„ظ…ظˆط¶ظˆط¹ ظ…ط´ ظˆط§ط¶ط­طŒ ط§ط´ط±ط­ظ„ظٹ ط£ظƒطھط± ظˆط£ظ†ط§ ظ‡ط§طھط¹ظ„ظ… ظ…ظ†ظ‡.' };
    }

    // Specific direct request handling
    if (/ط­ظ„ ط§ظ„ط³ط¤ط§ظ„ ط¯ظ‡|ط­ظ„ ط§ظ„ط³ط¤ط§ظ„|ط¹ط§ظٹط² ط­ظ„/.test(normalized)) {
      setLastContext('cheat_attempt', 'ط·ظ„ط¨ ط­ظ„ ظ…ط¨ط§ط´ط±', null);
      return { text: 'ط¹ط´ط§ظ† ط£ط³ط§ط¹ط¯ظƒ طµط­طŒ ظ‚ظˆظ„ظ‘ظٹ ط§ظ„ط³ط¤ط§ظ„ ط§ظ„ظ„ظٹ ظˆط§ظ‚ظپ ظ…ط¹ط§ظƒ ط¹ط´ط§ظ† ط£ط´ط±ط­ظ„ظƒ ط§ظ„ظپظƒط±ط© ظ…ط´ ط£ط­ظ„ظ‡ظ„ظƒ.' };
    }

    // Fallback to professional escalation
    return getFallbackResponse(text);
  }

  function learnFromResponse(question, response) {
    if (!question || !response) return;
    learnInteraction(question, response);
  }

  function googleSearchUrl(query) {
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  function loadHistory(){
    try{
      const key = getStorageKey(BASE_HISTORY_KEY);
      const storage = getStorageForKey(key);
      return JSON.parse(storage.getItem(key) || '[]');
    } catch(e){ return []; }
  }

  function saveHistory(h){ const key = getStorageKey(BASE_HISTORY_KEY); const storage = getStorageForKey(key); safeSetItem(storage, key, JSON.stringify(h)); }

  function loadTickets(){
    try{
      const key = getStorageKey(BASE_TICKETS_KEY);
      const storage = getStorageForKey(key);
      return JSON.parse(storage.getItem(key) || '[]');
    } catch(e){ return []; }
  }

  function saveTickets(t){ const key = getStorageKey(BASE_TICKETS_KEY); const storage = getStorageForKey(key); safeSetItem(storage, key, JSON.stringify(t)); }

  function loadCustom(){ try{ return JSON.parse(localStorage.getItem(CUSTOM_ANSWERS_KEY) || '{}'); }catch(e){ return {} } }
  function saveCustom(c){ safeSetItem(localStorage, CUSTOM_ANSWERS_KEY, JSON.stringify(c)); }

  function playSound(name){
    try {
      if(window.audioManager && typeof window.audioManager.play === 'function'){
        if(name === 'open') return window.audioManager.play('notifOpen');
        if(name === 'close') return window.audioManager.play('notifArrive');
      }
    } catch(e) {}
  }

  // Curated suggestion chips (controlled, safe, and contextual)
  const SUGGESTED = [
    'نسيت الباسورد',
    'أغير الإيميل إزاي؟',
    'إزاي أشترك؟',
    'عندي مشكلة في الدفع',
    'فين الكورسات بتاعتي؟',
    'مين صاحب المنصة؟',
    'أكلم الدعم الفني',
    'إزاي أبدأ؟'
  ];

  // Create support ticket and notify admin (localStorage/sessionStorage-based fallback)
  function createSupportTicket(user, message){
    const current = user || getCurrentUser() || { phone:'guest' };
    const tickets = loadTickets();
    const ticket = {
      id: 'ticket_' + Date.now(),
      user: { phone: current.phone || current.email || 'guest', name: current.name || 'guest' },
      userId: current.phone || current.email || 'guest',
      message,
      ts: nowTs(),
      status:'open'
    };
    tickets.push(ticket);
    saveTickets(tickets);
    safeSetItem(localStorage, 'pf_unseen_support_tickets', String((parseInt(safeGetItem(localStorage, 'pf_unseen_support_tickets')||'0')||0)+1));
    if(window.showToast) window.showToast('طھظ… ط¥ظ†ط´ط§ط، طھط°ظƒط±ط© ط¯ط¹ظ…طŒ ط³ظٹطھظˆط§طµظ„ ظ…ط¹ظƒ ظپط±ظٹظ‚ ط§ظ„ط¯ط¹ظ… ظ‚ط±ظٹط¨ط§ظ‹', 'success');
    return ticket;
  }

  function transferGuestSupportSessionToAccount(user) {
    if (!user || !user.phone) return;

    const guestId = safeGetItem(sessionStorage, GUEST_SESSION_ID_KEY);
    if (!guestId) return;

    const guestHistoryKey = `${BASE_HISTORY_KEY}_guest_${guestId}`;
    const guestTicketsKey = `${BASE_TICKETS_KEY}_guest_${guestId}`;
    const userHistoryKey = `${BASE_HISTORY_KEY}_student_${user.phone}`;
    const userTicketsKey = `${BASE_TICKETS_KEY}_student_${user.phone}`;

    const guestHistory = JSON.parse(safeGetItem(sessionStorage, guestHistoryKey) || '[]');
    const existingHistory = JSON.parse(localStorage.getItem(userHistoryKey) || '[]');
    const mergedHistory = guestHistory.length ? [...guestHistory, ...existingHistory] : existingHistory;
    if (mergedHistory.length) {
      safeSetItem(localStorage, userHistoryKey, JSON.stringify(mergedHistory));
    }
    sessionStorage.removeItem(guestHistoryKey);

    const guestTickets = JSON.parse(safeGetItem(sessionStorage, guestTicketsKey) || '[]');
    const existingTickets = JSON.parse(localStorage.getItem(userTicketsKey) || '[]');
    const migratedTickets = guestTickets.map(t => ({ ...t, user: { phone: user.phone, name: user.name || '' }, userId: user.phone }));
    if (migratedTickets.length) {
      safeSetItem(localStorage, userTicketsKey, JSON.stringify([...existingTickets, ...migratedTickets]));
    }
    sessionStorage.removeItem(guestTicketsKey);

    return mergedHistory;
  }

  // Rendering helpers
  // Fix common mojibake (double-encoded UTF-8 shown as sequences like 'ط§ظ„')
  function fixMojibake(s){
    if(!s || typeof s !== 'string') return s;
    try{
      // quick heuristic: contains typical mojibake fragments (ط§ or Ã/Â)
      if(/ط§|Ã|Â/.test(s)){
        return decodeURIComponent(escape(s));
      }
      return s;
    }catch(e){
      return s;
    }
  }

  function mkMsgEl(item){
    const el = document.createElement('div');
    el.className = 'pf-msg '+(item.who==='user'?'user':'bot');
    if(item.status) el.setAttribute('data-status', item.status);
    const inner = document.createElement('div');
    inner.className='pf-msg-inner';
    inner.textContent = fixMojibake(item.text);
    el.appendChild(inner);
    if(!item.noTime){
      const meta = document.createElement('div');
      meta.className='pf-msg-meta';
      meta.textContent = fmtTimestamp(item.ts);
      el.appendChild(meta);
    }
    return el;
  }

  function appendMessage(item, scroll = false){ const box = document.getElementById('pfChatMessages'); const el = mkMsgEl(item); box.appendChild(el); if(scroll){ box.scrollTop = box.scrollHeight; } }

  function renderHistory(scrollToBottom = false){ const h = loadHistory(); const box = document.getElementById('pfChatMessages'); if(!box) return; const wasAtBottom = box.scrollHeight - box.clientHeight - box.scrollTop < 20; box.innerHTML=''; h.forEach(it=> appendMessage(it)); if(scrollToBottom || wasAtBottom){ box.scrollTop = box.scrollHeight; } }

  // Prevent duplicate welcome message
  function ensureWelcome(){ const h = loadHistory(); if(h.length === 0){ h.push({ who:'bot', text: WELCOME, ts: nowTs(), status:'delivered', noTime: true }); saveHistory(h); return; }
    const last = h[h.length-1]; if(!last || last.text !== WELCOME){ // only add if not equal
      h.push({ who:'bot', text: WELCOME, ts: nowTs(), status:'delivered', noTime: true }); saveHistory(h);
    }
  }

  // Typing indicator
  function addTyping(){ const box = document.getElementById('pfChatMessages'); const wasAtBottom = box.scrollHeight - box.clientHeight - box.scrollTop < 20; const el = document.createElement('div'); el.className='pf-msg bot typing'; el.id='pfTyping'; const inner = document.createElement('div'); inner.className='pf-msg-inner'; inner.innerHTML = '<span class="dots"><i>.</i><i>.</i><i>.</i></span>'; el.appendChild(inner); box.appendChild(el); if(wasAtBottom){ box.scrollTop = box.scrollHeight; } }
  function removeTyping(){ const t = document.getElementById('pfTyping'); if(t) t.remove(); }

  function showWelcomeBubble(delay = 4500) {
    const bubble = document.getElementById('pfChatBubble');
    const windowEl = document.getElementById('pfChatWindow');
    if (!bubble || (windowEl && windowEl.style.display === 'flex')) return;
    bubble.textContent = fixMojibake(WELCOME);
    bubble.style.display = 'block';
    bubble.style.opacity = '1';
    if (window.audioManager && safeGetItem(sessionStorage, LOGIN_WELCOME_KEY)) {
      window.audioManager.playStudentWelcome && window.audioManager.playStudentWelcome();
      sessionStorage.removeItem(LOGIN_WELCOME_KEY);
    }
    clearTimeout(bubble._hideTimer);
    bubble._hideTimer = setTimeout(()=>{ bubble.style.display='none'; }, delay);
  }

  // Generate a helpful fallback answer when no rule matches
  function generateFallbackAnswer(text){
    try{
      const normalized = normalizeText(text) || '';
      // 1) Platform-aware reply
      const platform = getPlatformReply(text);
      if(platform && platform.text) return fixMojibake(platform.text);

      // 2) Known canned responses
      const known = getKnownResponses(text);
      if(known && known.text) return fixMojibake(known.text);

      // 3) Smart heuristics
      const smart = getSmartResponse(text);
      if(smart && smart.text) return fixMojibake(smart.text);

      // 4) Build an informative generic reply using keywords + platform hint
      const tokens = normalized.split(/\s+/).filter(Boolean).slice(0,5);
      const keys = tokens.join('، ') || 'هذا الموضوع';
      const facts = getPlatformFacts();
      let resp = `ممكن تقصد: ${keys}؟ عمومًا أقدر أتكلم عن ${keys} وأديك إجابة أو مثال. قلّي تحديدًا إيه اللي محتاجه.`;
      if(facts && facts.hasCourses){
        resp += ` بالمناسبة عندك ${facts.courseCount} كورس${facts.courseCount>1?'ات':''} مسجلة.`;
      }
      return resp;
    }catch(e){
      return 'ممكن توضح سؤالك أكتر؟ أنا هنا أساعدك.';
    }
  }

  // send workflow
  function sendMessageRaw(text){ 
    const hist = loadHistory(); 
    const user = { who:'user', text, ts: nowTs(), status:'sent' }; 
    hist.push(user); 
    // Remove noTime from bot messages when user sends first reply
    hist.forEach(msg => { if(msg.who === 'bot' && msg.noTime) delete msg.noTime; });
    saveHistory(hist); 
    renderHistory(false); // optimistic
    // generate reply
    addTyping(); 
    setTimeout(()=>{
      removeTyping(); 
      const rule = ruleAnswerFor(text);
      let replyText = '';
      if(rule){ 
        if(rule.escalate || rule.shouldEscalate){ 
          // create ticket for escalated issues
          createSupportTicket(null, text); 
          replyText = rule.text;
        } else {
          replyText = rule.text;
        }
      } else {
        replyText = null;
      }

      if(replyText === null){ 
        // unknown - generate a helpful fallback answer instead of failing
        replyText = generateFallbackAnswer(text);
      }

      replyText = composeFinalResponse({ text: replyText }, text, analyzeStudentIntent(text));

      // Enrich context and learn from interaction
      learnFromResponse(text, replyText);
      enrichChatContext(text, replyText, { timestamp: nowTs() });
      
      const botMsg = { who:'bot', text: replyText, ts: nowTs(), status:'delivered' };
      const h2 = loadHistory(); 
      h2.push(botMsg); 
      saveHistory(h2); 
      renderHistory();
    }, 700 + Math.random()*900);
  }

  function renderSuggestions(container){
    const panel = document.createElement('div');
    panel.className='pf-suggestion-panel';
    panel.id='pfSuggestionPanel';
    SUGGESTED.forEach(s=>{
      const card = document.createElement('button');
      card.type='button';
      card.className='pf-suggestion-card';
      card.textContent = fixMojibake(s);
      card.addEventListener('click', ()=>{ hideSuggestions(); document.getElementById('pfChatInput').value = fixMojibake(s); sendFromInput(); });
      panel.appendChild(card);
    });
    container.appendChild(panel);
  }

  function hideSuggestions(){ const panel = document.getElementById('pfSuggestionPanel'); if(panel) panel.style.display='none'; const win = document.getElementById('pfChatWindow'); if(win) win.classList.add('pf-suggestions-hidden'); }
  function showSuggestions(){ const panel = document.getElementById('pfSuggestionPanel'); if(panel) panel.style.display='grid'; const win = document.getElementById('pfChatWindow'); if(win) win.classList.remove('pf-suggestions-hidden'); }
  function resetSuggestions(){ showSuggestions(); }

  function sendFromInput(){ const input = document.getElementById('pfChatInput'); const v = input.value && input.value.trim(); if(!v) return; hideSuggestions(); sendMessageRaw(v); input.value=''; }

  // Expose create ticket and migration externally
  window.pfCreateSupportTicket = createSupportTicket;
  window.pfTransferGuestSupportSessionToAccount = transferGuestSupportSessionToAccount;
  window.pfShowSupportBubble = showWelcomeBubble;

  // ==================================================
  // EXTERNAL API FOR ADMIN LEARNING & CONTENT
  // ==================================================
  
  // Admin learning: When admin answers a difficult question, teach the AI
  window.pfLearnFromAdmin = (question, adminResponse, context = {}) => {
    learnFromAdmin(question, adminResponse, context);
    if(window.showToast) window.showToast('طھظ… طھط­ط¯ظٹط« ظ…ط¹ط±ظپط© ط§ظ„ط¨ظˆطµظ„ط© ظ…ظ† ط±ط¯ظƒ', 'success');
  };

  // Get platform content analysis for better responses
  window.pfAnalyzePlatformContent = () => {
    analyzePlatformContent();
    if(window.showToast) window.showToast('طھظ… طھط­ط¯ظٹط« ظ…ط­طھظˆظ‰ ط§ظ„ظ…ظ†طµط©', 'success');
  };

  // Get AI learning statistics
  window.pfGetLearningStats = () => {
    const trained = loadTraining();
    const adminLearned = loadAdminLearning();
    return {
      trainedResponses: Object.keys(trained).length,
      adminLearnedResponses: Object.keys(adminLearned).length,
      totalLearning: Object.keys(trained).length + Object.keys(adminLearned).length
    };
  };

  // Manually test smart search
  window.pfTestSmartSearch = async (query) => {
    const result = await getSmartSearch(query);
    return result;
  };

  function init(){
    // Minimal safe init with DOMContentLoaded wrapping and safe retries
    const runInit = () => {
      const existingBtn = document.getElementById('pfChatBtn');
      const existingWin = document.getElementById('pfChatWindow');
      const existingBubble = document.getElementById('pfChatBubble');
      const btnBroken = existingBtn && isElementBroken(existingBtn);
      if (existingBtn && !btnBroken) {
        return;
      }
      if (existingBtn && btnBroken) {
        try { existingBtn.remove(); } catch (e) {}
      }
      if (existingWin && (btnBroken || isElementBroken(existingWin))) {
        try { existingWin.remove(); } catch (e) {}
      }
      if (existingBubble && (btnBroken || isElementBroken(existingBubble))) {
        try { existingBubble.remove(); } catch (e) {}
      }

      // attach stylesheet safely
      try {
        if (!document.getElementById('pfChatStyles')) {
          const l = document.createElement('link');
          l.id = 'pfChatStyles'; l.rel = 'stylesheet'; l.href = 'css/support-chat.css';
          l.onerror = () => {};
          try { document.head.appendChild(l); } catch (e) {}
        }
      } catch (e) {}

      // build UI guarded
      try {
        const btn = document.createElement('div');
        btn.id = 'pfChatBtn'; btn.className = 'pf-chat-btn'; btn.title = 'البوصلة'; btn.innerHTML = '<i class="fas fa-compass"></i>';
        try { btn.style.cssText = 'position:fixed!important;bottom:24px!important;right:24px!important;z-index:999999999!important;display:flex!important;visibility:visible!important;opacity:1!important;width:74px!important;height:74px!important;border-radius:50%!important;background:linear-gradient(135deg,#193d80,#0b1d43)!important;border:2px solid rgba(255,241,0,0.95)!important;box-shadow:0 22px 60px rgba(0,0,0,0.42)!important;color:#f1c40f!important;cursor:pointer!important;transition:none!important;'; } catch(e) {}
        try { document.body.appendChild(btn); } catch(e){/* ignore */}

        const bubble = document.createElement('div'); bubble.className='pf-chat-bubble'; bubble.id='pfChatBubble'; bubble.style.display='none'; bubble.textContent = WELCOME; try { document.body.appendChild(bubble); } catch(e){}

        const windowEl = document.createElement('div'); windowEl.className='pf-chat-window'; windowEl.id='pfChatWindow'; windowEl.style.display='none';
        windowEl.innerHTML = `
          <div class="pf-chat-header">
            <div class="title">البوصلة - الدعم الذكي</div>
            <div><button id="pfCloseBtn" class="pf-close">×</button></div>
          </div>
          <div class="pf-chat-messages" id="pfChatMessages"></div>
          <div class="pf-chat-input-area">
            <div class="pf-suggestion-panel" id="pfSuggestionPanel"></div>
            <div class="pf-chat-input">
              <input id="pfChatInput" placeholder="اكتب سؤالك أو اختر اقتراح سريع..." autocomplete="off" />
              <button id="pfSendBtn" type="button" aria-label="إرسال"><i class="fas fa-paper-plane"></i></button>
            </div>
          </div>
          <div class="pf-chat-footer">البوصلة بتساعدك في الدعم التعليمي والفني. اسألني أي حاجة الآن.</div>
        `;
        try { document.body.appendChild(windowEl); } catch(e){}

        // safe events
        try { btn.addEventListener('mouseenter', ()=>{ bubble.style.display='block'; }); } catch(e){}
        try { btn.addEventListener('mouseleave', ()=>{ setTimeout(()=> bubble.style.display='none', 1200); }); } catch(e){}
        try { bubble.addEventListener('click', ()=>{ const w = document.getElementById('pfChatWindow'); if(w && (w.style.display === 'none' || !w.style.display)){ w.style.display='flex'; playSound('open'); renderHistory(true); resetSuggestions(); } if(bubble) bubble.style.display='none'; }); } catch(e){}
        try { btn.addEventListener('click', ()=>{ const w = document.getElementById('pfChatWindow'); if(w && (w.style.display === 'none' || !w.style.display)){ w.style.display='flex'; playSound('open'); renderHistory(true); resetSuggestions(); } else if(w){ w.style.display='none'; playSound('close'); } }); } catch(e){}
        try { document.getElementById('pfCloseBtn')?.addEventListener('click', ()=>{ const w = document.getElementById('pfChatWindow'); if(w) w.style.display='none'; playSound('close'); }); } catch(e){}
        try { document.getElementById('pfSendBtn')?.addEventListener('click', sendFromInput); } catch(e){}
        try { const inputEl = document.getElementById('pfChatInput'); if(inputEl){ inputEl.addEventListener('focus', hideSuggestions); inputEl.addEventListener('input', hideSuggestions); inputEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); sendFromInput(); } else { hideSuggestions(); } }); } } catch(e){}
        try { renderSuggestions(windowEl.querySelector('.pf-chat-input-area')); } catch(e){}
        try { btn.addEventListener('click', ()=> renderHistory()); } catch(e){}

        let bodyObserver = null;
        const observeBody = () => {
          if (bodyObserver || !document.body) return;
          try {
            bodyObserver = new MutationObserver(() => {
              try {
                const btnLive = document.getElementById('pfChatBtn');
                if (!btnLive || isElementBroken(btnLive)) {
                  if (!window.__pfChat_recreated) {
                    window.__pfChat_recreated = true;
                    setTimeout(()=>{ window.__pfChat_recreated = false; }, 1600);
                    runInit();
                  }
                }
              } catch(e){}
            });
            bodyObserver.observe(document.body, { childList: true, subtree: true });
          } catch(e){}
        };
        observeBody();

        // Detect ancestor clipping issues (do not modify page layout)
        try {
          let cur = btn.parentElement;
          while(cur){
            const cs = window.getComputedStyle(cur);
            if (cs && (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0')){
              // mark for debugging; do not change site styles
              btn.setAttribute('data-pfchat-clipped','true');
              break;
            }
            if (cs && (cs.overflow && (cs.overflow.indexOf('hidden') !== -1 || cs.overflow.indexOf('clip') !== -1))) {
              btn.setAttribute('data-pfchat-overflow','true');
              break;
            }
            if (cs && cs.transform && cs.transform !== 'none') { btn.setAttribute('data-pfchat-transform','true'); break; }
            cur = cur.parentElement;
          }
        } catch(e){}

        // signal minimal success
        try { console.log('pfChat mounted successfully'); } catch(e){}
      } catch(e){ /* guard - do not stop execution */ }
    };

    const attemptInit = () => {
      if (!document.head || !document.body) {
        return setTimeout(attemptInit, 300);
      }
      try {
        runInit();
      } catch (e) {
        // schedule retry but remain silent
        setTimeout(attemptInit, 500);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attemptInit);
    } else {
      attemptInit();
    }

    window.addEventListener('load', ()=>{ attemptInit(); });

    // Safe recovery: if pfChatBtn missing or broken after 2s, attempt one recovery create
    setTimeout(()=>{
      try {
        const visibleBtn = document.getElementById('pfChatBtn');
        if ((!visibleBtn || isElementBroken(visibleBtn)) && !window.__pfChat_recreated) {
          window.__pfChat_recreated = true;
          try { runInit(); console.log('pfChat recovered'); } catch(e){ }
        }
      } catch(e){}
    }, 2000);

    // Periodic lightweight health-check: attempt safe re-init if widget disappears unexpectedly
    try {
      let healthChecks = 0;
      const maxHealthChecks = 8; // limited attempts to avoid infinite loops
      const healthInterval = setInterval(()=>{
        try {
          const btn = document.getElementById('pfChatBtn');
          if (!btn || isElementBroken(btn)) {
            if (!window.__pfChat_recreated && healthChecks < maxHealthChecks) {
              healthChecks++;
              window.__pfChat_recreated = true;
              try { runInit(); console.log('pfChat health-recover attempt', healthChecks); } catch(e){}
              // allow future attempts after a short cool-down
              setTimeout(()=>{ window.__pfChat_recreated = false; }, 1500);
            }
          }
          if (healthChecks >= maxHealthChecks) {
            clearInterval(healthInterval);
          }
        } catch(e){ /* ignore errors in health-check */ }
      }, 4500);
    } catch(e) {}
  }

  init();
})();





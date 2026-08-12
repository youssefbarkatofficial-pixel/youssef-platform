// Upgraded Support chat widget ("البوصلة") - lightweight, private, and smarter
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
  // FOR "البوصلة" ASSISTANT
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
      en: query.split(' ').map(w => w.replace(/[ء-ي]/g, '')).join(' '),
    };

    try {
      // Attempt to search trusted educational sources
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQueries.ar)}+site:wikipedia.org OR site:britannica.com OR site:khan-academy.org`;
      
      return {
        hasSearch: true,
        searchUrl: searchUrl,
        query: searchQueries.ar,
        recommendation: 'يمكنك البحث عن المزيد من المعلومات'
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
          response: 'خلال فترة الامتحان أو تسليم الواجبطŒ أقدر أشرحلك المفهوم بس ما أحلش السؤال بالكامل. إشرح لي الجزء اللي مش واضح واحنا نقدّم معاًا خطوة بخطوة.',
          allowExplanation: true,
          allowGuidance: true,
          allowDirectAnswer: false
        };
      }
      return {
        isCheat: true,
        strict: false,
        response: 'مقدرش أساعدك فى دهطŒ الأستاذ يوسف بركات لو لمحني هيمرجحني ًںک‚',
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
        text: `استمراراًا على السؤال السابقطŒ ${chatContext.lastResponse}`,
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
        if (Array.isArray(course.contents.homeworks) && course.contents.homeworks.length > 0) contentHints.push(`في ${course.title} في واجبات`);
        if (Array.isArray(course.contents.exams) && course.contents.exams.length > 0) contentHints.push(`في ${course.title} في امتحانات`);
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

    if (/عامل ايه|ازيك|ايه اخبارك|وضعك ايه|صباح الخير|مساء الخير/.test(normalized)) {
      return { text: 'الحمد لله يا بطلطŒ ربنا معاك. قلّي إيه المطلوب وأنا أظبطلك الرد.' };
    }
    if (/انت مين|مين انت|انت مين/.test(normalized)) {
      return { text: 'أنا البوصلة بتاعتك في المنصةطŒ صايع الردود ودايماًا معاك في المذاكرة والدعم.' };
    }
    if (/مش قادر.*ذاكر|مش قادر.*الذاكر|معرفش|ماعرفش|مش عرف|مش فاهم|مش عارف\b/.test(normalized)) {
      return { text: 'ولا يهمكطŒ كلنا بنمر بده. قسّم المذاكرة على أجزاء صغيرة وأبدأ بحاجة بسيطةطŒ وأنا أساندك خطوة بخطوة.' };
    }
    if (/خايف.*الامتحان|خايف من الامتحان|قلقان.*الامتحان/.test(normalized)) {
      return { text: 'الخوف ده طبيعيطŒ بس لما تكون منظم وبتراجع صح هتلاقي نفسك مرتاح. قولّي انت محتاج تذاكر في إيه بالظبط.' };
    }
    if (/انا فاشل|انا فشل|انا وحش|مش هقدر/.test(normalized)) {
      return { text: 'ما تقولش كدهطŒ اللي يقعد يحاول هو اللي يكسب. أنا هنا أساعدك بكل وقت وتقدر تطور نفسك من دلوقتي.' };
    }
    if (/عاوز.*حد.*يساعدني|عايز.*حد.*يساعدني|عايز حد يساعدني|عايز مساعدة/.test(normalized)) {
      return { text: 'تمام يا جميلطŒ ابعتلي بالصراحة المشكلة أو الكورس اللي معطل معاكطŒ وأنا هديك حل بالمصري والعربي.' };
    }
    if (/انت ذكي|كويس|ممتاز/.test(normalized)) {
      return { text: 'بحاول أكون كويس دلوقتيطŒ بس اللي فعلاً ذكي هو اللي بيتعب ويبذل مجهود.' };
    }
    if (/شكرا|متشكر|ميرسي|تسلم|جزاك الله|جزاك الله خير/.test(normalized)) {
      return { text: 'على عيني يا بطلطŒ ربنا يخليك. لو عندك سؤال غريب أو مش واضحطŒ هابص عليه بسرعة وأحاول أرد عليك صح.' };
    }
    if (/بحبك/.test(normalized)) {
      return { text: 'وأنا بحب الطلبة الشاطرة اللي بتجتهدطŒ واحنا مع بعض هنكسر الدنيا.' };
    }
    if (/انت غبي|انت احمق|مش ذكي|احمق|تافه/.test(normalized)) {
      return { text: 'يا عم مش لازم نخش في الكلام دهطŒ خليني أفهماك بشكل أبسط وأظبطلك الرد اللي تحتاجه.' };
    }
    if (/حلو|جميل|ظريف/.test(normalized)) {
      return { text: 'الحمد للهطŒ خليني أكمل معاك على نفس الموجة ونظبط لك حل يساعدك.' };
    }
    return null;
  }

  function isVeryUnclearMessage(text) {
    const normalized = normalizeText(text);
    if (!normalized) return true;
    if (normalized.length <= 3) return true;
    const keywords = /(كورس|واجب|دعم|دخول|باسورد|فيديو|مشكل|مشكله|مذاكر|امتحان|تسجيل|تحويل|دفع|سؤال|اهلا|مرحبا|عايز|اكتب)/;
    return normalized.split(' ').length <= 2 && !keywords.test(normalized);
  }

  function getRudeResponse(text) {
    const normalized = normalizeText(text);
    if (/انت غبي|انت احمق|مش ذكي|تافه|اخرس/.test(normalized)) {
      return { text: 'ممكن أكون فهمتك غلط ًںک… جرّب توضّحلي أكتر وأنا هحاول أساعدك.' };
    }
    return null;
  }

  function isCheatingRequest(text) {
    const normalized = normalizeText(text);
    return /حل السؤال ده|حل السؤال|حل الامتحان|عايز حل|اكتب الاجابة|جيبلي الاجابة|تسريب|غش|اجابة مباشرة|نمره|درجة|ازاي اعمل حل|اكتبلي الحل/.test(normalized);
  }

  function isStudyEmotion(text) {
    return /انا تعبان|مش قادر أذاكر|مش قادر اذكر|خايف من الامتحان|انا خايف|التوتر|ضغط الامتحان|معلقتش|مش قادر|تعبان/.test(normalizeText(text));
  }

  function isSameIssueFollowup(text) {
    return /(لسه المشكلة|لسه مشكله|لسه المشكلة موجوده|لسه المشكلة موجودة|لسه نفس المشكلة|لسه المشكلة)/.test(normalizeText(text));
  }

  function getKnownResponses(text) {
    const normalized = normalizeText(text);
    const fallback = { text: null };
    if (/اشترك|ازاي اشترك|اشتراك|اشتري|عايز اشترك/.test(normalized)) {
      return { text: 'ادخل على قسم الكورساتطŒ اختار الكورس المناسب لصفكطŒ واضغط اشتراك. بعد كده هتظهرلك طريقة الدفع والتعليمات الكاملة للتحويل ورفع صورة التحويل.' };
    }
    if (/الكورس مش شغال|الكورس مش شغّال|الكورس مش شغاله|الكورس مش شغال/.test(normalized)) {
      return { text: 'تأكد الأول من النت وسجل خروج ودخول مرة تانية. لو لسه المشكلةطŒ ابعتلي اسم الكورس أو صورةطŒ وأنا أظبطلك حل سريع.' };
    }
    if (/نسيت.*الباسورد|نسيت.*كلمه المرور|نسيت الباسورد|نسيت كلمة المرور/.test(normalized)) {
      return { text: "اضغط على 'نسيت كلمة المرور' من صفحة تسجيل الدخول واتبع الخطواتطŒ ولو مش ظبط معاك ابعتلي وهقولك تعمل إيه." };
    }
    if (/فين.*الواجبات|فين.*الواجب|الواجب فين/.test(normalized)) {
      return { text: 'الواجبات بتبقى جوه الكورس اللي انت مشترك فيه بعد كل حصة. لو مش لاقيهاطŒ قولّي اسم الكورس وانا أقولك تمشي فين.' };
    }
    if (/امتى.*الحصة|إمتى.*الحصة|ميعاد.*الحصة|موعد.*الحصة/.test(normalized)) {
      return { text: 'مواعيد الحصص بتكون موجودة جوه الكورس وفي الإشعارات. لو مش شايفها افتح الكورس أو ابعتلي اسم الكورس.' };
    }
    if (/دفعت.*لسه|لسه الكورس مفتحش|لسه فتحش|الكورس مش مفتوح/.test(normalized)) {
      return { text: 'غالباًا طلبك تحت المراجعةطŒ اتأكد إن صورة التحويل واضحة. لو لسهطŒ ابعتلي اسم الكورس وهناخد الموضوع مع الدعم.' };
    }
    if (/عاوز.*اكلم الدعم|عايز.*اكلم الدعم|عاوز أكلم الدعم|الكلام مع الدعم/.test(normalized)) {
      return { text: 'تقدر تفتح صفحة المساعدة أو تستخدم واتساب الدعم الموجود في المنصة. أنا موجود أساعدك في أي حاجة بعدين.' };
    }
    if (/أفضل طريقة.*أذاكر|افضل طريقة.*اذاكر|ازاي أذاكر|ازاي اذاكر/.test(normalized)) {
      return { text: 'ابدأ بشرح الدرس وبعدها حل الواجب فوراًاطŒ وراجع أخطاءك أول بأول عشان التراكمات متزيدش عليك.' };
    }
    if (/انا مش فاهم الدرس|انا مش فاهم|مش فاهم الدرس|مش فاهم/.test(normalized)) {
      return { text: 'ولا يهمك â‌¤ï¸ڈ قولّي الجزء اللي واقف معاك وأنا هحاول أبسطهولك خطوة بخطوة.' };
    }
    if (/الاستاذ يوسف.*راجع|هو الأستاذ يوسف.*مراجعات|ينزل مراجعات|مراجعات.*يوسف/.test(normalized)) {
      return { text: 'أيوةطŒ المنصة فيها مراجعات دورية ونهائية وتجميعات مهمة جداًا قبل الامتحانات.' };
    }
    if (/ازاي.*ï¸ڈ?اجيب درجة عالية|إزاي.*درجة عالية|ازاي اجيب درجة عالية|عايز درجة عالية/.test(normalized)) {
      return { text: 'الاستمرارية أهم من عدد الساعاتطŒ ذاكر أول بأول وحل الامتحانات والواجبات بتركيز.' };
    }
    return fallback;
  }

  function getPlatformReply(text) {
    const facts = getPlatformFacts();
    const normalized = normalizeText(text);

    if (/(dashboard|لوحة|لوحة التحكم)/.test(normalized)) {
      if (facts.hasCourses) {
        return { text: `أنت دلوقتي مشترك في ${facts.courseCount} كورس${facts.courseCount > 1 ? 'ات' : ''} (${facts.courseTitlesString}). فتح لوحة التحكم عشان تشوف التقدمطŒ الفيديوهاتطŒ والواجبات.` };
      }
      return { text: 'لوحة التحكم جاهزة ليكطŒ لكن لسه معندكش أي كورس مشترك فيه. اختار أول كورس من صفحة الكورسات.' };
    }

    if (/(progress|نسبة|تقدم|مستوى|performance)/.test(normalized)) {
      if (facts.hasCourses) {
        return { text: `التقدم الحالي بتاعك: ${facts.progressPercent}% التزامطŒ شاهدت ${facts.videosWatched} فيديو${facts.videosWatched === 1 ? '' : 'ات'}طŒ وأنجزت ${facts.homeworkCompleted}/${facts.homeworkTotal} واجبات.` };
      }
      return { text: 'مافيش بيانات تقدم لحد دلوقتي لأنك مشترك فيش كورس. لو حبيت أساعدك تختار كورس مناسبطŒ قولّي سنة دراستك.' };
    }

    if (/(notification|اشعار|اشعارات)/.test(normalized)) {
      if (facts.notificationCount > 0) {
        return { text: `عندك ${facts.notificationCount} إشعار${facts.notificationCount > 1 ? 'ات' : ''} في حسابك. تقدر تفتح لوحة التحكم وتشوفهم دلوقتي.` };
      }
      return { text: 'مافيش إشعارات جديدة دلوقتي. لو محتاج مساعدةطŒ أنا هنا.' };
    }

    if (/(homework|واجب)/.test(normalized)) {
      if (facts.hasCourses) {
        const homeworkStatus = facts.homeworkTotal ? `أنجزت ${facts.homeworkCompleted}/${facts.homeworkTotal} واجبات` : 'لسه ما اضفتش واجبات رسمية لبياناتك';
        const hint = facts.contentHints.length > 0 ? ` ${facts.contentHints.slice(0, 2).join('طŒ ')}.` : '';
        return { text: `أنت مشترك في ${facts.courseCount} كورس${facts.courseCount > 1 ? 'ات' : ''} (${facts.courseTitlesString}). ${homeworkStatus}.${hint} افتح صفحة الكورس اللي شغال فيه عشان تدخل على الواجبات.` };
      }
      return { text: 'لما تتأكد اشتراكك في كورس تقدر تتابع الواجبات من لوحة التحكم.' };
    }

    if (/(exam|امتحان|اختبار)/.test(normalized)) {
      if (facts.hasCourses) {
        const examsHint = facts.contentHints.filter(h => h.includes('امتحانات')).slice(0, 2).join('طŒ ');
        return { text: `في الكورسات اللي انت مشترك فيها ممكن تلاقي امتحانات ومراجعات. ${examsHint || 'افتح الكورس عشان تعرف التفاصيل'}.` };
      }
      return { text: 'لما تشترك في كورس هعرف أقولك إذا كان فيه امتحانات ومراجعات متاحة.' };
    }

    if (/(course|كورس)/.test(normalized) && facts.hasCourses) {
      return { text: `انت مشترك في ${facts.courseCount} كورس${facts.courseCount > 1 ? 'ات' : ''}: ${facts.courseTitlesString}. تقدر تفتح صفحة الكورسات أو لوحة التحكم عشان تكمل.` };
    }

    if (/(course|كورس)/.test(normalized) && !facts.hasCourses) {
      return { text: 'لو لسه مشتركش في أي كورسطŒ تقدر تدخل على صفحة الكورسات وتشوف العروض المتاحة وتختار الكورس المناسب لصفك.' };
    }

    return null;
  }

  function getFollowUpReply(text) {
    if (isSameIssueFollowup(text) && chatContext.lastIssue) {
      return { text: `لسه نفس المشكلة؟ خليني أراجع معاك تاني. المشكلة كانت في: ${chatContext.lastIssue}.` };
    }
    if (isStudyEmotion(text)) {
      return { text: 'حسيت إنك متوتر شويةطŒ وده طبيعي. خليك مركز خطوة بخطوةطŒ وخد بريك بسيط بعد كل جلسة مذاكرةطŒ وأي حاجة محتاج توضيح فيها ابعتلي دلوقتي.' };
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
      return { text: antiCheatCheck.response || 'مقدرش أساعدك فى دهطŒ الأستاذ يوسف بركات لو لمحني هيمرجحني ًںک‚', type:'anti-cheat', strict: antiCheatCheck.strict };
    }

    const followUp = getFollowUpReply(text);
    if (followUp) return followUp;

    const known = getKnownResponses(text);
    if (known.text) {
      if (/الكورس مش شغال|الكورس مش شغّال|الكورس مش شغاله|الكورس مش شغال/.test(normalized)) {
        setLastContext('course_issue', 'الكورس مش شغال', null);
      }
      if (/نسيت.*الباسورد|نسيت.*كلمه المرور|نسيت الباسورد|نسيت كلمة المرور/.test(normalized)) {
        setLastContext('auth_issue', 'نسيت كلمة المرور', null);
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
      return { text: 'معلش يا جميل â‌¤ï¸ڈ\nممكن تكتب سؤالك بشكل أوضح شوية عشان أعرف أساعدك صح؟' };
    }

    if (/ليه|ازاي|ايه سبب|مش واضح|معلش|ممكن|سؤال غريب|سؤال مش واضح/.test(normalized)) {
      return { text: 'دا سؤال مهمطŒ هابص عليه بسرعة في البيانات اللي عندي وأحاول أرد عليك بأبسط شكل. لو الموضوع مش واضحطŒ اشرحلي أكتر وأنا هاتعلم منه.' };
    }

    // Specific direct request handling
    if (/حل السؤال ده|حل السؤال|عايز حل/.test(normalized)) {
      setLastContext('cheat_attempt', 'طلب حل مباشر', null);
      return { text: 'عشان أساعدك صحطŒ قولّي السؤال اللي واقف معاك عشان أشرحلك الفكرة مش أحلهلك.' };
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
    if(window.showToast) window.showToast('تم إنشاء تذكرة دعمطŒ سيتواصل معك فريق الدعم قريباً', 'success');
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
  // Fix common mojibake (double-encoded UTF-8 shown as sequences like 'ال')
  function fixMojibake(s){
    if(!s || typeof s !== 'string') return s;
    try{
      // quick heuristic: contains typical mojibake fragments (ا or Ã/Â)
      if(/ا|Ã|Â/.test(s)){
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
    if(window.showToast) window.showToast('تم تحديث معرفة البوصلة من ردك', 'success');
  };

  // Get platform content analysis for better responses
  window.pfAnalyzePlatformContent = () => {
    analyzePlatformContent();
    if(window.showToast) window.showToast('تم تحديث محتوى المنصة', 'success');
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





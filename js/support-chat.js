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
  const ESCALATION_SUGGESTION = 'لو مستعجل على حل المشكلة اكتب مشكلة والدعم هيتواصل معاك في أقرب وقت 🙏';
  let complaintCaptureMode = false;
  let escalationSuggested = false;

  const SELF_LEARNING_KEY = 'pf_self_learning_v1';
  function loadSelfLearning() {
    try { return JSON.parse(localStorage.getItem(SELF_LEARNING_KEY) || '{"unknown_questions":{}, "slang_words":{}, "successful_patterns":{}, "pending_review":[]}'); } 
    catch(e) { return {"unknown_questions":{}, "slang_words":{}, "successful_patterns":{}, "pending_review":[]}; }
  }
  function saveSelfLearning(data) {
    safeSetItem(localStorage, SELF_LEARNING_KEY, JSON.stringify(data));
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 SELF IMPROVEMENT BRAIN
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const IMPROVEMENT_BRAIN_KEY = 'pf_improvement_brain_v2';
  
  function loadImprovementBrain() {
    try { 
      return JSON.parse(localStorage.getItem(IMPROVEMENT_BRAIN_KEY) || '{"ununderstood":{}, "frequent_questions":{}, "conversation_drops":{}, "caused_confusion":{}, "suggestions":[]}'); 
    } catch(e) { 
      return {"ununderstood":{}, "frequent_questions":{}, "conversation_drops":{}, "caused_confusion":{}, "suggestions":[]}; 
    }
  }

  function saveImprovementBrain(data) {
    safeSetItem(localStorage, IMPROVEMENT_BRAIN_KEY, JSON.stringify(data));
  }

  function monitorConversationFlow(userMsg, botReplyTag, purpose, isConfused) {
    const memory = loadImprovementBrain();
    const normalized = normalizeText(userMsg);

    // 1. Ununderstood (Fallback)
    if (botReplyTag === 'fallback' || purpose === 'UNKNOWN_PURPOSE') {
      if (!memory.ununderstood[normalized]) memory.ununderstood[normalized] = 0;
      memory.ununderstood[normalized]++;
    } else {
      // 2. Frequent Questions (Successfully handled)
      if (purpose === 'EDUCATIONAL_EXPLANATION' || purpose === 'ASSISTANCE') {
        if (!memory.frequent_questions[normalized]) memory.frequent_questions[normalized] = 0;
        memory.frequent_questions[normalized]++;
      }
    }

    // 3. Caused Confusion (If the user is confused now, the PREVIOUS bot message caused it)
    if (isConfused) {
      const context = loadContextMemory();
      let lastBotMsg = null;
      for (let i = context.length - 1; i >= 0; i--) {
        if (context[i].role === 'bot') {
          lastBotMsg = context[i].text;
          break;
        }
      }
      if (lastBotMsg) {
        if (!memory.caused_confusion[lastBotMsg]) memory.caused_confusion[lastBotMsg] = 0;
        memory.caused_confusion[lastBotMsg]++;
      }
    }

    saveImprovementBrain(memory);
  }

  function generateImprovementReport() {
    const memory = loadImprovementBrain();
    
    // Auto-suggest new intents based on highly frequent ununderstood messages
    Object.keys(memory.ununderstood).forEach(msg => {
      if (memory.ununderstood[msg] >= 3 && !memory.suggestions.some(s => s.text === msg && s.type === 'new_intent')) {
        memory.suggestions.push({ type: 'new_intent', text: msg, reason: 'تكرر عدم فهم هذه الرسالة', date: Date.now() });
      }
    });

    // Auto-suggest simplifying a response if it caused confusion multiple times
    Object.keys(memory.caused_confusion).forEach(msg => {
      if (memory.caused_confusion[msg] >= 2 && !memory.suggestions.some(s => s.text === msg && s.type === 'needs_simplification')) {
        memory.suggestions.push({ type: 'needs_simplification', text: msg, reason: 'هذا الرد تسبب في ارتباك الطالب أكثر من مرة', date: Date.now() });
      }
    });

    saveImprovementBrain(memory);
    return memory.suggestions;
  }

  function analyzeAndLearnFromMessage(userMessage, finalResponseTag) {
    const normalized = normalizeText(userMessage);
    const memory = loadSelfLearning();

    if (finalResponseTag === 'fallback') {
      // 1. Record Unknown Questions
      if (!memory.unknown_questions[normalized]) memory.unknown_questions[normalized] = 0;
      memory.unknown_questions[normalized]++;

      if (memory.unknown_questions[normalized] >= 3) {
        if (!memory.pending_review.some(p => p.type === 'missing_answer' && p.text === normalized)) {
          memory.pending_review.push({ type: 'missing_answer', text: normalized, count: memory.unknown_questions[normalized], date: Date.now() });
        }
      }

      // 2. Identify Potential Slang or Typos
      const words = normalized.split(/\s+/);
      const knownVocab = Object.values(DYNAMIC_VOCAB).flat();
      
      words.forEach(word => {
        if (word.length < 3) return;
        let isKnown = false;
        for (const known of knownVocab) {
          if (typeof levenshteinDistance === 'function' && levenshteinDistance(word, known) <= 1) {
            isKnown = true;
            break;
          }
        }
        
        if (!isKnown) {
          if (!memory.slang_words[word]) memory.slang_words[word] = 0;
          memory.slang_words[word]++;
          if (memory.slang_words[word] >= 3) {
            if (!memory.pending_review.some(p => p.type === 'slang_or_typo' && p.word === word)) {
              memory.pending_review.push({ type: 'slang_or_typo', word: word, count: memory.slang_words[word], context: normalized, date: Date.now() });
            }
          }
        }
      });
    } else {
      // 3. Learn successful interaction patterns
      if (!memory.successful_patterns[normalized]) memory.successful_patterns[normalized] = 0;
      memory.successful_patterns[normalized]++;
      if (memory.successful_patterns[normalized] >= 5) {
         if (!memory.pending_review.some(p => p.type === 'successful_style' && p.text === normalized)) {
           memory.pending_review.push({ type: 'successful_style', text: normalized, count: memory.successful_patterns[normalized], date: Date.now() });
         }
      }
    }
    saveSelfLearning(memory);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 ANSWER QUALITY SCORER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function evaluateResponseQuality(responseText, userMessage, purpose, thoughtProcess = {}) {
    let score = 100;
    if (!responseText || responseText.length < 5) return 0;
    
    // 1. Relevance (الارتباط بالسؤال)
    const keywords = userMessage.split(/\s+/).filter(w => w.length > 3);
    const hasRelevance = keywords.some(w => responseText.includes(w)) || 
                         (thoughtProcess.extractedData && thoughtProcess.extractedData.subjects && thoughtProcess.extractedData.subjects[0] && responseText.includes(thoughtProcess.extractedData.subjects[0]));
    if (!hasRelevance && purpose === 'EDUCATIONAL_EXPLANATION') {
      score -= 30; // Strong penalty if we drift off topic
    }

    // 2. Clarity (الوضوح)
    if (responseText.length > 300 && !responseText.includes('\n') && !responseText.includes('•')) {
      score -= 20; // Text wall penalty
    }

    // 3. Naturalness (الطبيعية)
    if (/(بص|عشان كده|وللتوضيح|خد بالك|يا صاحبي|يا بطل|تعالى|على فكرة)/.test(responseText)) {
      score += 15;
    } else {
      score -= 10; // Sounds a bit robotic
    }

    // 4. Usefulness (الفائدة)
    if (purpose === 'EDUCATIONAL_EXPLANATION' && responseText.length < 30) {
      score -= 40; // Too short to be educational
    }

    // 5. Anti-Repetition (عدم التكرار)
    const history = typeof getBotHistory === 'function' ? getBotHistory() : [];
    if (history.slice(-5).includes(responseText)) {
      score -= 60; // Huge penalty for repeating exact same response recently
    }
    
    const finalScore = Math.max(0, Math.min(100, score));
    console.log(`[QUALITY SCORER] Score: ${finalScore} | Purpose: ${purpose}`);
    return finalScore;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🤝 AI COMPANION LAYER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const COMPANION_MESSAGES = [
    'ملحوظة صغيرة: عاش يا بطل، كمل مذاكرة وأنا معاك.',
    'على فكرة، مبسوط جداً إنك بتسأل كتير، ده معناه إنك عايز تفهم بجد.',
    'خليك فاكر حلمك، كل دقيقة بتذاكرها بتقربك خطوة.',
    'الله ينور عليك، تركيزك عالي النهاردة!',
    'أنا فخور بيك إنك بتحاول تفهم وتسأل.. كمل يا بطل!'
  ];

  function applyCompanionLayer(candidateText, purpose) {
    if (!candidateText || purpose === 'SOCIAL_CONNECTION' || purpose === 'CLARIFICATION') return candidateText;
    
    let messagesSinceLastCompanion = parseInt(sessionStorage.getItem('pf_companion_cooldown') || '0');
    messagesSinceLastCompanion++;
    
    if (messagesSinceLastCompanion >= 4) {
      let msg = pickRandom(COMPANION_MESSAGES);
      sessionStorage.setItem('pf_companion_cooldown', '0');
      return candidateText + '\n\n' + msg;
    } else {
      sessionStorage.setItem('pf_companion_cooldown', messagesSinceLastCompanion.toString());
      return candidateText;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧐 AI SELF CRITIC ENGINE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function applySelfCriticEngine(candidateText, userMessage, purpose, thoughtProcess) {
    if (!candidateText) return candidateText;
    let refinedText = candidateText;
    let flawsFound = [];

    // 1. Natural Check
    if (!/(بص|عشان|خد بالك|يا صاحبي|يا بطل|تعالى|على فكرة|أهلاً|يا هلا|طبعاً|خليني)/.test(refinedText) && refinedText.length > 20 && purpose !== 'SOCIAL_CONNECTION' && purpose !== 'CLARIFICATION') {
      refinedText = 'بص يا بطل عشان تكون في الصورة.. ' + refinedText;
      flawsFound.push('Not Natural -> Added Intro');
    }

    // 2. Relevance Check (Educational but too short)
    if (purpose === 'EDUCATIONAL_EXPLANATION' && refinedText.length < 50 && !refinedText.includes('خليني أشرحلك')) {
      refinedText += '\n\nده اللي قدرت أجمعهولك حالاً، بس لو محتاج تفصيل أكتر قولي!';
      flawsFound.push('Too Short/Lacks Relevance -> Added Apology/Extension');
    }

    // 3. Repetition Check (Removing duplicated sentences)
    const sentences = refinedText.split(/([.?!؟\n]+)/);
    let uniqueSentences = [];
    for (let i = 0; i < sentences.length; i++) {
      let s = sentences[i].trim();
      // Only check real sentences for exact duplicates to prevent stripping out legitimate parts
      if (s.length > 15 && uniqueSentences.some(us => us === s)) {
        flawsFound.push('Repetition -> Removed Duplicated Sentence');
        if (sentences[i+1] && /^[.?!؟\n]+$/.test(sentences[i+1])) i++; // skip punctuation
        continue;
      }
      uniqueSentences.push(sentences[i]);
    }
    refinedText = uniqueSentences.join('');

    // 4. Ambiguity Check (Abrupt endings)
    if (refinedText.length < 15 && purpose !== 'SOCIAL_CONNECTION' && purpose !== 'FOLLOW_UP') {
      refinedText += '.. قصدك حاجة معينة أقدر أساعدك فيها؟';
      flawsFound.push('Ambiguous/Abrupt -> Added Clarification Question');
    }

    // 5. Optimization (Adding emojis if missing)
    if (refinedText.length > 30 && !/[\u{1F300}-\u{1F9FF}]/u.test(refinedText)) {
      refinedText += ' 💡';
      flawsFound.push('Lacks Warmth -> Added Emoji');
    }

    if (flawsFound.length > 0) {
      console.log(`[AI SELF CRITIC] Triggered. Flaws Fixed:`, flawsFound);
    }

    return refinedText;
  }

  function loadContextMemory() {
    try {
      const mem = sessionStorage.getItem('pf_context_memory');
      return mem ? JSON.parse(mem) : [];
    } catch(e) { return []; }
  }

  function saveContextMemory(history) {
    if (history.length > 40) history = history.slice(-40);
    safeSetItem(sessionStorage, 'pf_context_memory', JSON.stringify(history));
  }

  function pushContext(role, text, purpose, subjects = []) {
    const memory = loadContextMemory();
    memory.push({ role, text, purpose, subjects, timestamp: Date.now() });
    saveContextMemory(memory);
  }

  function resolveContext(normalizedMessage) {
    const memory = loadContextMemory();
    for (let i = memory.length - 1; i >= 0; i--) {
      if (memory[i].subjects && memory[i].subjects.length > 0) {
        return memory[i].subjects[0];
      }
    }
    return null;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 STUDENT UNDERSTANDING DETECTOR
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function analyzeStudentConfusion(normalized) {
    const confusionWords = ['صعبة', 'معقد', 'تايه', 'ضايع', 'مش فاهم', 'مش مستوعب', 'مفهمتش', 'مش واضح'];
    return confusionWords.some(w => normalized.includes(w));
  }

  function simplifyResponse(originalText) {
    if (!originalText || originalText.length < 50) return originalText;

    // Trim long responses down to 1-2 sentences.
    const sentences = originalText.split(/(?<=[.?!])\s+/);
    let trimmed = sentences.slice(0, 2).join(' ').trim();

    // Remove any personality hooks that might contradict the simplification
    trimmed = trimmed.replace(/بص يا سيدي ركز معايا\.\.|سؤال ممتاز جداً! خليني أوضحلك\.\.|سؤالك في محله يا بطل! شوف يا سيدي\.\./g, '');

    const simplifiers = [
      'الموضوع أسهل مما تتخيل، خليني ألخصهولك في جملة:',
      'بص يا بطل، عشان متتوهش مني، الفكرة ببساطة هي:',
      'عشان نسهلها خالص، ركز في دي بس:'
    ];
    const prefix = simplifiers[Math.floor(Math.random() * simplifiers.length)];
    
    return `${prefix}\n\n${trimmed}\n\nعشان تقرب الصورة أكتر، اعتبرها زي قصة بسيطة بنمشيها خطوة خطوة، ولو في جزء معين لسه صعب قولي!`;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 AMBIGUITY RESOLVER SYSTEM
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function resolveAmbiguity(thoughtProcess, userMessage) {
    const interpretations = thoughtProcess.interpretations || [];
    let options = [];
    
    if (interpretations.includes('EDUCATIONAL_EXPLANATION')) options.push('سؤال في المنهج');
    if (interpretations.includes('COMPLAINT')) options.push('مشكلة تقنية في المنصة');
    if (interpretations.includes('ASSISTANCE')) options.push('محتاج مساعدة عامة');
    if (interpretations.includes('SOCIAL_CONNECTION')) options.push('بندردش شوية');
    if (interpretations.includes('EMOTIONAL_SUPPORT')) options.push('مضغوط وعايز تفضفض');

    // Keep max 2 options to not overwhelm user
    options = options.slice(0, 2);

    if (options.length < 2) {
      return "يا بطل كلامك كبير عليا شوية، تقصد إيه بالظبط عشان أقدر أساعدك صح؟";
    }

    let text = `أنا معاك يا بطل، بس حابب أتأكد.. تقصد `;
    text += options.join(' ولا ') + '؟';
    return text;
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 BRAIN METRICS ENGINE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function logBrainMetrics(pipelineContext, thoughtProcess) {
    const metrics = {
      "Input": pipelineContext.userMessage,
      "Intent": pipelineContext.intent,
      "Purpose": pipelineContext.purpose,
      "Emotion": pipelineContext.emotion,
      "Confidence": (thoughtProcess.confidence || 0) + "%",
      "Context Used": pipelineContext.context && pipelineContext.context.length > 0 ? "Yes" : "No",
      "Memory Used": pipelineContext.memory ? "Yes" : "No",
      "Strategy": pipelineContext.plannedResponseMode,
      "Self-Critic Score": pipelineContext.score + "/100"
    };

    console.groupCollapsed(`🧠 [BRAIN METRICS] ${pipelineContext.purpose}`);
    console.table(metrics);
    console.groupEnd();

    // Save to localStorage for debugging persistence
    try {
      let savedMetrics = JSON.parse(localStorage.getItem('pf_brain_metrics') || '[]');
      savedMetrics.push({ timestamp: new Date().toISOString(), ...metrics });
      if (savedMetrics.length > 50) savedMetrics.shift();
      localStorage.setItem('pf_brain_metrics', JSON.stringify(savedMetrics));
    } catch(e) {}
  }

  // Bot response logic is active and uses the platform-aware Arabic assistant engine.
  const BOT_RESPONSES_DISABLED = false;
  function getTemporarySafeBotReply(userMessage) {
    let pipelineContext = {
      userMessage: userMessage,
      normalized: '',
      intent: 'UNKNOWN',
      purpose: 'UNKNOWN',
      emotion: 'UNKNOWN',
      context: null,
      memory: null,
      microInferences: [],
      plannedResponseMode: 'STANDARD',
      candidateText: '',
      candidateTag: 'fallback',
      finalText: '',
      score: 0
    };

    // Stage 1: Normalize
    pipelineContext.normalized = normalizeText(userMessage) || 'كلمة_فارغة';
    console.log("✅ [Stage 1: Normalize] Executed");

    // Stage 2: Intent Detection
    if (isCheatingRequest(userMessage)) {
      pipelineContext.intent = 'CHEATING';
    } else {
      pipelineContext.intent = analyzeStudentIntent(userMessage);
    }
    console.log("✅ [Stage 2: Intent Detection] Executed");

    // Stage 3: Purpose Detection
    const thoughtProcess = multiStepThinkEngine(pipelineContext.normalized, userMessage);
    pipelineContext.purpose = thoughtProcess.purpose || 'SOCIAL_CONNECTION';
    console.log("✅ [Stage 3: Purpose Detection] Executed");

    // Stage 4: Emotion Detection
    pipelineContext.emotion = thoughtProcess.extractedData.emotion || 'NEUTRAL';
    const isConfused = analyzeStudentConfusion(pipelineContext.normalized);
    console.log("✅ [Stage 4: Emotion Detection] Executed");

    // Stage 5: Context Analysis
    const currentContext = loadContextMemory();
    pipelineContext.context = currentContext;
    const isFirstMessageInSession = currentContext.length === 0 || ((Date.now() - currentContext[currentContext.length - 1].timestamp) > 60 * 60 * 1000);
    
    if (currentContext.length > 0) {
      const lastInteraction = currentContext[currentContext.length - 1];
      if (lastInteraction.role === 'bot' && (Date.now() - lastInteraction.timestamp) > 30 * 60 * 1000) {
        const droppedText = lastInteraction.text;
        const brainMem = loadImprovementBrain();
        if (!brainMem.conversation_drops[droppedText]) brainMem.conversation_drops[droppedText] = 0;
        brainMem.conversation_drops[droppedText]++;
        saveImprovementBrain(brainMem);
      }
    }
    console.log("✅ [Stage 5: Context Analysis] Executed");

    // Stage 6: Memory Analysis
    const platformFacts = getPlatformFacts();
    pipelineContext.memory = humanMemoryEngine(pipelineContext.normalized, thoughtProcess.extractedData.abstractConcept, thoughtProcess.extractedData.subjects, platformFacts.dbUser, userMessage);
    console.log("✅ [Stage 6: Memory Analysis] Executed");

    // Stage 7: Reasoning Layer
    pipelineContext.microInferences = thoughtProcess.microInferences || [];
    console.log("✅ [Stage 7: Reasoning Layer] Executed");

    // Stage 8: Response Planning
    if (pipelineContext.intent === 'CHEATING') {
      pipelineContext.plannedResponseMode = 'ANTI_CHEAT';
    } else if (pipelineContext.purpose === 'AMBIGUOUS') {
      pipelineContext.plannedResponseMode = 'CLARIFICATION';
    } else {
      pipelineContext.plannedResponseMode = 'FUSION_OR_STANDARD';
    }
    console.log("✅ [Stage 8: Response Planning] Executed");

    // Stage 9: Response Generation
    if (pipelineContext.plannedResponseMode === 'ANTI_CHEAT') {
      pipelineContext.candidateText = 'مقدرش أساعدك فى ده، الأستاذ يوسف بركات لو لمحني هيمرجحني 😂';
      pipelineContext.candidateTag = 'social';
    } else if (pipelineContext.plannedResponseMode === 'CLARIFICATION') {
      pipelineContext.candidateText = resolveAmbiguity(thoughtProcess, userMessage);
      pipelineContext.candidateTag = 'clarification';
    } else {
      const fused = executeIntentFusionEngine(thoughtProcess, pipelineContext.normalized, userMessage);
      if (fused && fused.text) {
        pipelineContext.candidateText = fused.text;
        pipelineContext.candidateTag = fused.tag;
      } else {
        if (['HUMOR', 'SOCIAL_CONNECTION', 'EMOTIONAL_SUPPORT'].includes(pipelineContext.purpose)) {
          pipelineContext.candidateText = composeFinalResponse({ text: generateSocialResponse(pipelineContext.normalized, pipelineContext.purpose), tag: 'social' }, userMessage, pipelineContext.intent);
          pipelineContext.candidateTag = 'social';
        }
        else if (pipelineContext.purpose === 'FOLLOW_UP') {
          pipelineContext.candidateText = executeContextEngine(pipelineContext.normalized, userMessage);
          pipelineContext.candidateTag = 'follow_up';
        }
        else if (['EDUCATIONAL_EXPLANATION', 'INFORMATION_SEEKING', 'ASSISTANCE', 'COMPLAINT'].includes(pipelineContext.purpose)) {
          pipelineContext.candidateText = executeEducationalIntentEngine(pipelineContext.normalized, userMessage);
          pipelineContext.candidateTag = 'educational';
        }
        else {
          const emergencyResponse = emergencyRetrievalEngine(pipelineContext.normalized, userMessage);
          if (emergencyResponse) {
            pipelineContext.candidateText = emergencyResponse.text;
            pipelineContext.candidateTag = emergencyResponse.tag;
          } else {
            pipelineContext.candidateText = executeFallbackEngine(pipelineContext.normalized, userMessage, thoughtProcess);
            pipelineContext.candidateTag = 'fallback';
          }
        }
      }
    }
    
    // Stage 9: Apply Formatting and Extensions (Anti-Fake AI Layer logic)
    const isTeacherMode = pipelineContext.candidateText.includes('تبسيط سريع:') || pipelineContext.candidateText.includes('عشان أبسطهالك:');

    if (isTeacherMode) {
      console.log("⚠️ [ANTI FAKE AI LAYER] Skipped destructive formatting engines (Text is already structured as Teacher Mode)");
    } else {
      pipelineContext.candidateText = applyReasoningTemplates(pipelineContext.candidateText, pipelineContext.candidateTag);
      pipelineContext.candidateText = applyGoalBasedFormatting(pipelineContext.candidateText, thoughtProcess.extractedData.goal, thoughtProcess.internalPlan);
      pipelineContext.candidateText = applyPersonaEngine(pipelineContext.candidateText, thoughtProcess.extractedData.abstractConcept, pipelineContext.purpose, thoughtProcess.internalPlan);
      pipelineContext.candidateText = applyMicroReasoning(pipelineContext.candidateText, pipelineContext.microInferences);
      
      if ((isConfused || thoughtProcess.internalPlan.isStrugglingTopic || thoughtProcess.internalPlan.lowUnderstanding) && pipelineContext.candidateTag === 'educational') {
        pipelineContext.candidateText = simplifyResponse(pipelineContext.candidateText);
      }
      
      pipelineContext.candidateText = applyKnowledgeGraph(pipelineContext.candidateText, thoughtProcess.extractedData.subjects, pipelineContext.candidateTag);
      pipelineContext.candidateText = selfQuestioningEngine(pipelineContext.candidateText, pipelineContext.normalized, thoughtProcess.internalPlan, pipelineContext.candidateTag);
      pipelineContext.candidateText = applySmartFollowUp(pipelineContext.candidateText, pipelineContext.candidateTag, thoughtProcess.extractedData.goal, thoughtProcess.extractedData.subjects);
    }

    // These layers are non-destructive and apply correctly everywhere
    pipelineContext.candidateText = applyKnowledgeReasoningLayer(pipelineContext.candidateText, thoughtProcess.extractedData.subjects, pipelineContext.candidateTag);
    pipelineContext.candidateText = injectHumanMemory(pipelineContext.candidateText, isFirstMessageInSession);
    pipelineContext.candidateText = applyCompanionLayer(pipelineContext.candidateText, pipelineContext.purpose);
    console.log("✅ [Stage 9: Response Generation] Executed");

    // Stage 10: Quality Review
    pipelineContext.score = evaluateResponseQuality(pipelineContext.candidateText, userMessage, pipelineContext.purpose, thoughtProcess);
    
    if (pipelineContext.score < 65 && pipelineContext.plannedResponseMode !== 'ANTI_CHEAT') {
      console.log(`[QUALITY SCORER] Score (${pipelineContext.score}) is low. Triggering Error Recovery...`);
      pipelineContext.candidateText = errorRecoverySystem(pipelineContext.normalized, userMessage, thoughtProcess);
      pipelineContext.candidateTag = 'clarification';
    }
    
    pipelineContext.finalText = applySelfCriticEngine(pipelineContext.candidateText, userMessage, pipelineContext.purpose, thoughtProcess);
    console.log("✅ [Stage 10: Quality Review] Executed");
    
    pushContext('user', userMessage, pipelineContext.purpose, thoughtProcess.extractedData.subjects);
    analyzeAndLearnFromMessage(userMessage, pipelineContext.candidateTag);
    monitorConversationFlow(userMessage, pipelineContext.candidateTag, pipelineContext.purpose, isConfused);
    generateImprovementReport();
    pushContext('bot', pipelineContext.finalText, pipelineContext.purpose, thoughtProcess.extractedData.subjects);

    logBrainMetrics(pipelineContext, thoughtProcess);

    return pipelineContext.finalText;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 INTENT FUSION ENGINE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function executeIntentFusionEngine(thoughtProcess, normalized, userMessage) {
    const purposes = thoughtProcess.interpretations || [];
    // If it's a simple single intent, skip fusion to save processing and maintain focused responses
    if (purposes.length <= 1) return null;

    let responseParts = [];
    let tags = [];

    // 1. Social / Greeting (Always comes first)
    if (thoughtProcess.extractedData.islamicGreeting && thoughtProcess.extractedData.islamicGreeting.level > 1) {
      responseParts.push(thoughtProcess.extractedData.islamicGreeting.reply + '، أهلاً بيك يا بطل!');
      tags.push('social');
    } else if (purposes.includes('SOCIAL_CONNECTION') || isFuzzyMatch(normalized, DYNAMIC_VOCAB.greetings)) {
      responseParts.push(pickRandom(DYNAMIC_RESPONSES.greetings));
      tags.push('social');
    }

    // 2. Humor (Acknowledge joke)
    if (purposes.includes('HUMOR') || isFuzzyMatch(normalized, DYNAMIC_VOCAB.humor)) {
      responseParts.push(pickRandom(DYNAMIC_RESPONSES.emotions.humor));
      tags.push('humor');
    }

    // 3. Emotional / Empathy (Complaint or Stress)
    if (purposes.includes('EMOTIONAL_SUPPORT') || purposes.includes('COMPLAINT') || isFuzzyMatch(normalized, DYNAMIC_VOCAB.complaint)) {
      responseParts.push(pickRandom(DYNAMIC_RESPONSES.emotions.empathy));
      tags.push('empathy');
    }

    // 4. Educational / Follow up / Help (The meat of the response)
    let eduText = null;
    if (purposes.includes('EDUCATIONAL_EXPLANATION') || purposes.includes('FOLLOW_UP') || purposes.includes('ASSISTANCE') || thoughtProcess.extractedData.subjects.length > 0) {
      eduText = executeEducationalIntentEngine(normalized, userMessage);
      if (eduText && !eduText.includes('مفهمتش قصدك')) {
         // To make it naturally flow from the social parts
         if (responseParts.length > 0) {
            responseParts.push('وبخصوص طلبك، ' + eduText);
         } else {
            responseParts.push(eduText);
         }
         tags.push('educational');
      }
    }

    // If fusion didn't actually combine anything, fallback to standard routing
    if (responseParts.length <= 1) return null;

    return {
      text: responseParts.join(' '),
      tag: tags.includes('educational') ? 'educational' : 'social'
    };
  }

  function executeEducationalIntentEngine(normalized, userMessage) {
    const rule = ruleAnswerFor(userMessage);
    if (rule && rule.text) return applyMiniTeacherMode(composeFinalResponse(rule, userMessage, analyzeStudentIntent(userMessage)));

    const platformReply = getPlatformReply(userMessage);
    if (platformReply && platformReply.text) return applyMiniTeacherMode(composeFinalResponse(platformReply, userMessage, analyzeStudentIntent(userMessage)));

    const known = getKnownResponses(userMessage);
    if (known && known.text) return applyMiniTeacherMode(composeFinalResponse(known, userMessage, analyzeStudentIntent(userMessage)));

    const contentBased = getContentBasedResponse(userMessage);
    if (contentBased && contentBased.text) return applyMiniTeacherMode(composeFinalResponse(contentBased, userMessage, analyzeStudentIntent(userMessage)));

    // 🧠 OFFLINE KNOWLEDGE RESEARCHER (TEACHER MODE)
    const expansionResponse = offlineKnowledgeResearcher(normalized, userMessage);
    if (expansionResponse) return expansionResponse;

    // 🚨 EMERGENCY RETRIEVAL
    const emergencyReply = emergencyRetrievalEngine(normalized, userMessage);
    if (emergencyReply) return emergencyReply;

    return { text: executeFallbackEngine(normalized, userMessage), tag: 'fallback' };
  }

  function applyMiniTeacherMode(responseObj) {
    if (!responseObj || !responseObj.text) return responseObj;
    const text = responseObj.text;
    // Don't apply if it's already an expansion or a fallback or very short
    if (text.length > 40 && responseObj.tag === 'educational' && !text.includes('خليني أشرحلك')) {
      const miniWrap = `${text}\n\n**تبسيط سريع:** لو فهمت دي، هترتاح جداً في المذاكرة.\n**نصيحة حفظ:** اربط المعلومة دي بكلمة تفكرك بيها في الامتحان.\nجاهز أسألك فيها ولا نكمل شرح؟`;
      return { text: miniWrap, tag: 'educational' };
    }
    return responseObj;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📚 OFFLINE KNOWLEDGE RESEARCHER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const OFFLINE_KNOWLEDGE_BASE = [
    {
      topic: 'الحملة الفرنسية',
      keywords: ['فرنسا', 'حملة', 'نابليون', 'كليبر', 'مينو', 'رشيد'],
      definition: 'الحملة الفرنسية على مصر (1798-1801) بقيادة نابليون بونابرت كان هدفها قطع طريق التجارة على إنجلترا للهند، وتأسيس إمبراطورية فرنسية في الشرق.',
      simplification: 'عشان أبسطهالك: دي كانت محاولة من فرنسا عشان تضرب انجلترا عن طريق السيطرة على مصر وتعمل لنفسها مستعمرة.',
      example: 'أبرز أحداثها: ثورة القاهرة الأولى وموقعة أبي قير البحرية اللي دمرت أسطول فرنسا.',
      memorizationPoint: 'احفظ النقطة دي كويس: (فك رموز حجر رشيد) هو أهم نتيجة علمية للحملة.',
      question: 'بعد ما شرحتلك.. جاهز أسألك في الحملة الفرنسية؟'
    },
    {
      topic: 'محمد علي',
      keywords: ['محمد علي', 'مذبحة القلعة', 'الاحتكار', 'مؤسس'],
      definition: 'محمد علي باشا هو مؤسس مصر الحديثة. تولى الحكم عام 1805 باختيار الزعامة الشعبية، وانفرد بالحكم بعد مذبحة القلعة.',
      simplification: 'ببساطة: الراجل ده استلم مصر وهي ضعيفة، وبنى جيش قوي واهتم بالزراعة والصناعة عشان يعمل دولة قوية خاصة بيه.',
      example: 'من إنجازاته: تطبيق نظام (الاحتكار) عشان يتحكم في الاقتصاد وإرسال بعثات علمية لأوروبا.',
      memorizationPoint: 'ركز في دي بتيجي في الامتحان: (عمر مكرم) هو زعيم المقاومة الشعبية اللي اختار محمد علي للحكم.',
      question: 'تفتكر بقى.. إيه هي مذبحة القلعة اللي عملها محمد علي؟'
    },
    {
      topic: 'تضاريس مصر',
      keywords: ['تضاريس', 'جبال', 'هضاب', 'الصحراء', 'وادي النيل'],
      definition: 'تنقسم تضاريس مصر لـ 4 أقسام رئيسية: وادي النيل والدلتا، الصحراء الغربية، الصحراء الشرقية، وشبه جزيرة سيناء.',
      simplification: 'بمعنى أصح: مصر متقسمة 4 حتت، حتة زراعية (الوادي والدلتا)، وحتة صحراء كبيرة (الغربية)، وحتة جبال (الشرقية)، وسيناء في الشرق.',
      example: 'مثال للتضاريس: سلسلة جبال البحر الأحمر في الصحراء الشرقية وهضبة مرمريكا في الغربية.',
      memorizationPoint: 'احفظها صم: (الصحراء الغربية) هي أكبر قسم تضاريسي في مصر.',
      question: 'مستعد للسؤال؟ لو قولتلك فين تقع هضبة الجلف الكبير هتقولي فين؟'
    },
    {
      topic: 'الفراعنة',
      keywords: ['فرعون', 'الدولة القديمة', 'الهكسوس', 'أحمس', 'تاريخ قديم', 'الاهرامات'],
      definition: 'تاريخ مصر الفرعوني ينقسم لعدة عصور: الدولة القديمة (عصر بناة الأهرامات)، الدولة الوسطى (الرخاء الاقتصادي)، والدولة الحديثة (المجد الحربي).',
      simplification: 'عشان متتلخبطش: تاريخ مصر عامل زي 3 محطات أساسية؛ محطة بنوا فيها الأهرامات، ومحطة اهتموا فيها بالزراعة والتجارة، ومحطة بقوا فيها جيش قوي وحاربوا.',
      example: 'زي ما الملك أحمس طرد الهكسوس في نهاية عصر الاضمحلال الثاني عشان يأمن البلد.',
      memorizationPoint: 'نقطة الامتحان هنا: (الملك مينا) هو موحد القطرين ومؤسس الأسرة الأولى.',
      question: 'ها يا بطل.. مين هو مؤسس الدولة الحديثة وصاحب المجد الحربي؟'
    }
  ];

  function searchPlatformKnowledge(normalized) {
    try {
      let adminCourses = JSON.parse(localStorage.getItem('adminCourses') || '[]');
      if (!adminCourses || adminCourses.length === 0) return null;

      const words = normalized.split(/\s+/).filter(w => w.length >= 3);
      if (words.length === 0) return null;

      // Filter out common stop words to avoid false positives
      const stopWords = ['انا', 'عايز', 'مش', 'فاهم', 'فين', 'اشرحلي', 'طب', 'ايه', 'ازاي', 'عن', 'بتاع', 'بتاعة'];
      const queryWords = words.filter(w => !stopWords.includes(w));

      if (queryWords.length === 0) return null;

      for (let course of adminCourses) {
        // 1. Check Course Title
        for (let qw of queryWords) {
          if (course.title && course.title.includes(qw)) {
            return { type: 'course', courseTitle: course.title, courseId: course.id };
          }
        }
        
        // 2. Check Units and Lessons
        if (course.units && Array.isArray(course.units)) {
          for (let unit of course.units) {
            for (let qw of queryWords) {
              if (unit.title && unit.title.includes(qw)) {
                return { type: 'unit', courseTitle: course.title, unitTitle: unit.title, courseId: course.id };
              }
            }
            if (unit.lessons && Array.isArray(unit.lessons)) {
              for (let lesson of unit.lessons) {
                for (let qw of queryWords) {
                  if (lesson.title && lesson.title.includes(qw)) {
                    return { type: 'lesson', courseTitle: course.title, unitTitle: unit.title, lessonTitle: lesson.title, courseId: course.id };
                  }
                }
              }
            }
          }
        }
      }
      return null;
    } catch(e) {
      console.error("Knowledge Expansion Error:", e);
      return null;
    }
  }

  function offlineKnowledgeResearcher(normalized, userMessage) {
    let matchedItem = null;
    let courseLink = '';
    
    // 1. Search Offline Base
    for (let item of OFFLINE_KNOWLEDGE_BASE) {
      if (item.keywords.some(k => normalized.includes(k) || userMessage.includes(k))) {
        matchedItem = item;
        break; // Take the first matched one for structured explanation
      }
    }

    // 2. Search Admin Courses
    const courseFinding = searchPlatformKnowledge(normalized);
    if (courseFinding) {
      if (courseFinding.type === 'lesson') {
        courseLink = `وللعلم، تفاصيل الدرس ده مشروحة كاملة في كورس (${courseFinding.courseTitle})، وحدة (${courseFinding.unitTitle})، درس (${courseFinding.lessonTitle}).`;
      } else if (courseFinding.type === 'unit') {
        courseLink = `ولو حابب تذاكر الموضوع ده بتركيز، هتلاقيه في كورس (${courseFinding.courseTitle}) وتحديداً في وحدة (${courseFinding.unitTitle}).`;
      } else {
        courseLink = `ولو حابب تذاكر الموضوع ده بتركيز، هتلاقيه في كورس (${courseFinding.courseTitle}).`;
      }
    }

    if (!matchedItem && !courseLink) return null;

    let finalResponse = '';
    
    if (matchedItem) {
      finalResponse = `خليني أشرحلك ( ${matchedItem.topic} ) في 5 خطوات سريعة:\n\n`;
      finalResponse += `**1. التعريف الأساسي:**\n${matchedItem.definition}\n\n`;
      finalResponse += `**2. تبسيط:**\n${matchedItem.simplification}\n\n`;
      finalResponse += `**3. مثال توضيحي:**\n${matchedItem.example}\n\n`;
      finalResponse += `**4. نقطة في الامتحان:**\n${matchedItem.memorizationPoint}\n\n`;
      finalResponse += `**5. سؤال ليك:**\n${matchedItem.question}`;
      
      if (courseLink) finalResponse += `\n\n${courseLink}`;
    } else {
      finalResponse = `أنا دورتلك في الكورسات بتاعتنا ولقيت إن الموضوع اللي بتسأل عنه موجود.. ${courseLink}\nأرجوك افتح صفحة الكورسات وابدأ ذاكره!`;
    }

    return composeFinalResponse({ text: finalResponse, tag: 'educational' }, userMessage, 'knowledge_expansion');
  }

  function executeContextEngine(normalized, userMessage) {
    const followUp = getFollowUpReply(userMessage);
    if (followUp && followUp.text) return composeFinalResponse(followUp, userMessage, analyzeStudentIntent(userMessage));
    return executeEducationalIntentEngine(normalized, userMessage);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🚨 EMERGENCY RETRIEVAL ENGINE (Retrieval Before Failure)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function emergencyRetrievalEngine(normalized, userMessage) {
    console.log('[EMERGENCY RETRIEVAL ENGINE] Scanning all knowledge bases for partial matches...');
    
    // 1. Scan KNOWLEDGE_REASONING_BASE
    for (const [topic, data] of Object.entries(KNOWLEDGE_REASONING_BASE)) {
      if (normalized.includes(topic) || Object.values(data).some(v => v.includes(normalized))) {
        return {
          text: `أنا مش متأكد إن كان ده اللي تقصده بالظبط، بس لو تقصد (${topic})، فالمعلومة اللي عندي بتقول:\n${data.explanation}\n\nهل ده اللي بتدور عليه؟`,
          tag: 'clarification'
        };
      }
    }

    // 2. Scan OFFLINE_KNOWLEDGE_BASE (Full Text Scan)
    for (const item of OFFLINE_KNOWLEDGE_BASE) {
      if (normalized.includes(item.topic) || item.definition.includes(normalized) || item.simplification.includes(normalized)) {
        return {
          text: `حاولت أفهم قصدك بالظبط، ولو سؤالك مرتبط بـ (${item.topic})، خليني أبسطهالك:\n${item.simplification}\n\nلو تقصد حاجة تانية ياريت توضحلي أكتر!`,
          tag: 'clarification'
        };
      }
    }

    // 3. Scan KNOWLEDGE_GRAPH
    for (const [topic, data] of Object.entries(KNOWLEDGE_GRAPH)) {
      if (normalized.includes(topic) || data.related.some(r => r.includes(normalized) || normalized.includes(r))) {
        return {
          text: `الكلام ده بيفكرني بـ (${topic}) واللي ليه علاقة بـ (${data.related.join(' و ')}).\nلو حابب نتكلم في النقطة دي، أنا جاهز!`,
          tag: 'clarification'
        };
      }
    }

    // 4. Memory Association (Last Topic)
    let memory = loadHumanMemory();
    if (memory.lastTopics && memory.lastTopics.length > 0) {
      const lastTopic = memory.lastTopics[memory.lastTopics.length - 1];
      if (normalized.length < 15) {
         return {
           text: `هل سؤالك ده له علاقة بـ (${lastTopic}) اللي كنا بنتكلم فيه من شوية؟ لو أيوة، ياريت توضح سؤالك عشان أجاوبك بدقة.`,
           tag: 'clarification'
         };
      }
    }

    console.log('[EMERGENCY RETRIEVAL ENGINE] Total Failure. Yielding to Fallback.');
    return null;
  }

  function executeFallbackEngine(normalized, userMessage, thoughtProcess = {}) {
    let response = getFallbackResponse(userMessage, thoughtProcess).text;
    return applyAntiRepetition(response, 'fallback');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🕵️‍♂️ STUDENT MISTAKE DECODER (Pre-processing)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const ADVANCED_TYPO_MAP = {
    'كمبيوتر': 'كمبيوتر',
    'اشترك': 'اشتراك',
    'اشتركم': 'اشتراك',
    'الكراس': 'الكورس',
    'البصورةه': 'الباسورد',
    'الباصورد': 'الباسورد',
    'الباسود': 'الباسورد',
    'مش عارفه': 'مش عارف',
    'مش شغاله': 'مش شغالة',
    'المنسه': 'المنصة',
    'البلاتفورم': 'المنصة',
    'منصه': 'المنصة',
    'معرفش': 'مش عارف',
    'مفهمتش': 'مش فاهم',
    'مشفاهم': 'مش فاهم',
    'مشبيفتح': 'مش بيفتح',
    'مابيفتحش': 'مش بيفتح',
    'مبيفتحش': 'مش بيفتح',
    'مشعارف': 'مش عارف',
    'يعم': 'يا عم',
    'يسطا': 'يا صاحبي',
    'ياعم': 'يا عم',
    'امتا': 'امتى',
    'ازاى': 'ازاي',
    'عوز': 'عايز',
    'عيز': 'عايز'
  };

  function decodeStudentMistakes(rawText) {
    if (!rawText) return '';
    let decoded = rawText;

    // 1. Fix commonly attached prefixes (مش، مب، ماب)
    decoded = decoded.replace(/\b(مش|مب|ماب)(?=[أ-ي])/g, '$1 ');

    // 2. Fix slang and typos using advanced map
    Object.keys(ADVANCED_TYPO_MAP).forEach(wrong => {
      const right = ADVANCED_TYPO_MAP[wrong];
      decoded = decoded.replace(new RegExp(`\\b${wrong}\\b`, 'g'), right);
    });

    return decoded;
  }

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

  // --- FIREBASE SYNC LOGIC ---
  let isBotPausedByAdmin = false;
  let supportSyncInitialized = false;

  function initFirebaseSupportSync() {
    if (supportSyncInitialized || !window.firebaseDb) return;
    const user = getCurrentUser();
    if (!user || !user.phone) return;

    supportSyncInitialized = true;
    
    // Sync Chats
    const chatDocRef = window.firebaseDb.collection('bot_chats').doc(user.phone);
    chatDocRef.onSnapshot(doc => {
      if (doc.exists) {
        const data = doc.data();
        
        // Update Bot Pause state based on Admin Heartbeat
        if (data.botPaused && data.adminActive) {
            const timeDiff = Date.now() - data.adminActive;
            isBotPausedByAdmin = timeDiff < 60000; // 60 seconds heartbeat
        } else {
            isBotPausedByAdmin = false;
        }

        if (data.messages && data.messages.length > 0) {
            const key = getStorageKey(BASE_HISTORY_KEY);
            const storage = getStorageForKey(key);
            safeSetItem(storage, key, JSON.stringify(data.messages));
            if (document.getElementById('pfChatWindow') && document.getElementById('pfChatWindow').style.display === 'flex') {
                renderHistory();
            }
        }
      }
    });

    // Sync Tickets (listen to my own tickets just in case admin replies)
    window.firebaseDb.collection('support_tickets').where('userId', '==', user.phone)
      .onSnapshot(snapshot => {
         const tickets = [];
         snapshot.forEach(doc => {
             tickets.push({ id: doc.id, ...doc.data() });
         });
         tickets.sort((a,b) => (a.ts||0) - (b.ts||0));
         const key = getStorageKey(BASE_TICKETS_KEY);
         const storage = getStorageForKey(key);
         safeSetItem(storage, key, JSON.stringify(tickets));
      });
  }

  // Push to Firebase helpers
  function syncHistoryToFirebase(h) {
    if (!window.firebaseDb) return;
    const user = getCurrentUser();
    if (!user || !user.phone) return;
    
    window.firebaseDb.collection('bot_chats').doc(user.phone).set({
        messages: h,
        updatedAt: Date.now(),
        user: { name: user.name || '', phone: user.phone }
    }, { merge: true }).catch(console.error);
  }

  function syncTicketToFirebase(ticket) {
    if (!window.firebaseDb || !ticket || !ticket.id) return;
    window.firebaseDb.collection('support_tickets').doc(ticket.id).set(ticket).catch(console.error);
  }
  // ---------------------------

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

    // Apply the mistake decoder before normalization
    normalized = decodeStudentMistakes(normalized);

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

  function getBotHistory() {
    try { return JSON.parse(sessionStorage.getItem('pf_bot_history')) || []; } 
    catch(e) { return []; }
  }

  function saveToBotHistory(responseStr) {
    let history = getBotHistory();
    history.push(responseStr);
    if (history.length > 20) history.shift();
    sessionStorage.setItem('pf_bot_history', JSON.stringify(history));
  }

  function applyAntiRepetition(responseStr, ruleTag) {
    if (!responseStr) return responseStr;
    const history = getBotHistory();
    
    if (history.includes(responseStr)) {
      if (ruleTag === 'social' || ruleTag === 'dynamic_chat') {
        const emojis = [' 😊', ' ✨', ' 💪', ' 🌟', ' 😄', ' 🎯'];
        responseStr += emojis[Math.floor(Math.random() * emojis.length)];
      } else {
        const PREFIXES = ['زي ما وضحتلك، ', 'تأكيداً لكلامي: ', 'مرة تانية عشانك، ', 'ببساطة: ', 'عشان تكون الصورة واضحة، '];
        responseStr = PREFIXES[Math.floor(Math.random() * PREFIXES.length)] + '\n' + responseStr;
      }
    }
    
    saveToBotHistory(responseStr);
    return responseStr;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 HUMANIZATION LAYER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function humanizeText(text) {
    if (!text || text.length < 10) return text;
    let modified = text;

    // 1. Synonym Swapper (only 50% probability to maintain original flavor)
    if (Math.random() > 0.5) {
      const synonyms = [
        { find: /شوف/g, replace: ['بص', 'ركز معايا', 'لاحظ'] },
        { find: /تقدر/g, replace: ['ممكن', 'في إمكانك', 'متاح ليك'] },
        { find: /مهم جداً/g, replace: ['ضروري أوي', 'أساسي ومهم', 'لازم نركز عليه'] },
        { find: /عشان/g, replace: ['علشان', 'لأن', 'بسبب إن'] }
      ];
      for (const rule of synonyms) {
        if (Math.random() > 0.5 && modified.match(rule.find)) {
          const replacement = rule.replace[Math.floor(Math.random() * rule.replace.length)];
          modified = modified.replace(rule.find, replacement);
        }
      }
    }

    // 2. List Shuffling (If it contains a list of items like - Item 1 \n - Item 2)
    // We look for patterns of "- " or "* " lines.
    if (modified.includes('- ') && Math.random() > 0.4) {
      const lines = modified.split('\n');
      const listItems = [];
      const normalLines = [];
      
      lines.forEach(line => {
        if (line.trim().startsWith('- ')) listItems.push(line);
        else normalLines.push(line);
      });

      if (listItems.length > 1) {
        // Shuffle list
        for (let i = listItems.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [listItems[i], listItems[j]] = [listItems[j], listItems[i]];
        }
        
        // Reconstruct: Try to insert them back where the first list item was found
        const firstListIndex = lines.findIndex(l => l.trim().startsWith('- '));
        if (firstListIndex !== -1) {
          lines.splice(firstListIndex, listItems.length, ...listItems);
          modified = lines.join('\n');
        }
      }
    }

    // 4. ANTI ROBOT LAYER (Strict filter for robotic helpers)
    // Strip "كيف يمكنني مساعدتك" completely if the response is already long enough
    if (modified.length > 50) {
      modified = modified.replace(/(كيف أستطيع مساعدتك|كيف يمكنني مساعدتك|كيف أساعدك|ماذا تريد|هل تحتاج شيئاً|هل تريد شيئاً آخر|محتاج حاجة تانية|عندك استفسار تاني)/g, '');
    } else {
      // If it's a short response, maybe it's just a greeting, so rotate wildly
      const roboticPhrases = [
        { find: /(كيف أستطيع مساعدتك|كيف يمكنني مساعدتك|كيف أساعدك)\b/g, replace: ['أقدر أعملك إيه دلوقتي؟', 'عايزني أساعدك في إيه يا بطل؟', 'تحب أساعدك إزاي؟', 'في خدمتك، أقدر أساعدك إزاي؟', ''] },
        { find: /(ماذا تريد|هل تريد شيئاً آخر|هل تحتاج شيئاً)\b/g, replace: ['أقدر أقدملك حاجة تانية؟', 'تؤمرني بحاجة كمان؟', 'محتاج مني أي خدمة تانية؟', ''] },
        { find: /(لا أستطيع فهمك|لم أفهم|عفواً لم أفهم)\b/g, replace: ['كلامك كبير عليا شوية، ممكن تبسطه؟', 'أنا تهت منك، تقصد إيه بالظبط؟', 'حاسس إني مش مجمع، ممكن تشرحلي قصدك تاني؟'] }
      ];
      for (const rule of roboticPhrases) {
        if (modified.match(rule.find)) {
          const replacement = rule.replace[Math.floor(Math.random() * rule.replace.length)];
          modified = modified.replace(rule.find, replacement);
        }
      }
    }

    return modified.trim();
  }

  function composeFinalResponse(rule, question, intentData) {
    let response = rule && typeof rule.text === 'string' ? rule.text : '';

    // 🧠 CONVERSATION PERSONALITY ENGINE
    if (rule && rule.tag && !response.includes('بص يا سيدي') && !response.includes('يا بطل')) {
      const personalityHooks = {
        educational: [
          'بص يا سيدي ركز معايا..',
          'سؤال ممتاز جداً! خليني أوضحلك..',
          'سؤالك في محله يا بطل! شوف يا سيدي..',
          'دي جزئية مهمة جداً ومحتاجة تركيز، بص..',
          'ولا يهمك خالص، الموضوع أبسط مما تتخيل:',
          'من أهم الأسئلة اللي بحبها! بص..',
          'تعظيم سلام للسؤال ده! بص يا نجم المنصة..',
          'ركز معايا وهتلاقيها سهلة جداً إن شاء الله:'
        ],
        assistance: [
          'طبعاً، عيني ليك:',
          'تحت أمرك يا كينج، بص معايا:',
          'معاك وفي ظهرك دايماً، بص يا سيدي:',
          'ولا تشغل بالك، الحل عندي:'
        ]
      };

      if (personalityHooks[rule.tag] && Math.random() > 0.3) {
        const prefix = personalityHooks[rule.tag][Math.floor(Math.random() * personalityHooks[rule.tag].length)];
        response = prefix + '\n\n' + response;
      }
    }

    if (shouldAppendEscalationHint(response, question)) {
      escalationSuggested = true;
      response = `${response}\n\n${ESCALATION_SUGGESTION}`.trim();
    }
    
    let finalized = applyAntiRepetition(response, rule ? rule.tag : null);
    return humanizeText(finalized);
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
  function getSupportContact() {
    const settings = getPaymentSettings();
    return settings.vCashNum || '01023675235';
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 HYBRID AI MODE (LAYER 3: DYNAMIC FALLBACK GENERATOR)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function generateHybridFallback(thoughtProcess) {
    const ext = thoughtProcess.extractedData || {};
    const subjects = ext.subjects || [];
    const goal = ext.goal || 'GENERAL';
    
    let parts = [];

    // Build the core sentence based on the extracted subject
    if (subjects.length > 0) {
      const subject = subjects[0];
      if (goal === 'PROBLEM_SOLVING') {
        parts.push(`بخصوص "${subject}" اللي بتواجه فيه مشكلة، أنا محتاج منك تفاصيل أكتر شوية.`);
        parts.push(`المشكلة دي بتظهرلك فين بالظبط على المنصة عشان أقدر أحلها معاك؟`);
      } else if (goal === 'FACT_SEEKING' || goal === 'DEEP_UNDERSTANDING') {
        parts.push(`بالنسبة لجزئية "${subject}" دي، المنهج مليان تفاصيل فيها.`);
        parts.push(`لو تقدر تحددلي بتسأل عن إيه بالظبط أو إيه اللي مش واضح، هقدر أديك الخلاصة بسرعة.`);
      } else {
        parts.push(`أنا لقطت إن كلامك عن "${subject}"، بس بصراحة مش قادر أحدد إنت محتاج إيه بالظبط.`);
        parts.push(`ممكن توضحلي أكتر عشان أقدر أفيدك؟`);
      }
    } else {
      // No subjects found
      if (goal === 'PROBLEM_SOLVING') {
        parts.push('أنا معاك إن في مشكلة مضايقاك، بس محتاج أعرف تفاصيل أكتر.');
        parts.push('بتواجه المشكلة دي فين بالظبط؟ (شاشة الدخول، فيديو معين، ولا في الدفع؟)');
      } else if (goal === 'FACT_SEEKING') {
        parts.push('سؤالك حلو، بس ناقصه شوية تفاصيل عشان أقدر أديك إجابة دقيقة.');
        parts.push('تقصد إيه بالظبط؟');
      } else {
        const generic = [
          'حاسس إني تهت منك شوية يا صاحبي 😅، ممكن تبسطهالي أو تشرحلي إنت تقصد إيه بالظبط؟',
          'الكلام دخل في بعضه شوية معايا... تقصد إيه؟',
          'أنا معاك بس محتاج تفاصيل أكتر عشان أقدر أساعدك صح 🎯'
        ];
        parts.push(generic[Math.floor(Math.random() * generic.length)]);
      }
    }

    return parts.join(' ');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 ERROR RECOVERY SYSTEM
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function errorRecoverySystem(normalized, userMessage, thoughtProcess) {
    console.log('[ERROR RECOVERY SYSTEM] Triggered. Attempting to salvage intent...');
    
    // Attempt 1: Second Pass Semantic Understanding
    const semanticConcepts = extractSemanticConcepts(normalized || userMessage);
    if (semanticConcepts.length > 0) {
      console.log('[ERROR RECOVERY SYSTEM] Recovered via Semantic Concepts:', semanticConcepts);
      return `أنا لقطت إحساسك واهتمامك بـ (${semanticConcepts[0].split('_')[1] || 'الموضوع ده'})..\nحابب توضحلي أكتر عشان أقدر أساعدك بشكل مباشر؟`;
    }

    // Attempt 2: Hybrid Fallback (Extracts subjects & goals to ask contextual questions naturally)
    console.log('[ERROR RECOVERY SYSTEM] Semantic failed. Using Hybrid Keyword Extraction...');
    const fallbackText = generateHybridFallback(thoughtProcess);
    return fallbackText;
  }

  function getFallbackResponse(question, thoughtProcess = {}) {
    const supportContact = getSupportContact();
    const fallbackText = generateHybridFallback(thoughtProcess);
    return {
      text: `${fallbackText}\n\nولو محتاج مساعدة فنية، تواصل مع الدعم على ${supportContact}.`,
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔥 THE NEW DYNAMIC CONVERSATIONAL ENGINE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const DYNAMIC_VOCAB = {
    check_status: ['اخبارك', 'عامل ايه', 'عامل اي', 'طمني', 'عامل ايه يا نجم', 'ايه الاخبار', 'الدنيا معاك', 'كيفك', 'عامل ايه يا بطل', 'طمني عليك', 'عامل ايه يارب تكون بخير', 'طمنا', 'ايه الدنيا', 'شغال فين', 'يا نجم', 'يا باشا', 'يا ريس', 'وحشني', 'عامل ايه يا غالي', 'طمني عنك'],
    greetings: ['صباح', 'مسا', 'اهلا', 'مرحبا', 'ازيك', 'هاي', 'هلو', 'مورنينج', 'سلام', 'يا هلا', 'نورت', 'يا مسا', 'منور', 'يا صباح', 'مساء الفل', 'صباح الفل', 'صباحو', 'يا غالي', 'هلا وغلا', 'السلام عليكم'],
    thanks: ['شكرا', 'تسلم', 'عاش', 'حبيبي', 'بطل', 'جزاك', 'متشكر', 'ميرسي', 'تمام', 'حلو', 'جميل', 'يا غالي', 'الله ينور', 'تسلم ايدك', 'الف شكر', 'حبيبي يا بطل', 'عظمة'],
    need_simplification: ['مش فاهم', 'مش جايبها', 'تايه', 'ضايع', 'مش مستوعب', 'معقد', 'متلخبط', 'معرفش', 'صعبة', 'مش قادر', 'الدنيا لفت', 'مش مجمع', 'هنجت', 'فصلت', 'مش راكبة', 'وقفت معايا'],
    complaint: ['مش شغال', 'بايظ', 'عطلان', 'مشكلة', 'زفت', 'مش بيفتح', 'خربان', 'واقع', 'بيعلق', 'بيهنج', 'مش راضي'],
    humor: ['نكتة', 'ضحكني', 'هتموتني من الضحك', 'انت جامد', 'عسل', 'تضحك', 'فصلان', 'هموت', 'يخربيتك', 'جامد زحليقة', 'والله انت برنس', 'ضحك السنين'],
    help: ['ساعدني', 'عايز مساعدة', 'دعم', 'الحقني', 'مشكلة', 'سؤال', 'حد يرد', 'في مشكلة', 'محتاج حد'],
    follow_up: ['طب', 'وبعدين', 'يعني', 'قصدك', 'لسه', 'كمان', 'طيب', 'وبالنسبة', 'امال', 'وبعدين بقى'],
    subjects: [
      // 1st Prep
      'ظواهر كونية', 'مجرات', 'نجوم', 'كواكب', 'سدم', 'نيازك', 'شهب', 'المجموعة الشمسية', 'شكل الأرض', 'خطوط الطول', 'دوائر العرض', 'فصول السنة', 'اليابس والماء', 'بنجايا', 'زلازل', 'براكين', 'تعرية',
      'عصر حجري', 'عصر نحاسي', 'ما قبل الأسرات', 'بناة الأهرامات', 'الدولة القديمة', 'زوسر', 'خوفو', 'خفرع', 'منكاورع', 'الدولة الوسطى', 'سنوسرت', 'أمنمحات', 'الهكسوس', 'أحمس', 'المجد الحربي', 'الدولة الحديثة', 'حتشبسوت', 'تحتمس', 'رمسيس',
      'افريقيا', 'قارة افريقيا', 'هضبة الحبشة', 'حوض النيل', 'نهر الكونغو', 'النيجر', 'الصحراء الكبرى', 'غابات استوائية', 'سافانا', 'مدار السرطان', 'خط الاستواء', 'تاريخ قديم',

      // 2nd Prep
      'وطننا العربي', 'تضاريس الوطن العربي', 'جبال التوائية', 'جبال انكسارية', 'مناخ الوطن العربي', 'توزيع السكان',
      'البعثة', 'الهجرة', 'غزوات', 'الخلفاء الراشدين', 'ابو بكر', 'عمر بن الخطاب', 'عثمان بن عفان', 'علي بن ابي طالب', 'الدولة الاموية', 'الدولة العباسية', 'الدولة الفاطمية', 'الدولة الايوبية', 'روائع الحضارة الاسلامية',
      'اسيا', 'اوروبا', 'قارة اسيا', 'قارة اوروبا', 'الهيمالايا', 'سيبيريا', 'جبال الالب', 'البلقان', 'المحيط الهادي', 'المحيط الهندي', 'تندرا', 'الخلافة الاسلامية', 'الفتوحات الاسلامية', 'الاندلس', 'بيت المال', 'الحضارة الاسلامية',

      // 3rd Prep
      'قارات العالم', 'تضاريس العالم', 'مناخ العالم', 'السلالات البشرية', 'سكان العالم', 'النشاط الزراعي', 'النشاط الصناعي', 'التعدين',
      'مصر بين المماليك والعثمانيين', 'الحملة الفرنسية', 'ثورة الشعب', 'محمد علي', 'بناء الدولة الحديثة', 'خلفاء محمد علي', 'النفوذ الاجنبي', 'الحركة الوطنية', 'الثورة العرابية', 'الاحتلال البريطاني', 'ثورة 1919', 'ثورة 23 يوليو', 'الصراع العربي الاسرائيلي', 'حرب اكتوبر', 'ثورة 25 يناير', 'ثورة 30 يونيو',

      // 1st Sec (History)
      'الحضارة والتاريخ', 'مصادر دراسة الحضارات', 'عوامل قيام الحضارات', 'مصر الفرعونية', 'الحياة السياسية', 'الحياة الدينية', 'الحياة الثقافية', 'حضارة العراق', 'بلاد الرافدين', 'فينيقيا', 'اليونان', 'الاغريق', 'البطالمة', 'الرومان',

      // The Deep Egyptian/Tough Keywords
      'حرب الاستنزاف', 'خط بارليف', 'مؤتمر كامب ديفيد', 'طابا', 'محكمة العدل الدولية', 'تصريح 28 فبراير', 'دستور 1923', 'وزارة الشعب', 'الاقليم الاستوائي', 'الاقليم المداري', 'الاقليم الموسمي', 'الاقليم الصحراوي', 'البحر المتوسط', 'الاقليم اللورنسي', 'الكثبان الرملية',

      // Core general terms
      'نيل', 'قناة السويس', 'تاريخ', 'جغرافيا', 'ديمقراطية', 'حضارة', 'خريطة', 'مناخ', 'زراعة', 'بيئة', 'اقتصاد', 'المماليك', 'العثمانيين', 'الفراعنة', 'سعد زغلول', 'عرابي', 'خديوي', 'اسماعيل', 'نابليون', 'كليبر', 'مينو', 'معاهدة', 'مصطفى كامل', 'محمد فريد', 'عبدالناصر', 'السادات', 'صناعة', 'تجارة', 'سياحة', 'صحراوية', 'ساحلية', 'زراعية', 'صناعية', 'حدود', 'بحر احمر', 'بحر متوسط', 'جبال', 'هضاب', 'منخفضات', 'مداري', 'دراسات'
    ],
    inquiry: ['ايه', 'ازاي', 'ليه', 'فين', 'امتى', 'مين', 'اشرح', 'بكام']
  };

  const DYNAMIC_RESPONSES = {
    greetings: ['يا هلا بك!', 'منورنا يا بطل 🌟', 'صباح الفل والنشاط 💪', 'أهلاً بيك 😄', 'يا مرحب!', 'نورت البوصلة ✨', 'يا مية مسا!', 'يا كينج المنصة 👑', 'يا برنس الليالي 🌙', 'يا وحش الجغرافيا والتاريخ 🌍', 'يا ريس نورتنا!'],
    emotions: {
      positive: ['عظيم جداً!', 'شاطر ومكمل!', 'دي الروح المطلوبة 💪', 'فخور بيك جداً.', 'عاش يا بطل الأبطال 🦸‍♂️', 'عظمة على عظمة!', 'الله ينور عليك يا عالمي 🌍'],
      empathy: ['ولا يهمك خالص، كلنا بنتلخبط في الأول.', 'طبيعي تحس بكده، بس أنا معاك خطوة بخطوة.', 'مفيش حاجة صعبة، هنبسطها مع بعض.', 'ماتقلقش، الموضوع أبسط مما تتخيل.', 'انا في ظهرك ياصاحبي متقلقش.', 'شد حيلك والعبقري اللي جواك هيطلع.', 'مفيش مستحيل طول ماحنا مع بعض.'],
      humor: ['هههههه 😂 ربنا يسعدك يا بطل،', 'يا سيدي ولا يهمك 😂،', 'ضحكتني والله 😂،', 'عسل يا بطل 😂،', 'يانهار ابيض على الحلاوة 😂،', 'انت بتذاكر من ورايا ولا ايه 😂،']
    },
    cores: {
      thanks: ['على إيه بس، إحنا هنا عشانك!', 'عيني ليك يا بطل!', 'تحت أمرك في أي وقت 💪', 'بالتوفيق دايماً يا رب!', 'ده واجبي، المهم تكون مستفيد 💯'],
      identity: ['أنا البوصلة بتاعتك هنا في المنصة، صايع ردود وموجود دايماً عشان أسهل عليك المذاكرة 💪', 'أنا المساعد الذكي بتاعك، موجود هنا لخدمتك في أي وقت.', 'أنا البوصلة، مهمتي أرد على كل أسئلتك وأساعدك تذاكر أحسن.'],
      farewell: ['في رعاية الله يا بطل، مستنيك ترجعلي تاني في أي وقت 👋', 'مع السلامة، وماتنساش تذاكر كويس!', 'باي باي، هتوحشني لحد ما ترجع 👋'],
      subject: [
        'يا سلام على موضوع [SUBJECT]! ده من أمتع أجزاء منهج الدراسات.',
        'موضوع [SUBJECT] ده حكايته حكاية، ومهم جداً في الامتحان وبييجي كتير.',
        'عظيم! خلينا ندخل في تفاصيل [SUBJECT] عشان دي بتفرق مع الأوائل وتكسر بيها أي امتحان.',
        'بص يا سيدي، [SUBJECT] محتاج تركيز عالي، وهو الصراحة ممتع جداً تحسه قصة مش مجرد درس.',
        'سؤالك عن [SUBJECT] في محله، دي جزئية محتاجة فهم مش بس حفظ، وهنفرمها سوا.',
        'يا عيني على [SUBJECT]! ده لعبتنا ومفيش سؤال هيقف قدامنا فيه.'
      ]
    },
    follow_ups: {
      general: ['أقدر أساعدك في إيه دلوقتي؟', 'تحب نبدأ في إيه؟', 'قولي، في إيه في المنهج أقدر أساعدك فيه؟'],
      empathy: ['قولي بس إيه اللي مش واضح؟', 'تحب أشرحلك من الأول بطريقة تانية؟', 'تفتكر المشكلة فين بالظبط؟', 'خلينا ناخدها حتة حتة، إيه رأيك؟'],
      subject: ['تحب أشرحلك الجزئية دي ولا عندك سؤال محدد فيها؟', 'عندك استفسار معين في الجزء ده؟', 'في حاجة معينة واقفة معاك هنا؟'],
      action: ['يلا بينا نرجع نكسر الدنيا في المذاكرة؟', 'تحب نفتح درس جديد ولا نراجع؟']
    },
    clarification: [
      'أنا مش متأكد إني فهمت قصدك بالظبط يا بطل، تقصد إيه تحديداً؟',
      'كلامك كبير عليا شوية، ممكن تبسطهولي عشان أقدر أساعدك؟',
      'انا بحاول أفهمك بس الموضوع تايه مني، تقصد إيه؟',
      'وضحلي أكتر يا صاحبي عشان أقدر أرد عليك صح.'
    ]
  };

  function pickRandom(arr) {
    const history = getBotHistory();
    let options = arr.filter(item => !history.some(h => h && h.includes && h.includes(item)));
    if (options.length === 0) options = arr;
    return options[Math.floor(Math.random() * options.length)];
  }

  function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    var matrix = [];
    for (var i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for (var j = 0; j <= a.length; j++) { matrix[0][j] = j; }
    for (var i = 1; i <= b.length; i++) {
      for (var j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) == a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
        }
      }
    }
    return matrix[b.length][a.length];
  }

  function isFuzzyMatch(normalizedStr, targetArray) {
    const words = normalizedStr.split(/\s+/);
    for (let target of targetArray) {
      if (normalizedStr.includes(target)) return true;
      
      if (!target.includes(' ')) {
        // Single word target
        for (let word of words) {
          if (word.length < 3) continue;
          let dist = levenshteinDistance(word, target);
          let allowed = target.length <= 4 ? 1 : 2;
          if (dist <= allowed) return true;
        }
      } else {
        // Bag of words logic for multi-word targets (order independent)
        const targetWords = target.split(/\s+/);
        let allFound = true;
        
        for (let tWord of targetWords) {
          if (tWord.length < 3) continue;
          let foundThisWord = false;
          for (let word of words) {
            let dist = levenshteinDistance(word, tWord);
            let allowed = tWord.length <= 4 ? 1 : 2;
            if (dist <= allowed || word.includes(tWord)) {
              foundThisWord = true;
              break;
            }
          }
          if (!foundThisWord) {
            allFound = false;
            break;
          }
        }
        
        if (allFound) return true;
      }
    }
    return false;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 GOAL DETECTION & ISLAMIC GREETING ENGINE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function analyzeIslamicGreeting(text) {
    const clean = text.replace(/أ/g, 'ا').replace(/إ/g, 'ا').replace(/آ/g, 'ا');
    
    // Level 3: Full greeting (ورحمة الله وبركاته)
    if (/(و\s*ر+ح+م+ة*\s*ا+ل+ل+ه+\s*و*\s*ب+ر+ك+ا+ت+ه+)/.test(clean) && /(س+ل+ا+م+و*\s*ع+ل+ي+ك+و+م*)/.test(clean)) {
      return { level: 3, reply: 'وعليكم السلام ورحمة الله وبركاته' };
    }
    // Level 2.5: (ورحمة الله)
    if (/(و\s*ر+ح+م+ة*\s*ا+ل+ل+ه+)/.test(clean) && /(س+ل+ا+م+و*\s*ع+ل+ي+ك+و+م*)/.test(clean)) {
      return { level: 2.5, reply: 'وعليكم السلام ورحمة الله' };
    }
    // Level 2: Basic Islamic (سلام عليكم)
    if (/(س+ل+ا+م+و*\s*ع+ل+ي+ك+و+م*)/.test(clean)) {
      return { level: 2, reply: 'وعليكم السلام ورحمة الله' };
    }
    return { level: 1, reply: null };
  }

  function detectUserGoal(normalized) {
    // FACT_SEEKING: مين، امتى، فين، بكام
    if (/\b(مين|امتى|متى|فين|بكام|كم|ايه هو)\b/.test(normalized) && normalized.length < 30) return 'FACT_SEEKING';
    
    // VERIFICATION: هل، صح كده، بجد، متأكد
    if (/\b(هل|صح كده|متاكد|بجد|مظبوط)\b/.test(normalized)) return 'VERIFICATION';
    
    // PROBLEM_SOLVING: مش شغال، عطلان، مش عارف
    if (/\b(مش شغال|عطلان|نسيت|ازاي ادفع|ازاي اشترك|مش بيفتح)\b/.test(normalized)) return 'PROBLEM_SOLVING';
    
    // DEEP_UNDERSTANDING: اشرحلي، ازاي، ليه، يعني ايه
    if (/\b(اشرح|ازاي|ليه|يعني ايه|فهمني|بسرعة)\b/.test(normalized)) return 'DEEP_UNDERSTANDING';
    
    return 'GENERAL';
  }

  function applyGoalBasedFormatting(text, goal, internalPlan = {}) {
    if (!text || text.length < 10) return text;
    let modified = text;

    if (goal === 'FACT_SEEKING' || internalPlan.needsShortening) {
      // Strip out long intros, make it very concise
      modified = modified.replace(/بص يا سيدي ركز معايا\.\.|سؤال ممتاز جداً! خليني أوضحلك\.\.|سؤالك في محله يا بطل! شوف يا سيدي\.\./g, '');
      // Keep only first 2 sentences max
      const sentences = modified.split(/(?<=[.?!])\s+/);
      modified = sentences.slice(0, 2).join(' ').trim();
    } else if (goal === 'VERIFICATION') {
      const verifications = ['بالظبط كده! ', 'كلامك مظبوط، ', 'فعلاً يا بطل، ', 'أأكدلك كلامك: '];
      modified = verifications[Math.floor(Math.random() * verifications.length)] + modified;
    } else if (goal === 'DEEP_UNDERSTANDING' || internalPlan.needsExplanation) {
      if (!modified.includes('بص يا سيدي')) {
        modified = 'بص يا سيدي ركز معايا، هبسطهالك خالص:\n\n' + modified;
      }
    }
    
    // Example injection
    if (internalPlan.needsExample && !modified.includes('تخيل إن')) {
      modified += '\n\n(عشان توضح الفكرة أكتر، تخيل إن الموضوع ده عامل زي قصة أو تطبيق عملي في حياتنا..)';
    }
    
    // Adaptive Teaching: Advanced Insight
    if (internalPlan.advancedExplanation) {
      modified += '\n\n💡 **وبما إن مستواك ممتاز وبتفهمها وهي طايرة، خليني أضيفلك بُعد أعمق:** في الحقيقة الموضوع ده بيرتبط بشكل كبير بتفاصيل أعمق في المنهج هتفهمها أكتر قدام، لأن الأحداث دي كلها بتسمّع في بعضها!';
    }
    
    return modified;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 INTERNAL PLANNER BRAIN
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function generateInternalPlan(thoughtProcess, normalized) {
    let plan = {
      whatUserWants: '',
      bestApproach: '',
      needsExplanation: false,
      needsShortening: false,
      needsExample: false,
      needsEncouragement: false,
      advancedExplanation: false,
      studentTier: 'Intermediate'
    };

    const goal = thoughtProcess.extractedData.goal || 'GENERAL';
    const emotion = thoughtProcess.extractedData.emotion || 'NEUTRAL';
    const purpose = thoughtProcess.purpose || 'UNKNOWN_PURPOSE';

    // Determine needs
    if (goal === 'DEEP_UNDERSTANDING') {
      plan.needsExplanation = true;
      plan.needsExample = true;
    }
    if (goal === 'FACT_SEEKING') {
      plan.needsShortening = true;
    }
    if (['FRUSTRATION', 'ANXIETY', 'BOREDOM'].includes(emotion)) {
      plan.needsEncouragement = true;
    }

    if (purpose === 'SOCIAL_CONNECTION') {
      plan.needsShortening = true;
      plan.bestApproach = 'Chat casually and naturally';
    } else if (purpose === 'EDUCATIONAL_EXPLANATION') {
      plan.bestApproach = plan.needsExplanation ? 'Detailed educational explanation with logic' : 'Direct educational answer';
    } else if (purpose === 'PROBLEM_SOLVING') {
      plan.bestApproach = 'Step-by-step troubleshooting';
    } else {
      plan.bestApproach = 'General support response';
    }

    plan.whatUserWants = `Goal: ${goal}, Emotion: ${emotion}`;

    // 🧠 PROFILE BUILDER INTEGRATION & ADAPTIVE TEACHING
    const profile = getStudentProfile();
    if (profile) {
      // Classify Tier
      let studentTier = 'Intermediate';
      if (profile.understandingLevel < 40 || (profile.writingStyle && profile.writingStyle.shortMessages > 5 && profile.understandingLevel < 50)) {
        studentTier = 'Beginner';
      } else if (profile.understandingLevel > 70) {
        studentTier = 'Advanced';
      }

      plan.studentTier = studentTier;

      // Adaptive Teaching Logic
      if (studentTier === 'Beginner') {
        plan.needsShortening = true;
        plan.needsEncouragement = true;
        plan.lowUnderstanding = true;
        plan.bestApproach = 'Extreme simplification for struggling/beginner student';
      } else if (studentTier === 'Advanced' && purpose === 'EDUCATIONAL_EXPLANATION') {
        plan.advancedExplanation = true;
      }

      if (thoughtProcess.extractedData.subjects && thoughtProcess.extractedData.subjects.length > 0) {
        const sub = thoughtProcess.extractedData.subjects[0];
        if (profile.topics && profile.topics[sub] && profile.topics[sub].struggles > 2) {
          plan.needsShortening = true;
          plan.needsEncouragement = true;
          plan.isStrugglingTopic = true;
          plan.bestApproach = 'Extreme simplification for struggling topic';
        }
      }
    }

    console.log('[INTERNAL PLANNER BRAIN]', plan);
    return plan;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 EMOTION DETECTION ENGINE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function analyzeEmotion(normalized) {
    if (/\b(يأس|مش نافع|فاشل|تعبت|مفيش فايدة|محبط|صعب)\b/.test(normalized)) return 'FRUSTRATION';
    if (/\b(خايف|قلقان|متوتر|خايفة|مرعوب|الامتحان|خوف)\b/.test(normalized)) return 'ANXIETY';
    if (/\b(جاهز|هنكسر الدنيا|يالا بينا|متحمس|عاش|بطل)\b/.test(normalized)) return 'EXCITEMENT';
    if (/\b(فرحان|نجحت|قفلت|الحمدلله|شطورة|فرحتني)\b/.test(normalized)) return 'JOY';
    if (/\b(زهقت|مكسل|ملل|طهقت|مش قادر|تعبان)\b/.test(normalized)) return 'BOREDOM';
    if (/\b(متعصب|زفت|غبي|مخنوق|نرفزة|ضايق|مستفز)\b/.test(normalized)) return 'ANGER';
    
    return 'NEUTRAL';
  }

  function applyPersonaEngine(text, abstractConcept, purpose, internalPlan) {
    if (!text || text.length < 5) return text;

    let modified = text;
    let persona = 'FRIEND'; // Default social fallback

    if (purpose === 'EDUCATIONAL_EXPLANATION' || purpose === 'INFORMATION_SEEKING' || purpose === 'FOLLOW_UP') {
      persona = 'TEACHER';
    }
    
    // Explicit overrides
    if (abstractConcept === 'CONCEPT_MOTIVATION') {
      persona = 'COACH';
    } else if (purpose === 'COMPLAINT' || abstractConcept === 'CONCEPT_FRUSTRATION') {
      persona = 'SUPPORT';
    } else if (abstractConcept === 'CONCEPT_HUMOR' || abstractConcept === 'CONCEPT_VENTING' || abstractConcept === 'CONCEPT_GREETING' || abstractConcept === 'CONCEPT_APPRECIATION') {
      persona = 'FRIEND';
    }

    console.log(`[PERSONA ENGINE] Routing as: ${persona} (Concept: ${abstractConcept}, Purpose: ${purpose})`);

    // Only apply prefix if not already heavily styled
    if (!modified.includes('بص يا') && !modified.includes('🔥') && !modified.includes('يا صاحبي')) {
      switch (persona) {
        case 'TEACHER':
          if (text.length > 50 && !modified.includes('عشان نفهم ده صح')) {
            modified = 'بص يا بطل ركز معايا في دي:\n\n' + modified;
          }
          break;
        case 'COACH':
          modified = '🔥 مفيش حاجة اسمها مستحيل! قوم كسر الدنيا يا بطل:\n\n' + modified;
          break;
        case 'SUPPORT':
          modified = '🛠️ حقك عليا لو في حاجة ضايقتك، إحنا هنا عشان نسهل عليك كل حاجة:\n\n' + modified;
          break;
        case 'FRIEND':
          if (abstractConcept === 'CONCEPT_VENTING' || abstractConcept === 'CONCEPT_CONFUSION') {
            modified = 'يا صاحبي أنا حاسس بيك جداً والله، ولا يهمك خالص فضفض براحتك..\n\n' + modified;
          } else if (abstractConcept === 'CONCEPT_HUMOR') {
            modified = '😂😂 يا سيدي على الروقان..\n\n' + modified;
          }
          break;
      }
    }

    return modified;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 HUMAN CONVERSATION MEMORY ENGINE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function loadHumanMemory() {
    try {
      const raw = localStorage.getItem('bot_human_memory');
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return { name: null, grade: null, style: null, interests: [], lastTopics: [] };
  }

  function saveHumanMemory(mem) {
    localStorage.setItem('bot_human_memory', JSON.stringify(mem));
  }

  function humanMemoryEngine(normalizedText, abstractConcept, subjects, dbUser, userMessage) {
    let memory = loadHumanMemory();

    // 1. Extract Name
    if (!memory.name && dbUser && dbUser.name) {
      memory.name = dbUser.name.split(' ')[0]; // First name only
    } else if (normalizedText.includes('انا اسمي') || normalizedText.includes('اسمي ')) {
      const words = userMessage.split(' ');
      const nameIndex = words.findIndex(w => w === 'اسمي' || w === 'اسمى');
      if (nameIndex !== -1 && words[nameIndex + 1]) {
        memory.name = words[nameIndex + 1];
      }
    }

    // 2. Track Topics & Deduce Grade
    if (subjects && subjects.length > 0) {
      subjects.forEach(sub => {
        if (!memory.interests.includes(sub)) memory.interests.push(sub);
        if (!memory.lastTopics.includes(sub)) {
          memory.lastTopics.push(sub);
          if (memory.lastTopics.length > 2) memory.lastTopics.shift(); // Keep last 2
        }
      });
    }

    // 3. Detect Style
    if (abstractConcept === 'CONCEPT_HUMOR' || abstractConcept === 'CONCEPT_VENTING') {
      memory.style = 'CASUAL';
    } else if (userMessage.includes('شكرا') || userMessage.includes('استاذ')) {
      memory.style = 'POLITE';
    }

    saveHumanMemory(memory);
    return memory;
  }

  function injectHumanMemory(candidateText, isFirstMessageInSession) {
    let memory = loadHumanMemory();
    if (!memory.name || candidateText.length < 15) return candidateText;

    let modified = candidateText;

    // Subtle Injection Logic (20% chance or if it's the first interaction)
    if (isFirstMessageInSession || Math.random() < 0.2) {
      
      // Don't inject if name already mentioned
      if (modified.includes(memory.name)) return modified;

      if (isFirstMessageInSession && memory.lastTopics.length > 0 && Math.random() < 0.5) {
        modified = `أهلاً بيك يا ${memory.name}، عاش من شافك! جاهز نكمل حماسنا؟\n\n` + modified;
      } else if (modified.includes('يا بطل')) {
        modified = modified.replace('يا بطل', `يا ${memory.name}`);
      } else if (modified.includes('يا صاحبي')) {
        modified = modified.replace('يا صاحبي', `يا ${memory.name}`);
      } else if (modified.includes('بص يا ')) {
        modified = modified.replace('بص يا ', `بص يا ${memory.name} `);
      }
    }

    return modified;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 REASONING TEMPLATES ENGINE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function applyReasoningTemplates(text, tag) {
    if (!text || tag !== 'educational' || text.length < 40) return text;

    let modified = text;

    // 1. Cause and Effect (السبب والنتيجة)
    if (/(بسبب|أدى إلى|نتيجة|عشان كده|لذلك)/.test(modified) && !modified.includes('عشان نفهم ده صح')) {
      modified = modified.replace(/(بسبب|أدى إلى|نتيجة|عشان كده|لذلك)/, "\n\nوهنا بيجي دور السبب المباشر، اللي هو: ")
                         .replace(/^/, "عشان نفهم ده صح، لازم نعرف الأسباب والنتائج المرتبطة ببعضها.\n");
      return modified;
    }

    // 2. Comparison (المقارنة)
    if (/(بينما|لكن|في المقابل|يختلف|أما|على عكس)/.test(modified) && !modified.includes('لو جينا نقارن')) {
      modified = modified.replace(/(بينما|لكن|في المقابل|أما|على عكس)/, "\n\nلكن لو جينا نقارن في المقابل هنلاقي إن: ")
                         .replace(/^/, "الموضوع ده فيه تفريعات، وعشان نسهله هنعمل مقارنة سريعة بتبين الفرق:\n");
      return modified;
    }

    // 3. Chronological (التدرج الزمني)
    if (/(ثم|بعد ذلك|قبل|قديماً|أولاً|بعدين|في النهاية|أخيراً)/.test(modified) && !modified.includes('بالترتيب الزمني')) {
      modified = modified.replace(/^/, "تعالى نمشي معاها خطوة بخطوة وناخدها بالترتيب الزمني عشان منتهش:\n");
      modified = modified.replace(/(ثم|بعد ذلك|بعدين)/, "\n\nوبعد كده في المرحلة اللي بعدها: ");
      return modified;
    }

    // 4. Problem and Solution (المشكلة والحل)
    if (/(حل|مشكلة|أزمة|طريقة|للتخلص|واجه|تغلب)/.test(modified) && !modified.includes('الأزمة الحقيقية')) {
      modified = modified.replace(/^/, "بص، الفكرة هنا بتبدأ بوجود مشكلة لازم نعالجها:\n");
      modified = modified.replace(/(حل|للتخلص|تغلب|طريقة)/, "\n\nوهنا بقى ظهر الحل للمشكلة دي، واللي كان عبارة عن: ");
      return modified;
    }

    // 5. Before and After (قبل وبعد)
    if (/(قبل|بعد|حالياً|الآن|زمان|أصبح)/.test(modified) && !modified.includes('الوضع قبل وبعد')) {
      modified = modified.replace(/^/, "عشان الصورة توضح، خلينا نبص على الوضع (قبل وبعد):\n");
    }

    return modified;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 KNOWLEDGE REASONING LAYER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const KNOWLEDGE_REASONING_BASE = {
    'محمد علي': {
      explanation: 'محمد علي مكنش مجرد حاكم عادي، كان عنده مشروع كامل عشان يبني "دولة كبرى" قوية ومستقلة.',
      connection: 'طموحاته دي ارتبطت بشكل مباشر بضعف الدولة العثمانية في الوقت ده.',
      inference: 'لو فكرنا فيها، هنستنتج إن القوة العسكرية كانت هي الأساس، وبدونها مكنش هيقدر يبني أي حاجة تانية.',
      cause_effect: 'عشان كده، كان اهتمامه بالتعليم والصناعة (نتيجة طبيعية) لحاجته لجيش قوي يعتمد على كفاءات وسلاح مصري.'
    },
    'الحملة الفرنسية': {
      explanation: 'الحملة الفرنسية مكنتش مجرد غزو عسكري تقليدي، دي كانت حملة عسكرية وعلمية في نفس الوقت.',
      connection: 'وده ظهر بوضوح في المجمع العلمي اللي أسسه نابليون عشان يدرس كل حاجة في مصر.',
      inference: 'نستنتج من ده إن هدف فرنسا الحقيقي كان تحويل مصر لمستعمرة فرنسية طويلة الأمد، مش مجرد ممر تجاري.',
      cause_effect: 'وبسبب الوجود العلمي ده، كانت النتيجة الأهم هي فك رموز حجر رشيد اللي فتحلنا باب لمعرفة تاريخنا القديم.'
    },
    'تضاريس مصر': {
      explanation: 'تضاريس مصر مش مجرد أشكال على الخريطة، دي هي اللي بتشكل حياة المصريين من آلاف السنين.',
      connection: 'نهر النيل والصحراء هما اللي رسموا حدود تركز السكان في الوادي والدلتا.',
      inference: 'يعني نقدر نستنتج إن الجغرافيا في مصر بتفرض نفسها على الاقتصاد وتوزيع الناس والمشاريع.',
      cause_effect: 'ولأن الوادي ضيق جداً مقارنة بمساحة مصر، ده أدى لتكدس سكاني وازدحام كبير بنحاول نعالجه بإنشاء مدن جديدة.'
    }
  };

  function applyKnowledgeReasoningLayer(candidateText, subjects, tag) {
    if (!candidateText || tag !== 'educational' || !subjects || subjects.length === 0) return candidateText;

    const mainSubject = subjects[0];
    
    let reasoningBlock = null;
    for (const [key, data] of Object.entries(KNOWLEDGE_REASONING_BASE)) {
      if (mainSubject.includes(key) || key.includes(mainSubject)) {
        reasoningBlock = data;
        break;
      }
    }

    if (!reasoningBlock) return candidateText;

    const reasoningText = `\n\n**💡 (تحليل استنتاجي):**\n- **التفسير:** ${reasoningBlock.explanation}\n- **الربط:** ${reasoningBlock.connection}\n- **الاستنتاج:** ${reasoningBlock.inference}\n- **السبب والنتيجة:** ${reasoningBlock.cause_effect}`;

    console.log(`[KNOWLEDGE REASONING LAYER] Injected Reasoning for: ${mainSubject}`);
    return candidateText + reasoningText;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 KNOWLEDGE GRAPH BUILDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const KNOWLEDGE_GRAPH = {
    'محمد علي': { 
       related: ['تطوير الجيش', 'النهضة الصناعية', 'التعليم'], 
       linkText: 'وعشان تبقى الصورة كاملة، خد بالك إن ده كان السبب الأساسي في الاهتمام بـ' 
    },
    'تطوير الجيش': { 
       related: ['الصناعة', 'الزراعة', 'محمد علي'], 
       linkText: 'لأن بناء جيش قوي كان محتاج بالضرورة الاهتمام بـ' 
    },
    'حرب أكتوبر': { 
       related: ['استرداد سيناء', 'خط بارليف', 'معاهدة السلام'], 
       linkText: 'وده اللي مهد الطريق بشكل مباشر لـ' 
    },
    'تضاريس مصر': {
       related: ['نهر النيل', 'الزراعة', 'توزيع السكان'],
       linkText: 'والتضاريس دي هي اللي أثرت بشكل مباشر على'
    },
    'الحملة الفرنسية': {
       related: ['المجمع العلمي', 'حجر رشيد', 'الروح القومية'],
       linkText: 'ورغم إنها كانت حملة عسكرية، إلا إن نتيجتها الحقيقية ظهرت في'
    }
  };

  function applyKnowledgeGraph(candidateText, subjects, tag) {
    if (!candidateText || tag !== 'educational' || !subjects || subjects.length === 0) return candidateText;

    const mainSubject = subjects[0];
    let modified = candidateText;

    // Check if the subject exists in the Knowledge Graph
    for (const [node, data] of Object.entries(KNOWLEDGE_GRAPH)) {
      if (mainSubject.includes(node) || node.includes(mainSubject)) {
        // Find a related concept that isn't already mentioned in the text
        const unmentioned = data.related.find(r => !modified.includes(r));
        
        if (unmentioned) {
          console.log(`[KNOWLEDGE GRAPH] Bridging ${node} -> ${unmentioned}`);
          modified += `\n\n💡 **(ربط منهجي):** وبما إننا فتحنا كلام عن ${node}، ${data.linkText} (${unmentioned})، لأن الأحداث التاريخية والجغرافية دايماً مترتبة على بعضها.`;
          break; // Inject only one bridge to avoid clutter
        }
      }
    }

    return modified;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 SELF QUESTIONING ENGINE (INTERNAL QA)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function selfQuestioningEngine(candidateText, normalized, internalPlan, tag) {
    if (!candidateText || tag !== 'educational') return candidateText;
    
    let modified = candidateText;
    let didModify = false;

    // 1. COMPLETENESS (Why/Reasoning)
    if (/(ليه|بم تفسر|سبب|لي|لماذا|عشان ايه)/.test(normalized)) {
      if (!/(لأن|بسبب|علشان|عشان|نتيجة|من هنا|بيرجع لـ)/.test(modified)) {
        console.log('[SELF QUESTIONING ENGINE] Checking: Completeness... Failed! Injecting clarity...');
        modified += '\n\nوللتوضيح أكتر، السبب الأساسي لده هو إن الأحداث دي مترتبة على بعضها نتيجتها الطبيعية للظروف دي.';
        didModify = true;
      }
    }

    // 2. RELEVANCE (When/Dates)
    if (/(امتى|متى|سنة كام|تاريخ)/.test(normalized)) {
      if (!/\d{3,4}/.test(modified)) {
        console.log('[SELF QUESTIONING ENGINE] Checking: Relevance (Dates)... Failed! Injecting context...');
        modified += '\n\n(أهم حاجة هنا تركز على التواريخ والترتيب الزمني للأحداث دي في المنهج.)';
        didModify = true;
      }
    }

    // 3. VALUE ADD (Where/Locations)
    if (/(فين|مكان|اين)/.test(normalized)) {
      if (!/(في|يقع|شمال|جنوب|شرق|غرب|محافظة|مدينة)/.test(modified)) {
        console.log('[SELF QUESTIONING ENGINE] Checking: Value Add (Location)... Failed! Injecting spatial context...');
        modified += '\n\n(خد بالك، الخريطة هنا مهمة جداً لمعرفة المكان بالتحديد والتخيل الجغرافي ليه.)';
        didModify = true;
      }
    }

    // 4. CLARITY (Beginner Fallback)
    if (internalPlan && internalPlan.studentTier === 'Beginner' && modified.length > 150) {
      if (!/(باختصار|علشان نلخص|الخلاصة)/.test(modified)) {
        console.log('[SELF QUESTIONING ENGINE] Checking: Clarity for Beginner... Failed! Injecting summary...');
        modified += '\n\nلو حاسس إن الكلام كتير، الخلاصة ببساطة إنك تركز على الفكرة الأساسية وماتشغلش بالك بالتفاصيل دلوقتي.';
        didModify = true;
      }
    }

    if (!didModify) {
      console.log('[SELF QUESTIONING ENGINE] All checks passed. Response is solid.');
    }

    return modified;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 SMART FOLLOW-UP ENGINE & SEMANTIC CONCEPTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function applySmartFollowUp(text, tag, goal, subjects) {
    const profile = getStudentProfile();
    
    // Check for explicit Semantic Concepts to address
    if (profile && profile.semanticMemory && tag !== 'educational') {
       if (profile.semanticMemory['EXAM_ANXIETY'] > 0 && Math.random() > 0.5) {
         profile.semanticMemory['EXAM_ANXIETY'] -= 0.5; // Decay it so we don't spam it forever
         localStorage.setItem('pf_student_profile', JSON.stringify(profile));
         return text + '\n\nبالمناسبة، طمني قلق الامتحانات خف شوية ولا لسه؟ متخليش التوتر يسيطر عليك، أنت بطل وتقدر.';
       }
       if (profile.semanticMemory['LOW_SCORE'] > 0 && Math.random() > 0.5) {
         profile.semanticMemory['LOW_SCORE'] -= 0.5;
         localStorage.setItem('pf_student_profile', JSON.stringify(profile));
         return text + '\n\nعلى فكرة، الدرجة الوحشة اللي جبتها قبل كده مش مقياس ليك، دي مجرد خطوة عشان تتعلم منها وتقفل المرة الجاية.';
       }
       if (profile.semanticMemory['AMBITION_HIGH'] > 0 && Math.random() > 0.5) {
         return text + '\n\nأنا واثق إنك هتوصل لحلمك وهتبقى من الأوائل زي ما بتتمنى، استمر يا بطل!';
       }
    }

    // Only apply general follow-up ~30% of the time
    if (Math.random() > 0.3) return text;

    // Do not follow up if the user is frustrated, asking for problem solving, or verification
    if (['PROBLEM_SOLVING', 'EMOTIONAL_VALIDATION', 'VERIFICATION'].includes(goal)) return text;

    let followUp = '';

    if (tag === 'educational' || tag === 'content-based') {
      const eduFollowUps = [
        'لو في نقطة تانية في الدرس ده لسه مش واضحة، قولي.',
        'تحب أديك سؤال صغير تختبر بيه فهمك في الجزء ده؟',
        'ممكن نتكلم عن جزء مرتبط بالموضوع ده لو حابب؟',
        'لو فهمت دي، نقدر ندخل في اللي بعدها؟'
      ];
      if (subjects && subjects.length > 0) {
        eduFollowUps.push(`تحب نكمل كلامنا عن ${subjects[0]}؟`);
      }
      followUp = eduFollowUps[Math.floor(Math.random() * eduFollowUps.length)];
    } else if (tag === 'social') {
      const topInterest = getTopInterest();
      if (topInterest && Math.random() > 0.3) { // 70% chance if they have a top interest
        const curiosityFollowUps = [
          `بالمناسبة، أنا ملاحظ إنك من عشاق (${topInterest})، عاش بجد!`,
          `على فكرة، شغفك بـ (${topInterest}) واضح جداً، استمر يا بطل!`,
          `أنا بقيت عارف إنك بتحب تسأل كتير في (${topInterest})، وده شيء ممتاز.`
        ];
        followUp = curiosityFollowUps[Math.floor(Math.random() * curiosityFollowUps.length)];
      } else {
        const socialFollowUps = [
          'أخبارك إيه في المذاكرة؟ ماشي تمام ولا في حاجة موقفاك؟',
          'جاهز تكسر الدنيا في منهج الدراسات؟',
          'طمني، الكورسات معاك ماشية زي الفل ولا محتاج مساعدة؟',
          'قولي بقى، إيه أكتر جزء عجبك في الدروس اللي ذاكرتها؟'
        ];
        followUp = socialFollowUps[Math.floor(Math.random() * socialFollowUps.length)];
      }
    }

    if (followUp && !text.includes(followUp)) {
      return text + '\n\n' + followUp;
    }
    return text;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 STUDENT PROFILE BUILDER & SEMANTIC MEMORY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const SEMANTIC_RULES = [
    { pattern: /(بحب|عشق|أفضل|مفضل|بموت في|حبيت|اكتر مادة).*(تاريخ|جغرافيا|تضاريس|دراسات|خرائط)/, getConcept: (match) => `INTEREST_${match[2]}` },
    { pattern: /(مش فاهم|صعب|معقد|مش عارف|مش بستوعب|مش داخله دماغي|عقدتي).*(تاريخ|جغرافيا|تضاريس|دراسات|خرائط)/, getConcept: (match) => `STRUGGLE_${match[2]}` },
    { pattern: /(امتحان|اختبار|ميدتيرم|كويز).*(بكرة|قريب|الاسبوع|خايف|مرعوب|رعب)/, getConcept: () => 'EXAM_ANXIETY' },
    { pattern: /(نفسي|عايز|حلمي|ياريت|بتمناها).*(ابقى شاطر|اقفل|اجيب مجموع|اطلع الاول|انجح)/, getConcept: () => 'AMBITION_HIGH' },
    { pattern: /(جبت|درجتي|نقصت|سقطت).*(وحش|سيئ|قليل|زفت)/, getConcept: () => 'LOW_SCORE' }
  ];

  function extractSemanticConcepts(userMessage) {
    let concepts = [];
    SEMANTIC_RULES.forEach(rule => {
      const match = userMessage.match(rule.pattern);
      if (match) {
        concepts.push(rule.getConcept(match));
      }
    });
    return concepts;
  }

  function updateStudentProfile(thoughtProcess, userMessage, normalized) {
    let profile;
    try {
      profile = JSON.parse(localStorage.getItem('pf_student_profile') || 'null');
    } catch (e) {
      profile = null;
    }

    if (!profile) {
      profile = {
        understandingLevel: 50,
        topics: {},
        writingStyle: { usesSlang: 0, usesEmojis: 0, shortMessages: 0 }
      };
    }

    const goal = thoughtProcess.extractedData.goal || 'GENERAL';
    const emotion = thoughtProcess.extractedData.emotion || 'NEUTRAL';
    const subjects = thoughtProcess.extractedData.subjects || [];

    // 1. Update Understanding Level
    if (goal === 'SOCIAL_CONNECTION' && isFuzzyMatch(normalized, DYNAMIC_VOCAB.thanks)) {
      profile.understandingLevel = Math.min(100, profile.understandingLevel + 5);
    } else if (goal === 'DEEP_UNDERSTANDING' || emotion === 'FRUSTRATION' || emotion === 'ANXIETY') {
      profile.understandingLevel = Math.max(0, profile.understandingLevel - 2);
    } else if (isFuzzyMatch(normalized, DYNAMIC_VOCAB.need_simplification)) {
      profile.understandingLevel = Math.max(0, profile.understandingLevel - 5);
    }

    // 2. Track Strengths & Weaknesses (Topics)
    const genericSubjects = ['سؤال', 'امتحان', 'واجب', 'دفع', 'اشتراك', 'كورس', 'درس', 'منصة', 'باسورد', 'حصة', 'منهج', 'شرح'];
    subjects.forEach(sub => {
      if (!genericSubjects.includes(sub)) {
        if (!profile.topics[sub]) profile.topics[sub] = { asks: 0, struggles: 0, successes: 0 };
        profile.topics[sub].asks += 1;
        
        if (['FRUSTRATION', 'ANXIETY', 'ANGER'].includes(emotion)) {
          profile.topics[sub].struggles += 1;
        } else if (['JOY', 'EXCITEMENT'].includes(emotion)) {
          profile.topics[sub].successes += 1;
        }
      }
    });

    // 3. Track Writing Style
    const slangRegex = /(يا نجم|باشا|يا ريس|يا غالي|يا سيدي|ايه الدنيا|شغال فين|طمني|زي الفل)/g;
    if (slangRegex.test(userMessage)) profile.writingStyle.usesSlang += 1;
    
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u;
    if (emojiRegex.test(userMessage)) profile.writingStyle.usesEmojis += 1;
    
    if (userMessage.length < 15) profile.writingStyle.shortMessages += 1;

    // 4. Track Semantic Memory (Abstract Concepts)
    if (!profile.semanticMemory) profile.semanticMemory = {};
    const concepts = extractSemanticConcepts(userMessage || normalized);
    concepts.forEach(c => {
      profile.semanticMemory[c] = (profile.semanticMemory[c] || 0) + 1;
    });

    try {
      localStorage.setItem('pf_student_profile', JSON.stringify(profile));
    } catch (e) {
      console.warn('Could not save student profile', e);
    }
  }

  function getStudentProfile() {
    try {
      return JSON.parse(localStorage.getItem('pf_student_profile')) || null;
    } catch (e) {
      return null;
    }
  }

  function getTopInterest() {
    const profile = getStudentProfile();
    if (!profile) return null;

    let topSubject = null;
    let maxCount = 0;

    // 1. Try to find top Semantic Interest first
    if (profile.semanticMemory) {
      for (const [concept, count] of Object.entries(profile.semanticMemory)) {
        if (concept.startsWith('INTEREST_') && count > maxCount) {
          maxCount = count;
          topSubject = concept.split('_')[1]; // Extract the subject name
        }
      }
    }

    if (topSubject && maxCount >= 2) return topSubject;

    // 2. Fallback to raw topics
    maxCount = 0;
    if (profile.topics) {
      for (const [subject, data] of Object.entries(profile.topics)) {
        if (data.asks > maxCount) {
          maxCount = data.asks;
          topSubject = subject;
        }
      }
    }

    return maxCount >= 2 ? topSubject : null;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧠 MEANING FIRST ARCHITECTURE (CONCEPTS)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const MEANING_CLUSTERS = {
    CONCEPT_CONFUSION: ['انا تايه', 'مش فاهم', 'مش مستوعب', 'حاسس اني ضايع', 'مش مجمع', 'هنجت', 'الدنيا لفت', 'فصلت', 'مخي قفل', 'معقد', 'مش راكبة', 'تايه', 'وقفت معايا'],
    CONCEPT_FRUSTRATION: ['زهقت', 'مش شغال', 'بايظ', 'عطلان', 'انا تعبت', 'قرفت', 'خربان', 'يأس', 'مخنوق', 'زفت', 'واقع'],
    CONCEPT_APPRECIATION: ['شكرا', 'تسلم', 'عاش', 'حبيبي', 'الف شكر', 'الله ينور', 'جزاك', 'متشكر', 'تسلم ايدك', 'عظمة'],
    CONCEPT_GREETING: ['اهلا', 'ازيك', 'عامل ايه', 'السلام عليكم', 'صباح الفل', 'مرحبا', 'يا هلا', 'هاي', 'هلو', 'اخبارك', 'كيفك', 'طمني'],
    CONCEPT_VENTING: ['انا مخنوق', 'الدنيا مقفلة', 'خايف من النتيجة', 'فقدت الشغف', 'مكتئب', 'حزين', 'مش قادر اكمل'],
    CONCEPT_MOTIVATION: ['عايز اذاكر', 'شجعني', 'ازاي ابقى شاطر', 'نفسي اقفل', 'طموح', 'هدف'],
    CONCEPT_HUMOR: ['نكتة', 'ضحكني', 'قولي حاجة تضحك', 'افشخني ضحك', 'حاجة تضحك', 'هزر']
  };

  function analyzeMeaningFirst(normalized) {
    for (const [concept, phrases] of Object.entries(MEANING_CLUSTERS)) {
      if (phrases.some(phrase => normalized.includes(phrase))) {
        return concept;
      }
    }
    return 'CONCEPT_UNKNOWN';
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⚡ MICRO REASONING ENGINE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function extractMicroInferences(normalized) {
    let inferences = [];
    
    // Urgent / Exam
    if (/(امتحان|بكرة|النهارده|حالا|بسرعة|الوقت|مفيش وقت|لجنة)/.test(normalized)) {
      inferences.push('URGENT');
      inferences.push('NEEDS_SIMPLIFICATION');
    }
    
    // Confidence / Frustration
    if (/(غبي|بنسى|مش بفهم|يأست|صعب اوي|مفيش فايدة|تعبت|مخنوق|ضايع)/.test(normalized)) {
      inferences.push('CONFIDENCE_BOOST');
    }
    
    // Technical Frustration / Access issues
    if (/(الكورس مش|مش لاقي|مش شغال|الباسورد|الموقع واقع|مش بيفتح|بايظ)/.test(normalized)) {
      inferences.push('NEEDS_DIRECT_ACTION');
    }

    return inferences;
  }

  function applyMicroReasoning(text, inferences) {
    if (!inferences || inferences.length === 0) return text;
    
    let prefix = '';
    
    if (inferences.includes('URGENT')) {
      prefix = 'مفيش وقت للتوتر، ركز معايا في الخلاصة دي:\n\n';
    } else if (inferences.includes('CONFIDENCE_BOOST')) {
      prefix = 'يا بطل، أنت شاطر وممتاز بس محتاج تركز في نقطة بسيطة وهي دي:\n\n';
    } else if (inferences.includes('NEEDS_DIRECT_ACTION')) {
      prefix = 'ولا تزعل نفسك، حل المشكلة دي بسيط جداً:\n\n';
    }

    if (prefix && !text.includes(prefix) && !text.includes('مفيش وقت للتوتر')) {
      return prefix + text;
    }
    return text;
  }

  function multiStepThinkEngine(normalized, userMessage) {
    let thoughtProcess = {
      purpose: 'UNKNOWN_PURPOSE',
      confidence: 100,
      extractedData: { subjects: [], verbs: [] },
      interpretations: [],
      microInferences: []
    };

    const words = normalized.split(/\s+/).filter(w => w.length >= 2);
    
    // 0. MICRO REASONING
    thoughtProcess.microInferences = extractMicroInferences(normalized);
    console.log(`[MICRO REASONING] Inferences:`, thoughtProcess.microInferences);
    
    // 0. MEANING FIRST ARCHITECTURE (Extract Abstract Concept)
    const abstractConcept = analyzeMeaningFirst(normalized);
    thoughtProcess.extractedData.abstractConcept = abstractConcept;
    console.log(`[MEANING FIRST] Extracted Concept: ${abstractConcept}`);

    // 1. EXTRACT IMPORTANT INFO
    const educationalKeywords = [...DYNAMIC_VOCAB.subjects, 'شرح', 'سؤال', 'امتحان', 'واجب', 'دفع', 'اشتراك', 'كورس', 'درس', 'منصة', 'باسورد', 'حصة', 'منهج'];
    thoughtProcess.extractedData.subjects = educationalKeywords.filter(k => normalized.includes(k));
    
    const isAsking = /\?|؟|فين|امتى|ازاي|ليه|مين|كام|بكام/.test(normalized);
    const isChatting = abstractConcept === 'CONCEPT_GREETING' || isFuzzyMatch(normalized, [...DYNAMIC_VOCAB.greetings, ...DYNAMIC_VOCAB.check_status, 'انت مين', 'عمرك']);
    const isJoking = isFuzzyMatch(normalized, DYNAMIC_VOCAB.humor);
    const isComplaining = abstractConcept === 'CONCEPT_FRUSTRATION' || isFuzzyMatch(normalized, DYNAMIC_VOCAB.complaint);
    const isStressed = abstractConcept === 'CONCEPT_CONFUSION' || isFuzzyMatch(normalized, [...DYNAMIC_VOCAB.need_simplification, 'زعلان', 'تعبان', 'مضغوط', 'مخنوق', 'يأس']);
    const wantsExplanation = isFuzzyMatch(normalized, ['اشرح', 'ازاي', 'ليه', 'فهمني', 'يعني ايه']);
    const wantsHelp = isFuzzyMatch(normalized, DYNAMIC_VOCAB.help);
    const wantsSocial = abstractConcept === 'CONCEPT_APPRECIATION' || isFuzzyMatch(normalized, [...DYNAMIC_VOCAB.thanks, 'سلام', 'باي', 'تصبح على خير']);
    const isFollowUp = isFuzzyMatch(normalized, DYNAMIC_VOCAB.follow_up);
    const hasEduKeywords = thoughtProcess.extractedData.subjects.length > 0;

    // 2. MULTIPLE INTERPRETATIONS & AMBIGUITY RESOLVER
    let interpretationScores = {};
    if (isChatting) interpretationScores['SOCIAL_CONNECTION'] = 20;
    if (isAsking || wantsExplanation) interpretationScores['EDUCATIONAL_EXPLANATION'] = 40;
    if (hasEduKeywords) interpretationScores['EDUCATIONAL_EXPLANATION'] = (interpretationScores['EDUCATIONAL_EXPLANATION'] || 0) + 50;
    if (isStressed) interpretationScores['EMOTIONAL_SUPPORT'] = 60;
    if (isComplaining) interpretationScores['COMPLAINT'] = 70;
    if (isJoking) interpretationScores['HUMOR'] = 30;
    if (wantsHelp) interpretationScores['ASSISTANCE'] = 50;
    
    thoughtProcess.interpretations = Object.keys(interpretationScores);

    // 3. GOAL & EMOTION DETECTION ENGINE
    thoughtProcess.extractedData.goal = detectUserGoal(normalized);
    thoughtProcess.extractedData.emotion = analyzeEmotion(normalized);
    thoughtProcess.extractedData.islamicGreeting = analyzeIslamicGreeting(userMessage || normalized);

    // 4. DEDUCE TRUE INTENT (Priority & Weight Logic)
    let topPurpose = 'UNKNOWN_PURPOSE';
    let topScore = 0;
    let secondScore = 0;

    for (const [intent, score] of Object.entries(interpretationScores)) {
      if (score > topScore) {
        secondScore = topScore;
        topScore = score;
        topPurpose = intent;
      } else if (score > secondScore) {
        secondScore = score;
      }
    }

    if (isFollowUp && normalized.length < 25 && !hasEduKeywords) topPurpose = 'FOLLOW_UP';
    else if (isAsking && normalized.length < 15 && !hasEduKeywords) topPurpose = 'FOLLOW_UP';

    thoughtProcess.purpose = topPurpose;

    // 5. CONFIDENCE SCORING & AMBIGUITY DETECTION
    if (topPurpose === 'UNKNOWN_PURPOSE') {
      thoughtProcess.confidence = normalized.length > 15 ? 20 : 40;
    } else {
      const gap = topScore - secondScore;
      thoughtProcess.confidence = gap === 0 ? 50 : Math.min(100, 50 + gap);
      
      if (topPurpose === 'SOCIAL_CONNECTION' && normalized.length > 30) {
        thoughtProcess.confidence = 35;
      }
    }

    if (thoughtProcess.confidence <= 55 && topPurpose !== 'FOLLOW_UP') {
      thoughtProcess.purpose = 'AMBIGUOUS';
      console.log(`[AMBIGUITY RESOLVER] Ambiguous intent detected. Scores: Top=${topScore}, Second=${secondScore}`);
    } else if (thoughtProcess.confidence < 40) {
      thoughtProcess.purpose = 'CLARIFICATION';
    }

    // 🧠 UPDATE STUDENT PROFILE
    updateStudentProfile(thoughtProcess, userMessage, normalized);

    // 5. INTERNAL PLANNER BRAIN (New Step)
    thoughtProcess.internalPlan = generateInternalPlan(thoughtProcess, normalized);

    return thoughtProcess;
  }

  function isHumanLike(text) {
    if (!text || text.trim() === '') return false;
    const roboticPhrases = ['حاولت أفهم قصدك', 'غير مدعوم', 'لم أفهم', 'لا أستطيع الإجابة'];
    for (const p of roboticPhrases) {
      if (text.includes(p)) return false;
    }
    return true;
  }

  function generateSocialResponse(normalized, purpose) {
    let responseParts = [];
    const words = normalized.split(/\s+/);
    
    let matchedSubject = null;
    for (const w of words) {
      if (w.length < 3) continue;
      const subj = DYNAMIC_VOCAB.subjects.find(s => s.includes(w) || w.includes(s) || levenshteinDistance(w, s) <= 1);
      if (subj) matchedSubject = subj;
    }

    // Dynamic Response Builder Pipeline
    if (purpose === 'SOCIAL_CONNECTION') {
      if (isFuzzyMatch(normalized, [...DYNAMIC_VOCAB.greetings, ...DYNAMIC_VOCAB.check_status])) {
        responseParts.push(pickRandom(DYNAMIC_RESPONSES.greetings));
        if (Math.random() > 0.5) responseParts.push(pickRandom(DYNAMIC_RESPONSES.emotions.positive));
        responseParts.push(pickRandom(DYNAMIC_RESPONSES.follow_ups.general));
      } else if (isFuzzyMatch(normalized, ['سلام', 'باي', 'تصبح'])) {
        responseParts.push(pickRandom(DYNAMIC_RESPONSES.cores.farewell));
      } else if (isFuzzyMatch(normalized, ['انت مين', 'شغال', 'عمرك'])) {
        responseParts.push(pickRandom(DYNAMIC_RESPONSES.cores.identity));
        responseParts.push(pickRandom(DYNAMIC_RESPONSES.follow_ups.general));
      } else {
        responseParts.push(pickRandom(DYNAMIC_RESPONSES.cores.thanks));
        if (Math.random() > 0.5) responseParts.push('لو احتجت أي مساعدة أنا في الخدمة.');
      }
    }
    else if (purpose === 'EMOTIONAL_SUPPORT') {
      responseParts.push(pickRandom(DYNAMIC_RESPONSES.emotions.empathy));
      responseParts.push(pickRandom(DYNAMIC_RESPONSES.follow_ups.empathy));
    }
    else if (purpose === 'HUMOR') {
      responseParts.push(pickRandom(DYNAMIC_RESPONSES.emotions.humor));
      responseParts.push(pickRandom(DYNAMIC_RESPONSES.follow_ups.action));
    }

    if (matchedSubject && purpose !== 'HUMOR') {
      let core = pickRandom(DYNAMIC_RESPONSES.cores.subject).replace('[SUBJECT]', matchedSubject);
      responseParts.push(`\nوبالنسبة لـ ${matchedSubject}، ${core}`);
      responseParts.push(pickRandom(DYNAMIC_RESPONSES.follow_ups.subject));
    }

    // Join the built parts dynamically
    return responseParts.join(' ') || 'أنا معاك يا بطل! قل لي بس إزاي أقدر أساعدك؟';
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

  function getPaymentSettings() {
    try {
      return JSON.parse(localStorage.getItem('paymentSettings') || '{}');
    } catch (e) {
      return {};
    }
  }

  function getStableIntentResponse(text) {
    const normalized = normalizeText(text);
    if (!normalized) return null;

    const facts = getPlatformFacts();
    const paymentSettings = getPaymentSettings();
    const supportNumber = paymentSettings.vCashNum || '01023675235';

    if (/(نسيت|استرجاع|استعادة).*(باسورد|كلمة المرور)|باسورد|password/.test(normalized)) {
      return { text: `لو نسيت الباسورد، اضغط على "نسيت كلمة المرور" في صفحة تسجيل الدخول. لو محتاج مساعدة، تواصل مع الدعم على ${supportNumber}.` };
    }
    if (/(غير.+ايميل|تغيير.+ايميل|تغيير.+البريد|ايميل|البريد)/.test(normalized)) {
      return { text: `لتغيير الإيميل، تواصل مع الدعم الفني عبر الرقم ${supportNumber}، لأن النظام لا يتيح تغيير الإيميل تلقائياً.` };
    }
    if (/(اشترك|اشتراك|ازاي.+اشترك|كيف.+اشترك|عايز.+اشترك|اريد.+اشتراك)/.test(normalized)) {
      return { text: 'عشان تشترك في الكورس، افتح صفحة الكورسات، اختار الكورس اللي يعجبك، واضغط "اشترك" واتبع خطوات الدفع.' };
    }
    if (/(مشكلة.+دفع|دفع.+مشكلة|مشكلة في الدفع|الدفعة|التحويل|فاتورة|سداد|دلوقتي.+دفع)/.test(normalized)) {
      return { text: `لو عندك مشكلة في الدفع، راجع تفاصيل التحويل أولاً. لو المشكلة ما اتحلتش، تواصل مع الدعم على ${supportNumber} أو عبر واتساب.` };
    }
    if (/(فين.+كورسات|كورساتي|الكورسات بتاعتي|الدورات بتاعتي|دوراتي|course|courses)/.test(normalized)) {
      if (facts.hasCourses) {
        return { text: `انت مسجل حالياً في ${facts.courseCount} كورس${facts.courseCount > 1 ? 'ات' : ''}: ${facts.courseTitlesString}.` };
      }
      return { text: 'ما عندكش أي كورسات مسجلة حالياً. تقدر تتصفح الكورسات المتاحة وتختار اللي يناسبك.' };
    }
    if (/(فين.+واجب|الواجبات|معلومات.+الواجب|واجباتي|الواجب)/.test(normalized)) {
      if (facts.hasCourses) {
        const homeworkStatus = facts.homeworkTotal ? `مقدار الواجب المكتمل ${facts.homeworkCompleted}/${facts.homeworkTotal}` : 'مفيش معلومات واجبات مضافة لحضرتك دلوقتي';
        return { text: `بالنسبة للواجبات، ${homeworkStatus}.` };
      }
      return { text: 'ما عندكش واجبات حالياً أو مفيش كورسات مسجلة. لو محتاج مساعدة في الواجبات، تواصل مع الدعم.' };
    }
    if (/(موعد.+حصة|الحصة.+الجاية|الدرس.+الجاي|متى.+الدرس|موعد.+الدراسة|next lesson|الدرس القادم)/.test(normalized)) {
      if (facts.hasCourses) {
        return { text: `لو عايز تعرف موعد الحصة الجاية، افتح الكورس اللي انت مسجل فيه أو تواصل مع الدعم على ${supportNumber}.` };
      }
      return { text: `لو عايز تعرف مواعيد الكورسات، افتح صفحة الكورسات أو تواصل مع الدعم على ${supportNumber}.` };
    }
    if (/(الدعم الفني|اكلم الدعم|اتواصل مع الدعم|تواصل.+الدعم|رقم الدعم|دعم)/.test(normalized)) {
      return { text: `لو عايز تتواصل مع الدعم الفني، ممكن تبعت لهم رسالة مباشرة هنا أو تستخدم الرقم ${supportNumber}.` };
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

    const adminLearned = getAdminLearnedResponse(text);
    if (adminLearned) return adminLearned;

    const trained = getTrainedResponse(text);
    if (trained) return trained;

    const explicitAdmin = custom[normalized];
    if (explicitAdmin) return { text: explicitAdmin, tag:'custom' };

    const rude = getRudeResponse(text);
    if (rude) return rude;

    const stableIntent = getStableIntentResponse(text);
    if (stableIntent) return stableIntent;

    const antiCheatCheck = checkAntiCheatContext(text);
    if (antiCheatCheck.isCheat) {
      return { text: antiCheatCheck.response || 'مقدرش أساعدك فى ده، الأستاذ يوسف بركات لو لمحني هيمرجحني 😂', type:'anti-cheat', strict: antiCheatCheck.strict };
    }

    const followUp = getFollowUpReply(text);
    if (followUp) return followUp;

    const known = getKnownResponses(text);
    if (known && known.text) {
      return known;
    }

    const platformReply = getPlatformReply(text);
    if (platformReply) return platformReply;

    const contextAware = getContextAwareResponse(text);
    if (contextAware) return contextAware;

    const contentBased = getContentBasedResponse(text);
    if (contentBased) return contentBased;

    if (isVeryUnclearMessage(text)) {
      return { text: 'حاولت أفهم قصدك لكن محتاج تفاصيل أكتر شوية 🙏' };
    }

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

  function saveHistory(h){ 
    const key = getStorageKey(BASE_HISTORY_KEY); 
    const storage = getStorageForKey(key); 
    safeSetItem(storage, key, JSON.stringify(h)); 
    syncHistoryToFirebase(h);
  }

  function loadTickets(){
    try{
      const key = getStorageKey(BASE_TICKETS_KEY);
      const storage = getStorageForKey(key);
      return JSON.parse(storage.getItem(key) || '[]');
    } catch(e){ return []; }
  }

  function saveTickets(t){ 
    const key = getStorageKey(BASE_TICKETS_KEY); 
    const storage = getStorageForKey(key); 
    safeSetItem(storage, key, JSON.stringify(t)); 
    if (t && t.length) {
      t.forEach(syncTicketToFirebase);
    }
  }

  function loadCustom(){ try{ return JSON.parse(localStorage.getItem(CUSTOM_ANSWERS_KEY) || '{}'); }catch(e){ return {} } }
  function saveCustom(c){ safeSetItem(localStorage, CUSTOM_ANSWERS_KEY, JSON.stringify(c)); }

  function playSound(name){
    try {
      if(window.audioManager && typeof window.audioManager.play === 'function'){
        if(name === 'open') return window.audioManager.play('notifOpen');
        if(name === 'close') return window.audioManager.play('notifOpen');
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
    'فين الواجبات؟',
    'عندي مشكلة في الحساب',
    'موعد الحصة الجاية',
    'عايز أكلم الدعم الفني'
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
      status:'open',
      page: window.location.pathname || '',
      pageTitle: document.title || '',
      sessionId: getUserContext().id || '',
      source: 'complaint-flow'
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

  function buildWhatsAppButtonHtml() {
    const supportNumber = getPaymentSettings().vCashNum || '01023675235';
    const formatted = supportNumber.replace(/[^0-9]/g, '');
    const href = `https://wa.me/${formatted}`;
    return `<div style="margin-top:12px;text-align:center;">
      <a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:999px;background:#25D366;color:#fff;font-size:13px;font-weight:700;text-decoration:none;box-shadow:0 10px 18px rgba(37,211,102,0.24);transition:transform .16s ease,box-shadow .16s ease;">
        <i class="fab fa-whatsapp" style="margin-right:8px;font-size:14px;"></i> تواصل واتساب
      </a>
    </div>`;
  }

  function isComplaintTrigger(text) {
    const normalized = normalizeText(text);
    if (!normalized) return false;
    const shortTrigger = /^(?:مشكلة|مشكله|مشكل|مشاكل|عيب|خطأ|غلط|مش راضي|مش بيفتح|فيه مشكلة|في مشكلة|الدفع متفعلش|التطبيق واقف)$/;
    return shortTrigger.test(normalized) || (normalized.length < 45 && /(?:مشكلة|مشكله|مشكل|عيب|خطأ|غلط|مش راضي|مش بيفتح|الدفع متفعلش|التطبيق واقف)/.test(normalized));
  }

  function isEscalationSignal(text) {
    const normalized = normalizeText(text);
    if (!normalized) return false;
    const signal = /(الكورس مش شغال|الدفع متفعلش|عندي مشكلة|فيه خطأ|مش راضي يفتح|لسه المشكلة موجودة|مش نافع|التطبيق واقف|دفع مش شغال|فيه مشكلة|مش شغال|مش نافع|مش راضي|خطأ|غلط)/;
    return signal.test(normalized);
  }

  function getComplaintFlow(text) {
    if (complaintCaptureMode) {
      return { action: 'submit' };
    }
    if (isComplaintTrigger(text)) {
      return { action: 'prompt' };
    }
    return null;
  }

  function shouldAppendEscalationHint(ruleText, question) {
    if (escalationSuggested) return false;
    if (!question || !ruleText) return false;
    if (ruleText.includes('لو مستعجل على حل المشكلة')) return false;
    if (!isEscalationSignal(question)) return false;
    return true;
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
    if (item.html) {
      inner.innerHTML = item.html;
    } else {
      inner.textContent = fixMojibake(item.text);
    }
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
  function ensureWelcome(){ const h = loadHistory(); if(h.length === 0){ h.push({ who:'bot', text: WELCOME, ts: nowTs(), status:'delivered', noTime: true }); saveHistory(h); } }

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
    return getTemporarySafeBotReply(text);
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
      if (isBotPausedByAdmin) return; // Wait for admin to reply manually
      
      const complaintFlow = getComplaintFlow(text);
      if (complaintFlow && complaintFlow.action === 'prompt') {
        complaintCaptureMode = true;
        const promptMsg = { who:'bot', text: 'اكتب المشكلة اللي عاوز تقدمها عشان نبعتها للدعم 🙏', ts: nowTs(), status:'delivered' };
        const h2 = loadHistory();
        h2.push(promptMsg);
        saveHistory(h2);
        renderHistory();
        return;
      }
      if (complaintFlow && complaintFlow.action === 'submit') {
        complaintCaptureMode = false;
        createSupportTicket(getCurrentUser(), text);
        const messageText = 'تم تقديم شكوتك، سيتم الرد قريبًا فور إخباري بالحل من الدعم 🙏';
        const botMsg = { who:'bot', text: messageText, html: `${fixMojibake(messageText)}${buildWhatsAppButtonHtml()}`, ts: nowTs(), status:'delivered' };
        const h2 = loadHistory();
        h2.push(botMsg);
        saveHistory(h2);
        renderHistory();
        return;
      }
      const replyText = getTemporarySafeBotReply(text);

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
        btn.id = 'pfChatBtn'; btn.className = 'pf-chat-btn'; btn.title = 'البوصلة'; btn.innerHTML = '<i class="fas fa-compass" style="font-size:30px; line-height:1; width:100%; text-align:center;"></i>';
        try { btn.style.cssText = 'position:fixed!important;bottom:24px!important;right:24px!important;z-index:999999999!important;display:flex!important;align-items:center!important;justify-content:center!important;visibility:visible!important;opacity:1!important;width:68px!important;height:68px!important;border-radius:50%!important;background:linear-gradient(135deg,#193d80,#0b1d43)!important;border:1px solid rgba(255,241,0,0.95)!important;box-shadow:0 22px 60px rgba(0,0,0,0.42)!important;color:#f1c40f!important;cursor:pointer!important;transition:none!important;'; } catch(e) {}
        try { document.body.appendChild(btn); } catch(e){/* ignore */}

        const bubble = document.createElement('div'); bubble.className='pf-chat-bubble'; bubble.id='pfChatBubble'; bubble.style.display='none'; bubble.style.cssText = 'position:fixed!important;bottom:32px!important;right:116px!important;z-index:999999998!important;display:none!important;max-width:320px!important;padding:14px 18px!important;border-radius:999px!important;background:linear-gradient(135deg,rgba(25,61,128,0.94),rgba(11,29,67,0.94))!important;color:#fff!important;font-size:14px!important;font-weight:600!important;white-space:nowrap!important;text-overflow:ellipsis!important;overflow:hidden!important;box-shadow:0 18px 40px rgba(0,0,0,0.22)!important;cursor:pointer!important;transition:opacity 0.24s ease-in-out!important;backdrop-filter:blur(10px)!important;'; bubble.textContent = WELCOME; try { document.body.appendChild(bubble); } catch(e){}

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
        try { bubble.addEventListener('click', ()=>{ const w = document.getElementById('pfChatWindow'); if(w && (w.style.display === 'none' || !w.style.display)){ w.style.display='flex'; document.body.classList.add('pf-chat-active'); playSound('open'); renderHistory(true); resetSuggestions(); } if(bubble) bubble.style.display='none'; }); } catch(e){}
        try { btn.addEventListener('click', ()=>{ const w = document.getElementById('pfChatWindow'); if(w && (w.style.display === 'none' || !w.style.display)){ w.style.display='flex'; document.body.classList.add('pf-chat-active'); playSound('open'); renderHistory(true); resetSuggestions(); } else if(w){ w.style.display='none'; document.body.classList.remove('pf-chat-active'); playSound('close'); } }); } catch(e){}
        try { document.getElementById('pfCloseBtn')?.addEventListener('click', ()=>{ const w = document.getElementById('pfChatWindow'); if(w) { w.style.display='none'; document.body.classList.remove('pf-chat-active'); playSound('close'); } }); } catch(e){}
        try { document.addEventListener('click', (e)=>{ const w = document.getElementById('pfChatWindow'); const b = document.getElementById('pfChatBtn'); const bb = document.getElementById('pfChatBubble'); if(w && w.style.display === 'flex' && !w.contains(e.target) && (!b || !b.contains(e.target)) && (!bb || !bb.contains(e.target))) { w.style.display='none'; document.body.classList.remove('pf-chat-active'); playSound('close'); } }); } catch(e){}
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
        try { initFirebaseSupportSync(); } catch(e){}
        try { ensureWelcome(); } catch(e){}
        try { setTimeout(()=>{ showWelcomeBubble(); }, 1200); } catch(e){}
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







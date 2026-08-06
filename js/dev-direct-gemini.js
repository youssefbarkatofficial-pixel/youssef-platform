/**
 * DEV MODE ONLY — REMOVE BEFORE PRODUCTION
 * Direct Gemini & DeepSeek API integration for testing.
 * Features: Key Rotation, Smart Caching, Dynamic Variations.
 */

window.DISABLE_DIRECT_GEMINI = false;

(function() {
    console.log('[DEV GEMINI] Smart Bot Initializing...');

    // ==========================================
    // 1. CONFIGURATION (Placeholder API Keys)
    // ==========================================
    // أضف مفاتيح Gemini الـ 5 هنا (سيتم التبديل بينهم تلقائياً)
    const GEMINI_KEYS = [
        "YOUR_GEMINI_KEY_1",
        "YOUR_GEMINI_KEY_2",
        "YOUR_GEMINI_KEY_3",
        "YOUR_GEMINI_KEY_4",
        "YOUR_GEMINI_KEY_5"
    ];
    
    // أضف مفتاح DeepSeek هنا (سيعمل كاحتياطي أخير)
    const DEEPSEEK_KEY = "YOUR_DEEPSEEK_KEY";
    
    let currentGeminiKeyIndex = 0;
    const CACHE_KEY = "smart_bot_cache";
    const SYSTEM_PROMPT = "أنت المساعد الذكي (البوصلة) في منصة الأستاذ يوسف بركات لتعليم التاريخ والجغرافيا للثانوية العامة والإعدادية بمصر. أجب بشكل مباشر وعلمي ومختصر ومبسط. قاعدة صارمة: امتص غضب الطالب واحتويه، تحدث معه بذكاء وأسلوب راقٍ ومباشر ولا تستفزه. إذا واجهته مشكلة، حاول طمأنته وناقشه بذكاء لتهدئته ولا تقم بتحويله فوراً للإدارة بل ساعده بقدر الإمكان. أجب وتناقش مع الطالب بشكل مباشر فوري، ممنوع منعاً باتاً أن تطرح أسئلة استرجاعية أو اختبارية على الطالب. اشرح المعلومة أو أجب عن السؤال فوراً. تكلم بلطف وتشجيع. لو السؤال مش متعلق بالدراسات قوله بلطف إنك متخصص في التاريخ والجغرافيا بس.";

    // ==========================================
    // 2. SMART CACHE & DYNAMIC LEARNING
    // ==========================================
    function loadCache() {
        try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } 
        catch (e) { return {}; }
    }
    
    function saveCache(cache) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    }

    function getFingerprint(text) {
        return text.replace(/[^\w\s\u0600-\u06FF]/g, '')
                   .replace(/[أإآ]/g, 'ا')
                   .replace(/ة/g, 'ه')
                   .replace(/ى/g, 'ي')
                   .replace(/\s+/g, ' ')
                   .trim()
                   .toLowerCase();
    }

    // ==========================================
    // 3. OFFLINE KNOWLEDGE BASE & INTENTS
    // ==========================================
    const OFFLINE_KNOWLEDGE = [
        { keywords: ["من هو", "يوسف بركات", "مين يوسف", "مين الاستاذ", "صاحب المنصة"], answer: "الأستاذ يوسف بركات هو صانع محتوى تعليمي ومدرس متخصص في التاريخ والجغرافيا. هدفه تبسيط المناهج وتوصيل المعلومة بشكل ممتع وسهل." },
        { keywords: ["اشترك", "اشتراك", "اسجل ازاي", "طريقة الاشتراك", "ادخل كورس"], answer: "للاشتراك، افتح صفحة 'الكورسات'، اختار الكورس المناسب، واضغط على 'اشترك الآن'، ثم اتبع خطوات الدفع." },
        { keywords: ["نسيت", "الباسورد", "كلمة المرور", "الرقم السري", "نسيت كلمة"], answer: "لو نسيت الباسورد، اضغط على 'نسيت كلمة المرور' في صفحة تسجيل الدخول، وهيوصلك كود التفعيل على الواتساب." },
        { keywords: ["مشكلة", "عطل", "دعم", "فني", "الدفع", "مش شغال", "مش بيفتح"], answer: "تقدر تتواصل مع الدعم الفني عبر واتساب على الرقم 01023675235 وهما هيحلوها فوراً." },
        { keywords: ["اذاكر", "نصيحة", "مش بعرف احفظ", "بنسى", "تاريخ", "جغرافيا"], answer: "أهم نصيحة هي الفهم قبل الحفظ! اربط الأحداث ببعضها كأنها قصة، واستخدم الخرائط الذهنية." }
    ];

    const CONVERSATIONAL_INTENTS = [
        { regex: /^(سلام|اهلا|هلا|صباح|مساء|هاي|ازيك|عامل ايه)$/i, answers: ["أهلًا بيك! 🧭 أنا البوصلة، اسألني أي حاجة في دروسك.", "يا هلا! 😄 جاهز نذاكر مع بعض؟"] },
        { regex: /(زعلان|صعب|مش فاهم|تعبت|مخنوق|يأس|فاشل)/i, answers: ["ولا يهمك 💪 كلنا بنتعلم بالتدريج. قولي إيه اللي واقف معاك بالظبط ونبسطه سوا.", "متيأسش يا بطل! أنا معاك هنا عشان أسهلك الصعب، اتفضل اسأل."] },
        { regex: /(شكرا|تسلم|حبيبي|عاش|شكراً)/i, answers: ["العفو يا بطل! 🌟 لو عندك سؤال تاني أنا موجود.", "في الخدمة دائماً! بالتوفيق في المذاكرة."] }
    ];

    function searchOfflineKnowledge(text) {
        // 1. Check Intents (Regex)
        for (let intent of CONVERSATIONAL_INTENTS) {
            if (intent.regex.test(text)) {
                return intent.answers[Math.floor(Math.random() * intent.answers.length)];
            }
        }
        
        // 2. Check Keywords
        const lowerText = text.toLowerCase();
        for (let item of OFFLINE_KNOWLEDGE) {
            if (item.keywords.some(kw => lowerText.includes(kw))) return item.answer;
        }
        return null;
    }

    // ==========================================
    // 4. CREATIVE VARIATIONS
    // ==========================================
    const variations = [
        (ans) => `أهلاً بيك يا بطل! الإجابة باختصار:\n\n${ans}`,
        (ans) => `سؤال ممتاز جداً! بص يا سيدي:\n\n${ans}`,
        (ans) => `${ans}\n\nلو محتاج توضيح أكتر، أنا معاك!`,
        (ans) => `${ans}\n\nأتمنى تكون الفكرة وضحت، استمر في التفوق! 🌟`,
        (ans) => `شوف يا سيدي الموضوع بسيط:\n\n${ans}`,
        (ans) => `${ans}` 
    ];

    function getRandomVariation(answer) {
        // If the answer is already conversational, don't wrap it
        if (CONVERSATIONAL_INTENTS.some(i => i.answers.includes(answer))) return answer;
        
        const randomIndex = Math.floor(Math.random() * variations.length);
        return variations[randomIndex](answer);
    }

    // ==========================================
    // 5. MAIN BOT LOGIC
    // ==========================================
    window.askGeminiDirectly = async function(userMessage) {
        if (window.DISABLE_DIRECT_GEMINI) return { fallback: true, reply: null, reason: "killed" };
        if (typeof userMessage !== 'string' || userMessage.length > 500) return { fallback: true, reply: null, reason: "prompt_too_long" };

        const cache = loadCache();

        // --- STEP 0: DYNAMIC TEACHING (علمني) ---
        const teachMatch = userMessage.match(/علمني\s*[:：]\s*(.+?)\s*=\s*(.+)/i);
        if (teachMatch) {
            const newQuestion = getFingerprint(teachMatch[1]);
            const newAnswer = teachMatch[2].trim();
            cache[newQuestion] = newAnswer;
            saveCache(cache);
            console.log('[DEV BOT] 🧠 Learned new answer!');
            return { reply: "تمام! 🧠 اتعلمتها وهرد بيها المرة الجاية.", fallback: false, provider: "learning" };
        }

        const fingerprint = getFingerprint(userMessage);

        // --- STEP 1: CHECK OFFLINE KNOWLEDGE ---
        const offlineAnswer = searchOfflineKnowledge(userMessage);
        if (offlineAnswer) {
            console.log('[DEV BOT] 📚 Answer served from Offline Knowledge Base!');
            return { reply: getRandomVariation(offlineAnswer), fallback: false, provider: "offline" };
        }

        // --- STEP 2: CHECK SMART CACHE ---
        let cachedAnswer = cache[fingerprint];
        if (!cachedAnswer) {
            for (let key in cache) {
                if (key.length > 10 && (key.includes(fingerprint) || fingerprint.includes(key))) {
                    cachedAnswer = cache[key];
                    break;
                }
            }
        }

        if (cachedAnswer) {
            console.log('[DEV BOT] 🚀 Answer served from Smart Cache! (0 Tokens spent)');
            return { reply: getRandomVariation(cachedAnswer), fallback: false, provider: "cache" };
        }

        // --- STEP 3: TRY GEMINI KEYS (ROTATION) ---
        let apiResponseText = null;
        let providerUsed = null;

        for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
            let keyToUse = GEMINI_KEYS[currentGeminiKeyIndex];
            
            // Skip unconfigured keys
            if (!keyToUse || keyToUse.startsWith("YOUR_GEMINI_KEY")) {
                currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % GEMINI_KEYS.length;
                continue;
            }

            try {
                console.log(`[DEV GEMINI] Trying Gemini Key Index: ${currentGeminiKeyIndex}`);
                let url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keyToUse}`;
                let response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                        contents: [{ role: "user", parts: [{ text: userMessage }] }],
                        generationConfig: { temperature: 0.4, maxOutputTokens: 300 }
                    })
                });

                if (response.ok) {
                    let data = await response.json();
                    apiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (apiResponseText) {
                        providerUsed = "gemini";
                        break; // Success!
                    }
                } else if (response.status === 429) {
                    console.warn(`[DEV GEMINI] Key ${currentGeminiKeyIndex} quota exceeded (429). Switching to next key...`);
                    currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % GEMINI_KEYS.length;
                } else {
                    console.error(`[DEV GEMINI] Error with key ${currentGeminiKeyIndex}: ${response.status}`);
                    currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % GEMINI_KEYS.length;
                }
            } catch (err) {
                console.error(`[DEV GEMINI] Network error with Gemini key ${currentGeminiKeyIndex}`, err);
                currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % GEMINI_KEYS.length;
            }
        }

        // --- STEP 3: FALLBACK TO DEEPSEEK ---
        if (!apiResponseText && DEEPSEEK_KEY && !DEEPSEEK_KEY.startsWith("YOUR_DEEPSEEK_KEY")) {
            console.log('[DEV GEMINI] ⚠️ All Gemini keys failed or none valid. Falling back to DeepSeek...');
            try {
                let url = "https://api.deepseek.com/chat/completions";
                let response = await fetch(url, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${DEEPSEEK_KEY}`
                    },
                    body: JSON.stringify({
                        model: "deepseek-chat",
                        messages: [
                            { role: "system", content: SYSTEM_PROMPT },
                            { role: "user", content: userMessage }
                        ],
                        temperature: 0.4,
                        max_tokens: 300
                    })
                });

                if (response.ok) {
                    let data = await response.json();
                    apiResponseText = data.choices?.[0]?.message?.content;
                    if (apiResponseText) {
                        providerUsed = "deepseek";
                    }
                } else {
                    console.error(`[DEV DEEPSEEK] API Error: ${response.status}`);
                }
            } catch (err) {
                console.error('[DEV DEEPSEEK] Network error:', err);
            }
        }

        // --- STEP 4: SAVE TO CACHE & RETURN ---
        if (apiResponseText) {
            console.log(`[DEV BOT] Success! Served from: ${providerUsed}`);
            cache[fingerprint] = apiResponseText;
            saveCache(cache);
            return { reply: apiResponseText, fallback: false, provider: providerUsed };
        }

        // --- STEP 5: ULTIMATE FALLBACK (IF APIs FAIL AND NOT IN OFFLINE KB) ---
        console.error('[DEV BOT] All APIs failed entirely.');
        const ultimateFallbackAnswers = [
            "حالياً بواجه ضغط بسيط في النظام، بس متقلقش أنا معاك! تقدر تسألني سؤال محدد بخصوص الكورسات أو المنصة وهرد عليك فوراً.",
            "الإنترنت عندي بطيء شوية 😅، ممكن تعيد سؤالك بشكل تاني أو تسألني عن الاشتراكات والكورسات؟",
            "عفواً يا بطل، مقدرتش أوصل للمعلومة دي حالياً بسبب تحديث في النظام. لو في سؤال تاني يخص المنهج أنا تحت أمرك!"
        ];
        const randomFallback = ultimateFallbackAnswers[Math.floor(Math.random() * ultimateFallbackAnswers.length)];
        
        return { reply: randomFallback, fallback: true, provider: "ultimate_fallback" };
    };
})();

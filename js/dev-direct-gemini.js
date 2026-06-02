/**
 * DEV MODE ONLY — REMOVE BEFORE PRODUCTION
 * Direct Gemini API integration for testing.
 * Owner authorized temporary key embedding.
 */

window.DISABLE_DIRECT_GEMINI = false;

(function() {
    console.log('[DEV GEMINI] Initializing... hostname:', window.location.hostname || 'local file');

    window.askGeminiDirectly = async function(userMessage) {
        console.log('[DEV GEMINI] Called with:', userMessage);

        if (window.DISABLE_DIRECT_GEMINI) {
            return { fallback: true, reply: null, reason: "killed" };
        }

        if (typeof userMessage !== 'string' || userMessage.length > 500) {
            return { fallback: true, reply: null, reason: "prompt_too_long" };
        }

        var apiKey = 'AQ.Ab8RN6J86krCv' + 'LMSrzdExjPxhU_T_DTEF-EOMzlWYSJK6UDmEw';
        var systemPrompt = "أنت المساعد الذكي (البوصلة) في منصة الأستاذ يوسف بركات لتعليم التاريخ والجغرافيا للثانوية العامة والإعدادية بمصر. أجب بشكل مباشر وعلمي ومختصر ومبسط. لا تسأل الطالب عما يقصده بل اشرح المعلومة فوراً. تكلم بلطف وتشجيع. لو السؤال مش متعلق بالدراسات قوله بلطف إنك متخصص في التاريخ والجغرافيا بس.";

        var models = ["gemini-2.5-flash", "gemini-2.0-flash"];

        for (var i = 0; i < models.length; i++) {
            var modelName = models[i];
            var url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent?key=" + apiKey;
            
            try {
                console.log('[DEV GEMINI] Trying model:', modelName);
                var response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: { parts: [{ text: systemPrompt }] },
                        contents: [{ role: "user", parts: [{ text: userMessage }] }],
                        generationConfig: { temperature: 0.2, maxOutputTokens: 300 }
                    })
                });

                if (!response.ok) {
                    var errBody = await response.json();
                    console.error('[DEV GEMINI] ' + modelName + ' HTTP ' + response.status, errBody);
                    continue;
                }

                var data = await response.json();
                var text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;

                if (text) {
                    console.log('[DEV GEMINI] SUCCESS from ' + modelName + ':', text.substring(0, 80) + '...');
                    return { reply: text, fallback: false, provider: modelName };
                }
            } catch (err) {
                console.error('[DEV GEMINI] ' + modelName + ' NETWORK ERROR:', err);
            }
        }

        console.error('[DEV GEMINI] All models failed.');
        return { fallback: true, reply: null, reason: "all_failed" };
    };

    console.log('[DEV GEMINI] Ready. window.askGeminiDirectly =', typeof window.askGeminiDirectly);
})();

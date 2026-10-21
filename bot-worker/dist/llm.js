"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callLlm = callLlm;
const FRIENDLY_BUSY_MESSAGE = 'الخدمة مشغولة حاليًا بضغط كبير، جرّب بعد دقيقة يا صديقي وهكون معاك فورًا.';
async function callLlm(systemPrompt, userMessage, history = [], env, maxTokens = 500) {
    const groqKey = env.GROQ_API_KEY;
    const geminiKey = env.GEMINI_API_KEY;
    if (!groqKey && !geminiKey) {
        return {
            reply: 'مفتاح الذكاء الاصطناعي غير مضبوط حالياً. يُرجى مراجعة إدارة المنصة.',
            source: 'fallback',
            fallbackReason: 'llm_missing_key',
            modelUsed: 'none',
            totalTokens: 0
        };
    }
    // اختيار النموذج (كبير للأسئلة المعقدة، سريع للبسيطة)
    const primaryModel = env.GROQ_PRIMARY_MODEL || 'llama-3.3-70b-versatile';
    const fastModel = env.GROQ_FAST_MODEL || 'llama-3.1-8b-instant';
    const isComplex = userMessage.length > 150 || history.length > 4;
    const targetModel = isComplex ? primaryModel : fastModel;
    // سقف طول سجل المحادثة (بحد أقصى 6 رسائل وبطول 400 حرف لمنع تضخم التوكنز)
    const groqMessages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map(h => ({
            role: h.role === 'assistant' ? 'assistant' : 'user',
            content: h.content.slice(0, 400)
        })),
        { role: 'user', content: userMessage.slice(0, 500) }
    ];
    // محاولة الاتصال بـ Groq
    if (groqKey) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: targetModel,
                    messages: groqMessages,
                    temperature: 0.2,
                    max_completion_tokens: maxTokens,
                    reasoning_effort: 'low'
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                const choice = data.choices?.[0];
                const reply = choice?.message?.content?.trim();
                const finishReason = choice?.finish_reason;
                const completionTokens = data.usage?.completion_tokens;
                const totalTokens = data.usage?.total_tokens || ((data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0)) || 0;
                console.error(`[GROQ_COMPLETION] model=${targetModel} finish_reason=${finishReason} completion_tokens=${completionTokens} total_tokens=${totalTokens}`);
                if (reply) {
                    return {
                        reply,
                        source: 'llm_groq',
                        modelUsed: targetModel,
                        finishReason,
                        completionTokens,
                        totalTokens
                    };
                }
            }
            // إذا واجهنا 429 أو 5xx، نجرب الموديل السريع كـ fallback لو كنا بالموديل الكبير
            if ((res.status === 429 || res.status >= 500) && targetModel === primaryModel) {
                const fallbackRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: fastModel,
                        messages: groqMessages,
                        temperature: 0.2,
                        max_completion_tokens: maxTokens,
                        reasoning_effort: 'low'
                    })
                });
                if (fallbackRes.ok) {
                    const fbData = await fallbackRes.json();
                    const fbChoice = fbData.choices?.[0];
                    const reply = fbChoice?.message?.content?.trim();
                    const finishReason = fbChoice?.finish_reason;
                    const completionTokens = fbData.usage?.completion_tokens;
                    const totalTokens = fbData.usage?.total_tokens || ((fbData.usage?.prompt_tokens || 0) + (fbData.usage?.completion_tokens || 0)) || 0;
                    console.error(`[GROQ_FALLBACK_COMPLETION] model=${fastModel} finish_reason=${finishReason} completion_tokens=${completionTokens}`);
                    if (reply) {
                        return {
                            reply,
                            source: 'llm_groq',
                            modelUsed: fastModel,
                            finishReason,
                            completionTokens,
                            totalTokens
                        };
                    }
                }
            }
            if (res.status === 429 || res.status >= 500) {
                return {
                    reply: FRIENDLY_BUSY_MESSAGE,
                    source: 'fallback',
                    fallbackReason: res.status === 429 ? 'llm_rate_limit' : 'llm_server_error',
                    modelUsed: targetModel
                };
            }
            // إذا كان كود الخطأ غير 429 وغير 5xx (مثل 400 أو 401) نسجل الكود فقط ولا نعرض "مشغولة" بصمت
            console.error(`[GROQ_ERROR_STATUS] status=${res.status}`);
            return {
                reply: 'تعذر الحصول على إجابة في الوقت الحالي، يُرجى المحاولة لاحقاً أو مراجعة إدارة المنصة.',
                source: 'fallback',
                fallbackReason: `llm_error:${res.status}`,
                modelUsed: targetModel
            };
        }
        catch (e) {
            if (e.name === 'AbortError') {
                return {
                    reply: 'استغرقت الإجابة وقتاً أطول من المعتاد، جرّب صياغة سؤالك بشكل أبسط وسأجيبك فوراً.',
                    source: 'fallback',
                    modelUsed: targetModel
                };
            }
        }
    }
    // محاولة Gemini كـ احتياطي إن وُجد المفتاح
    if (geminiKey) {
        try {
            const contents = [
                ...history.slice(-10).map(h => ({
                    role: h.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: h.content.slice(0, 800) }]
                })),
                { role: 'user', parts: [{ text: userMessage.slice(0, 500) }] }
            ];
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
            const res = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    contents,
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 1024
                    }
                })
            });
            if (res.ok) {
                const data = await res.json();
                const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                if (reply) {
                    return {
                        reply,
                        source: 'llm_gemini',
                        modelUsed: 'gemini-1.5-flash'
                    };
                }
            }
        }
        catch {
            // Ignore and proceed to busy message
        }
    }
    return {
        reply: FRIENDLY_BUSY_MESSAGE,
        source: 'fallback',
        fallbackReason: 'llm_all_failed',
        modelUsed: 'none'
    };
}

import { Env, ChatMessage } from './types';

export interface LlmResult {
  reply: string;
  source: 'llm_groq' | 'llm_gemini' | 'fallback';
  modelUsed: string;
  finishReason?: string;
  completionTokens?: number;
}

const FRIENDLY_BUSY_MESSAGE = 'الخدمة مشغولة حاليًا بضغط كبير، جرّب بعد دقيقة يا صديقي وهكون معاك فورًا.';

export async function callLlm(
  systemPrompt: string,
  userMessage: string,
  history: ChatMessage[] = [],
  env: Env
): Promise<LlmResult> {
  const groqKey = env.GROQ_API_KEY;
  const geminiKey = env.GEMINI_API_KEY;

  if (!groqKey && !geminiKey) {
    return {
      reply: 'مفتاح الذكاء الاصطناعي غير مضبوط حالياً. يُرجى مراجعة إدارة المنصة.',
      source: 'fallback',
      modelUsed: 'none'
    };
  }

  // اختيار النموذج (كبير للأسئلة المعقدة، سريع للبسيطة)
  const primaryModel = env.GROQ_PRIMARY_MODEL || 'llama-3.3-70b-versatile';
  const fastModel = env.GROQ_FAST_MODEL || 'llama-3.1-8b-instant';

  const isComplex = userMessage.length > 150 || history.length > 4;
  const targetModel = isComplex ? primaryModel : fastModel;

  // محاولة الاتصال بـ Groq
  if (groqKey) {
    try {
      const groqMessages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-12).map(h => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content.slice(0, 800)
        })),
        { role: 'user', content: userMessage.slice(0, 500) }
      ];

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
          max_completion_tokens: 2048,
          reasoning_effort: 'low'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json() as any;
        const choice = data.choices?.[0];
        const reply = choice?.message?.content?.trim();
        const finishReason = choice?.finish_reason;
        const completionTokens = data.usage?.completion_tokens;
        const totalTokens = data.usage?.total_tokens;

        console.error(`[GROQ_COMPLETION] model=${targetModel} finish_reason=${finishReason} completion_tokens=${completionTokens} total_tokens=${totalTokens}`);

        if (reply) {
          return {
            reply,
            source: 'llm_groq',
            modelUsed: targetModel,
            finishReason,
            completionTokens
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
            max_completion_tokens: 2048,
            reasoning_effort: 'low'
          })
        });

        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json() as any;
          const fbChoice = fbData.choices?.[0];
          const reply = fbChoice?.message?.content?.trim();
          const finishReason = fbChoice?.finish_reason;
          const completionTokens = fbData.usage?.completion_tokens;

          console.error(`[GROQ_FALLBACK_COMPLETION] model=${fastModel} finish_reason=${finishReason} completion_tokens=${completionTokens}`);

          if (reply) {
            return {
              reply,
              source: 'llm_groq',
              modelUsed: fastModel,
              finishReason,
              completionTokens
            };
          }
        }
      }

      if (res.status === 429 || res.status >= 500) {
        return {
          reply: FRIENDLY_BUSY_MESSAGE,
          source: 'fallback',
          modelUsed: targetModel
        };
      }

      // إذا كان كود الخطأ غير 429 وغير 5xx (مثل 400 أو 401) نسجل الكود فقط ولا نعرض "مشغولة" بصمت
      console.error(`[GROQ_ERROR_STATUS] status=${res.status}`);
      return {
        reply: 'تعذر الحصول على إجابة في الوقت الحالي، يُرجى المحاولة لاحقاً أو مراجعة إدارة المنصة.',
        source: 'fallback',
        modelUsed: targetModel
      };
    } catch (e: any) {
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
        const data = await res.json() as any;
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (reply) {
          return {
            reply,
            source: 'llm_gemini',
            modelUsed: 'gemini-1.5-flash'
          };
        }
      }
    } catch {
      // Ignore and proceed to busy message
    }
  }

  return {
    reply: FRIENDLY_BUSY_MESSAGE,
    source: 'fallback',
    modelUsed: 'none'
  };
}

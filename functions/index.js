const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

// Simple in-memory rate limiter (Warning: For production with multiple instances, use Firestore or Redis)
const rateLimits = new Map();
const MAX_REQUESTS_PER_MINUTE = 15;

/**
 * Clean error messages to hide stack traces and sensitive details
 */
function getSafeErrorMessage(err) {
    console.error("LLM Proxy Error:", err);
    // Generic safe fallback for the frontend
    return "عذراً، أواجه مشكلة في الاتصال بالخوادم الآن. يرجى المحاولة بعد قليل.";
}

/**
 * HTTPS Callable Function: askAlBouslaLLM
 * Future Proxy to Gemini/OpenAI API.
 */
exports.askAlBouslaLLM = functions.https.onCall(async (data, context) => {
    try {
        // --- 1. Basic Security & Authentication (Optional but recommended) ---
        // if (!context.auth) {
        //     throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
        // }

        const ip = context.rawRequest ? context.rawRequest.ip : 'unknown_ip';
        const userId = context.auth ? context.auth.uid : ip;

        // --- 2. Rate Limiting ---
        const now = Date.now();
        const userRateData = rateLimits.get(userId) || { count: 0, firstRequestTime: now };
        
        // Reset count if a minute has passed
        if (now - userRateData.firstRequestTime > 60000) {
            userRateData.count = 1;
            userRateData.firstRequestTime = now;
        } else {
            userRateData.count++;
            if (userRateData.count > MAX_REQUESTS_PER_MINUTE) {
                console.warn(`Rate limit exceeded for User/IP: ${userId}`);
                return { reply: "عذراً، لقد تجاوزت الحد المسموح من الرسائل في الدقيقة. يرجى الانتظار قليلاً." };
            }
        }
        rateLimits.set(userId, userRateData);

        // --- 3. Input Validation ---
        const { message, history } = data;

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return { reply: "لم أستطع قراءة رسالتك، هل يمكنك المحاولة مرة أخرى؟" };
        }

        if (message.length > 500) {
            console.warn(`Message length exceeded for User/IP: ${userId}`);
            return { reply: "رسالتك طويلة جداً، حاول اختصارها وسأجيبك بأفضل ما عندي!" };
        }

        if (history && !Array.isArray(history)) {
            console.warn(`Malformed history array for User/IP: ${userId}`);
            return { reply: "حدث خطأ في قراءة سياق المحادثة. يرجى إعادة المحاولة." };
        }

        // --- 4. Secret Isolation (Future usage setup) ---
        // Access future API keys securely via environment or Firebase Secrets.
        // Example: const apiKey = process.env.AI_API_KEY || functions.config().ai.api_key;
        // if (!apiKey) throw new Error("API Key not configured");

        // --- 5. RAG Pipeline Execution ---
        const { retrieveRelevantChunks } = require('./rag/retriever');
        const { buildEducationalPrompt } = require('./rag/prompt-builder');
        const { validateAndFormatResponse } = require('./rag/validation');
        const { getCachedResponse, setCachedResponse, logQueryToMemory } = require('./rag/cache');

        const db = admin.firestore();
        
        // Check Cache first
        const cacheHit = await getCachedResponse(message, db, history ? history.length : 0);
        if (cacheHit) {
             return { reply: cacheHit.generatedReply, debug: { cache: true } };
        }

        // Step 1: Retrieve context
        const retrievalResult = await retrieveRelevantChunks(message, db);
        const chunkIds = retrievalResult.chunks.map(c => c.id);
        
        // Log query to memory for future optimization
        await logQueryToMemory(message, chunkIds, retrievalResult.confidence, db);

        // Step 2: Build Safe Prompt
        const safePrompt = buildEducationalPrompt(message, retrievalResult.chunks, history);

        // Step 3: Mock LLM Generation (Pending actual Gemini integration)
        const llmStartTime = Date.now();
        let rawLlmReply = "هذه إجابة تجريبية تفترض أن: " + (retrievalResult.chunks[0]?.text.substring(0, 50) || "لا يوجد نص") + "...";
        const llmLatency = Date.now() - llmStartTime;

        // Step 4: Strict Validation Boundary
        const safeReply = validateAndFormatResponse(rawLlmReply, retrievalResult.chunks, retrievalResult.confidence);
        const fallbackTriggered = safeReply.includes("لا يتوفر لدي سياق تعليمي");

        // Set Cache if valid
        if (!fallbackTriggered) {
             await setCachedResponse(message, safeReply, chunkIds, db, history ? history.length : 0);
        }

        // --- 6. Observability & Telemetry Logs ---
        const telemetry = {
            query: message,
            retrievalLatency: retrievalResult.latency,
            llmLatency: llmLatency,
            matchedChunkIds: chunkIds,
            retrievalConfidence: retrievalResult.confidence,
            tokenUsageEstimate: retrievalResult.tokenEstimate,
            cacheHit: false,
            fallbackTriggered: fallbackTriggered
        };
        console.log("RAG Telemetry:", telemetry);

        return {
            reply: safeReply,
            debug: {
                telemetry: telemetry,
                retrievedChunks: retrievalResult.chunks,
                promptUsed: safePrompt
            }
        };

    } catch (error) {
        // --- 6. Error Sanitization ---
        const safeMsg = getSafeErrorMessage(error);
        // Do not throw HttpsError with internal details, return a soft safe reply.
        return { reply: safeMsg };
    }
});

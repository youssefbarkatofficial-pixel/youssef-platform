/**
 * Memory and Caching Layer
 *
 * Responsibilities:
 * - Handle short TTL response cache (llm_response_cache).
 * - Handle retrieval query memory (rag_query_memory) for optimization.
 */

const crypto = require('crypto');

function generateCacheKey(query, historyTokens) {
    const raw = `${query.trim().toLowerCase()}_${historyTokens}`;
    return crypto.createHash('md5').update(raw).digest('hex');
}

/**
 * Check if we already generated a response for this exact state recently.
 * Short TTL (e.g., 5 minutes) prevents repetitive Gemini API costs.
 */
async function getCachedResponse(query, db, historyTokens = 0) {
    // In production, fetch from Firestore `llm_response_cache` where expiresAt > now
    // Return null if miss.
    return null; 
}

async function setCachedResponse(query, response, matchedChunkIds, db, historyTokens = 0) {
    const cacheKey = generateCacheKey(query, historyTokens);
    const expiresAt = new Date(Date.now() + 5 * 60000); // 5 min TTL
    
    // In production, save to Firestore:
    // db.collection('llm_response_cache').doc(cacheKey).set({
    //     cacheKey, generatedReply: response, matchedChunkIds, createdAt: new Date(), expiresAt
    // });
}

/**
 * Log the query to optimize future retrievals.
 * This is strictly for retrieval performance, NOT self-learning AI facts.
 */
async function logQueryToMemory(query, matchedChunkIds, retrievalScore, db) {
    // db.collection('rag_query_memory').doc(hash).set({ ... }, { merge: true });
}

module.exports = {
    getCachedResponse,
    setCachedResponse,
    logQueryToMemory
};

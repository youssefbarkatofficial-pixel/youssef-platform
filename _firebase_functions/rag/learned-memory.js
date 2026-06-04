/**
 * Controlled Learning Loop Memory
 *
 * Responsibilities:
 * - Save grounded, verified Gemini responses for specific semantic clusters.
 * - Retrieve from learned memory to optimize costs and latency.
 * - NEVER override the official published curriculum.
 */

const { normalizeArabicQuery } = require('./normalize');
const crypto = require('crypto');

function generateMemoryId(normalizedQuery) {
    return crypto.createHash('sha256').update(normalizedQuery).digest('hex');
}

/**
 * Searches the learned memory (optimization layer).
 */
async function searchLearnedMemory(query, db) {
    const normalized = normalizeArabicQuery(query);
    if (!normalized) return null;

    const id = generateMemoryId(normalized);
    // In production:
    // const doc = await db.collection('learned_qa').doc(id).get();
    // if (doc.exists && doc.data().verified !== false) { return doc.data(); }
    
    return null; // Mock return
}

/**
 * Saves a grounded, high-confidence response to learned memory.
 */
async function saveToLearnedMemory(query, answer, matchedChunkIds, confidence, provider, db) {
    if (confidence !== 'High') {
        console.log("Skipping learned memory save: Confidence not High.");
        return;
    }

    const normalized = normalizeArabicQuery(query);
    if (!normalized) return;

    const memoryId = generateMemoryId(normalized);

    const memoryPayload = {
        id: memoryId,
        normalizedQuestion: normalized,
        originalQuestion: query,
        generatedAnswer: answer,
        matchedChunkIds: matchedChunkIds,
        retrievalConfidence: confidence,
        provider: provider || "unknown",
        source: "gemini_verified",
        curriculumVersion: "v1.0", // Extract dynamically in production
        usageCount: 1,
        createdAt: new Date().toISOString(),
        verified: false // Requires admin approval to become permanent
    };

    // In production:
    // await db.collection('learned_qa').doc(memoryId).set(memoryPayload, { merge: true });
    console.log("Learned Memory Registered for:", normalized);
}

module.exports = {
    searchLearnedMemory,
    saveToLearnedMemory
};

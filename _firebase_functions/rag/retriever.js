/**
 * Pluggable Retrieval Interface
 *
 * Responsibilities:
 * - Abstract retrieval orchestration from the database layer.
 * - Calculate retrieval scores and latencies.
 * - Enforce Token Budgeting (MAX_CONTEXT, MAX_HISTORY, MAX_TOTAL).
 */

const MAX_CONTEXT_TOKENS = 2000;

class BaseRetriever {
    async retrieve(query, options) {
        throw new Error("retrieve() must be implemented by subclass");
    }
}

/**
 * Temporary Firestore-based keyword retriever for bootstrapping.
 * Will be replaced by Pinecone/pgVector later without changing the orchestrator.
 */
class FirestoreKeywordRetriever extends BaseRetriever {
    constructor(db) {
        super();
        this.db = db;
    }

    async retrieve(query, options = {}) {
        const keywords = query.split(/\s+/).filter(w => w.length > 3);
        if (keywords.length === 0) return [];

        // Mock retrieval. In production, this only queries `status == 'published'`
        // and ranks by keyword hits.
        const mockChunks = [
            {
                id: 'history_u1_l1_c01',
                text: 'جاءت الحملة الفرنسية على مصر بقيادة نابليون بونابرت عام 1798.',
                sourceBook: 'تاريخ مصر الحديث', unit: 'الوحدة الأولى', lesson: 'الحملة الفرنسية',
                status: 'published'
            }
        ];

        return mockChunks.map(c => ({
            chunk: c,
            score: 0.85, // Mock score
            confidence: 'High'
        }));
    }
}

/**
 * Factory for the active retrieval provider.
 */
function getRetrieverProvider(db) {
    // Easily swap to new VectorRetriever(pineconeClient) later.
    return new FirestoreKeywordRetriever(db);
}

/**
 * Orchestrates the retrieval process using the active provider.
 */
async function retrieveRelevantChunks(query, db) {
    const startTime = Date.now();
    
    try {
        const retriever = getRetrieverProvider(db);
        const results = await retriever.retrieve(query, { limit: 4 });

        // Filter and sort
        const validResults = results
            .filter(r => r.chunk.status === 'published')
            .sort((a, b) => b.score - a.score);

        // Map out the chunks
        const chunks = validResults.map(r => r.chunk);
        
        // Simple token estimation (~4 chars = 1 token for Arabic)
        let tokenEstimate = 0;
        const budgetedChunks = [];
        
        for (const chunk of chunks) {
            const chunkTokens = Math.ceil(chunk.text.length / 4);
            if (tokenEstimate + chunkTokens > MAX_CONTEXT_TOKENS) {
                console.warn("Max context token budget reached. Dropping remaining chunks.");
                break;
            }
            tokenEstimate += chunkTokens;
            budgetedChunks.push(chunk);
        }

        const avgConfidence = validResults.length > 0 ? validResults[0].confidence : 'Low';

        return {
            chunks: budgetedChunks,
            scores: validResults.reduce((acc, r) => ({ ...acc, [r.chunk.id]: r.score }), {}),
            confidence: avgConfidence,
            tokenEstimate: tokenEstimate,
            latency: Date.now() - startTime
        };

    } catch (error) {
        console.error("Retrieval Abstraction Error:", error);
        return { chunks: [], scores: {}, confidence: 'Error', tokenEstimate: 0, latency: Date.now() - startTime };
    }
}

module.exports = {
    retrieveRelevantChunks,
    getRetrieverProvider
};

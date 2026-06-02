/**
 * Hybrid Retriever Engine
 *
 * Responsibilities:
 * - Retrieve chunks using keywords from Firestore.
 * - Retrieve chunks using Vector Embeddings (Future).
 * - Rerank and deduplicate overlapping chunks.
 * - Return top K chunks.
 */

const { generateEmbeddings } = require('./embedder');

/**
 * Pluggable retrieval function.
 * @param {string} query The user query.
 * @param {object} db Firestore database instance.
 * @returns {object} { chunks, tokenEstimate, scores, latency }
 */
async function retrieveRelevantChunks(query, db) {
    const startTime = Date.now();
    let retrievedChunks = [];
    let scores = {};

    try {
        // 1. Keyword Extraction (Basic for now)
        const keywords = query.split(/\s+/).filter(w => w.length > 3);

        // 2. Keyword Retrieval Phase
        const keywordChunks = await retrieveByKeywords(keywords, db);
        
        // 3. Vector Retrieval Phase (Future)
        // const queryVector = await generateEmbeddings(query);
        // const vectorChunks = await retrieveByVector(queryVector, db);
        const vectorChunks = []; // Empty for now until vector DB is ready

        // 4. Merge & Rerank Phase (Hybrid scoring)
        const mergedMap = new Map();
        
        // Add keyword chunks to map
        keywordChunks.forEach(chunk => {
            mergedMap.set(chunk.id, chunk);
            scores[chunk.id] = (scores[chunk.id] || 0) + chunk.keywordScore;
        });

        // Add vector chunks to map
        vectorChunks.forEach(chunk => {
            mergedMap.set(chunk.id, chunk);
            scores[chunk.id] = (scores[chunk.id] || 0) + chunk.vectorScore;
        });

        // Convert back to array and sort by combined score
        retrievedChunks = Array.from(mergedMap.values()).sort((a, b) => {
            return (scores[b.id] || 0) - (scores[a.id] || 0);
        });

        // 5. Top-K Selection (Limit to top 3-5 to prevent context overflow)
        retrievedChunks = retrievedChunks.slice(0, 4);

        // Calculate rough token estimate (assuming ~4 chars per token for Arabic/English mix)
        const tokenEstimate = Math.ceil(retrievedChunks.reduce((acc, c) => acc + c.text.length, 0) / 4);

        return {
            chunks: retrievedChunks,
            scores: scores,
            tokenEstimate: tokenEstimate,
            latency: Date.now() - startTime
        };

    } catch (error) {
        console.error("Retrieval Engine Error:", error);
        return { chunks: [], scores: {}, tokenEstimate: 0, latency: Date.now() - startTime };
    }
}

/**
 * Keyword-based retrieval from Firestore.
 */
async function retrieveByKeywords(keywords, db) {
    if (!keywords || keywords.length === 0 || !db) return [];
    
    // TEMPORARY MOCK: In a real scenario, this queries the `rag_chunks` collection.
    // e.g., db.collection('rag_chunks').where('keywords', 'array-contains-any', keywords).limit(20).get()
    
    console.log("Mocking keyword retrieval for:", keywords);
    
    // Mocking a retrieved chunk for testing the pipeline
    return [
        {
            id: 'mock_chunk_1',
            sourceBook: 'تاريخ مصر الحديث',
            unit: 'الوحدة الأولى',
            lesson: 'الحملة الفرنسية',
            page: '12',
            text: 'جاءت الحملة الفرنسية على مصر بقيادة نابليون بونابرت عام 1798. كان هدفها قطع طريق التجارة على إنجلترا وتأسيس إمبراطورية فرنسية في الشرق.',
            keywordScore: 0.8
        }
    ];
}

module.exports = {
    retrieveRelevantChunks
};

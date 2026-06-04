/**
 * Semantic Normalization
 *
 * Responsibilities:
 * - Unify Arabic variants.
 * - Remove stop words and punctuation.
 * - Create a stable semantic key for learning loop clusters.
 */

function normalizeArabicQuery(query) {
    if (!query || typeof query !== 'string') return '';

    let normalized = query.trim();

    // 1. Remove Punctuation
    normalized = normalized.replace(/[.,/#!$%^&*;:{}=\-_`~()؟?]/g, '');

    // 2. Unify Arabic Variants
    normalized = normalized.replace(/[أإآ]/g, 'ا');
    normalized = normalized.replace(/ة/g, 'ه');
    normalized = normalized.replace(/ى/g, 'ي');
    normalized = normalized.replace(/ؤ/g, 'و');
    normalized = normalized.replace(/ئ/g, 'ي');

    // 3. Remove Diacritics (Tashkeel)
    normalized = normalized.replace(/[\u0617-\u061A\u064B-\u0652]/g, '');

    // 4. Remove Common Stop Words (Question markers, etc.)
    const stopWords = ['هل', 'ما', 'كيف', 'لماذا', 'متي', 'بم', 'تفسر', 'علل', 'اذكر', 'وضح', 'ماذا', 'من'];
    const words = normalized.split(/\s+/);
    const filtered = words.filter(w => !stopWords.includes(w));

    // Fallback if all words were stop words
    if (filtered.length === 0) return words.join(' ');

    return filtered.join(' ');
}

module.exports = {
    normalizeArabicQuery
};

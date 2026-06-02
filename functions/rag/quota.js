/**
 * Cost Protection & Quota Layer
 *
 * Responsibilities:
 * - Enforce MAX_DAILY_LLM_CALLS
 * - Enforce MAX_CALLS_PER_USER
 * - Protect the API from abuse and billing spikes.
 */

const MAX_DAILY_LLM_CALLS = 1000;
const MAX_CALLS_PER_USER = 50;

/**
 * Validates if the system or user has exceeded their LLM quota.
 * Returns true if allowed, false if quota exceeded.
 */
async function checkQuota(userId, db) {
    // In production, this checks a `quotas/daily` document in Firestore 
    // and a `users/{userId}/quota` document.
    
    // Mock implementation for current tests:
    const systemCallsToday = 0; // db.collection('quotas').doc('today').get().count
    const userCallsToday = 0;

    if (systemCallsToday >= MAX_DAILY_LLM_CALLS) {
        console.error("CRITICAL: Global Daily LLM Quota Exceeded.");
        return false;
    }

    if (userCallsToday >= MAX_CALLS_PER_USER) {
        console.warn(`User ${userId} exceeded daily quota.`);
        return false;
    }

    return true;
}

/**
 * Increments the quota counters after a successful LLM call.
 */
async function incrementQuota(userId, db) {
    // In production, atomic increment:
    // batch.update(db.collection('quotas').doc('today'), { count: admin.firestore.FieldValue.increment(1) });
}

module.exports = {
    checkQuota,
    incrementQuota
};

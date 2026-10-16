"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllSettings = getAllSettings;
exports.getSetting = getSetting;
exports.setSetting = setSetting;
exports.checkAndIncrementUsage = checkAndIncrementUsage;
exports.isPersonalizedQuestion = isPersonalizedQuestion;
exports.getAnswerFromCache = getAnswerFromCache;
exports.findLearnedAnswer = findLearnedAnswer;
exports.logChat = logChat;
exports.getChatLog = getChatLog;
exports.setLogRating = setLogRating;
exports.checkConversationState = checkConversationState;
exports.recordStudentMessageInState = recordStudentMessageInState;
exports.cleanupOldLogs = cleanupOldLogs;
const rag_1 = require("./rag");
// ===================== الإعدادات Settings =====================
let isolateSettingsCache = null;
const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000;
async function getAllSettings(db) {
    const now = Date.now();
    if (isolateSettingsCache && isolateSettingsCache.expiresAt > now) {
        return isolateSettingsCache.settings;
    }
    const { results } = await db.prepare('SELECT key, value FROM settings').all();
    const map = {};
    for (const r of results || []) {
        map[r.key] = r.value;
    }
    isolateSettingsCache = {
        settings: map,
        expiresAt: now + SETTINGS_CACHE_TTL_MS
    };
    return map;
}
async function getSetting(db, key, defaultValue = '') {
    const all = await getAllSettings(db);
    return all[key] !== undefined ? all[key] : defaultValue;
}
async function setSetting(db, key, value, description = '') {
    const now = Date.now();
    await db.prepare('INSERT INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, description = ?, updated_at = ?').bind(key, value, description, now, value, description, now).run();
    isolateSettingsCache = null; // Clear cache
}
async function checkAndIncrementUsage(db, studentUid) {
    const settings = await getAllSettings(db);
    const enabled = (settings['enabled'] || 'true') === 'true';
    if (!enabled) {
        return { allowed: false, remaining: 0, reason: 'bot_disabled' };
    }
    const studentDailyLimit = parseInt(settings['daily_student_limit'] || '30', 10);
    const globalDailyCap = parseInt(settings['global_daily_cap'] || '4000', 10);
    const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const studentUsageId = `${dateKey}:${studentUid}`;
    const globalUsageId = `${dateKey}:GLOBAL`;
    // قراءة الاستهلاك الحالي
    const { results } = await db.prepare('SELECT id, count FROM usage_daily WHERE id IN (?, ?)').bind(studentUsageId, globalUsageId).all();
    let studentCount = 0;
    let globalCount = 0;
    for (const r of results || []) {
        if (r.id === studentUsageId)
            studentCount = r.count || 0;
        if (r.id === globalUsageId)
            globalCount = r.count || 0;
    }
    if (globalCount >= globalDailyCap) {
        return { allowed: false, remaining: 0, reason: 'global_cap' };
    }
    if (studentCount >= studentDailyLimit) {
        return { allowed: false, remaining: 0, reason: 'student_limit' };
    }
    // زيادة العداد للطالب وللعالمي
    await db.batch([
        db.prepare('INSERT INTO usage_daily (id, date_key, user_uid, count) VALUES (?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET count = count + 1').bind(studentUsageId, dateKey, studentUid),
        db.prepare('INSERT INTO usage_daily (id, date_key, user_uid, count) VALUES (?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET count = count + 1').bind(globalUsageId, dateKey, 'GLOBAL')
    ]);
    return {
        allowed: true,
        remaining: Math.max(0, studentDailyLimit - (studentCount + 1))
    };
}
// ===================== كاش الإجابات Answer Cache =====================
async function hashText(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
function isPersonalizedQuestion(msg) {
    const normMsg = (0, rag_1.norm)(msg);
    const pWords = ['اسمي', 'كورساتي', 'بياناتي', 'ايميلي', 'تليفوني', 'رقمي', 'حسابي', 'درجتي', 'امتحاني', 'امتحان'];
    return pWords.some(w => normMsg.includes(w));
}
async function getAnswerFromCache(db, question) {
    if (isPersonalizedQuestion(question))
        return null;
    const questionNorm = (0, rag_1.norm)(question);
    const hash = await hashText(questionNorm);
    const now = Date.now();
    const row = await db.prepare('SELECT answer FROM answer_cache WHERE question_hash = ? AND expires_at > ?').bind(hash, now).first();
    return row ? row.answer : null;
}
// ===================== الإجابات المعتمدة من الأدمن Learned Answers =====================
async function findLearnedAnswer(db, question) {
    const qNorm = (0, rag_1.norm)(question);
    if (!qNorm)
        return null;
    // فحص التطابق التام أو القريب
    const row = await db.prepare('SELECT answer FROM learned_answers WHERE question_norm = ?').bind(qNorm).first();
    if (row)
        return row.answer;
    // فحص يحتوي بشرط الترتيب وحد أقصى 200 وحد أدنى 8 أحرف لكل من النصين لمنع التطابق الخاطئ
    const { results } = await db.prepare('SELECT question_norm, answer FROM learned_answers ORDER BY updated_at DESC LIMIT 200').all();
    for (const r of results || []) {
        const target = r.question_norm;
        if (!target)
            continue;
        // تطابق تام
        if (qNorm === target) {
            return r.answer;
        }
        // تطابق جزئي بشرط أن يكون كلا النصين 8 أحرف على الأقل
        if (qNorm.length >= 8 && target.length >= 8) {
            if (qNorm.includes(target) || target.includes(qNorm)) {
                return r.answer;
            }
        }
    }
    return null;
}
// ===================== تسجيل المحادثات (بدون أي هواتف أو إيميلات) =====================
async function logChat(db, studentUid, userMessage, botReply, source, cpuMs) {
    const logId = crypto.randomUUID();
    const now = Date.now();
    await db.prepare('INSERT INTO chat_logs (id, student_uid, user_message, bot_reply, source, cpu_ms, rating, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)').bind(logId, studentUid, userMessage, botReply, source, cpuMs, now).run();
    return logId;
}
async function getChatLog(db, logId) {
    const row = await db.prepare('SELECT id, student_uid, rating FROM chat_logs WHERE id = ?').bind(logId).first();
    return row || null;
}
async function setLogRating(db, logId, rating) {
    const res = await db.prepare('UPDATE chat_logs SET rating = ? WHERE id = ?').bind(rating, logId).run();
    return res.success;
}
// ===================== حالة المحادثة وتدخل المعلم Conversation States =====================
async function checkConversationState(db, studentUid) {
    const row = await db.prepare('SELECT bot_paused, admin_active, last_admin_message_at, last_activity_at FROM conversation_states WHERE student_uid = ?').bind(studentUid).first();
    if (!row) {
        return { paused: false, adminActive: false };
    }
    const isPaused = row.bot_paused === 1;
    if (!isPaused) {
        return { paused: false, adminActive: row.admin_active === 1 };
    }
    // فحص الاستئناف التلقائي إذا مضت المدة المحددة (افتراضي 30 دقيقة)
    const autoResumeMinutes = parseInt(await getSetting(db, 'teacher_auto_resume_minutes', '30'), 10);
    const autoResumeMs = autoResumeMinutes * 60 * 1000;
    const timeoutBase = row.last_admin_message_at || 0;
    if (timeoutBase > 0 && Date.now() - timeoutBase > autoResumeMs) {
        // استئناف تلقائي بعد انقضاء مهلة تدخل المعلم
        await db.prepare('UPDATE conversation_states SET bot_paused = 0, admin_active = 0 WHERE student_uid = ?').bind(studentUid).run();
        return { paused: false, adminActive: false };
    }
    return { paused: true, adminActive: row.admin_active === 1 };
}
async function recordStudentMessageInState(db, studentUid) {
    const now = Date.now();
    await db.prepare(`
    INSERT INTO conversation_states (student_uid, bot_paused, admin_active, last_student_message_at, last_activity_at, unread_for_admin)
    VALUES (?, 0, 0, ?, ?, 1)
    ON CONFLICT(student_uid) DO UPDATE SET
      last_student_message_at = excluded.last_student_message_at,
      last_activity_at = excluded.last_activity_at,
      unread_for_admin = conversation_states.unread_for_admin + 1
  `).bind(studentUid, now, now).run();
}
// ===================== تنظيف السجلات الأقدم من 90 يومًا =====================
async function cleanupOldLogs(db) {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const res = await db.prepare('DELETE FROM chat_logs WHERE created_at < ?').bind(ninetyDaysAgo).run();
    return res.meta?.changes || 0;
}

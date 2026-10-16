import { norm } from './rag';

// ===================== الإعدادات Settings =====================
let isolateSettingsCache: { settings: Record<string, string>; expiresAt: number } | null = null;
const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000;

export async function getAllSettings(db: D1Database): Promise<Record<string, string>> {
  const now = Date.now();
  if (isolateSettingsCache && isolateSettingsCache.expiresAt > now) {
    return isolateSettingsCache.settings;
  }

  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  const map: Record<string, string> = {};
  for (const r of results || []) {
    map[(r as any).key] = (r as any).value;
  }

  isolateSettingsCache = {
    settings: map,
    expiresAt: now + SETTINGS_CACHE_TTL_MS
  };

  return map;
}

export async function getSetting(db: D1Database, key: string, defaultValue = ''): Promise<string> {
  const all = await getAllSettings(db);
  return all[key] !== undefined ? all[key] : defaultValue;
}

export async function setSetting(db: D1Database, key: string, value: string, description = ''): Promise<void> {
  const now = Date.now();
  await db.prepare(
    'INSERT INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, description = ?, updated_at = ?'
  ).bind(key, value, description, now, value, description, now).run();

  isolateSettingsCache = null; // Clear cache
}

// ===================== الحدود اليومية Rate Limiting =====================
export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  reason?: 'student_limit' | 'global_cap' | 'bot_disabled';
}

export async function checkAndIncrementUsage(
  db: D1Database,
  studentUid: string
): Promise<RateLimitCheck> {
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
  const { results } = await db.prepare(
    'SELECT id, count FROM usage_daily WHERE id IN (?, ?)'
  ).bind(studentUsageId, globalUsageId).all();

  let studentCount = 0;
  let globalCount = 0;

  for (const r of results || []) {
    if ((r as any).id === studentUsageId) studentCount = (r as any).count || 0;
    if ((r as any).id === globalUsageId) globalCount = (r as any).count || 0;
  }

  if (globalCount >= globalDailyCap) {
    return { allowed: false, remaining: 0, reason: 'global_cap' };
  }

  if (studentCount >= studentDailyLimit) {
    return { allowed: false, remaining: 0, reason: 'student_limit' };
  }

  // زيادة العداد للطالب وللعالمي
  await db.batch([
    db.prepare(
      'INSERT INTO usage_daily (id, date_key, user_uid, count) VALUES (?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET count = count + 1'
    ).bind(studentUsageId, dateKey, studentUid),
    db.prepare(
      'INSERT INTO usage_daily (id, date_key, user_uid, count) VALUES (?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET count = count + 1'
    ).bind(globalUsageId, dateKey, 'GLOBAL')
  ]);

  return {
    allowed: true,
    remaining: Math.max(0, studentDailyLimit - (studentCount + 1))
  };
}

// ===================== كاش الإجابات Answer Cache =====================
async function hashText(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isPersonalizedQuestion(msg: string): boolean {
  const normMsg = norm(msg);
  const pWords = ['اسمي', 'كورساتي', 'بياناتي', 'ايميلي', 'تليفوني', 'رقمي', 'حسابي', 'درجتي', 'امتحاني', 'امتحان'];
  return pWords.some(w => normMsg.includes(w));
}

export async function getAnswerFromCache(db: D1Database, question: string): Promise<string | null> {
  if (isPersonalizedQuestion(question)) return null;

  const questionNorm = norm(question);
  const hash = await hashText(questionNorm);
  const now = Date.now();

  const row = await db.prepare(
    'SELECT answer FROM answer_cache WHERE question_hash = ? AND expires_at > ?'
  ).bind(hash, now).first();

  return row ? (row as any).answer : null;
}


// ===================== الإجابات المعتمدة من الأدمن Learned Answers =====================
export async function findLearnedAnswer(db: D1Database, question: string): Promise<string | null> {
  const qNorm = norm(question);
  if (!qNorm) return null;

  // فحص التطابق التام أو القريب
  const row = await db.prepare(
    'SELECT answer FROM learned_answers WHERE question_norm = ?'
  ).bind(qNorm).first();

  if (row) return (row as any).answer;

  // فحص يحتوي بشرط الترتيب وحد أقصى 200 وحد أدنى 8 أحرف لكل من النصين لمنع التطابق الخاطئ
  const { results } = await db.prepare(
    'SELECT question_norm, answer FROM learned_answers ORDER BY updated_at DESC LIMIT 200'
  ).all();

  for (const r of results || []) {
    const target = (r as any).question_norm;
    if (!target) continue;

    // تطابق تام
    if (qNorm === target) {
      return (r as any).answer;
    }

    // تطابق جزئي بشرط أن يكون كلا النصين 8 أحرف على الأقل
    if (qNorm.length >= 8 && target.length >= 8) {
      if (qNorm.includes(target) || target.includes(qNorm)) {
        return (r as any).answer;
      }
    }
  }

  return null;
}

// ===================== تسجيل المحادثات (بدون أي هواتف أو إيميلات) =====================
export async function logChat(
  db: D1Database,
  studentUid: string,
  userMessage: string,
  botReply: string,
  source: string,
  cpuMs: number
): Promise<string> {
  const logId = crypto.randomUUID();
  const now = Date.now();

  await db.prepare(
    'INSERT INTO chat_logs (id, student_uid, user_message, bot_reply, source, cpu_ms, rating, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)'
  ).bind(logId, studentUid, userMessage, botReply, source, cpuMs, now).run();

  return logId;
}

export async function getChatLog(
  db: D1Database,
  logId: string
): Promise<{ id: string; student_uid: string; rating: number | null } | null> {
  const row = await db.prepare(
    'SELECT id, student_uid, rating FROM chat_logs WHERE id = ?'
  ).bind(logId).first();
  return (row as any) || null;
}

export async function setLogRating(db: D1Database, logId: string, rating: number): Promise<boolean> {
  const res = await db.prepare(
    'UPDATE chat_logs SET rating = ? WHERE id = ?'
  ).bind(rating, logId).run();

  return res.success;
}

// ===================== حالة المحادثة وتدخل المعلم Conversation States =====================
export async function checkConversationState(
  db: D1Database,
  studentUid: string
): Promise<{ paused: boolean; adminActive: boolean }> {
  const row = await db.prepare(
    'SELECT bot_paused, admin_active, last_admin_message_at, last_activity_at FROM conversation_states WHERE student_uid = ?'
  ).bind(studentUid).first();

  if (!row) {
    return { paused: false, adminActive: false };
  }

  const isPaused = (row as any).bot_paused === 1;
  if (!isPaused) {
    return { paused: false, adminActive: (row as any).admin_active === 1 };
  }

  // فحص الاستئناف التلقائي إذا مضت المدة المحددة (افتراضي 30 دقيقة)
  const autoResumeMinutes = parseInt(await getSetting(db, 'teacher_auto_resume_minutes', '30'), 10);
  const autoResumeMs = autoResumeMinutes * 60 * 1000;
  const timeoutBase = (row as any).last_admin_message_at || 0;

  if (timeoutBase > 0 && Date.now() - timeoutBase > autoResumeMs) {
    // استئناف تلقائي بعد انقضاء مهلة تدخل المعلم
    await db.prepare(
      'UPDATE conversation_states SET bot_paused = 0, admin_active = 0 WHERE student_uid = ?'
    ).bind(studentUid).run();
    return { paused: false, adminActive: false };
  }

  return { paused: true, adminActive: (row as any).admin_active === 1 };
}

export async function recordStudentMessageInState(db: D1Database, studentUid: string): Promise<void> {
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
export async function cleanupOldLogs(db: D1Database): Promise<number> {
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const res = await db.prepare(
    'DELETE FROM chat_logs WHERE created_at < ?'
  ).bind(ninetyDaysAgo).run();

  return res.meta?.changes || 0;
}


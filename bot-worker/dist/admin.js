"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAdminRoute = handleAdminRoute;
const db_1 = require("./db");
const rag_1 = require("./rag");
const MAX_LESSON_CONTENT_LENGTH = 50_000;
const MAX_TEACHER_REPLY_LENGTH = 1_000;
// قائمة بيضاء بالمفاتيح المسموح تعديلها في جدول settings مع شروط التحقق من القيم
const ALLOWED_SETTINGS = {
    enabled: {
        validate: (v) => v === 'true' || v === 'false',
        errorMsg: 'قيمة enabled يجب أن تكون true أو false فقط.',
    },
    daily_student_limit: {
        validate: (v) => {
            const n = Number(v);
            return Number.isInteger(n) && n > 0 && n <= 500;
        },
        errorMsg: 'الحد اليومي للطالب يجب أن يكون رقماً صحيحاً موجباً بين 1 و500.',
    },
    global_daily_cap: {
        validate: (v) => {
            const n = Number(v);
            return Number.isInteger(n) && n > 0 && n <= 50000;
        },
        errorMsg: 'السقف اليومي الإجمالي يجب أن يكون رقماً صحيحاً موجباً بين 1 و50000.',
    },
    teacher_auto_resume_minutes: {
        validate: (v) => {
            const n = Number(v);
            return Number.isInteger(n) && n >= 5 && n <= 1440;
        },
        errorMsg: 'وقت استئناف البوت التلقائي يجب أن يكون رقماً بين 5 دقائق و1440 دقيقة.',
    },
    schedule_prep: {
        validate: (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 500,
        errorMsg: 'نص مواعيد الإعدادي لا يمكن أن يكون فارغاً أو يتجاوز 500 حرف.',
    },
    schedule_sec: {
        validate: (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 500,
        errorMsg: 'نص مواعيد الثانوي لا يمكن أن يكون فارغاً أو يتجاوز 500 حرف.',
    },
    unsupported_subject_reply: {
        validate: (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 500,
        errorMsg: 'نص الرد على المواد غير المدعومة لا يمكن أن يكون فارغاً أو يتجاوز 500 حرف.',
    },
};
async function parseJsonBody(request) {
    try {
        const data = await request.json();
        return { data };
    }
    catch {
        return {
            error: Response.json({ error: 'بيانات الطلب غير صالحة (JSON غير صحيح).' }, { status: 400 }),
        };
    }
}
async function handleAdminRoute(request, url, env) {
    const method = request.method;
    const path = url.pathname;
    // 1. GET /admin/logs
    if (method === 'GET' && path === '/admin/logs') {
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const ratingFilter = url.searchParams.get('rating');
        let ratingNum = null;
        if (ratingFilter !== null && ratingFilter !== undefined && ratingFilter !== '') {
            const parsed = parseInt(ratingFilter, 10);
            if (isNaN(parsed) || (parsed !== 1 && parsed !== -1)) {
                return Response.json({ error: 'قيمة التقييم غير صالحة، يجب أن تكون 1 أو -1.' }, { status: 400 });
            }
            ratingNum = parsed;
        }
        let query = 'SELECT id, student_uid, user_message, bot_reply, source, cpu_ms, rating, created_at FROM chat_logs';
        let countQuery = 'SELECT COUNT(*) as total FROM chat_logs';
        const params = [];
        const countParams = [];
        if (ratingNum !== null) {
            query += ' WHERE rating = ?';
            countQuery += ' WHERE rating = ?';
            params.push(ratingNum);
            countParams.push(ratingNum);
        }
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const { results } = await env.DB.prepare(query).bind(...params).all();
        const countRow = await env.DB.prepare(countQuery).bind(...countParams).first();
        const total = countRow?.total || 0;
        return Response.json({ logs: results || [], total });
    }
    // 2. GET /admin/settings
    if (method === 'GET' && path === '/admin/settings') {
        const settings = await (0, db_1.getAllSettings)(env.DB);
        return Response.json({ settings });
    }
    // 3. PUT /admin/settings
    if (method === 'PUT' && path === '/admin/settings') {
        const parsed = await parseJsonBody(request);
        if (parsed.error)
            return parsed.error;
        const body = parsed.data;
        const toUpdate = [];
        if (body.settings && typeof body.settings === 'object') {
            for (const [k, v] of Object.entries(body.settings)) {
                toUpdate.push({ key: k, value: String(v) });
            }
        }
        else if (body.key && body.value !== undefined) {
            toUpdate.push({ key: body.key, value: String(body.value), description: body.description });
        }
        else {
            return Response.json({ error: 'بيانات الإعدادات غير صالحة.' }, { status: 400 });
        }
        // التحقق من القائمة البيضاء والحدود لكل مفتاح
        for (const item of toUpdate) {
            const rule = ALLOWED_SETTINGS[item.key];
            if (!rule) {
                return Response.json({ error: `المفتاح (${item.key}) غير مصرح بتعديله.` }, { status: 400 });
            }
            if (!rule.validate(item.value)) {
                return Response.json({ error: rule.errorMsg }, { status: 400 });
            }
        }
        for (const item of toUpdate) {
            await (0, db_1.setSetting)(env.DB, item.key, item.value, item.description || '');
        }
        return Response.json({ success: true });
    }
    // 4. GET /admin/stats (إحصائيات البوت للمالك)
    if (method === 'GET' && path === '/admin/stats') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startOfDayMs = startOfDay.getTime();
        const [todayCountRow, todayStudentsRow, totalRow, thumbsUpRow, thumbsDownRow, avgCpuRow, pausedRow] = await Promise.all([
            env.DB.prepare('SELECT COUNT(*) as c FROM chat_logs WHERE created_at >= ?')
                .bind(startOfDayMs)
                .first(),
            env.DB.prepare('SELECT COUNT(DISTINCT student_uid) as c FROM chat_logs WHERE created_at >= ?')
                .bind(startOfDayMs)
                .first(),
            env.DB.prepare('SELECT COUNT(*) as c FROM chat_logs').first(),
            env.DB.prepare('SELECT COUNT(*) as c FROM chat_logs WHERE rating = 1').first(),
            env.DB.prepare('SELECT COUNT(*) as c FROM chat_logs WHERE rating = -1').first(),
            env.DB.prepare('SELECT AVG(cpu_ms) as c FROM chat_logs WHERE cpu_ms IS NOT NULL').first(),
            env.DB.prepare('SELECT COUNT(*) as c FROM conversation_states WHERE bot_paused = 1').first(),
        ]);
        return Response.json({
            todayMessages: todayCountRow?.c || 0,
            todayStudents: todayStudentsRow?.c || 0,
            totalMessages: totalRow?.c || 0,
            thumbsUp: thumbsUpRow?.c || 0,
            thumbsDown: thumbsDownRow?.c || 0,
            avgCpuMs: Math.round((avgCpuRow?.c || 0) * 100) / 100,
            pausedConversations: pausedRow?.c || 0,
        });
    }
    // 5. GET /admin/conversations (قائمة المحادثات المباشرة للمراقبة والرد)
    if (method === 'GET' && path === '/admin/conversations') {
        const { results } = await env.DB.prepare(`
      SELECT
        c.student_uid,
        c.bot_paused,
        c.admin_active,
        c.last_student_message_at,
        c.last_admin_message_at,
        c.last_activity_at,
        c.unread_for_admin,
        (SELECT user_message FROM chat_logs WHERE student_uid = c.student_uid AND user_message != '' ORDER BY created_at DESC LIMIT 1) as last_user_message,
        (SELECT bot_reply FROM chat_logs WHERE student_uid = c.student_uid ORDER BY created_at DESC LIMIT 1) as last_bot_reply,
        (SELECT source FROM chat_logs WHERE student_uid = c.student_uid ORDER BY created_at DESC LIMIT 1) as last_source
      FROM conversation_states c
      ORDER BY c.last_activity_at DESC
      LIMIT 50
    `).all();
        return Response.json({ conversations: results || [] });
    }
    // 6. GET /admin/conversations/:uid/messages (قراءة صامتة لرسائل المحادثة)
    if (method === 'GET' && path.match(/^\/admin\/conversations\/[^/]+\/messages$/)) {
        const parts = path.split('/');
        const uid = parts[3];
        const { results } = await env.DB.prepare('SELECT id, student_uid, user_message, bot_reply, source, cpu_ms, rating, created_at FROM chat_logs WHERE student_uid = ? ORDER BY created_at ASC LIMIT 100').bind(uid).all();
        const stateRow = await env.DB.prepare('SELECT bot_paused, admin_active, last_activity_at, unread_for_admin FROM conversation_states WHERE student_uid = ?').bind(uid).first();
        return Response.json({
            messages: results || [],
            state: stateRow || { bot_paused: 0, admin_active: 0, unread_for_admin: 0 },
        });
    }
    // 7. POST /admin/conversations/:uid/pause (إيقاف البوت لرد المعلم)
    if (method === 'POST' && path.match(/^\/admin\/conversations\/[^/]+\/pause$/)) {
        const parts = path.split('/');
        const uid = parts[3];
        const now = Date.now();
        await env.DB.prepare(`
      INSERT INTO conversation_states (student_uid, bot_paused, admin_active, last_admin_message_at, last_activity_at, unread_for_admin)
      VALUES (?, 1, 1, ?, ?, 0)
      ON CONFLICT(student_uid) DO UPDATE SET
        bot_paused = 1,
        admin_active = 1,
        last_admin_message_at = excluded.last_admin_message_at,
        last_activity_at = excluded.last_activity_at,
        unread_for_admin = 0
    `).bind(uid, now, now).run();
        return Response.json({ success: true, bot_paused: true });
    }
    // 8. POST /admin/conversations/:uid/resume (إرجاع البوت)
    if (method === 'POST' && path.match(/^\/admin\/conversations\/[^/]+\/resume$/)) {
        const parts = path.split('/');
        const uid = parts[3];
        const now = Date.now();
        await env.DB.prepare(`
      INSERT INTO conversation_states (student_uid, bot_paused, admin_active, last_activity_at, unread_for_admin)
      VALUES (?, 0, 0, ?, 0)
      ON CONFLICT(student_uid) DO UPDATE SET
        bot_paused = 0,
        admin_active = 0,
        last_activity_at = excluded.last_activity_at,
        unread_for_admin = 0
    `).bind(uid, now).run();
        return Response.json({ success: true, bot_paused: false });
    }
    // 9. POST /admin/conversations/:uid/reply (إرسال رد المعلم المباشر)
    if (method === 'POST' && path.match(/^\/admin\/conversations\/[^/]+\/reply$/)) {
        const parts = path.split('/');
        const uid = parts[3];
        const parsed = await parseJsonBody(request);
        if (parsed.error)
            return parsed.error;
        const body = parsed.data;
        const rawReply = typeof body.reply === 'string' ? body.reply.trim() : '';
        if (!rawReply) {
            return Response.json({ error: 'نص رد المعلم لا يمكن أن يكون فارغاً.' }, { status: 400 });
        }
        if (rawReply.length > MAX_TEACHER_REPLY_LENGTH) {
            return Response.json({ error: `رد المعلم يتجاوز الحد الأقصى المسموح (${MAX_TEACHER_REPLY_LENGTH} حرف).` }, { status: 400 });
        }
        // تعقيم النص وحذف أي وسوم HTML لضمان الأمان
        const sanitizedReply = rawReply.replace(/<[^>]*>/g, '');
        const logId = 'teacher_' + crypto.randomUUID();
        const now = Date.now();
        // إدراج رد المعلم في chat_logs بـ source='teacher' و user_message=''
        await env.DB.prepare('INSERT INTO chat_logs (id, student_uid, user_message, bot_reply, source, cpu_ms, rating, created_at) VALUES (?, ?, ?, ?, ?, 0, NULL, ?)').bind(logId, uid, '', sanitizedReply, 'teacher', now).run();
        // تحديث حالة المحادثة
        await env.DB.prepare(`
      INSERT INTO conversation_states (student_uid, bot_paused, admin_active, last_admin_message_at, last_activity_at, unread_for_admin)
      VALUES (?, 1, 1, ?, ?, 0)
      ON CONFLICT(student_uid) DO UPDATE SET
        bot_paused = 1,
        admin_active = 1,
        last_admin_message_at = excluded.last_admin_message_at,
        last_activity_at = excluded.last_activity_at,
        unread_for_admin = 0
    `).bind(uid, now, now).run();
        return Response.json({ success: true, logId });
    }
    // 10. GET /admin/feedback/negative (قائمة الردود التي قيّمها الطلاب بـ 👎 للمراجعة)
    if (method === 'GET' && path === '/admin/feedback/negative') {
        const { results } = await env.DB.prepare('SELECT id, student_uid, user_message, bot_reply, source, cpu_ms, created_at FROM chat_logs WHERE rating = -1 ORDER BY created_at DESC LIMIT 50').all();
        return Response.json({ negativeFeedback: results || [] });
    }
    // 11. GET /admin/self-learning (قائمة التعلم الذاتي المعلقة للمراجعة مع ترقيم وفلاتر)
    if (method === 'GET' && path === '/admin/self-learning') {
        const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '15', 10), 1), 100);
        const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
        const status = url.searchParams.get('status') || '';
        const grade = url.searchParams.get('grade') || '';
        const conditions = [];
        const bindings = [];
        if (status && status !== 'all') {
            conditions.push('status = ?');
            bindings.push(status);
        }
        if (grade && grade !== 'all') {
            conditions.push('grade = ?');
            bindings.push(grade);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const countRow = await env.DB.prepare(`SELECT COUNT(*) as c FROM self_learning_pending ${whereClause}`).bind(...bindings).first();
        const total = countRow?.c || 0;
        const { results } = await env.DB.prepare(`SELECT id, text, keywords, grade, unit, subject, status, created_at FROM self_learning_pending ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...bindings, limit, offset).all();
        const { results: gradeRows } = await env.DB.prepare("SELECT DISTINCT grade FROM self_learning_pending WHERE grade IS NOT NULL AND grade != ''").all();
        const grades = (gradeRows || []).map((r) => r.grade).filter(Boolean);
        return Response.json({
            items: results || [],
            total,
            limit,
            offset,
            grades,
        });
    }
    // 12. POST /admin/self-learning/:id/approve (اعتماد سؤال تعلم ذاتي مع إجابته)
    if (method === 'POST' && path.match(/^\/admin\/self-learning\/[^/]+\/approve$/)) {
        const parts = path.split('/');
        const itemId = parts[3];
        const parsed = await parseJsonBody(request);
        if (parsed.error)
            return parsed.error;
        const { answer } = parsed.data;
        // اشتراط إجابة غير فارغة بحد 2000 حرف
        if (!answer || typeof answer !== 'string' || !answer.trim()) {
            return Response.json({ error: 'يجب كتابة إجابة نموذجية لاعتماد السؤال.' }, { status: 400 });
        }
        const trimmedAnswer = answer.trim();
        if (trimmedAnswer.length > 2000) {
            return Response.json({ error: 'نص الإجابة يتجاوز الحد الأقصى المسموح (2000 حرف).' }, { status: 400 });
        }
        const row = await env.DB.prepare('SELECT id, text, grade, unit, subject, status FROM self_learning_pending WHERE id = ?').bind(itemId).first();
        if (!row) {
            return Response.json({ error: 'العنصر المطلوب غير موجود.' }, { status: 404 });
        }
        // رفض العنصر غير pending بـ 409
        if (row.status !== 'pending') {
            return Response.json({ error: 'هذا العنصر تمت مراجعته مسبقًا وليس قيد الانتظار.' }, { status: 409 });
        }
        const now = Date.now();
        await env.DB.prepare('UPDATE self_learning_pending SET status = ? WHERE id = ?')
            .bind('approved', itemId)
            .run();
        // منع التكرار في learned_answers
        const qNorm = (0, rag_1.norm)(row.text);
        const existing = await env.DB.prepare('SELECT id FROM learned_answers WHERE question_norm = ?').bind(qNorm).first();
        if (existing) {
            await env.DB.prepare('UPDATE learned_answers SET answer = ?, updated_at = ? WHERE id = ?').bind(trimmedAnswer, now, existing.id).run();
        }
        else {
            const learnedId = crypto.randomUUID();
            await env.DB.prepare('INSERT INTO learned_answers (id, question, question_norm, answer, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(learnedId, row.text.trim(), qNorm, trimmedAnswer, now, now).run();
        }
        return Response.json({ success: true });
    }
    // 13. POST /admin/self-learning/:id/reject (رفض عنصر تعلم ذاتي)
    if (method === 'POST' && path.match(/^\/admin\/self-learning\/[^/]+\/reject$/)) {
        const parts = path.split('/');
        const itemId = parts[3];
        await env.DB.prepare('UPDATE self_learning_pending SET status = ? WHERE id = ?')
            .bind('rejected', itemId)
            .run();
        return Response.json({ success: true });
    }
    // 14. GET /admin/lessons
    if (method === 'GET' && path === '/admin/lessons') {
        const { results } = await env.DB.prepare('SELECT l.id, l.title, l.subject, l.grade, l.unit, l.archived, l.created_at, COUNT(c.id) as chunks_count FROM lessons l LEFT JOIN lesson_chunks c ON l.id = c.lesson_id GROUP BY l.id ORDER BY l.created_at DESC').all();
        return Response.json({ lessons: results || [] });
    }
    // 15. POST /admin/lessons
    if (method === 'POST' && path === '/admin/lessons') {
        const parsed = await parseJsonBody(request);
        if (parsed.error)
            return parsed.error;
        const body = parsed.data;
        const { title, subject, grade, unit, content } = body;
        if (!title || !content) {
            return Response.json({ error: 'عنوان الدرس ومحتواه مطلوبان.' }, { status: 400 });
        }
        if (typeof content === 'string' && content.length > MAX_LESSON_CONTENT_LENGTH) {
            return Response.json({ error: `محتوى الدرس يتجاوز الحد الأقصى المسموح (${MAX_LESSON_CONTENT_LENGTH} حرف).` }, { status: 400 });
        }
        const lessonId = crypto.randomUUID();
        const now = Date.now();
        await env.DB.prepare('INSERT INTO lessons (id, title, subject, grade, unit, archived, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)').bind(lessonId, title, subject || 'دراسات اجتماعية', grade || '', unit || '', now).run();
        // تقطيع المحتوى إلى مقاطع وتخزين الكلمات المفتاحية
        const rawChunks = (0, rag_1.chunkLesson)(content);
        const statements = [];
        for (let i = 0; i < rawChunks.length; i++) {
            const chunkText = rawChunks[i];
            const chunkId = `${lessonId}_chunk_${i + 1}`;
            const kw = (0, rag_1.keywords)(chunkText);
            statements.push(env.DB.prepare('INSERT INTO lesson_chunks (id, lesson_id, text, keywords, grade, unit, subject, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(chunkId, lessonId, chunkText, JSON.stringify(kw), grade || '', unit || '', subject || 'دراسات اجتماعية', now));
        }
        if (statements.length > 0) {
            await env.DB.batch(statements);
        }
        (0, rag_1.invalidateChunksCache)();
        return Response.json({
            success: true,
            lessonId,
            chunksCreated: rawChunks.length,
        });
    }
    // 16. PUT /admin/lessons/:id/archive (الأرشفة بدل الحذف)
    if (method === 'PUT' && path.match(/^\/admin\/lessons\/[^/]+\/archive$/)) {
        const parts = path.split('/');
        const lessonId = parts[3];
        const parsed = await parseJsonBody(request);
        const body = parsed.data || {};
        const archivedVal = body.archived !== undefined ? (body.archived ? 1 : 0) : 1;
        await env.DB.prepare('UPDATE lessons SET archived = ? WHERE id = ?')
            .bind(archivedVal, lessonId)
            .run();
        (0, rag_1.invalidateChunksCache)();
        return Response.json({ success: true, lessonId, archived: archivedVal === 1 });
    }
    // 17. GET /admin/learned
    if (method === 'GET' && path === '/admin/learned') {
        const { results } = await env.DB.prepare('SELECT id, question, question_norm, answer, created_at, updated_at FROM learned_answers ORDER BY updated_at DESC').all();
        return Response.json({ learned: results || [] });
    }
    // 18. POST /admin/learned
    if (method === 'POST' && path === '/admin/learned') {
        const parsed = await parseJsonBody(request);
        if (parsed.error)
            return parsed.error;
        const body = parsed.data;
        const { question, answer } = body;
        if (!question || !answer) {
            return Response.json({ error: 'السؤال والإجابة مطلوبان.' }, { status: 400 });
        }
        const id = crypto.randomUUID();
        const qNorm = (0, rag_1.norm)(question);
        const now = Date.now();
        await env.DB.prepare('INSERT INTO learned_answers (id, question, question_norm, answer, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, question.trim(), qNorm, answer.trim(), now, now).run();
        return Response.json({ success: true, id });
    }
    return Response.json({ error: 'المسار أو الصفحة غير موجودة.' }, { status: 404 });
}

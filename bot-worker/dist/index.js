"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("./auth");
const intents_1 = require("./intents");
const rag_1 = require("./rag");
const prompts_1 = require("./prompts");
const llm_1 = require("./llm");
const db_1 = require("./db");
const admin_1 = require("./admin");
function getCorsHeaders(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowlist = (env.CORS_ORIGIN || 'http://localhost:5173,https://youssef-barakat.web.app,https://youssefbarakat.com')
        .split(',')
        .map(s => s.trim().toLowerCase());
    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-device-id',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
    const isAllowed = allowlist.includes(origin.toLowerCase()) ||
        origin.endsWith('.youssefbarakat.pages.dev') ||
        origin === 'https://youssefbarakat.pages.dev';
    if (origin && isAllowed) {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    return headers;
}
function isGreeting(msg) {
    const clean = msg.trim().replace(/[؟?!.،,]/g, '').trim();
    if (!clean)
        return true;
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length > 5)
        return false;
    const greetings = [
        'سلام', 'السلام', 'عليكم', 'وعليكم', 'ورحمة', 'ورحمه', 'وبركاته', 'مرحبا', 'مرحباً', 'اهلا', 'أهلا', 'أهلاً',
        'صباح', 'الخير', 'مساء', 'النور', 'ازيك', 'إزيك', 'عامل', 'ايه', 'إيه',
        'شكرا', 'شكراً', 'تمام', 'تسلم', 'جزاك', 'الله', 'خيرا', 'خيراً',
        'هلا', 'يا', 'مستر', 'استاذ', 'أستاذ', 'بوصلة', 'البوصلة', 'باي', 'مع', 'السلامة', 'عفوا', 'عفواً'
    ];
    return words.every(w => greetings.some(g => w === g || w.includes(g)));
}
exports.default = {
    async fetch(request, env, ctx) {
        const startTime = performance.now();
        const url = new URL(request.url);
        const corsHeaders = getCorsHeaders(request, env);
        // 1. CORS Preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }
        try {
            // 2. GET /health (فحص الحالة بدون كشف أي مفتاح)
            if (request.method === 'GET' && url.pathname === '/health') {
                return Response.json({
                    status: 'ok',
                    service: 'bousala-bot-worker',
                    groqConfigured: !!env.GROQ_API_KEY,
                    geminiConfigured: !!env.GEMINI_API_KEY,
                    timestamp: new Date().toISOString()
                }, { headers: corsHeaders });
            }
            // 3. مسارات الأدمن /admin/*
            if (url.pathname.startsWith('/admin')) {
                const authHeader = request.headers.get('Authorization') || '';
                const token = authHeader.replace(/^Bearer\s+/i, '').trim();
                if (!token) {
                    return Response.json({ error: 'Missing Authorization token' }, { status: 401, headers: corsHeaders });
                }
                let email = '';
                try {
                    const verified = await (0, auth_1.verifyFirebaseToken)(token, env);
                    email = verified.email || '';
                    await (0, auth_1.verifyAdmin)(email, token, env);
                }
                catch (e) {
                    const isAccessDenied = e?.message?.includes('Access denied') || e?.message?.includes('Assistant');
                    const status = isAccessDenied ? 403 : 401;
                    const safeMsg = isAccessDenied
                        ? 'غير مصرح لك بالوصول إلى لوحة إدارة البوصلة.'
                        : 'تعذر التحقق من صلاحيات الدخول، يُرجى تسجيل الدخول مجددًا.';
                    return Response.json({ error: safeMsg }, { status, headers: corsHeaders });
                }
                const adminRes = await (0, admin_1.handleAdminRoute)(request, url, env);
                const headers = new Headers(adminRes.headers);
                for (const [k, v] of Object.entries(corsHeaders)) {
                    headers.set(k, v);
                }
                return new Response(adminRes.body, {
                    status: adminRes.status,
                    headers
                });
            }
            // 4. GET /usage (فحص رصيد التوكنز وحالة المحادثة)
            if (request.method === 'GET' && url.pathname === '/usage') {
                const authHeader = request.headers.get('Authorization') || '';
                const token = authHeader.replace(/^Bearer\s+/i, '').trim();
                let userKey = '';
                let studentName = 'زائر';
                let tier = 'visitor';
                if (token) {
                    const { uid } = await (0, auth_1.verifyFirebaseToken)(token, env);
                    const student = await (0, auth_1.fetchStudentProfile)(uid, token, env);
                    userKey = student.uid;
                    studentName = student.name;
                    const activeCourses = Array.isArray(student.courses) ? student.courses.filter(Boolean) : [];
                    tier = activeCourses.length > 0 ? 'subscribed' : 'free';
                }
                else {
                    userKey = await (0, auth_1.computeVisitorKey)(request);
                    tier = 'visitor';
                }
                const budget = await (0, db_1.checkTokenBudget)(env.DB, userKey, tier);
                const convState = token ? await (0, db_1.checkConversationState)(env.DB, userKey) : { paused: false };
                return Response.json({
                    studentName,
                    tier,
                    usedTokens: budget.usedTokens,
                    limitTokens: budget.limit,
                    remainingTokens: budget.remainingTokens,
                    remaining: budget.remainingTokens,
                    limit: budget.limit,
                    paused: convState.paused
                }, { headers: corsHeaders });
            }
            // 5. POST /feedback (تقييم رد البوت مع التحقق من الهوية والملكية)
            if (request.method === 'POST' && url.pathname === '/feedback') {
                const authHeader = request.headers.get('Authorization') || '';
                const token = authHeader.replace(/^Bearer\s+/i, '').trim();
                if (!token) {
                    return Response.json({ error: 'Missing Authorization token' }, { status: 401, headers: corsHeaders });
                }
                let uid = '';
                try {
                    const verified = await (0, auth_1.verifyFirebaseToken)(token, env);
                    uid = verified.uid;
                }
                catch {
                    return Response.json({ error: 'Unauthorized token' }, { status: 401, headers: corsHeaders });
                }
                const body = await request.json().catch(() => ({}));
                const { logId, rating } = body;
                if (!logId || typeof rating !== 'number' || (rating !== 1 && rating !== -1)) {
                    return Response.json({ error: 'بيانات التقييم غير صالحة.' }, { status: 400, headers: corsHeaders });
                }
                const chatLog = await (0, db_1.getChatLog)(env.DB, logId);
                if (!chatLog) {
                    return Response.json({ error: 'سجل المحادثة غير موجود.' }, { status: 404, headers: corsHeaders });
                }
                if (chatLog.student_uid !== uid) {
                    return Response.json({ error: 'غير مصرح لك بتقييم محادثة طالب آخر.' }, { status: 403, headers: corsHeaders });
                }
                await (0, db_1.setLogRating)(env.DB, logId, rating);
                return Response.json({ success: true }, { headers: corsHeaders });
            }
            // 6. GET /chat/updates (استطلاع الطالب لردود المعلم الحية أثناء التوقف)
            if (request.method === 'GET' && url.pathname === '/chat/updates') {
                const authHeader = request.headers.get('Authorization') || '';
                const token = authHeader.replace(/^Bearer\s+/i, '').trim();
                if (!token) {
                    return Response.json({ error: 'Missing Authorization token' }, { status: 401, headers: corsHeaders });
                }
                let uid = '';
                try {
                    const verified = await (0, auth_1.verifyFirebaseToken)(token, env);
                    uid = verified.uid;
                }
                catch {
                    return Response.json({ error: 'Unauthorized token' }, { status: 401, headers: corsHeaders });
                }
                const sinceParam = url.searchParams.get('since');
                const sinceTime = sinceParam ? parseInt(sinceParam, 10) : 0;
                const validSince = isNaN(sinceTime) ? 0 : sinceTime;
                const convState = await (0, db_1.checkConversationState)(env.DB, uid);
                const { results } = await env.DB.prepare('SELECT id, user_message, bot_reply, source, created_at FROM chat_logs WHERE student_uid = ? AND created_at > ? AND source = ? ORDER BY created_at ASC').bind(uid, validSince, 'teacher').all();
                return Response.json({
                    paused: convState.paused,
                    messages: (results || []).map((r) => ({
                        id: r.id,
                        reply: r.bot_reply,
                        source: r.source,
                        createdAt: r.created_at
                    }))
                }, { headers: corsHeaders });
            }
            // 7. POST /chat (المسار الرئيسي للمحادثة)
            if (request.method === 'POST' && url.pathname === '/chat') {
                const authHeader = request.headers.get('Authorization') || '';
                const token = authHeader.replace(/^Bearer\s+/i, '').trim();
                let studentUid = '';
                let studentProfile;
                let tier = 'visitor';
                if (token) {
                    try {
                        const verified = await (0, auth_1.verifyFirebaseToken)(token, env);
                        studentUid = verified.uid;
                        studentProfile = await (0, auth_1.fetchStudentProfile)(studentUid, token, env);
                        const activeCourses = Array.isArray(studentProfile.courses) ? studentProfile.courses.filter(Boolean) : [];
                        tier = activeCourses.length > 0 ? 'subscribed' : 'free';
                    }
                    catch (e) {
                        const isArchived = e?.message?.includes('archived');
                        const isExpired = e?.message?.includes('expired');
                        const status = isArchived ? 403 : 401;
                        const userMsg = isArchived
                            ? 'تم إيقاف حسابك مؤقتاً، يرجى التواصل مع إدارة المنصة.'
                            : (isExpired
                                ? 'انتهت صلاحية الجلسة، يُرجى تسجيل الدخول مجدداً.'
                                : 'تعذر التحقق من بيانات تسجيل الدخول، يُرجى إعادة تسجيل الدخول.');
                        return Response.json({ error: userMsg }, { status, headers: corsHeaders });
                    }
                }
                else {
                    // وضع الزائر (بدون إجبار على التسجيل، مع هوية مشفرة بملح سري)
                    studentUid = await (0, auth_1.computeVisitorKey)(request);
                    tier = 'visitor';
                    studentProfile = {
                        uid: studentUid,
                        name: 'زائر',
                        firstName: 'يا بطل',
                        grade: 'عام',
                        courses: [],
                        archived: false
                    };
                }
                // قراءة الـ body والتحقق من الشروط الصارمة
                const body = await request.json().catch(() => null);
                if (!body || typeof body.message !== 'string') {
                    return Response.json({ error: 'محتوى الرسالة غير صالح.' }, { status: 400, headers: corsHeaders });
                }
                const rawMessage = body.message.trim();
                if (!rawMessage) {
                    return Response.json({ error: 'الرسالة لا يمكن أن تكون فارغة.' }, { status: 400, headers: corsHeaders });
                }
                // شرط: الرسالة ≤ 500 حرف
                if (rawMessage.length > 500) {
                    return Response.json({ error: 'رسالتك أطول من الحد المسموح (500 حرف). اختصر سؤالك قليلًا.' }, { status: 400, headers: corsHeaders });
                }
                // شرط: فحص سجل المحادثة (history)
                if (body.history !== undefined) {
                    if (!Array.isArray(body.history)) {
                        return Response.json({ error: 'حقل history يجب أن يكون مصفوفة.' }, { status: 400, headers: corsHeaders });
                    }
                    if (body.history.length > 12) {
                        return Response.json({ error: 'عدد رسائل سجل المحادثة لا يمكن أن يتجاوز 12 رسالة.' }, { status: 400, headers: corsHeaders });
                    }
                    if (body.history.some((h) => h && h.role === 'system')) {
                        return Response.json({ error: 'غير مسموح بإرسال دور system في سجل المحادثة.' }, { status: 400, headers: corsHeaders });
                    }
                }
                const history = (Array.isArray(body.history) ? body.history : [])
                    .filter(h => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
                    .map(h => ({
                    role: h.role,
                    content: h.content.slice(0, 800)
                }));
                const examActive = Boolean(body.examActive);
                // (0) فحص حالة المحادثة وتدخل المعلم المباشر (bot_paused) - للطلاب المسجلين
                if (token) {
                    const convState = await (0, db_1.checkConversationState)(env.DB, studentProfile.uid);
                    if (convState.paused) {
                        const cpuMs = Math.round((performance.now() - startTime) * 100) / 100;
                        const pausedReply = 'لحظة، بنراجع سؤالك ونرد عليك';
                        const logId = await (0, db_1.logChat)(env.DB, studentProfile.uid, rawMessage, pausedReply, 'direct', cpuMs);
                        await (0, db_1.recordStudentMessageInState)(env.DB, studentProfile.uid);
                        const dateKey = new Date().toISOString().slice(0, 10);
                        const studentDailyLimit = parseInt(await (0, db_1.getSetting)(env.DB, 'daily_student_limit', '30'), 10);
                        const studentUsageId = `${dateKey}:${studentProfile.uid}`;
                        const usageRow = await env.DB.prepare('SELECT count FROM usage_daily WHERE id = ?').bind(studentUsageId).first();
                        const used = usageRow?.count || 0;
                        const remaining = Math.max(0, studentDailyLimit - used);
                        return Response.json({
                            reply: pausedReply,
                            source: 'direct',
                            remaining,
                            logId,
                            cpuMs,
                            paused: true
                        }, { headers: corsHeaders });
                    }
                }
                // (أ) فحص رصيد التوكنز داخل نافذة الـ 5 ساعات (قابلة للتعديل من الإعدادات)
                const tokenBudget = await (0, db_1.checkTokenBudget)(env.DB, studentProfile.uid, tier);
                if (!tokenBudget.allowed) {
                    if (tokenBudget.reason === 'bot_disabled') {
                        return Response.json({
                            error: 'البوصلة متوقفة حالياً لأعمال الصيانة، سنعود قريباً بإذن الله.'
                        }, { status: 503, headers: corsHeaders });
                    }
                    return Response.json({
                        error: 'استراحة قصيرة، ارجع بعد شوية'
                    }, { status: 429, headers: corsHeaders });
                }
                if (token) {
                    await (0, db_1.recordStudentMessageInState)(env.DB, studentProfile.uid);
                }
                // (ب) محرك النوايا Semantic Intents
                const intentMatch = await (0, intents_1.matchIntent)(env.DB, rawMessage);
                if (intentMatch && intentMatch.category === 'system_override') {
                    const cpuMs = Math.round((performance.now() - startTime) * 100) / 100;
                    const logId = await (0, db_1.logChat)(env.DB, studentProfile.uid, rawMessage, intentMatch.answer, 'system_override', cpuMs);
                    return Response.json({
                        reply: intentMatch.answer,
                        source: 'system_override',
                        remaining: tokenBudget.remainingTokens,
                        logId,
                        cpuMs
                    }, { headers: corsHeaders });
                }
                // (ج) فحص كاش الإجابات العامة
                const cachedAnswer = await (0, db_1.getAnswerFromCache)(env.DB, rawMessage);
                if (cachedAnswer) {
                    const cpuMs = Math.round((performance.now() - startTime) * 100) / 100;
                    const logId = await (0, db_1.logChat)(env.DB, studentProfile.uid, rawMessage, cachedAnswer, 'cache', cpuMs);
                    return Response.json({
                        reply: cachedAnswer,
                        source: 'cache',
                        remaining: tokenBudget.remainingTokens,
                        logId,
                        cpuMs
                    }, { headers: corsHeaders });
                }
                // (د) فحص الإجابات المعتمدة من الأدمن
                const learnedAnswer = await (0, db_1.findLearnedAnswer)(env.DB, rawMessage);
                // (هـ) استرجاع مقاطع الدروس من RAG (مع كاش isolate فائق السرعة)
                const ragResult = await (0, rag_1.findLessonContext)(env.DB, rawMessage, 3, studentProfile.grade);
                // (و) الردود التلقائية المجانية بصفر توكنز
                if (isGreeting(rawMessage)) {
                    const cpuMs = Math.round((performance.now() - startTime) * 100) / 100;
                    const helloReply = 'أهلاً بك يا بطل في منصة الأستاذ يوسف بركات! 🧭 أنا البوصلة، معاك لأي سؤال في منهج الدراسات الاجتماعية. تحب نراجع إيه النهاردة؟';
                    const logId = await (0, db_1.logChat)(env.DB, studentProfile.uid, rawMessage, helloReply, 'intent', cpuMs);
                    return Response.json({
                        reply: helloReply,
                        source: 'intent',
                        remaining: tokenBudget.remainingTokens,
                        logId,
                        cpuMs
                    }, { headers: corsHeaders });
                }
                const isOutOfSyllabus = !learnedAnswer && !intentMatch && ragResult.chunks.length === 0;
                // جلب المواعيد من جدول settings
                const prepSchedule = await (0, db_1.getSetting)(env.DB, 'schedule_prep', 'مواعيد المنصة الثابتة: للمرحلة الإعدادية (شرح وتدريب يوم الخميس، واجب يوم الثلاثاء، امتحان يوم الأربعاء الساعة 9 مساءً).');
                const secSchedule = await (0, db_1.getSetting)(env.DB, 'schedule_sec', 'للمرحلة الثانوية (شرح وتدريب يوم الجمعة، واجب يوم الثلاثاء، امتحان يوم الأربعاء الساعة 9 مساءً).');
                const scheduleContext = `${prepSchedule} ${secSchedule} أجب بأدب وبشكل مباشر إذا سألك الطالب عن المواعيد.`;
                // بناء توجيه النوايا إذا كان مطابقًا
                let intentContext = '';
                if (intentMatch) {
                    intentContext = `[مهم جداً: السائل يسأل عن (${intentMatch.intent}). الإجابة القاطعة من منهج/بيانات المنصة هي: "${intentMatch.answer}". يجب عليك استخدام هذه الإجابة نصاً وصياغتها بأسلوبك الودود جداً ولا تخترع إجابة من عندك.]`;
                }
                // بناء الـ System Prompt
                const systemPrompt = (0, prompts_1.buildSystemPrompt)({
                    student: studentProfile,
                    scheduleContext,
                    examActive,
                    lessonChunks: ragResult.chunks,
                    learnedRules: learnedAnswer ? `إرشادات معتمدة من إدارة المنصة: ${learnedAnswer}` : undefined,
                    intentContext: intentContext || undefined,
                    isOutOfSyllabus,
                });
                // (ز) استدعاء نموذج الذكاء الاصطناعي مع سقف التوكنز للرد
                const maxTokensSetting = parseInt(await (0, db_1.getSetting)(env.DB, 'max_completion_tokens', '500'), 10);
                const maxTokens = isOutOfSyllabus ? Math.min(maxTokensSetting, 300) : maxTokensSetting;
                const llmResult = await (0, llm_1.callLlm)(systemPrompt, rawMessage, history, env, maxTokens);
                // ضمان وجود التنبيه الصريح "مش من المنهج راجع الكتاب" إذا كان خارج المنهج
                let finalReply = llmResult.reply;
                if (isOutOfSyllabus && !finalReply.includes('مش من المنهج راجع الكتاب')) {
                    finalReply = `${finalReply}\n\n(تنبيه: مش من المنهج راجع الكتاب)`;
                }
                const usedTokens = llmResult.totalTokens || 0;
                if (usedTokens > 0) {
                    await (0, db_1.recordTokenUsage)(env.DB, studentProfile.uid, tier, usedTokens);
                }
                const cpuMs = Math.round((performance.now() - startTime) * 100) / 100;
                const logId = await (0, db_1.logChat)(env.DB, studentProfile.uid, rawMessage, finalReply, llmResult.source, cpuMs);
                const remainingTokens = Math.max(0, tokenBudget.remainingTokens - usedTokens);
                return Response.json({
                    reply: finalReply,
                    source: llmResult.source,
                    remaining: remainingTokens,
                    lessonTitles: ragResult.lessonTitles.length ? ragResult.lessonTitles : undefined,
                    logId,
                    cpuMs
                }, { headers: corsHeaders });
            }
            return Response.json({ error: 'Endpoint Not Found' }, { status: 404, headers: corsHeaders });
        }
        catch (err) {
            console.error('[WORKER_UNHANDLED_ERROR]', err?.stack || err?.message);
            const cpuMs = Math.round((performance.now() - startTime) * 100) / 100;
            const isAccessDenied = err?.message?.includes('Access denied');
            const isAuthError = err?.message?.includes('token') || err?.message?.includes('expired');
            let status = 500;
            let safeMsg = 'حدث خطأ غير متوقع أثناء معالجة الطلب، يُرجى المحاولة لاحقاً.';
            if (isAccessDenied) {
                status = 403;
                safeMsg = 'غير مصرح لك بالوصول إلى هذه الصفحة أو الميزة.';
            }
            else if (isAuthError) {
                status = 401;
                safeMsg = 'انتهت صلاحية تسجيل الدخول، يُرجى تسجيل الدخول مجدداً.';
            }
            return Response.json({
                error: safeMsg,
                cpuMs
            }, { status, headers: corsHeaders });
        }
    },
    // مجدول يومي لتنظيف السجلات القديمة (> 90 يوماً)
    async scheduled(event, env, ctx) {
        ctx.waitUntil((0, db_1.cleanupOldLogs)(env.DB));
    }
};

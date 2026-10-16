import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  Compass,
  RotateCcw,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  sendMessageToBot,
  sendFeedback,
  getBotUsage,
  getChatUpdates,
} from '../../services/bot';
import type { BotChatMessage } from '../../services/bot';

const STORAGE_KEY = 'yb_bousala_chat_messages';
const MAX_HISTORY_MESSAGES = 20;
const MAX_CHAR_LIMIT = 500;

// مقترحات الأسئلة حسب الصف الدراسي
const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  prep1: [
    'ما الفرق بين النجوم والكواكب والأقمار؟',
    'ما هي العوامل الباطنية والخارجية لتشكيل سطح الأرض؟',
    'كيف كان نظام الحكم والإدارة في مصر القديمة؟',
  ],
  prep2: [
    'ما هي أهم المظاهر التضاريسية للوطن العربي؟',
    'ما الفرق بين الطقس والمناخ؟',
    'ما هي أهم نتائج صلح الحديبية وغزوة خيبر؟',
  ],
  prep3: [
    'ما هي مميزات الموقع الجغرافي لقارة أفريقيا وتضاريسها؟',
    'ما هي الأسباب المباشرة لاندلاع ثورة 1919؟',
    'ما هي أهم السلاسل الجبلية والهضاب في العالم؟',
  ],
  sec1: [
    'ما هي المصادر الأولية والمصادر الثانوية لدراسة الحضارات؟',
    'كيف ساهم الموقع الجغرافي ونهر النيل في قيام الحضارة المصرية؟',
    'ما هي ملامح الحياة السياسية والإدارية في مصر الفرعونية؟',
  ],
  sec2: [
    'ما هي أهم مراحل ومحطات الفتح الإسلامي لمصر؟',
    'ما الفرق بين مفهوم التنمية الاقتصادية والتنمية البشرية المستدامة؟',
    'ما هي مقومات الجذب السياحي وتنمية البيئة السياحية؟',
  ],
  sec3: [
    'ما هي المقومات الطبيعية المؤثرة في قوة الدولة في الجغرافيا السياسية؟',
    'ما هي نتائج ثورة 23 يوليو على الأوضاع السياسية والاجتماعية؟',
    'ما هي أهداف الأحلاف العسكرية والتكتلات الاقتصادية الكبرى؟',
  ],
};

const DEFAULT_QUESTIONS = [
  'ما هي مواعيد الشرح والامتحانات والواجبات الأسبوعية؟',
  'كيف أذاكر مادة الدراسات الاجتماعية وأفهم الخرائط بسهولة؟',
  'ما هي فروع مادة الدراسات الاجتماعية وطريقة توزيع الدرجات؟',
];

export default function BousalaChatDrawer() {
  const { firebaseUser, student } = useAuth();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<BotChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // إخفاء الشات تماماً في مسارات الامتحانات والواجبات
  const isAssessmentRoute = location.pathname.startsWith('/student/assessment');

  // استخراج الاسم الأول للطالب والصف الدراسي
  const studentFirstName = student?.name ? student.name.trim().split(/\s+/)[0] : 'يا بطل';
  const gradeCode = student?.grade || '';
  const suggestedQuestions = (gradeCode && SUGGESTED_QUESTIONS[gradeCode]) || DEFAULT_QUESTIONS;

  // رسالة الترحيب الافتراضية
  const getWelcomeMessage = (): BotChatMessage => ({
    id: 'welcome',
    role: 'assistant',
    content: `أهلاً بك يا ${studentFirstName}! 🧭 أنا "البوصلة"، رفيقك الذكي لمادة الدراسات الاجتماعية. أنا هنا لمساعدتك في فهم أي درس أو إجابة أي سؤال في منهجك. اسألني في أي وقت وسأجيبك فوراً!`,
    createdAt: Date.now(),
  });

  // استرجاع السجل من sessionStorage عند بدء التشغيل
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as BotChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      // Ignore sessionStorage parsing errors
    }
    setMessages([getWelcomeMessage()]);
  }, [studentFirstName]);

  // حفظ الرسائل في sessionStorage بحد أقصى 20 رسالة
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      const slice = messages.slice(-MAX_HISTORY_MESSAGES);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(slice));
    } catch {
      // Storage unavailable
    }
  }, [messages]);

  // التمرير التلقائي لأسفل عند وصول رسالة جديدة أو فتح الشات
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  // جلب الرصيد وحالة الإيقاف عند فتح الشات
  useEffect(() => {
    if (isOpen && firebaseUser) {
      void firebaseUser.getIdToken().then((token) => {
        getBotUsage(token)
          .then((data) => {
            setRemainingQuota(data.remaining);
            if (data.paused !== undefined) {
              setIsPaused(data.paused);
            }
          })
          .catch(() => undefined);
      });
    }
  }, [isOpen, firebaseUser]);

  // التركيز في حقل الإدخال عند فتح النافذة
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // استطلاع ردود المعلم كل 10 ثوانٍ إذا كانت المحادثة موقوفة والنافذة مفتوحة (Polling)
  useEffect(() => {
    if (!isOpen || !isPaused || !firebaseUser) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const lastTs = messages.length > 0 ? messages[messages.length - 1].createdAt : 0;
        const res = await getChatUpdates(token, lastTs);

        if (!isMounted) return;

        if (res.paused !== undefined && res.paused !== isPaused) {
          setIsPaused(res.paused);
          if (!res.paused) {
            setMessages((prev) => [
              ...prev,
              {
                id: `resume_${Date.now()}`,
                role: 'assistant',
                content: 'تقدر تكمل أسئلتك 🧭',
                createdAt: Date.now(),
              },
            ]);
          }
        }

        if (res.updates && res.updates.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newItems: BotChatMessage[] = [];
            for (const upd of res.updates) {
              if (!existingIds.has(upd.id)) {
                newItems.push({
                  id: upd.id,
                  role: 'assistant',
                  content: upd.reply,
                  createdAt: upd.created_at,
                  source: upd.source as any,
                  logId: upd.id,
                });
              }
            }
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        }
      } catch {
        // خطأ شبكة مؤقت لا يزعج الطالب
      }
    }, 10_000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, isPaused, firebaseUser, messages]);

  if (isAssessmentRoute) {
    return null;
  }

  // إرسال رسالة
  const handleSendMessage = async (textToSend?: string) => {
    const rawText = (textToSend !== undefined ? textToSend : inputMessage).trim();
    if (!rawText || loading || !firebaseUser) return;

    if (rawText.length > MAX_CHAR_LIMIT) {
      setErrorAlert(`الرسالة تتجاوز الحد المسموح (${MAX_CHAR_LIMIT} حرف). اختصر سؤالك قليلًا.`);
      return;
    }

    setErrorAlert(null);
    setInputMessage('');

    const userMsg: BotChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: rawText,
      createdAt: Date.now(),
    };

    // إضافة رسالة المستخدم للسجل
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const token = await firebaseUser.getIdToken();

      // تجهيز سجل المحادثة (بحد أقصى آخر 12 رسالة) بدون رسائل الخطأ
      const history = updatedMessages
        .slice(-12)
        .filter((m) => !m.error && (m.role === 'user' || m.role === 'assistant'))
        .map((m) => ({ role: m.role, content: m.content }));

      const data = await sendMessageToBot(token, {
        message: rawText,
        history,
      });

      // إذا رد الخادم برسالة انتظار المعلم
      if (data.reply.includes('بنراجع سؤالك ونرد عليك')) {
        setIsPaused(true);
      }

      const botReplyMsg: BotChatMessage = {
        id: `bot_${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        createdAt: Date.now(),
        lessonTitles: data.lessonTitles,
        logId: data.logId,
        source: data.source,
      };

      setMessages((prev) => [...prev, botReplyMsg]);
      setRemainingQuota(data.remaining);
    } catch (err: any) {
      const errMsg =
        err?.message || 'تعذر إرسال رسالتك حالياً. يُرجى التحقق من الاتصال والمحاولة مجدداً.';
      setErrorAlert(errMsg);

      const errorMsg: BotChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ عذراً، ${errMsg}`,
        createdAt: Date.now(),
        error: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // تقييم الرد (إعجاب أو عدم إعجاب)
  const handleRating = async (msgId: string, logId: string, rating: 1 | -1) => {
    if (!firebaseUser) return;

    // تحديث تفاؤلي لحالة التحميل
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, ratingLoading: true } : m)),
    );

    try {
      const token = await firebaseUser.getIdToken();
      await sendFeedback(token, logId, rating);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, rating, ratingLoading: false } : m)),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, ratingLoading: false } : m)),
      );
      setErrorAlert('تعذر حفظ التقييم بسبب مشكلة في الاتصال.');
    }
  };

  // مسح المحادثة
  const handleClearChat = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    setMessages([getWelcomeMessage()]);
    setErrorAlert(null);
  };

  return (
    <>
      {/* 1. الزر العائم في ركن الشاشة السفلي */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="فتح شات البوصلة"
          className="fixed bottom-6 end-6 z-40 flex items-center gap-3 rounded-full bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 px-5 py-3.5 text-navy-950 font-black shadow-xl shadow-gold-500/30 transition-all duration-300 hover:scale-105 hover:shadow-gold-500/50 active:scale-95 group focus:outline-none focus:ring-4 focus:ring-gold-500/40"
        >
          <div className="relative flex items-center justify-center">
            <Compass className="h-6 w-6 transition-transform duration-700 group-hover:rotate-180" />
            <span className="absolute -top-1 -end-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-navy-950 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-navy-950"></span>
            </span>
          </div>
          <span className="text-sm font-black tracking-wide">اسأل البوصلة</span>
        </button>
      )}

      {/* 2. نافذة الشات المنبثقة (Drawer / Chat Widget) */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="محادثة البوصلة"
          className="fixed inset-0 z-50 flex flex-col bg-navy-950/95 sm:inset-auto sm:bottom-6 sm:end-6 sm:h-[620px] sm:w-[420px] sm:max-h-[calc(100vh-4rem)] sm:rounded-2xl sm:border sm:border-navy-700/80 sm:bg-navy-900/95 sm:shadow-2xl sm:backdrop-blur-xl transition-all duration-300 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-navy-800 bg-navy-950/70 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-500 to-amber-600 text-navy-950 shadow-md shadow-gold-500/20">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-white">البوصلة</h3>
                  <span className="inline-flex items-center rounded-md bg-gold-500/10 px-1.5 py-0.5 text-[10px] font-bold text-gold-400 border border-gold-500/20">
                    مساعدك الذكي
                  </span>
                  {isPaused && (
                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                      مراجعة المعلم
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {remainingQuota !== null
                    ? `المتبقي اليوم: ${remainingQuota} سؤال`
                    : 'استشارات منهج الدراسات'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearChat}
                title="مسح المحادثة"
                aria-label="مسح المحادثة"
                className="rounded-lg p-2 text-slate-400 hover:bg-navy-800 hover:text-slate-200 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="إغلاق الشات"
                aria-label="إغلاق الشات"
                className="rounded-lg p-2 text-slate-400 hover:bg-navy-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* تنبيه الأخطاء إن وجد */}
          {errorAlert && (
            <div className="flex items-center justify-between gap-2 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorAlert}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorAlert(null)}
                className="text-red-400 hover:text-white"
                aria-label="إغلاق التنبيه"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isTeacher = msg.source === 'teacher';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  {/* شارة المعلم إذا كان الرد من المعلم مباشرة */}
                  {!isUser && isTeacher && (
                    <div className="mb-1 flex items-center gap-1.5 px-1 text-xs font-bold text-emerald-400">
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>فريق البوصلة</span>
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-gold-500 font-medium text-navy-950 rounded-br-none shadow-sm'
                        : isTeacher
                          ? 'border border-emerald-500/40 bg-emerald-950/40 text-emerald-100 rounded-bl-none shadow-md shadow-emerald-500/10'
                          : msg.error
                            ? 'border border-red-500/30 bg-red-950/30 text-red-200 rounded-bl-none'
                            : 'border border-navy-800 bg-navy-950/80 text-slate-200 rounded-bl-none shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-line break-words">{msg.content}</p>

                    {/* شارة: من درس كذا */}
                    {!isUser && msg.lessonTitles && msg.lessonTitles.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-navy-800/80 text-[11px] text-gold-400 font-bold">
                        <BookOpen className="h-3.5 w-3.5 shrink-0" />
                        <span>من درس:</span>
                        <span className="text-slate-300">{msg.lessonTitles.join('، ')}</span>
                      </div>
                    )}
                  </div>

                  {/* أزرار التقييم (👍 / 👎) لردود البوت فقط (ليس لردود المعلم) */}
                  {!isUser && !isTeacher && !msg.error && msg.logId && (
                    <div className="mt-1 flex items-center gap-2 px-1 text-[11px] text-slate-500">
                      <span>هل ساعدتك هذه الإجابة؟</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={msg.ratingLoading || msg.rating !== undefined}
                          onClick={() => handleRating(msg.id, msg.logId!, 1)}
                          title="مفيدة"
                          aria-label="إجابة مفيدة"
                          className={`rounded p-1 transition-colors ${
                            msg.rating === 1
                              ? 'text-gold-400 bg-gold-500/10'
                              : 'text-slate-400 hover:text-gold-400 hover:bg-navy-800'
                          }`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={msg.ratingLoading || msg.rating !== undefined}
                          onClick={() => handleRating(msg.id, msg.logId!, -1)}
                          title="غير مفيدة"
                          aria-label="إجابة غير مفيدة"
                          className={`rounded p-1 transition-colors ${
                            msg.rating === -1
                              ? 'text-red-400 bg-red-500/10'
                              : 'text-slate-400 hover:text-red-400 hover:bg-navy-800'
                          }`}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {msg.rating !== undefined && (
                        <span className="text-[10px] text-gold-500/80">شكرًا لتقييمك!</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* مؤشر الكتابة (Typing Indicator) */}
            {loading && (
              <div className="flex items-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-none border border-navy-800 bg-navy-950/80 px-4 py-3 text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold-400 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold-400 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold-400" />
                  </div>
                  <span className="text-slate-300 font-medium">البوصلة تفكر...</span>
                </div>
              </div>
            )}

            {/* مقترحات الأسئلة تظهر إذا كانت المحادثة تحتوي فقط على الترحيب */}
            {messages.length <= 1 && !loading && (
              <div className="pt-2 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                  <Sparkles className="h-3.5 w-3.5 text-gold-400" />
                  <span>أسئلة شائعة يمكنك البدء بها:</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(q)}
                      className="text-right rounded-xl border border-navy-800 bg-navy-950/40 p-2.5 text-xs text-slate-300 transition-all hover:border-gold-500/40 hover:bg-navy-800/60 hover:text-gold-300"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Area */}
          <div className="border-t border-navy-800 bg-navy-950/80 p-3 sm:p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  maxLength={MAX_CHAR_LIMIT}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={loading}
                  placeholder="اكتب سؤالك هنا في المنهج..."
                  className="w-full rounded-xl border border-navy-700 bg-navy-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 disabled:opacity-50"
                />
                {inputMessage.length > 400 && (
                  <span className="absolute left-2.5 bottom-1 text-[10px] text-slate-500">
                    {inputMessage.length}/{MAX_CHAR_LIMIT}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                aria-label="إرسال السؤال"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500 text-navy-950 transition-all hover:bg-gold-400 active:scale-95 disabled:opacity-40 disabled:hover:bg-gold-500"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-2 text-center text-[10px] text-slate-500">
              قد يراجع فريق المنصة المحادثات لتحسين الإجابات
            </p>
          </div>
        </div>
      )}
    </>
  );
}

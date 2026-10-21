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

// أسئلة شائعة ثابتة ومخزنة (زراير جاهزة) لا تستهلك أي توكنز
export const VISITOR_FAQS = [
  {
    q: 'كيف أسجّل؟',
    a: 'للتسجيل في المنصة:\nاضغط على زر "ابدأ الآن مجانًا" في الصفحة الرئيسية أو ادخل على صفحة [إنشاء الحساب](/register).\n\nاكتب اسمك ثلاثيًا، رقم هاتفك ورقم ولي الأمر، واختر صفك الدراسي ومحافظتك وكلمة المرور، ثم اضغط على زر "إنشاء الحساب" لتفعيل دخولك فورًا.',
  },
  {
    q: 'كيف أشترك في كورس؟',
    a: 'للاشتراك في أي كورس:\n1. افتح صفحة [الكورسات](/courses) من القائمة العلوية.\n2. اختر الكورس المناسب لمرحلتك الدراسية واضغط على "تفاصيل الكورس".\n3. اضغط على زر "اشترك الآن"، وسيتم نقلك لصفحة إتمام الدفع وتأكيد الحجز.',
  },
  {
    q: 'طرق الدفع؟',
    a: 'طريقة الدفع المعتمدة:\nيتم تحويل رسوم الكورس عبر **فودافون كاش (أو أي محفظة إلكترونية)** إلى الرقم المعتمد (01023675235).\n\nبعد التحويل، ارفع صورة إيصال التحويل ورقم المحفظة التي قمت بالتحويل منها في صفحة تأكيد الطلب، وسيتم تفعيل الكورس في حسابك بأسرع وقت.',
  },
  {
    q: 'إزاي أدخل الكورسات بعد الاشتراك؟',
    a: 'بمجرد تفعيل اشتراكك:\nسجّل دخولك لحسابك، واضغط على **[كورساتي](/student/my-courses)** من القائمة الجانبية (أو من صفحة "لوحتي").\n\nستجد الكورس متاحًا، اضغط على "دخول الكورس" لمشاهدة الحصص والفيديوهات والملحقات مباشرة.',
  },
  {
    q: 'نسيت كلمة السر؟',
    a: 'إذا نسيت كلمة المرور:\nادخل على صفحة [تسجيل الدخول](/login) واضغط على رابط "نسيت كلمة المرور؟" (أو توجه مباشرة إلى [/forgot-password](/forgot-password)).\n\nاكتب بريدك الإلكتروني المسجل وستصلك رسالة لإعادة تعيين كلمة المرور، أو تواصل مع الدعم الفني لمساعدتك فورًا.',
  },
  {
    q: 'الامتحانات والواجبات؟',
    a: 'الامتحانات والواجبات:\nتجدها في صفحة [الامتحانات والواجبات](/student/exams) أو داخل كل كورس بعد الانتهاء من الحصة.\n\nاضغط على "بدء الامتحان" أو "حل الواجب" للإجابة وتأكيد التسليم، وستظهر نتيجتك فورًا مع إمكانية مراجعة الإجابات الصحيحة والتصحيح النموذجي.\n\n(ملاحظة: تُغلق البوصلة تلقائيًا أثناء أداء الاختبارات للحفاظ على التركيز).',
  },
  {
    q: 'إزاي أتواصل مع الدعم؟',
    a: 'قنوات التواصل المباشرة مع الدعم الفني:\n- فتح تذكرة دعم فني من لوحة الطالب: [الدعم الفني](/student/support).\n- التواصل عبر واتساب أو هاتفياً على الرقم الرسمي للمنصة: **01023675235** وسنكون سعداء بمساعدتك دائمًا!',
  },
];

export default function BousalaChatDrawer() {
  const { firebaseUser, student } = useAuth();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<BotChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
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
    content: firebaseUser
      ? `أهلاً بك يا ${studentFirstName}! 🧭 البوصلة بتساعدك فى المذاكرة.. اسألني أي حاجة في منهج الدراسات الاجتماعية، وراجع دايماً إجاباتك مع كتابك المدرسي للتأكد والتفوق.`
      : 'أهلاً بك في منصة الأستاذ يوسف بركات! 🧭 أنا البوصلة، اختر أي سؤال شائع أدناه للتعرف على المنصة، أو اكتب سؤالك مباشرة.',
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
  }, [studentFirstName, Boolean(firebaseUser)]);

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

  // جلب حالة الإيقاف عند فتح الشات
  useEffect(() => {
    if (isOpen && firebaseUser) {
      void firebaseUser.getIdToken().then((token) => {
        getBotUsage(token)
          .then((data) => {
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

  // قفل سكرول الصفحة الرئيسية عند فتح نافذة الشات على الموبايل والكمبيوتر وiOS Safari
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      window.scrollTo(0, scrollY);
    };
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

  // الرد على الأسئلة الشائعة فوراً بدون استهلاك أي توكنز
  const handleFaqClick = (faq: { q: string; a: string }) => {
    const userMsg: BotChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: faq.q,
      createdAt: Date.now(),
    };
    const botReplyMsg: BotChatMessage = {
      id: `faq_${Date.now()}`,
      role: 'assistant',
      content: faq.a,
      createdAt: Date.now() + 50,
      source: 'direct',
    };
    setMessages((prev) => [...prev, userMsg, botReplyMsg]);
    setErrorAlert(null);
  };

  // إرسال رسالة
  const handleSendMessage = async (textToSend?: string) => {
    const rawText = (textToSend !== undefined ? textToSend : inputMessage).trim();
    if (!rawText || loading) return;

    // فحص الأسئلة الشائعة أولاً للرد فوراً بدون توكنز
    const matchedFaq = VISITOR_FAQS.find(
      (f) => f.q === rawText || rawText.includes(f.q),
    );
    if (matchedFaq) {
      handleFaqClick(matchedFaq);
      setInputMessage('');
      return;
    }

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
      const token = firebaseUser ? await firebaseUser.getIdToken() : null;

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
    } catch (err: any) {
      const rawMessage = (err?.message || '').toLowerCase();
      let categorizedError = '';

      if (
        rawMessage.includes('429') ||
        rawMessage.includes('رصيد') ||
        rawMessage.includes('استراحة') ||
        rawMessage.includes('استنفدت')
      ) {
        categorizedError = 'استراحة قصيرة، ارجع بعد شوية 🧭';
      } else if (
        rawMessage.includes('401') ||
        rawMessage.includes('صلاحية') ||
        rawMessage.includes('تسجيل الدخول') ||
        rawMessage.includes('token')
      ) {
        categorizedError = 'انتهت صلاحية تسجيل الدخول، يُرجى تسجيل الدخول مجددًا لمواصلة المحادثة.';
      } else if (
        rawMessage.includes('اتصال') ||
        rawMessage.includes('شبكة') ||
        rawMessage.includes('failed to fetch') ||
        rawMessage.includes('network') ||
        rawMessage.includes('cors') ||
        rawMessage.includes('typeerror')
      ) {
        categorizedError = 'تعذر الاتصال بالشبكة، يُرجى التحقق من اتصالك بالإنترنت والمحاولة مجددًا.';
      } else if (
        rawMessage.includes('500') ||
        rawMessage.includes('502') ||
        rawMessage.includes('503') ||
        rawMessage.includes('صيانة') ||
        rawMessage.includes('سيرفر') ||
        rawMessage.includes('خادم')
      ) {
        categorizedError = 'خادم البوصلة غير متاح حاليًا أو يخضع للصيانة الدورية، يُرجى المحاولة بعد قليل.';
      } else if (err?.message) {
        categorizedError = err.message;
      } else {
        categorizedError = 'حدث خطأ أثناء معالجة السؤال، يُرجى المحاولة مجددًا.';
      }

      setErrorAlert(categorizedError);

      const errorMsg: BotChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ ${categorizedError}`,
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
          style={{ bottom: "calc(1.5rem + var(--yb-bottom-bar, 0px))" }}
          className="fixed end-6 z-40 flex items-center gap-3 rounded-full bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 px-5 py-3.5 text-navy-950 font-black shadow-xl shadow-gold-500/30 transition-all duration-300 hover:scale-105 hover:shadow-gold-500/50 active:scale-95 group focus:outline-none focus:ring-4 focus:ring-gold-500/40"
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
          className="fixed inset-0 z-50 flex flex-col bg-navy-950/95 sm:inset-auto sm:bottom-6 sm:end-6 h-[100dvh] max-h-[100dvh] sm:h-[620px] sm:w-[420px] sm:max-h-[calc(100vh-4rem)] sm:rounded-2xl sm:border sm:border-navy-700/80 sm:bg-navy-900/95 sm:shadow-2xl sm:backdrop-blur-xl transition-all duration-300 overflow-hidden overscroll-contain"
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
                  {isPaused && (
                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                      مراجعة المعلم
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-bold text-gold-400">
                  البوصلة بتساعدك فى المذاكرة.. اسألني أي حاجة
                </p>
                <p className="text-[10px] text-slate-400">
                  استشارات منهج الدراسات • راجع إجاباتها مع كتابك
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
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
                      <span>رد المعلم</span>
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
                  <span>
                    {!firebaseUser ? 'أسئلة شائعة عن المنصة (إجابات فورية):' : 'أسئلة شائعة يمكنك البدء بها:'}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {!firebaseUser
                    ? VISITOR_FAQS.map((faq, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleFaqClick(faq)}
                          className="text-right rounded-xl border border-navy-800 bg-navy-950/40 p-2.5 text-xs text-slate-300 transition-all hover:border-gold-500/40 hover:bg-navy-800/60 hover:text-gold-300"
                        >
                          {faq.q}
                        </button>
                      ))
                    : suggestedQuestions.map((q, idx) => (
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

                {/* زر إضافي للطلاب لعرض الأسئلة الشائعة عن المنصة */}
                {firebaseUser && (
                  <div className="pt-2 border-t border-navy-800/50">
                    <p className="text-[11px] font-bold text-slate-400 mb-1.5">أسئلة شائعة عن المنصة:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {VISITOR_FAQS.slice(0, 4).map((faq, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleFaqClick(faq)}
                          className="rounded-lg border border-navy-800 bg-navy-950/60 px-2 py-1 text-[11px] text-slate-300 hover:border-gold-500/40 hover:text-gold-300"
                        >
                          {faq.q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                  className="w-full rounded-xl border border-navy-700 bg-navy-900 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 disabled:opacity-50"
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
              البوصلة بتساعدك فى المذاكرة.. اسألني أي حاجة
            </p>
          </div>
        </div>
      )}
    </>
  );
}

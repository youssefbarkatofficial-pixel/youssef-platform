import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Archive,
  ArchiveRestore,
  BarChart3,
  BookOpen,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User,
  UserCheck,
  X,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getAdminStats,
  getAdminConversations,
  getAdminConversationMessages,
  pauseAdminConversation,
  resumeAdminConversation,
  sendTeacherReply,
  getAdminSettings,
  updateAdminSettings,
  getAdminNegativeFeedback,
  addLearnedAnswer,
  getAdminSelfLearning,
  approveAdminSelfLearning,
  rejectAdminSelfLearning,
  getAdminLessons,
  createAdminLesson,
  toggleArchiveAdminLesson,
} from '../../services/bot';
import type {
  AdminStatsData,
  AdminConversationItem,
  AdminChatMessage,
  AdminNegativeFeedbackItem,
  AdminSelfLearningItem,
  AdminLessonItem,
} from '../../services/bot';

type ActiveTab = 'conversations' | 'stats' | 'settings' | 'feedback' | 'selfLearning' | 'lessons';

const ITEMS_PER_PAGE = 15;
const MAX_LESSON_CONTENT_LENGTH = 50_000;

export default function BotMonitorPage() {
  const { firebaseUser } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>('conversations');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [successAlert, setSuccessAlert] = useState<string | null>(null);

  // 1. المحادثات المباشرة
  const [conversations, setConversations] = useState<AdminConversationItem[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<AdminChatMessage[]>([]);
  const [threadState, setThreadState] = useState<{ bot_paused: number; admin_active: number } | null>(null);
  const [teacherReplyInput, setTeacherReplyInput] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // 2. الإحصائيات
  const [stats, setStats] = useState<AdminStatsData | null>(null);

  // 3. الإعدادات
  const [settingsMap, setSettingsMap] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  // 4. الملاحظات السلبية
  const [negativeFeedback, setNegativeFeedback] = useState<AdminNegativeFeedbackItem[]>([]);
  const [adoptingLogId, setAdoptingLogId] = useState<string | null>(null);
  const [adoptQuestion, setAdoptQuestion] = useState('');
  const [adoptAnswer, setAdoptAnswer] = useState('');
  const [savingAdopt, setSavingAdopt] = useState(false);

  // 5. التعلم الذاتي
  const [selfLearningItems, setSelfLearningItems] = useState<AdminSelfLearningItem[]>([]);
  const [selfLearningTotal, setSelfLearningTotal] = useState(0);
  const [selfLearningGrades, setSelfLearningGrades] = useState<string[]>([]);
  const [approvingItemId, setApprovingItemId] = useState<string | null>(null);
  const [approveAnswer, setApproveAnswer] = useState('');
  const [savingSelfLearning, setSavingSelfLearning] = useState(false);
  const [selfLearningGradeFilter, setSelfLearningGradeFilter] = useState('all');
  const [selfLearningStatusFilter, setSelfLearningStatusFilter] = useState('all');
  const [selfLearningPage, setSelfLearningPage] = useState(1);

  // 6. الدروس ومقاطع المعرفة (RAG)
  const [lessons, setLessons] = useState<AdminLessonItem[]>([]);
  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonGrade, setNewLessonGrade] = useState('الثاني الإعدادي');
  const [newLessonUnit, setNewLessonUnit] = useState('');
  const [newLessonSubject, setNewLessonSubject] = useState('دراسات اجتماعية');
  const [newLessonContent, setNewLessonContent] = useState('');
  const [savingLesson, setSavingLesson] = useState(false);
  const [togglingArchiveId, setTogglingArchiveId] = useState<string | null>(null);

  // دالة مساعدة لجلب التوكن
  const getToken = useCallback(async (): Promise<string> => {
    if (!firebaseUser) throw new Error('يجب تسجيل الدخول كمسؤول.');
    return firebaseUser.getIdToken();
  }, [firebaseUser]);

  // تحميل البيانات الأولية حسب التبويب النشط
  const loadData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      setErrorAlert(null);

      try {
        const token = await getToken();

        if (activeTab === 'conversations') {
          const convs = await getAdminConversations(token);
          setConversations(convs);

          if (selectedUid) {
            const details = await getAdminConversationMessages(token, selectedUid);
            setThreadMessages(details.messages);
            setThreadState(details.state);
          }
        } else if (activeTab === 'stats') {
          const s = await getAdminStats(token);
          setStats(s);
        } else if (activeTab === 'settings') {
          const s = await getAdminSettings(token);
          setSettingsMap(s);
        } else if (activeTab === 'feedback') {
          const fb = await getAdminNegativeFeedback(token);
          setNegativeFeedback(fb);
        } else if (activeTab === 'selfLearning') {
          const sl = await getAdminSelfLearning(token, {
            page: selfLearningPage,
            limit: ITEMS_PER_PAGE,
            status: selfLearningStatusFilter,
            grade: selfLearningGradeFilter,
          });
          setSelfLearningItems(sl.items || []);
          setSelfLearningTotal(sl.total || 0);
          if (sl.grades && sl.grades.length > 0) {
            setSelfLearningGrades(sl.grades);
          }
        } else if (activeTab === 'lessons') {
          const l = await getAdminLessons(token);
          setLessons(l);
        }
      } catch (err: any) {
        setErrorAlert(err?.message || 'تعذر جلب البيانات.');
      } finally {
        if (!isBackground) setLoading(false);
        setRefreshing(false);
      }
    },
    [
      activeTab,
      selectedUid,
      getToken,
      selfLearningPage,
      selfLearningGradeFilter,
      selfLearningStatusFilter,
    ],
  );

  // استدعاء التحميل عند تغيير التبويب أو معاملات الترقيم والفلاتر
  useEffect(() => {
    void loadData();
  }, [loadData]);

  // استطلاع تلقائي كل 25 ثانية للمحادثات والإحصائيات فقط عند رؤية الصفحة
  useEffect(() => {
    if (activeTab !== 'conversations' && activeTab !== 'stats') return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadData(true);
      }
    }, 25_000);

    return () => clearInterval(interval);
  }, [activeTab, loadData]);

  // التمرير التلقائي لأسفل المحادثة
  useEffect(() => {
    if (selectedUid && threadMessages.length > 0) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [threadMessages, selectedUid]);

  // فتح محادثة
  const handleSelectConversation = async (uid: string) => {
    setSelectedUid(uid);
    setThreadMessages([]);
    setThreadState(null);
    setTeacherReplyInput('');

    try {
      const token = await getToken();
      const details = await getAdminConversationMessages(token, uid);
      setThreadMessages(details.messages);
      setThreadState(details.state);
    } catch (err: any) {
      setErrorAlert(err?.message || 'تعذر جلب محادثة الطالب.');
    }
  };

  // إيقاف البوت
  const handlePauseBot = async (uid: string) => {
    try {
      const token = await getToken();
      await pauseAdminConversation(token, uid);
      setThreadState((prev) => (prev ? { ...prev, bot_paused: 1, admin_active: 1 } : null));
      setConversations((prev) =>
        prev.map((c) => (c.student_uid === uid ? { ...c, bot_paused: 1, admin_active: 1 } : c)),
      );
      setSuccessAlert('تم إيقاف البوت مؤقتاً، يمكنك الآن الرد بنفسك.');
    } catch (err: any) {
      setErrorAlert(err?.message || 'تعذر إيقاف البوت.');
    }
  };

  // استئناف البوت
  const handleResumeBot = async (uid: string) => {
    try {
      const token = await getToken();
      await resumeAdminConversation(token, uid);
      setThreadState((prev) => (prev ? { ...prev, bot_paused: 0, admin_active: 0 } : null));
      setConversations((prev) =>
        prev.map((c) => (c.student_uid === uid ? { ...c, bot_paused: 0, admin_active: 0 } : c)),
      );
      setSuccessAlert('تم استئناف البوت وسيتولى الإجابة تلقائياً.');
    } catch (err: any) {
      setErrorAlert(err?.message || 'تعذر استئناف البوت.');
    }
  };

  // إرسال رد المعلم
  const handleSendTeacherReply = async () => {
    if (!selectedUid || !teacherReplyInput.trim() || sendingReply) return;

    setSendingReply(true);
    setErrorAlert(null);

    const replyText = teacherReplyInput.trim();

    try {
      const token = await getToken();
      const res = await sendTeacherReply(token, selectedUid, replyText);

      const newMsg: AdminChatMessage = {
        id: res.logId,
        student_uid: selectedUid,
        user_message: '',
        bot_reply: replyText,
        source: 'teacher',
        cpu_ms: 0,
        rating: null,
        created_at: Date.now(),
      };

      setThreadMessages((prev) => [...prev, newMsg]);
      setTeacherReplyInput('');
      setSuccessAlert('تم إرسال ردك للطالب بنجاح.');
    } catch (err: any) {
      setErrorAlert(err?.message || 'تعذر إرسال الرد.');
    } finally {
      setSendingReply(false);
    }
  };

  // حفظ الإعدادات
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setErrorAlert(null);
    setSuccessAlert(null);

    try {
      const token = await getToken();
      await updateAdminSettings(token, settingsMap);
      setSuccessAlert('تم حفظ إعدادات البوت بنجاح.');
    } catch (err: any) {
      setErrorAlert(err?.message || 'تعذر حفظ الإعدادات.');
    } finally {
      setSavingSettings(false);
    }
  };

  // اعتماد إجابة من الملاحظات السلبية
  const handleStartAdopt = (item: AdminNegativeFeedbackItem) => {
    setAdoptingLogId(item.id);
    setAdoptQuestion(item.user_message);
    setAdoptAnswer(item.bot_reply);
  };

  const handleSaveAdoptedAnswer = async () => {
    if (!adoptQuestion.trim() || !adoptAnswer.trim() || savingAdopt) return;

    setSavingAdopt(true);
    setErrorAlert(null);

    try {
      const token = await getToken();
      await addLearnedAnswer(token, adoptQuestion.trim(), adoptAnswer.trim());
      setSuccessAlert('تمت إضافة الإجابة المعتمدة بنجاح!');
      setAdoptingLogId(null);
      setAdoptQuestion('');
      setAdoptAnswer('');
    } catch (err: any) {
      setErrorAlert(err?.message || 'تعذر حفظ الإجابة المعتمدة.');
    } finally {
      setSavingAdopt(false);
    }
  };

  // اعتماد أو رفض التعلم الذاتي
  const handleApproveSelfLearning = async (id: string) => {
    if (!approveAnswer.trim()) {
      setErrorAlert('يجب كتابة إجابة نموذجية لاعتماد السؤال.');
      return;
    }
    if (approveAnswer.trim().length > 2000) {
      setErrorAlert('نص الإجابة يتجاوز الحد الأقصى المسموح (2000 حرف).');
      return;
    }

    setSavingSelfLearning(true);
    setErrorAlert(null);

    try {
      const token = await getToken();
      await approveAdminSelfLearning(token, id, approveAnswer.trim());
      setSuccessAlert('تم اعتماد السؤال بنجاح.');
      setApprovingItemId(null);
      setApproveAnswer('');
      // إعادة تحميل بيانات الصفحة الحالية من السيرفر
      void loadData();
    } catch (err: any) {
      setErrorAlert(err?.message || 'تعذر اعتماد السؤال.');
    } finally {
      setSavingSelfLearning(false);
    }
  };

  const handleRejectSelfLearning = async (id: string) => {
    setErrorAlert(null);
    try {
      const token = await getToken();
      await rejectAdminSelfLearning(token, id);
      setSuccessAlert('تم رفض السؤال.');
      // إعادة تحميل بيانات الصفحة الحالية من السيرفر
      void loadData();
    } catch (err: any) {
      setErrorAlert(err?.message || 'تعذر رفض السؤال.');
    }
  };

  // أرشفة / إلغاء أرشفة درس
  const handleToggleArchiveLesson = async (lesson: AdminLessonItem) => {
    setTogglingArchiveId(lesson.id);
    setErrorAlert(null);

    try {
      const token = await getToken();
      const newArchived = lesson.archived !== 1;
      await toggleArchiveAdminLesson(token, lesson.id, newArchived);
      setLessons((prev) =>
        prev.map((l) => (l.id === lesson.id ? { ...l, archived: newArchived ? 1 : 0 } : l)),
      );
      setSuccessAlert(
        newArchived
          ? 'تمت أرشفة الدرس واستبعاده من RAG بنجاح.'
          : 'تم إلغاء أرشفة الدرس وتفعيله في RAG بنجاح.',
      );
    } catch (err: any) {
      setErrorAlert(err?.message || 'تعذر تغيير حالة أرشفة الدرس.');
    } finally {
      setTogglingArchiveId(null);
    }
  };

  // رفع درس جديد وتقطيعه إلى مقاطع
  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLessonTitle.trim() || !newLessonContent.trim()) {
      setErrorAlert('عنوان الدرس ومحتواه مطلوبان.');
      return;
    }

    if (newLessonContent.length > MAX_LESSON_CONTENT_LENGTH) {
      setErrorAlert(`محتوى الدرس يتجاوز الحد الأقصى المسموح (${MAX_LESSON_CONTENT_LENGTH} حرف).`);
      return;
    }

    setSavingLesson(true);
    setErrorAlert(null);

    try {
      const token = await getToken();
      const res = await createAdminLesson(token, {
        title: newLessonTitle.trim(),
        grade: newLessonGrade.trim(),
        unit: newLessonUnit.trim(),
        subject: newLessonSubject.trim(),
        content: newLessonContent.trim(),
      });
      setSuccessAlert(`تم رفع الدرس بنجاح وتقطيعه إلى ${res.chunksCreated} مقطع في الـ RAG!`);
      setShowAddLessonModal(false);
      setNewLessonTitle('');
      setNewLessonUnit('');
      setNewLessonContent('');
      const updatedLessons = await getAdminLessons(token);
      setLessons(updatedLessons);
    } catch (err: any) {
      setErrorAlert(err?.message || 'تعذر رفع الدرس.');
    } finally {
      setSavingLesson(false);
    }
  };

  const formatTimestamp = (ts: number | null | undefined): string => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });
  };

  // حساب عدد الصفحات والصفحة الحالية من إجمالي السيرفر
  const totalSelfLearningPages = Math.max(1, Math.ceil(selfLearningTotal / ITEMS_PER_PAGE));
  const currentSelfLearningPage = Math.min(selfLearningPage, totalSelfLearningPages);

  return (
    <div className="space-y-6 p-4 sm:p-6 text-slate-100">
      {/* رأس الصفحة الرئيسي */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-navy-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-500 to-amber-600 text-navy-950 shadow-lg shadow-gold-500/20">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">مراقبة بوت البوصلة</h1>
            <p className="text-xs sm:text-sm text-slate-400">
              مراقبة المحادثات الحية، والتدخل المباشر للمعلم، وضبط المواعيد وإدارة المعرفة والدروس
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            void loadData();
          }}
          disabled={loading || refreshing}
          className="flex items-center gap-2 rounded-xl border border-navy-700 bg-navy-800/80 px-4 py-2 text-xs font-bold text-slate-300 hover:border-gold-500/50 hover:bg-navy-800 hover:text-gold-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-gold-400' : ''}`} />
          <span>تحديث البيانات</span>
        </button>
      </div>

      {/* التنبيهات (نجاح / خطأ) */}
      {errorAlert && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <span>{errorAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorAlert(null)}
            className="text-red-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successAlert && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>{successAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessAlert(null)}
            className="text-emerald-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* شريط التبويبات */}
      <div className="flex flex-wrap gap-2 border-b border-navy-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('conversations')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
            activeTab === 'conversations'
              ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/20'
              : 'bg-navy-900 text-slate-300 hover:bg-navy-800'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>المحادثات المباشرة</span>
          {conversations.some((c) => c.unread_for_admin > 0) && (
            <span className="flex h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
            activeTab === 'stats'
              ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/20'
              : 'bg-navy-900 text-slate-300 hover:bg-navy-800'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>الإحصائيات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lessons')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
            activeTab === 'lessons'
              ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/20'
              : 'bg-navy-900 text-slate-300 hover:bg-navy-800'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>محتوى الدروس (RAG)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
            activeTab === 'settings'
              ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/20'
              : 'bg-navy-900 text-slate-300 hover:bg-navy-800'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>الإعدادات والمواعيد</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('feedback')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
            activeTab === 'feedback'
              ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/20'
              : 'bg-navy-900 text-slate-300 hover:bg-navy-800'
          }`}
        >
          <ThumbsDown className="h-4 w-4" />
          <span>الملاحظات السلبية 👎</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('selfLearning')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
            activeTab === 'selfLearning'
              ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/20'
              : 'bg-navy-900 text-slate-300 hover:bg-navy-800'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>أسئلة التعلم الذاتي ({selfLearningItems.length})</span>
        </button>
      </div>

      {/* محتوى التبويبات */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin text-gold-400" />
            <span className="text-sm">جاري تحميل بيانات البوصلة...</span>
          </div>
        </div>
      ) : (
        <>
          {/* ===================== 1. المحادثات المباشرة ===================== */}
          {activeTab === 'conversations' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px]">
              {/* قائمة المحادثات (الجانب الأيمن) */}
              <div className="lg:col-span-5 flex flex-col rounded-2xl border border-navy-800 bg-navy-900/60 p-4">
                <div className="flex items-center justify-between pb-3 border-b border-navy-800">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-gold-400" />
                    <span>محادثات الطلاب النشطة ({conversations.length})</span>
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 mt-3 max-h-[550px] pr-1">
                  {conversations.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      لا توجد محادثات مسجلة بعد.
                    </div>
                  ) : (
                    conversations.map((c) => {
                      const isSelected = selectedUid === c.student_uid;
                      const hasUnread = c.unread_for_admin > 0;
                      const isPaused = c.bot_paused === 1;

                      return (
                        <button
                          key={c.student_uid}
                          type="button"
                          onClick={() => handleSelectConversation(c.student_uid)}
                          className={`w-full text-right p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                            isSelected
                              ? 'border-gold-500 bg-navy-800/90 shadow-md shadow-gold-500/10'
                              : 'border-navy-800/80 bg-navy-950/40 hover:bg-navy-800/50 hover:border-navy-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-800 text-slate-300">
                                <User className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-xs font-black text-slate-200">
                                طالب: {c.student_uid.slice(0, 10)}...
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {hasUnread && (
                                <span className="rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[10px] font-bold text-red-400">
                                  جديد
                                </span>
                              )}
                              {isPaused ? (
                                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                  <Pause className="h-2.5 w-2.5" />
                                  <span>متوقف للرد</span>
                                </span>
                              ) : (
                                <span className="rounded-full bg-blue-500/20 border border-blue-500/40 px-2 py-0.5 text-[10px] font-bold text-blue-400 flex items-center gap-1">
                                  <Play className="h-2.5 w-2.5" />
                                  <span>البوت يعمل</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {c.last_user_message && (
                            <p className="text-xs text-slate-400 truncate">
                              💬 {c.last_user_message}
                            </p>
                          )}

                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-navy-800/40">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimestamp(c.last_activity_at)}
                            </span>
                            {c.last_source && (
                              <span className="font-mono text-slate-400">
                                {c.last_source === 'teacher' ? 'رد المعلم' : c.last_source}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* نافذة عرض المحادثة والرد المباشر (الجانب الأيسر) */}
              <div className="lg:col-span-7 flex flex-col rounded-2xl border border-navy-800 bg-navy-900/60 p-4">
                {selectedUid ? (
                  <>
                    {/* شريط رأس المحادثة وأزرار التحكم */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-navy-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-white">
                            محادثة الطالب: {selectedUid}
                          </h3>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {threadState?.bot_paused
                            ? 'البوت موقوف حالياً لهذه المحادثة (أنت من يتولى الرد).'
                            : 'البوت يجيب الطالب تلقائياً في الوقت الحالي.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {threadState?.bot_paused ? (
                          <button
                            type="button"
                            onClick={() => handleResumeBot(selectedUid)}
                            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-bold text-white transition-colors shadow-sm"
                          >
                            <Play className="h-3.5 w-3.5" />
                            <span>إرجاع البوت</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePauseBot(selectedUid)}
                            className="flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition-colors shadow-sm"
                          >
                            <Pause className="h-3.5 w-3.5" />
                            <span>إيقاف البوت وأنا أرد</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* سجل الرسائل */}
                    <div className="flex-1 overflow-y-auto space-y-3 my-4 max-h-[380px] p-2">
                      {threadMessages.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-xs">
                          لا توجد رسائل سابقة في هذه المحادثة.
                        </div>
                      ) : (
                        threadMessages.map((m) => {
                          const isTeacher = m.source === 'teacher';
                          return (
                            <div key={m.id} className="space-y-2">
                              {/* رسالة الطالب */}
                              {m.user_message && (
                                <div className="flex flex-col items-start">
                                  <span className="text-[10px] text-slate-400 mb-0.5">الطالب:</span>
                                  <div className="rounded-2xl rounded-tl-none bg-navy-950 border border-navy-800 px-3.5 py-2.5 text-xs text-slate-200 max-w-[85%]">
                                    <p className="whitespace-pre-line">{m.user_message}</p>
                                  </div>
                                </div>
                              )}

                              {/* رد البوت أو المعلم */}
                              {m.bot_reply && (
                                <div className="flex flex-col items-end">
                                  <div className="flex items-center gap-1 text-[10px] mb-0.5">
                                    {isTeacher ? (
                                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                                        <UserCheck className="h-3 w-3" />
                                        <span>رد المعلم المباشر</span>
                                      </span>
                                    ) : (
                                      <span className="text-gold-400 font-bold flex items-center gap-1">
                                        <Bot className="h-3 w-3" />
                                        <span>رد البوصلة ({m.source})</span>
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    className={`rounded-2xl rounded-tr-none px-3.5 py-2.5 text-xs max-w-[85%] ${
                                      isTeacher
                                        ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-100'
                                        : 'bg-navy-800 border border-navy-700 text-slate-200'
                                    }`}
                                  >
                                    <p className="whitespace-pre-line">{m.bot_reply}</p>
                                  </div>
                                  <span className="text-[9px] text-slate-500 mt-0.5">
                                    {formatTimestamp(m.created_at)}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                      <div ref={threadEndRef} />
                    </div>

                    {/* حقل إرسال رد المعلم */}
                    <div className="border-t border-navy-800 pt-3">
                      <div className="flex flex-col gap-2">
                        <textarea
                          rows={2}
                          value={teacherReplyInput}
                          maxLength={1000}
                          onChange={(e) => setTeacherReplyInput(e.target.value)}
                          placeholder="اكتب ردك المباشر للطالب هنا (سيظهر للطالب باسم فريق البوصلة)..."
                          className="w-full rounded-xl border border-navy-700 bg-navy-950 p-2.5 text-xs text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">
                            {teacherReplyInput.length}/1000 حرف (وسوم HTML تُحذف تلقائياً)
                          </span>
                          <button
                            type="button"
                            onClick={handleSendTeacherReply}
                            disabled={sendingReply || !teacherReplyInput.trim()}
                            className="flex items-center gap-1.5 rounded-xl bg-gold-500 hover:bg-gold-400 px-4 py-2 text-xs font-black text-navy-950 transition-colors disabled:opacity-40"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>{sendingReply ? 'جاري الإرسال...' : 'إرسال الرد للطالب'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center py-20 text-slate-500 text-center">
                    <MessageSquare className="h-10 w-10 text-slate-600 mb-2" />
                    <p className="text-sm font-bold text-slate-400">اختر محادثة من القائمة لمراجعتها</p>
                    <p className="text-xs text-slate-500">
                      يمكنك قراءة الأسئلة وإيقاف البوت للرد بنفسك في أي وقت.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================== 2. الإحصائيات ===================== */}
          {activeTab === 'stats' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-navy-800 bg-navy-900/60 p-4">
                  <p className="text-xs text-slate-400 font-bold">رسائل اليوم</p>
                  <p className="text-2xl font-black text-gold-400 mt-1">{stats.todayMessages}</p>
                </div>

                <div className="rounded-2xl border border-navy-800 bg-navy-900/60 p-4">
                  <p className="text-xs text-slate-400 font-bold">الطلاب النشطون اليوم</p>
                  <p className="text-2xl font-black text-white mt-1">{stats.todayStudents}</p>
                </div>

                <div className="rounded-2xl border border-navy-800 bg-navy-900/60 p-4">
                  <p className="text-xs text-slate-400 font-bold">إجمالي الرسائل (الكل)</p>
                  <p className="text-2xl font-black text-slate-300 mt-1">{stats.totalMessages}</p>
                </div>

                <div className="rounded-2xl border border-navy-800 bg-navy-900/60 p-4">
                  <p className="text-xs text-slate-400 font-bold">محادثات قيد التدخل (متوقفة)</p>
                  <p className="text-2xl font-black text-amber-400 mt-1">
                    {stats.pausedConversations}
                  </p>
                </div>

                <div className="rounded-2xl border border-navy-800 bg-navy-900/60 p-4">
                  <p className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span>تقييم إيجابي 👍</span>
                  </p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">{stats.thumbsUp}</p>
                </div>

                <div className="rounded-2xl border border-navy-800 bg-navy-900/60 p-4">
                  <p className="text-xs text-red-400 font-bold flex items-center gap-1">
                    <ThumbsDown className="h-3.5 w-3.5" />
                    <span>تقييم سلبي 👎</span>
                  </p>
                  <p className="text-2xl font-black text-red-400 mt-1">{stats.thumbsDown}</p>
                </div>

                <div className="rounded-2xl border border-navy-800 bg-navy-900/60 p-4">
                  <p className="text-xs text-slate-400 font-bold">متوسط زمن المعالجة (CPU)</p>
                  <p className="text-2xl font-black text-sky-400 mt-1">{stats.avgCpuMs} ms</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">حد باقة Cloudflare المجانية 10ms</p>
                </div>
              </div>
            </div>
          )}

          {/* ===================== 3. محتوى الدروس والـ RAG ===================== */}
          {activeTab === 'lessons' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-gold-400" />
                    <span>دروس ومقاطع المعرفة (RAG Knowledge Base)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    الدروس المخزنة التي يبحث فيها البوت لتقديم إجابات منهجية موثوقة من منهج مستر يوسف بركات.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddLessonModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-gold-500 hover:bg-gold-400 px-4 py-2.5 text-xs font-black text-navy-950 transition-colors shadow-md"
                >
                  <Plus className="h-4 w-4" />
                  <span>رفع درس جديد</span>
                </button>
              </div>

              {/* قائمة الدروس الحالية */}
              {lessons.length === 0 ? (
                <div className="rounded-2xl border border-navy-800 bg-navy-900/60 p-12 text-center text-slate-500 text-sm">
                  لا توجد دروس مضافة حالياً. اضغط على زر "رفع درس جديد" لإضافة محتوى للمنهج.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lessons.map((lesson) => {
                    const isArchived = lesson.archived === 1;
                    const isToggling = togglingArchiveId === lesson.id;

                    return (
                      <div
                        key={lesson.id}
                        className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-all ${
                          isArchived
                            ? 'border-navy-800/60 bg-navy-950/40 opacity-70'
                            : 'border-navy-800 bg-navy-900/70 hover:border-navy-700'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isArchived
                                  ? 'bg-slate-700/40 text-slate-400'
                                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {isArchived ? 'مؤرشف (مستبعد من RAG)' : 'نشط في الـ RAG'}
                            </span>
                            <span className="text-[11px] text-gold-400 font-bold flex items-center gap-1">
                              <span>{lesson.chunks_count || 0}</span>
                              <span className="text-[10px] text-slate-400">مقطع</span>
                            </span>
                          </div>

                          <h4 className="text-sm font-black text-white line-clamp-1">
                            {lesson.title}
                          </h4>

                          <div className="text-xs text-slate-400 space-y-0.5">
                            {lesson.grade && <p>الصف: {lesson.grade}</p>}
                            {lesson.unit && <p className="line-clamp-1">الوحدة: {lesson.unit}</p>}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-navy-800/80 text-[10px] text-slate-500">
                          <span>{formatTimestamp(lesson.created_at)}</span>

                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleToggleArchiveLesson(lesson)}
                            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                              isArchived
                                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                            }`}
                          >
                            {isArchived ? (
                              <>
                                <ArchiveRestore className="h-3.5 w-3.5" />
                                <span>إلغاء الأرشفة</span>
                              </>
                            ) : (
                              <>
                                <Archive className="h-3.5 w-3.5" />
                                <span>أرشفة الدرس</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* نافذة رفع درس جديد (Modal) */}
              {showAddLessonModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 p-4 backdrop-blur-sm">
                  <div className="w-full max-w-2xl rounded-2xl border border-navy-700 bg-navy-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-navy-800 pb-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-gold-400" />
                        <h3 className="text-base font-black text-white">رفع درس جديد إلى الـ RAG</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddLessonModal(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <form onSubmit={handleCreateLesson} className="space-y-4">
                      <div>
                        <label className="text-xs font-black text-white block mb-1">
                          عنوان الدرس <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newLessonTitle}
                          onChange={(e) => setNewLessonTitle(e.target.value)}
                          placeholder="مثال: الدرس الأول - الموقع والمساحة للوطن العربي"
                          className="w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-black text-white block mb-1">الصف الدراسي</label>
                          <select
                            value={newLessonGrade}
                            onChange={(e) => setNewLessonGrade(e.target.value)}
                            className="w-full rounded-xl border border-navy-700 bg-navy-950 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
                          >
                            <option value="الأول الإعدادي">الأول الإعدادي</option>
                            <option value="الثاني الإعدادي">الثاني الإعدادي</option>
                            <option value="الثالث الإعدادي">الثالث الإعدادي</option>
                            <option value="الأول الثانوي">الأول الثانوي</option>
                            <option value="الثاني الثانوي">الثاني الثانوي</option>
                            <option value="الثالث الثانوي">الثالث الثانوي</option>
                            <option value="عام">عام</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-black text-white block mb-1">الوحدة</label>
                          <input
                            type="text"
                            value={newLessonUnit}
                            onChange={(e) => setNewLessonUnit(e.target.value)}
                            placeholder="مثال: الوحدة الأولى: أرض وتاريخ"
                            className="w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-black text-white block">
                            محتوى الدرس النصي <span className="text-red-400">*</span>
                          </label>
                          <span
                            className={`text-[10px] ${
                              newLessonContent.length > MAX_LESSON_CONTENT_LENGTH
                                ? 'text-red-400 font-bold'
                                : 'text-slate-500'
                            }`}
                          >
                            {newLessonContent.length.toLocaleString('ar-EG')} / {MAX_LESSON_CONTENT_LENGTH.toLocaleString('ar-EG')} حرف
                          </span>
                        </div>
                        <textarea
                          rows={8}
                          required
                          value={newLessonContent}
                          onChange={(e) => setNewLessonContent(e.target.value)}
                          placeholder="الصق نص الشرح أو مذكرة الدرس هنا كاملاً... سيتم تقطيعه تلقائياً وحساب الكلمات المفتاحية وفهرسته في قاعدة D1 ليجيب منه البوت فوراً."
                          className="w-full rounded-xl border border-navy-700 bg-navy-950 p-3 text-xs text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none leading-relaxed"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-navy-800">
                        <button
                          type="button"
                          onClick={() => setShowAddLessonModal(false)}
                          className="rounded-xl border border-navy-700 px-4 py-2 text-xs text-slate-400 hover:text-white"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          disabled={savingLesson || !newLessonTitle.trim() || !newLessonContent.trim() || newLessonContent.length > MAX_LESSON_CONTENT_LENGTH}
                          className="flex items-center gap-1.5 rounded-xl bg-gold-500 hover:bg-gold-400 px-5 py-2 text-xs font-black text-navy-950 transition-colors disabled:opacity-40"
                        >
                          <Check className="h-4 w-4" />
                          <span>{savingLesson ? 'جاري التقطيع والفهرسة...' : 'رفع وتقطيع الدرس'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================== 4. الإعدادات والمواعيد ===================== */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl rounded-2xl border border-navy-800 bg-navy-900/60 p-6 space-y-6">
              <div>
                <h3 className="text-base font-black text-white">إعدادات ومواعيد البوت</h3>
                <p className="text-xs text-slate-400">
                  تعديل المواعيد المضمّنة في الـ System Prompt وحدود الاستخدام اليومية.
                </p>
              </div>

              <div className="space-y-4">
                {/* حالة التفعيل */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-navy-800 bg-navy-950/60">
                  <div>
                    <label className="text-xs font-black text-white block">تشغيل خدمة البوت</label>
                    <span className="text-[11px] text-slate-400">
                      عند التعطيل لن يتمكن الطلاب من إرسال رسائل جديدة.
                    </span>
                  </div>
                  <select
                    value={settingsMap.enabled || 'true'}
                    onChange={(e) =>
                      setSettingsMap((prev) => ({ ...prev, enabled: e.target.value }))
                    }
                    className="rounded-lg border border-navy-700 bg-navy-900 px-3 py-1.5 text-xs text-white"
                  >
                    <option value="true">مفعّل</option>
                    <option value="false">معطّل</option>
                  </select>
                </div>

                {/* الحد اليومي للطالب */}
                <div>
                  <label className="text-xs font-black text-white block mb-1">
                    الحد اليومي لأسئلة الطالب (عدد الأسئلة)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={settingsMap.daily_student_limit || '30'}
                    onChange={(e) =>
                      setSettingsMap((prev) => ({ ...prev, daily_student_limit: e.target.value }))
                    }
                    className="w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2 text-xs text-white"
                  />
                  <span className="text-[10px] text-slate-500">القيمة الافتراضية: 30 سؤالاً</span>
                </div>

                {/* مدة استئناف البوت التلقائي */}
                <div>
                  <label className="text-xs font-black text-white block mb-1">
                    مدة استئناف البوت التلقائي بعد تدخل المعلم (بالدقائق)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={settingsMap.teacher_auto_resume_minutes || '30'}
                    onChange={(e) =>
                      setSettingsMap((prev) => ({
                        ...prev,
                        teacher_auto_resume_minutes: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2 text-xs text-white"
                  />
                  <span className="text-[10px] text-slate-500">
                    الحد الأدنى 5 دقائق، الحد الأقصى 1440 دقيقة (24 ساعة).
                  </span>
                </div>

                {/* نص مواعيد المرحلة الإعدادية */}
                <div>
                  <label className="text-xs font-black text-white block mb-1">
                    نص مواعيد المرحلة الإعدادية
                  </label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={
                      settingsMap.schedule_prep ||
                      'الشرح والامتحان التراكمي الأسبوعي يوم الجمعة، والواجب الأسبوعي يُسلّم يوم الاثنين'
                    }
                    onChange={(e) =>
                      setSettingsMap((prev) => ({ ...prev, schedule_prep: e.target.value }))
                    }
                    className="w-full rounded-xl border border-navy-700 bg-navy-950 p-2.5 text-xs text-white"
                  />
                </div>

                {/* نص مواعيد المرحلة الثانوية */}
                <div>
                  <label className="text-xs font-black text-white block mb-1">
                    نص مواعيد المرحلة الثانوية
                  </label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={
                      settingsMap.schedule_sec ||
                      'الشرح والامتحان التراكمي الأسبوعي يوم السبت، والواجب الأسبوعي يُسلّم يوم الثلاثاء'
                    }
                    onChange={(e) =>
                      setSettingsMap((prev) => ({ ...prev, schedule_sec: e.target.value }))
                    }
                    className="w-full rounded-xl border border-navy-700 bg-navy-950 p-2.5 text-xs text-white"
                  />
                </div>

                {/* نص الرد على المواد غير المدعومة */}
                <div>
                  <label className="text-xs font-black text-white block mb-1">
                    نص الرد على أسئلة المواد الأخرى غير الدراسات الاجتماعية
                  </label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={
                      settingsMap.unsupported_subject_reply ||
                      'أنا مساعد مستر يوسف بركات لمادة الدراسات الاجتماعية والتاريخ والجغرافيا فقط، ولا يمكنني المساعدة في أي مادة أخرى.'
                    }
                    onChange={(e) =>
                      setSettingsMap((prev) => ({
                        ...prev,
                        unsupported_subject_reply: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-navy-700 bg-navy-950 p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="flex items-center gap-2 rounded-xl bg-gold-500 hover:bg-gold-400 px-5 py-2.5 text-xs font-black text-navy-950 transition-colors shadow-md disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  <span>{savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات في البوت'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ===================== 5. الملاحظات السلبية 👎 ===================== */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">ردود قيّمها الطلاب بـ 👎</h3>
                  <p className="text-xs text-slate-400">
                    مراجعة الردود غير المرضية واعتماد إجابات نموذجية بديلة بنقرة واحدة (تُخزَّن في
                    قاعدة الإجابات المعتمدة).
                  </p>
                </div>
              </div>

              {negativeFeedback.length === 0 ? (
                <div className="rounded-2xl border border-navy-800 bg-navy-900/60 p-12 text-center text-slate-500 text-sm">
                  لا توجد أي تقييمات سلبية مسجلة حتى الآن 🎉
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {negativeFeedback.map((item) => {
                    const isAdopting = adoptingLogId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-navy-800 bg-navy-900/60 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-red-400 flex items-center gap-1">
                            <ThumbsDown className="h-3.5 w-3.5" />
                            <span>تقييم سلبي من طالب: {item.student_uid.slice(0, 10)}...</span>
                          </span>
                          <span className="text-slate-500 text-[10px]">
                            {formatTimestamp(item.created_at)}
                          </span>
                        </div>

                        <div className="rounded-xl bg-navy-950/80 p-3 border border-navy-800 space-y-2">
                          <div className="text-xs">
                            <span className="text-slate-400 font-bold">سؤال الطالب: </span>
                            <span className="text-white">{item.user_message}</span>
                          </div>
                          <div className="text-xs pt-1 border-t border-navy-800/60">
                            <span className="text-slate-400 font-bold">رد البوت السابق: </span>
                            <span className="text-slate-300 whitespace-pre-line">
                              {item.bot_reply}
                            </span>
                          </div>
                        </div>

                        {/* زر الاعتماد كإجابة نموذجية */}
                        {!isAdopting ? (
                          <button
                            type="button"
                            onClick={() => handleStartAdopt(item)}
                            className="flex items-center gap-1.5 rounded-xl border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 text-xs font-bold text-gold-400 hover:bg-gold-500/20 transition-colors"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>تصحيح واعتماد كإجابة نموذجية</span>
                          </button>
                        ) : (
                          <div className="rounded-xl border border-gold-500/40 bg-navy-950 p-4 space-y-3">
                            <h4 className="text-xs font-black text-gold-400">
                              اعتماد إجابة نموذجية دائمة لهذا السؤال
                            </h4>

                            <div>
                              <label className="text-[11px] text-slate-400 block mb-1">
                                نص السؤال:
                              </label>
                              <input
                                type="text"
                                value={adoptQuestion}
                                onChange={(e) => setAdoptQuestion(e.target.value)}
                                className="w-full rounded-lg border border-navy-700 bg-navy-900 p-2 text-xs text-white"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] text-slate-400 block mb-1">
                                الإجابة المعتمدة (سيجيب بها البوت بنسبة 100% مستقبلاً):
                              </label>
                              <textarea
                                rows={3}
                                value={adoptAnswer}
                                onChange={(e) => setAdoptAnswer(e.target.value)}
                                className="w-full rounded-lg border border-navy-700 bg-navy-900 p-2 text-xs text-white"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleSaveAdoptedAnswer}
                                disabled={savingAdopt || !adoptAnswer.trim()}
                                className="flex items-center gap-1 rounded-lg bg-gold-500 hover:bg-gold-400 px-3 py-1.5 text-xs font-black text-navy-950 transition-colors disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>{savingAdopt ? 'جاري الحفظ...' : 'حفظ الإجابة المعتمدة'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setAdoptingLogId(null)}
                                className="rounded-lg border border-navy-700 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                              >
                                إلغاء
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===================== 6. أسئلة التعلم الذاتي (مراجعة + فلترة + ترقيم صفحات) ===================== */}
          {activeTab === 'selfLearning' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-white">أسئلة التعلم الذاتي للمراجعة</h3>
                  <p className="text-xs text-slate-400">
                    مراجعة فردية يدوية للأسئلة المستخرجة قبل اعتمادها في RAG.
                  </p>
                </div>

                {/* شريط الفلاتر */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-xl border border-navy-700 bg-navy-900 px-3 py-1.5 text-xs">
                    <Filter className="h-3.5 w-3.5 text-gold-400" />
                    <select
                      value={selfLearningGradeFilter}
                      onChange={(e) => {
                        setSelfLearningGradeFilter(e.target.value);
                        setSelfLearningPage(1);
                      }}
                      className="bg-transparent text-white focus:outline-none"
                    >
                      <option value="all">جميع الصفوف ({selfLearningTotal})</option>
                      {selfLearningGrades.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <select
                    value={selfLearningStatusFilter}
                    onChange={(e) => {
                      setSelfLearningStatusFilter(e.target.value);
                      setSelfLearningPage(1);
                    }}
                    className="rounded-xl border border-navy-700 bg-navy-900 px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="all">جميع الحالات</option>
                    <option value="pending">قيد المراجعة</option>
                    <option value="approved">معتمد</option>
                    <option value="rejected">مرفوض</option>
                  </select>
                </div>
              </div>

              {selfLearningItems.length === 0 ? (
                <div className="rounded-2xl border border-navy-800 bg-navy-900/60 p-12 text-center text-slate-500 text-sm">
                  لا توجد أسئلة تطابق الفلاتر المحددة.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    {selfLearningItems.map((it) => {
                      const isApproving = approvingItemId === it.id;
                      const isPending = it.status === 'pending';

                      return (
                        <div
                          key={it.id}
                          className="rounded-2xl border border-navy-800 bg-navy-900/60 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white flex items-center gap-1">
                                <HelpCircle className="h-3.5 w-3.5 text-gold-400" />
                                <span>{it.grade || 'عام'}</span>
                                {it.unit && <span>- {it.unit}</span>}
                              </span>
                            </div>

                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                it.status === 'approved'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : it.status === 'rejected'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-amber-500/20 text-amber-400'
                              }`}
                            >
                              {it.status === 'approved'
                                ? 'معتمد'
                                : it.status === 'rejected'
                                  ? 'مرفوض'
                                  : 'قيد المراجعة'}
                            </span>
                          </div>

                          <div className="rounded-xl bg-navy-950/80 p-3 border border-navy-800 text-xs text-slate-200">
                            <p className="whitespace-pre-line">{it.text}</p>
                          </div>

                          {isPending && (
                            <>
                              {!isApproving ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setApprovingItemId(it.id);
                                      setApproveAnswer('');
                                    }}
                                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition-colors"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    <span>اعتماد فردي مع إجابة</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleRejectSelfLearning(it.id)}
                                    className="flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 transition-colors"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    <span>رفض</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="rounded-xl border border-emerald-500/40 bg-navy-950 p-4 space-y-3">
                                  <label className="text-[11px] text-emerald-400 block font-bold">
                                    اكتب الإجابة النموذجية المعتمدة لهذا السؤال:
                                  </label>
                                  <textarea
                                    rows={3}
                                    value={approveAnswer}
                                    onChange={(e) => setApproveAnswer(e.target.value)}
                                    placeholder="نص الإجابة النموذجية..."
                                    className="w-full rounded-lg border border-navy-700 bg-navy-900 p-2 text-xs text-white"
                                  />

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleApproveSelfLearning(it.id)}
                                      disabled={savingSelfLearning || !approveAnswer.trim()}
                                      className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition-colors disabled:opacity-50"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      <span>{savingSelfLearning ? 'جاري الاعتماد...' : 'تأكيد الاعتماد'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setApprovingItemId(null)}
                                      className="rounded-lg border border-navy-700 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                                    >
                                      إلغاء
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* شريط ترقيم الصفحات Pagination */}
                  {totalSelfLearningPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-navy-800 pt-4 text-xs text-slate-400">
                      <span>
                        عرض {(currentSelfLearningPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                        {Math.min(currentSelfLearningPage * ITEMS_PER_PAGE, selfLearningTotal)}{' '}
                        من أصل {selfLearningTotal} سؤال
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={currentSelfLearningPage <= 1}
                          onClick={() => setSelfLearningPage((p) => Math.max(1, p - 1))}
                          className="flex items-center gap-1 rounded-lg border border-navy-700 bg-navy-900 px-3 py-1.5 text-white disabled:opacity-40"
                        >
                          <ChevronRight className="h-4 w-4" />
                          <span>السابق</span>
                        </button>

                        <span className="font-bold text-white px-2">
                          صفحة {currentSelfLearningPage} من {totalSelfLearningPages}
                        </span>

                        <button
                          type="button"
                          disabled={currentSelfLearningPage >= totalSelfLearningPages}
                          onClick={() => setSelfLearningPage((p) => Math.min(totalSelfLearningPages, p + 1))}
                          className="flex items-center gap-1 rounded-lg border border-navy-700 bg-navy-900 px-3 py-1.5 text-white disabled:opacity-40"
                        >
                          <span>التالي</span>
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

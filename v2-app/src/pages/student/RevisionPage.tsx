import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { listEnrolledCourses, Course } from '../../services/courses';
import { parseExamResults } from '../../services/assessments';
import {
  buildSkillMapFromCourses,
  convertAttemptsToAnswerEvents,
  extractPracticeQuestionsFromCourses,
  createLocalStore,
  mergeEvents,
  type AnswerEvent,
  type Plan,
  type QuestionMeta,
  type ProgressStore
} from '../../lib/revision/index';
import RevisionDashboard, { type SkillInfo } from '../../components/revision/RevisionDashboard';
import PracticeRunner, { type PracticeQuestion } from '../../components/revision/PracticeRunner';

export default function RevisionPage() {
  const { student } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // حالة جلسة المراجعة الحالية
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [sessionFinished, setSessionFinished] = useState<{ correct: number; total: number } | null>(null);

  // مخزن التقدم المحلي المخصص للطالب
  const studentId = student?.id || student?.phone || 'student_local';
  const store: ProgressStore = useMemo(() => createLocalStore(studentId), [studentId]);
  const [localEvents, setLocalEvents] = useState<AnswerEvent[]>([]);

  // تحميل الكورسات والتقدم المحلي
  const loadData = useCallback(async () => {
    if (!student) return;
    setLoading(true);
    setError(null);
    try {
      const [fetchedCourses, savedLocal] = await Promise.all([
        listEnrolledCourses(student),
        Promise.resolve(store.load()),
      ]);
      setCourses(fetchedCourses);
      setLocalEvents(savedLocal);
    } catch (err: any) {
      console.error('Error loading revision data:', err);
      setError('تعذر تحميل بيانات المراجعة. يُرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [student, store]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // استخراج المهارات وخريطة ربط الأسئلة
  const { skills, questionToSkill } = useMemo(() => {
    return buildSkillMapFromCourses(courses);
  }, [courses]);

  // استخراج أسئلة المراجعة (MCQ) من الكورسات
  const { practiceQuestions, questionMetas } = useMemo(() => {
    return extractPracticeQuestionsFromCourses(courses);
  }, [courses]);

  // تحويل محاولات الطالب في الامتحانات إلى أحداث إجابة
  const examEvents = useMemo(() => {
    const rawAttempts = parseExamResults(student?.examResults);
    const { events } = convertAttemptsToAnswerEvents(rawAttempts as any, questionToSkill);
    return events;
  }, [student?.examResults, questionToSkill]);

  // دمج أحداث الامتحانات والتدريبات مع أحداث المراجعة المحلية
  const allEvents = useMemo(() => {
    return mergeEvents(examEvents, localEvents);
  }, [examEvents, localEvents]);

  // دالة البحث عن السؤال للممارس (PracticeRunner)
  const questionMap = useMemo(() => {
    return new Map(practiceQuestions.map((q) => [q.id, q]));
  }, [practiceQuestions]);

  const getQuestion = useCallback((id: string): PracticeQuestion | undefined => {
    return questionMap.get(id);
  }, [questionMap]);

  // معالجة كل إجابة في جلسة المراجعة مع منع الفشل الصامت
  const handleAnswer = useCallback((event: AnswerEvent) => {
    store.append([event]).catch((err: any) => {
      console.error('Failed to append revision event:', err);
      setSaveError('تنبيه: تعذر حفظ تقدم الإجابة محليًا على هذا الجهاز (المساحة ممتلئة أو التخزين معطل).');
    });
    setLocalEvents((prev) => [...prev, event]);
    setSaveError(null);
  }, [store]);

  // إنهاء الجلسة
  const handleFinish = useCallback((result: { correct: number; total: number }) => {
    setSessionFinished(result);
    setActivePlan(null);
  }, []);

  // العودة من الجلسة
  const handleBackToDashboard = () => {
    setActivePlan(null);
    setSessionFinished(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="h-8 w-8 animate-spin text-theme-gold" aria-hidden="true" />
        <p className="mt-4 text-theme-muted">جاري تجهيز خطة المراجعة الذكية الخاصة بك...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-rose-300">
          <AlertCircle className="mx-auto h-8 w-8" />
          <p className="mt-2 font-medium">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-theme-surface px-4 py-2 text-sm text-theme-text shadow hover:bg-theme-surface/80"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  // وضع الجلسة النشطة
  if (activePlan) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-theme-border/15 pb-4">
          <button
            type="button"
            onClick={handleBackToDashboard}
            className="inline-flex items-center gap-2 text-sm font-medium text-theme-muted hover:text-theme-text transition-colors"
          >
            <ArrowRight className="h-4 w-4" />
            العودة إلى لوحة المراجعة
          </button>
          <div className="flex items-center gap-2 text-theme-gold">
            <Sparkles className="h-5 w-5" />
            <span className="font-bold text-sm">جلسة مراجعة مخصصة</span>
          </div>
        </div>

        {saveError && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <PracticeRunner
          plan={activePlan}
          getQuestion={getQuestion}
          onAnswer={handleAnswer}
          onFinish={handleFinish}
        />
      </div>
    );
  }

  // نتيجة جلسة مكتملة للتو
  if (sessionFinished) {
    const percent = Math.round((sessionFinished.correct / Math.max(sessionFinished.total, 1)) * 100);
    return (
      <div className="p-4 md:p-8 max-w-xl mx-auto space-y-6">
        <div className="rounded-3xl border border-theme-border/20 bg-theme-surface p-8 text-center shadow-soft">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <Sparkles className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-theme-text">اكتملت جلسة المراجعة بنجاح!</h2>
          <p className="mt-2 text-sm text-theme-muted">
            تم تسجيل إجاباتك وتحديث مستوى إتقانك لكل درس وتعديل مواعيد التكرار المتباعد.
          </p>

          <div className="my-6 rounded-2xl bg-theme-base/50 p-6">
            <p className="text-xs text-theme-muted">النتيجة في هذه الجلسة</p>
            <p className="mt-1 font-num text-4xl font-extrabold text-theme-gold">
              {sessionFinished.correct} / {sessionFinished.total}
            </p>
            <p className="mt-1 font-num text-sm font-semibold text-emerald-400">
              {percent}% إجابات صحيحة
            </p>
          </div>

          <button
            type="button"
            onClick={handleBackToDashboard}
            className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-sm font-bold text-slate-950 shadow-md hover:from-amber-400 hover:to-amber-500 transition-all"
          >
            العودة إلى لوحة المراجعة
          </button>
        </div>
      </div>
    );
  }

  // الحالة الفارغة: لا توجد بيانات كافية (صفر محاولات وصفر أسئلة)
  const hasNoData = skills.length === 0 || (allEvents.length === 0 && practiceQuestions.length === 0);

  if (hasNoData) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="rounded-3xl border border-theme-border/20 bg-theme-surface p-8 md:p-12 text-center shadow-soft">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-theme-gold/10 text-theme-gold">
            <Sparkles className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-xl font-bold text-theme-text">المراجعة الذكية الشخصية</h2>
          <p className="mt-3 text-sm leading-relaxed text-theme-muted">
            لا توجد بيانات كافية لبدء المراجعة الذكية حتى الآن. يقوم هذا المحرك بتحليل نتائجك في التدريبات والامتحانات لبناء خطة مراجعة يومية مخصصة بنظام التكرار المتباعد (SM-2).
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/student/exams"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-theme-gold px-6 py-3 text-sm font-bold text-slate-950 hover:bg-theme-gold/90 transition-colors shadow-soft"
            >
              <BookOpen className="h-4 w-4" />
              ابدأ أول تدريب أو امتحان
            </Link>
            <Link
              to="/student/my-courses"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border border-theme-border/30 bg-theme-surface px-6 py-3 text-sm font-semibold text-theme-text hover:bg-theme-base/40 transition-colors"
            >
              استعراض محاضراتي
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // العرض الرئيسي: لوحة المراجعة الذكية
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-theme-border/15 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-theme-gold/15 text-theme-gold">
              <Sparkles className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold text-theme-text">المراجعة الذكية</h1>
          </div>
          <p className="mt-1.5 text-xs sm:text-sm text-theme-muted">
            خطة مراجعة شخصية يومية مبنية على إجاباتك بنظام التكرار المتباعد ونموذج بيتا للإتقان.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            title="تحديث البيانات"
            className="inline-flex items-center gap-1.5 rounded-xl border border-theme-border/30 bg-theme-surface px-3 py-2 text-xs font-semibold text-theme-muted hover:text-theme-text hover:bg-theme-surface/80 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {saveError && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* لوحة تحكم المراجعة */}
      <RevisionDashboard
        skills={skills}
        questions={questionMetas}
        events={allEvents}
        onStart={(plan) => setActivePlan(plan)}
      />
    </div>
  );
}

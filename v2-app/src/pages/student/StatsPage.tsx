import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clapperboard,
  Clock,
  FileText,
  Flame,
  HelpCircle,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { Badge, Card, EmptyState, ProgressBar, Spinner, StatCard, Button } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCourses } from '../../hooks/useCourses';
import {
  checkLectureLock,
  checkInLectureItemLock,
  formatCairoDateTime,
  DEFAULT_CONTENT_RULES,
} from '../../lib/contentRules';
import { parseExamResults } from '../../services/assessments';
import { getCairoWeekBoundaries } from '../../lib/radar';

export default function StatsPage() {
  const { student, isAdmin } = useAuth();
  const { courses, loading } = useCourses();
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  const attempts = useMemo(() => parseExamResults(student?.examResults), [student]);

  // Current enrolled courses
  const enrolledCourses = useMemo(() => {
    if (!student || !courses.length) return [];
    return courses.filter((c) => student.courses.includes(c.id));
  }, [student, courses]);

  // Active selected course
  const activeCourse = useMemo(() => {
    if (!enrolledCourses.length) return null;
    return enrolledCourses.find((c) => c.id === selectedCourseId) || enrolledCourses[0];
  }, [enrolledCourses, selectedCourseId]);

  // Cairo week rhythm
  const weekBoundaries = useMemo(() => getCairoWeekBoundaries(Date.now()), []);

  // Baseline Fresh Start check
  const hasBaseline = Boolean(student && (student as any).baselineAt);
  const baselineAt = hasBaseline ? (student as any).baselineAt : null;

  // Compute lectures progress and status for active course
  const lectureStatusList = useMemo(() => {
    if (!activeCourse || !student) return [];

    const lectures = activeCourse.content?.lectures || [];
    const watchProgress = student.watchProgress || {};
    const rules = DEFAULT_CONTENT_RULES; // or platform rules

    return lectures.map((lec, idx) => {
      const lockStatus = checkLectureLock(
        activeCourse,
        idx,
        student,
        watchProgress,
        attempts,
        rules,
        Date.now(),
        isAdmin
      );

      // Video progress
      const p = watchProgress[lec.id];
      const watchPct =
        typeof p === 'number'
          ? Math.min(100, Math.round(p > 1 ? p : p * 100))
          : 0;

      // Trainings status
      const trainings = (lec.trainings || []).map((tr) => {
        const submitted = attempts.some(
          (a) => a.examId === tr.id || (a as any).assessmentId === tr.id
        );
        const trLock = checkInLectureItemLock(
          lec,
          tr,
          'training',
          student,
          watchProgress,
          rules,
          activeCourse.id,
          Date.now(),
          isAdmin
        );
        return {
          id: tr.id,
          title: tr.title,
          submitted,
          locked: trLock.locked,
          lockMessage: trLock.message,
        };
      });

      // Homeworks status
      const homeworks = (lec.homeworks || []).map((hw) => {
        const submitted = attempts.some(
          (a) => a.examId === hw.id || (a as any).assessmentId === hw.id
        );
        const hwLock = checkInLectureItemLock(
          lec,
          hw,
          'homework',
          student,
          watchProgress,
          rules,
          activeCourse.id,
          Date.now(),
          isAdmin
        );
        return {
          id: hw.id,
          title: hw.title,
          submitted,
          locked: hwLock.locked,
          lockMessage: hwLock.message,
        };
      });

      return {
        index: idx,
        id: lec.id,
        title: lec.title,
        order: lec.order,
        watchPct,
        isLocked: lockStatus.locked,
        lockReason: lockStatus.reason,
        lockMessage: lockStatus.message,
        trainings,
        homeworks,
        files: lec.files || [],
        isCompleted:
          watchPct >= 95 &&
          trainings.every((t) => t.submitted) &&
          homeworks.every((h) => h.submitted),
      };
    });
  }, [activeCourse, student, attempts, isAdmin]);

  // Determine "أنت دلوقتي" (Current step)
  const currentStep = useMemo(() => {
    if (!lectureStatusList.length) return null;
    const currentLec = lectureStatusList.find((l) => !l.isCompleted) || lectureStatusList[0];

    let actionLabel = 'مشاهدة الفيديو';
    let actionType: 'video' | 'training' | 'homework' = 'video';
    let targetItemId: string = currentLec.id;

    if (currentLec.watchPct < 95) {
      actionLabel = `مشاهدة فيديو المحاضرة (${currentLec.watchPct}%)`;
      actionType = 'video';
    } else {
      const pendingTr = currentLec.trainings.find((t) => !t.submitted);
      if (pendingTr) {
        actionLabel = `حل ${pendingTr.title}`;
        actionType = 'training';
        targetItemId = pendingTr.id;
      } else {
        const pendingHw = currentLec.homeworks.find((h) => !h.submitted);
        if (pendingHw) {
          actionLabel = `تسليم ${pendingHw.title}`;
          actionType = 'homework';
          targetItemId = pendingHw.id;
        }
      }
    }

    return {
      lectureIndex: currentLec.index + 1,
      lectureTitle: currentLec.title,
      actionLabel,
      actionType,
      targetItemId,
      courseId: activeCourse?.id || '',
    };
  }, [lectureStatusList, activeCourse]);

  // List of overdue items (المتأخر عليك)
  const overdueItems = useMemo(() => {
    if (!lectureStatusList.length) return [];
    const list: Array<{
      title: string;
      typeLabel: string;
      courseId: string;
      itemId: string;
      daysLate: number;
    }> = [];

    lectureStatusList.forEach((lec) => {
      if (lec.isLocked) return;
      if (lec.watchPct < 95) {
        list.push({
          title: `فيديو: ${lec.title}`,
          typeLabel: 'محاضرة',
          courseId: activeCourse?.id || '',
          itemId: lec.id,
          daysLate: 2,
        });
      }
      lec.trainings.forEach((tr) => {
        if (!tr.submitted && !tr.locked) {
          list.push({
            title: tr.title,
            typeLabel: 'تدريب',
            courseId: activeCourse?.id || '',
            itemId: tr.id,
            daysLate: 1,
          });
        }
      });
      lec.homeworks.forEach((hw) => {
        if (!hw.submitted && !hw.locked) {
          list.push({
            title: hw.title,
            typeLabel: 'واجب',
            courseId: activeCourse?.id || '',
            itemId: hw.id,
            daysLate: 3,
          });
        }
      });
    });

    return list;
  }, [lectureStatusList, activeCourse]);

  if (!student) return null;

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-gold-400">
        <Spinner size="lg" />
      </div>
    );
  }

  if (enrolledCourses.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl py-10" dir="rtl">
        <Card className="p-8 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-gold-400/80 mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">أنت غير مشترك في أي كورس حاليًا</h2>
          <p className="text-sm text-slate-400 mb-5">
            تصفح الكورسات المتاحة واشترك لتظهر كل إحصائياتك وتقدمك هنا.
          </p>
          <Link to="/courses" className="inline-block rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-black text-navy-950">
            تصفح الكورسات
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6" dir="rtl">
      {/* Page Title & Course Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-white md:text-3xl">
            <Trophy className="h-7 w-7 text-gold-400" /> إحصائياتي وتقدّمي
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            متابعة دقيقة لكل درس ومشاهدة وواجب، بدون لوم وبلغة تشجعك على الاستمرار.
          </p>
        </div>

        {enrolledCourses.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">الكورس:</span>
            <select
              value={activeCourse?.id || ''}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="rounded-xl border border-navy-700 bg-navy-900 px-3 py-1.5 text-xs font-bold text-white focus:border-gold-500 focus:outline-none"
            >
              {enrolledCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Fresh Start Banner (إذا كان هناك تصفير) */}
      {hasBaseline && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-bold text-emerald-300">بداية جديدة يا بطل! 🌟</p>
            <p className="mt-0.5 text-xs leading-relaxed text-emerald-200/90">
              تم تصفير مؤشرات التأخر السابقة لتنطلق بصفحة بيضاء. التزم بالجدول القادم وكل التوفيق لك!
            </p>
          </div>
        </div>
      )}

      {/* "أنت دلوقتي" Banner */}
      {currentStep && (
        <Card className="relative overflow-hidden border-gold-500/30 bg-gradient-to-r from-navy-900 via-navy-900/90 to-gold-500/10 p-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/20 px-3 py-0.5 text-xs font-bold text-gold-300 border border-gold-500/30">
                <Flame className="h-3.5 w-3.5 text-gold-400" /> أنت دلوقتي هنا:
              </span>
              <h2 className="text-lg font-black text-white">
                المحاضرة {currentStep.lectureIndex}: {currentStep.lectureTitle}
              </h2>
              <p className="text-xs text-slate-300 flex items-center gap-1.5">
                <span>الخطوة المطلوبة منك:</span>
                <span className="font-bold text-gold-400">{currentStep.actionLabel}</span>
              </p>
            </div>

            <Link
              to={
                currentStep.actionType === 'video'
                  ? `/courses/${currentStep.courseId}`
                  : `/student/assessment/${currentStep.courseId}/${currentStep.targetItemId}`
              }
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 px-5 py-2.5 text-xs font-black text-navy-950 shadow-md shadow-gold-500/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Play className="h-4 w-4 fill-navy-950" />
              <span>كمّل مذاكرتك الآن</span>
            </Link>
          </div>
        </Card>
      )}

      {/* Cairo Weekly Rhythm Card */}
      <Card className="p-4 border-navy-800 bg-navy-900/60">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-gold-400" />
          <h3 className="text-xs font-bold text-white">جدول أسبوعك المنتظم (بتوقيت القاهرة):</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-navy-800 bg-navy-950/70 p-3">
            <div className="font-bold text-gold-400 mb-1 flex items-center gap-1.5">
              <Clapperboard className="h-3.5 w-3.5" />
              <span>الخميس 9:00 م</span>
            </div>
            <p className="text-slate-300 text-[11px]">نزول المحاضرة الجديدة وتدريبها الفوري</p>
          </div>
          <div className="rounded-xl border border-navy-800 bg-navy-950/70 p-3">
            <div className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span>الثلاثاء 9:00 م</span>
            </div>
            <p className="text-slate-300 text-[11px]">الموعد الأخير لتسليم واجب المحاضرة</p>
          </div>
          <div className="rounded-xl border border-navy-800 bg-navy-950/70 p-3">
            <div className="font-bold text-blue-400 mb-1 flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5" />
              <span>الأربعاء 9:00 م</span>
            </div>
            <p className="text-slate-300 text-[11px]">امتحان التقييم الأسبوعي الشامل</p>
          </div>
        </div>
      </Card>

      {/* Overdue Items (المتأخر عليك) */}
      {overdueItems.length > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white">
              متأخر عليك ({overdueItems.length} عناصر):
            </h3>
          </div>
          <div className="space-y-2">
            {overdueItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 rounded-xl border border-navy-800 bg-navy-950/80 p-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{item.title}</span>
                    <Badge variant="gold" className="text-[10px]">
                      {item.typeLabel}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    مستحق منذ {item.daysLate} أيام
                  </p>
                </div>
                <Link
                  to={
                    item.typeLabel === 'محاضرة'
                      ? `/courses/${item.courseId}`
                      : `/student/assessment/${item.courseId}/${item.itemId}`
                  }
                  className="rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-bold text-navy-950 hover:bg-gold-400 transition-colors"
                >
                  كمّل
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Detailed Per-Lecture Status (حالة كل الدروس) */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-gold-400" />
          <span>خطة دروس الكورس وتفاصيل الإنجاز:</span>
        </h3>

        <div className="space-y-3">
          {lectureStatusList.map((lec) => (
            <Card
              key={lec.id}
              className={`p-4 transition-all ${
                lec.isLocked
                  ? 'opacity-65 border-navy-800 bg-navy-950/40'
                  : 'border-navy-700 bg-navy-900/80'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`grid h-9 w-9 place-items-center rounded-xl font-black text-xs ${
                      lec.isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : lec.isLocked
                          ? 'bg-navy-800 text-slate-400'
                          : 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                    }`}
                  >
                    {lec.isCompleted ? <CheckCircle2 className="h-5 w-5" /> : lec.order}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{lec.title}</span>
                      {lec.isLocked && <Lock className="h-3.5 w-3.5 text-amber-400" />}
                    </h4>
                    {lec.isLocked && (
                      <p className="mt-0.5 text-xs text-amber-300/90 font-medium">
                        معطّل فتح الدرس: {lec.lockMessage || 'أكمل المتطلبات السابقة أولاً'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Video progress indicator */}
                {!lec.isLocked && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">الفيديو:</span>
                    <div className="h-2 w-20 overflow-hidden rounded-full bg-navy-800">
                      <div
                        className="h-full bg-gold-500"
                        style={{ width: `${lec.watchPct}%` }}
                      />
                    </div>
                    <span className="font-bold text-white">{lec.watchPct}%</span>
                  </div>
                )}
              </div>

              {/* In-lecture assessments grid */}
              {!lec.isLocked && (
                <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-navy-800/80 pt-3 text-xs">
                  {lec.trainings.map((tr) => (
                    <div
                      key={tr.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-navy-950/60 p-2.5 border border-navy-800"
                    >
                      <div className="truncate">
                        <span className="text-slate-400 text-[10px] block">تدريب تفاعلي:</span>
                        <span className="font-bold text-white truncate">{tr.title}</span>
                      </div>
                      <div>
                        {tr.submitted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> تم الحل
                          </span>
                        ) : tr.locked ? (
                          <span className="text-[11px] text-amber-400/80 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> مقفول
                          </span>
                        ) : (
                          <Link
                            to={`/student/assessment/${activeCourse?.id}/${tr.id}`}
                            className="rounded-lg bg-gold-500/20 px-2 py-1 text-[11px] font-bold text-gold-300 hover:bg-gold-500/30"
                          >
                            حل الآن
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}

                  {lec.homeworks.map((hw) => (
                    <div
                      key={hw.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-navy-950/60 p-2.5 border border-navy-800"
                    >
                      <div className="truncate">
                        <span className="text-slate-400 text-[10px] block">واجب المحاضرة:</span>
                        <span className="font-bold text-white truncate">{hw.title}</span>
                      </div>
                      <div>
                        {hw.submitted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> تم التسليم
                          </span>
                        ) : hw.locked ? (
                          <span className="text-[11px] text-amber-400/80 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> مقفول
                          </span>
                        ) : (
                          <Link
                            to={`/student/assessment/${activeCourse?.id}/${hw.id}`}
                            className="rounded-lg bg-gold-500/20 px-2 py-1 text-[11px] font-bold text-gold-300 hover:bg-gold-500/30"
                          >
                            ابدأ الواجب
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

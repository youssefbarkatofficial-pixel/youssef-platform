import { recordDownloadClick, getAllLocalWatchProgress } from '../../services/watchProgress';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  EyeOff,
  FileText,
  Lock,
  PlayCircle,
  ServerCrash,
  ShieldCheck,
  Calendar,
  Clock,
  Sparkles,
  Gift,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import CoursePrice from '../../components/course/CoursePrice';
import LectureStationBadges from '../../components/course/LectureStationBadges';
import CourseTocSidebar from '../../components/course/CourseTocSidebar';
import { getCourseAccessStatus, BASE_MONTHLY_PRICE } from '../../lib/subscriptions';
import { claimTrialLecture, claimFreeMonthlyPromo } from '../../services/students';
import ProtectedVideoPlayer from '../../components/course/ProtectedVideoPlayer';
import { Badge, Button, Card, EmptyState, Modal, Spinner, Tabs, buttonClasses, useToast } from '../../components/ui';
import { cn } from '../../components/ui/cn';
import { useAuth } from '../../hooks/useAuth';
import { useCourse } from '../../hooks/useCourses';
import { getGradeLabel } from '../../lib/grades';
import { canAccessCourseContent } from '../../services/courses';
import type { CourseItem } from '../../services/courses';
import { markVideoWatched } from '../../services/progress';
import { getContentRules } from '../../services/contentRules';
import {
  checkLectureLock,
  checkInLectureItemLock,
  formatCairoDateTime,
  DEFAULT_CONTENT_RULES,
} from '../../lib/contentRules';
import type { ContentRulesSettings } from '../../lib/contentRules';
import type { LectureFile } from '../../lib/courseNormalize';

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card>{children}</Card>
    </div>
  );
}

function LectureFilesSection({
  lecture,
  student,
  effectiveWatch,
  contentRules,
  courseId,
  isAdmin,
}: {
  lecture: any;
  student: any;
  effectiveWatch: Record<string, number>;
  contentRules: ContentRulesSettings;
  courseId: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const files: LectureFile[] =
    lecture.files && lecture.files.length > 0
      ? lecture.files
      : lecture.pdfUrl
        ? [{ id: `f_${lecture.id}`, title: 'تحميل المذكرة (PDF)', url: lecture.pdfUrl }]
        : [];

  if (files.length === 0) return null;

  if (files.length === 1) {
    const file = files[0];
    const lock = checkInLectureItemLock(
      lecture,
      file,
      'file',
      student,
      effectiveWatch,
      contentRules,
      courseId,
      Date.now(),
      isAdmin
    );

    if (lock.locked) {
      return (
        <span
          className="flex items-center gap-1.5 rounded-lg border border-navy-800 bg-navy-950/70 px-2.5 py-1 text-xs text-amber-300"
          title={lock.message}
        >
          <Lock className="h-3.5 w-3.5 text-amber-400" />
          <span>{lock.message || 'المذكرة مقفولة'}</span>
        </span>
      );
    }

    return (
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          if (student?.id) void recordDownloadClick(student.id, courseId, lecture.id, file.id);
        }}
        className={buttonClasses({ variant: 'secondary', size: 'sm' })}
      >
        <FileText className="h-4 w-4 text-gold-400" />
        {file.title || 'تحميل المذكرة'}
      </a>
    );
  }

  return (
    <div className="relative inline-block text-start">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5"
      >
        <FileText className="h-4 w-4 text-gold-400" />
        <span>المرفقات ({files.length})</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </Button>

      {open && (
        <div className="absolute end-0 top-full z-20 mt-1 min-w-[220px] space-y-1 rounded-xl border border-navy-700 bg-navy-900 p-2 shadow-xl">
          {files.map((file) => {
            const lock = checkInLectureItemLock(
              lecture,
              file,
              'file',
              student,
              effectiveWatch,
              contentRules,
              courseId,
              Date.now(),
              isAdmin
            );

            if (lock.locked) {
              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-navy-950/60 px-2.5 py-2 text-xs text-slate-400"
                >
                  <span className="truncate">{file.title || 'ملف المحاضرة'}</span>
                  <span className="flex items-center gap-1 text-[11px] text-amber-300 shrink-0">
                    <Lock className="h-3 w-3 text-amber-400" />
                    مقفول
                  </span>
                </div>
              );
            }

            return (
              <a
                key={file.id}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (student?.id) void recordDownloadClick(student.id, courseId, lecture.id, file.id);
                }}
                className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-navy-800 hover:text-gold-300"
              >
                <span className="truncate">{file.title || 'تحميل الملف'}</span>
                <FileText className="h-3.5 w-3.5 shrink-0 text-gold-400" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CourseDetailsPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { course, loading, error, reload } = useCourse(courseId);
  const { firebaseUser, student, isAdmin, loading: authLoading, refresh } = useAuth();
  const { showToast } = useToast();
  const [marking, setMarking] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'about'>('content');
  const [searchParams] = useSearchParams();
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [monthlyModalOpen, setMonthlyModalOpen] = useState(false);
  const [claimingTrial, setClaimingTrial] = useState(false);
  const [claimingMonthly, setClaimingMonthly] = useState(false);

  const [contentRules, setContentRules] = useState<ContentRulesSettings>(DEFAULT_CONTENT_RULES);
  const [localWatch, setLocalWatch] = useState<Record<string, number>>(() => {
    return student?.id ? getAllLocalWatchProgress(student.id) : {};
  });

  useEffect(() => {
    if (student?.id) {
      setLocalWatch((prev) => ({ ...getAllLocalWatchProgress(student.id), ...prev }));
    }
  }, [student?.id]);

  useEffect(() => {
    getContentRules().then(setContentRules).catch((err) => {
      console.warn('Could not fetch content rules:', err);
    });
  }, []);

  const effectiveWatch = { ...(student?.watchProgress || {}), ...localWatch };

  // التحقق من المطالبات السابقة للمحاضرة المجانية والشهري
  const progressObj = student?.progress as Record<string, unknown> | undefined;
  const hasClaimedTrialBefore = Boolean(
    progressObj?.trials &&
    typeof progressObj.trials === 'object' &&
    (progressObj.trials as Record<string, unknown>)[course?.id || '']
  );
  const hasClaimedMonthlyBefore = Boolean(
    progressObj?.monthlyPromos &&
    typeof progressObj.monthlyPromos === 'object' &&
    (progressObj.monthlyPromos as Record<string, unknown>)[course?.id || '']
  );

  const sortedLectures = course?.content?.lectures
    ? [...course.content.lectures].sort((a, b) => b.order - a.order)
    : [];
  const latestLecture = sortedLectures[0];

  const handleClaimTrial = async () => {
    if (!student || !course) return;
    setClaimingTrial(true);
    try {
      const res = await claimTrialLecture(student.id, course);
      if (res.success) {
        showToast(res.message, 'success');
        setTrialModalOpen(false);
        await refresh();
        await reload();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تفعيل المحاضرة التجريبية', 'error');
    } finally {
      setClaimingTrial(false);
    }
  };

  const handleClaimMonthlyPromo = async () => {
    if (!student || !course) return;
    setClaimingMonthly(true);
    try {
      const res = await claimFreeMonthlyPromo(student.id, course);
      if (res.success) {
        showToast(res.message, 'success');
        setMonthlyModalOpen(false);
        await refresh();
        await reload();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تفعيل الاشتراك الشهري', 'error');
    } finally {
      setClaimingMonthly(false);
    }
  };

  const [activeItem, setActiveItem] = useState<CourseItem | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const playerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeItem) {
      playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeItem]);

  const canAccess = Boolean(course && canAccessCourseContent(course, student, isAdmin));
  const grantStatus = getCourseAccessStatus(course, student, isAdmin);

  // فتح نافذة التفعيل تلقائياً عند عودة الزائر بعد التسجيل
  useEffect(() => {
    if (student && !canAccess) {
      const action = searchParams.get('action');
      if (action === 'trial' && !hasClaimedTrialBefore) setTrialModalOpen(true);
      if (action === 'monthly' && !hasClaimedMonthlyBefore) setMonthlyModalOpen(true);
    }
  }, [student, canAccess, searchParams, hasClaimedTrialBefore, hasClaimedMonthlyBefore]);

  useEffect(() => {
    if (!canAccess) {
      const updateBar = () => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
          document.documentElement.style.setProperty('--yb-bottom-bar', '84px');
        } else {
          document.documentElement.style.removeProperty('--yb-bottom-bar');
        }
      };
      updateBar();
      window.addEventListener('resize', updateBar);
      return () => {
        window.removeEventListener('resize', updateBar);
        document.documentElement.style.removeProperty('--yb-bottom-bar');
      };
    } else {
      document.documentElement.style.removeProperty('--yb-bottom-bar');
    }
  }, [canAccess]);

  if (loading || authLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-gold-400">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <CenteredMessage>
        <EmptyState
          icon={ServerCrash}
          title="تعذر تحميل الكورس"
          description="تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى."
          action={<Button onClick={reload}>إعادة المحاولة</Button>}
        />
      </CenteredMessage>
    );
  }

  if (!course) {
    return (
      <CenteredMessage>
        <EmptyState
          icon={BookOpen}
          title="الكورس غير موجود"
          description="الرابط غير صحيح أو تم نقل الكورس."
          action={
            <Link to="/courses" className={buttonClasses({ variant: 'primary' })}>
              تصفح الكورسات
            </Link>
          }
        />
      </CenteredMessage>
    );
  }

  // canAccess computed above

  // المسودات المحفوظة من الإدارة لا تظهر للطلاب (تظهر للأدمن بشارة "مسودة")
  const isDraftAssessment = (item: { raw?: Record<string, unknown> }) =>
    item.raw?.isDraft === true || item.raw?.hidden === true;
  const visibleHomeworks = course.content.homeworks.filter((hw) => isAdmin || !isDraftAssessment(hw));
  const visibleExams = course.content.exams.filter((ex) => isAdmin || !isDraftAssessment(ex));

  const attachedHomeworkIds = new Set(
    course.content.lectures.flatMap((lec) => (lec.homeworks || []).map((hw) => hw.id)),
  );
  const looseHomeworks = visibleHomeworks.filter((hw) => !attachedHomeworkIds.has(hw.id));

  if (course.hidden && !canAccess) {
    return (
      <CenteredMessage>
        <EmptyState
          icon={EyeOff}
          title="هذا الكورس غير متاح حاليًا"
          description="الكورس غير منشور في الوقت الحالي."
          action={
            <Link to="/courses" className={buttonClasses({ variant: 'primary' })}>
              تصفح الكورسات
            </Link>
          }
        />
      </CenteredMessage>
    );
  }


  // تعليم المحاضرة كمشاهَدة (للطالب المشترك فقط، وليس معاينة الأدمن). تغذي الإحصائيات ونسبة المشاهدة.
  const canTrackProgress = canAccess && !isAdmin && student !== null && !student.archived;
  const activeWatched =
    activeItem !== null &&
    student !== null &&
    (student.watchProgress[activeItem.id] ?? 0) >= 100;

  const handleMarkWatched = async () => {
    if (!student || !activeItem) return;
    setMarking(true);
    try {
      await markVideoWatched(student.id, course.id, activeItem.id);
      await refresh();
      showToast('تم تسجيل المحاضرة كمشاهَدة.', 'success');
    } catch {
      showToast('تعذر تسجيل المشاهدة. حاول مرة أخرى.', 'error');
    } finally {
      setMarking(false);
    }
  };

  const gradeLabel = course.grade ? getGradeLabel(course.grade) : course.rawGrade;
  const watermarkText = student ? `${student.name} | ${student.phone}` : (firebaseUser?.email ?? '');

  let statusBox;
  if (canAccess) {
    statusBox = (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-3 text-sm font-bold text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {isAdmin ? (
            'معاينة الأدمن: يمكنك رؤية كل المحتوى'
          ) : course.isFree ? (
            'كورس مجاني'
          ) : grantStatus.plan === 'monthly' ? (
            `مشترك باشتراك شهري (متبقي ${grantStatus.remainingDays} يوم)`
          ) : grantStatus.plan === 'trial_lecture' ? (
            `تشاهد المحاضرة التجريبية (#${grantStatus.targetLectureOrder})`
          ) : (
            'أنت مشترك في هذا الكورس (ترم كامل)'
          )}
        </div>

        {/* تنبيه تجديد الاشتراك الشهري بخصومات 25% أو 15% */}
        {grantStatus.plan === 'monthly' && grantStatus.renewalStage === 'discount_25' && (
          <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-200 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-sky-300">
              <Clock className="h-4 w-4" />
              <span>تجديد الاشتراك بخصم 25%</span>
            </div>
            <p className="leading-relaxed text-slate-300">
              متبقي {grantStatus.remainingDays} أيام! جدد الآن بـ {grantStatus.renewalPrice} ج بدلاً من {BASE_MONTHLY_PRICE} ج.
              تنبيه: بعد انتهاء الـ 5 أيام، سيتم إغلاق الاشتراك الشهري نهائياً ويتاح الترم كامل فقط.
            </p>
            <Button
              size="sm"
              variant="primary"
              fullWidth
              onClick={() => navigate(`/student/checkout/${course.id}?plan=monthly_renewal_25`)}
            >
              جدد الآن بخصم 25% ({grantStatus.renewalPrice} ج)
            </Button>
          </div>
        )}

        {grantStatus.plan === 'monthly' && grantStatus.renewalStage === 'discount_15' && (
          <div className="rounded-xl border border-amber-500/50 bg-amber-500/15 p-3 text-xs text-amber-200 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Zap className="h-4 w-4" />
              <span>فرصة أخيرة للتجديد بخصم 15%</span>
            </div>
            <p className="leading-relaxed text-slate-300">
              متبقي أقل من 24 ساعة! جدد بـ {grantStatus.renewalPrice} ج بدلاً من {BASE_MONTHLY_PRICE} ج.
              إذا انتهى اليوم، سيغلق الاشتراك الشهري تماماً ويقتصر على الترم كامل.
            </p>
            <Button
              size="sm"
              variant="primary"
              fullWidth
              onClick={() => navigate(`/student/checkout/${course.id}?plan=monthly_renewal_15`)}
            >
              فرصة أخيرة: جدد بخصم 15% ({grantStatus.renewalPrice} ج)
            </Button>
          </div>
        )}

        {/* في حال المحاضرة التجريبية: خيارات الترقية */}
        {grantStatus.plan === 'trial_lecture' && (
          <div className="space-y-2 pt-1 border-t border-navy-800">
            <p className="text-xs text-slate-400">للترقية ومتابعة المنهج بالكامل:</p>
            <Button size="sm" variant="primary" fullWidth onClick={() => navigate(`/student/checkout/${course.id}`)}>
              اشترك في الترم كامل
            </Button>
            {!hasClaimedMonthlyBefore && (
              <Button size="sm" variant="secondary" fullWidth onClick={() => setMonthlyModalOpen(true)}>
                تفعيل الاشتراك الشهري (مجاناً)
              </Button>
            )}
          </div>
        )}

        <Link to="/student/my-courses" className={buttonClasses({ variant: 'secondary', fullWidth: true })}>
          كورساتي
        </Link>
      </div>
    );
  } else if (!firebaseUser) {
    statusBox = (
      <div className="space-y-3">
        <p className="text-sm text-slate-400">سجّل دخولك أو أنشئ حسابًا للاشتراك ومشاهدة الحصص.</p>
        <Link
          to={`/register?redirect=/courses/${course.id}`}
          className={buttonClasses({ variant: 'primary', fullWidth: true })}
        >
          اشترك في الكورس (الترم كامل)
        </Link>
        <Link
          to={`/register?redirect=/courses/${course.id}&action=monthly`}
          className={cn(
            buttonClasses({ variant: 'secondary', fullWidth: true }),
            'flex items-center justify-between border-sky-500/40 hover:bg-sky-500/10'
          )}
        >
          <span>الاشتراك الشهري</span>
          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[11px] font-bold text-sky-300">
            110 ج مجاناً الآن
          </span>
        </Link>
        <Link
          to={`/register?redirect=/courses/${course.id}&action=trial`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
        >
          <Gift className="h-4 w-4" />
          <span>تجربة محاضرة مجانية (صالحة لمرة واحدة)</span>
        </Link>
        <div className="pt-1 text-center">
          <Link to={`/login?redirect=/courses/${course.id}`} className="text-xs text-slate-400 hover:text-white underline">
            لديك حساب بالفعل؟ تسجيل الدخول
          </Link>
        </div>
      </div>
    );
  } else {
    // طالب مسجل ولكن ليس لديه وصول نشط
    if (grantStatus.plan === 'monthly' && grantStatus.expired) {
      statusBox = (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 space-y-2 text-amber-200">
            <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
              <Lock className="h-4 w-4 text-amber-400" />
              <span>انتهت مدة اشتراكك الشهري</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              تم إغلاق خيار التجديد الشهري بعد انتهاء المدة. لمتابعة دراستك واستعادة سجل درجاتك وامتحاناتك وكامل المحاضرات، اشترك الآن في الترم كامل.
            </p>
          </div>
          <Button size="lg" fullWidth onClick={() => navigate(`/student/checkout/${course.id}`)}>
            اشترك في الترم كامل
          </Button>
        </div>
      );
    } else {
      statusBox = (
        <div className="space-y-3">
          <Button size="lg" fullWidth onClick={() => navigate(`/student/checkout/${course.id}`)}>
            اشترك في الترم كامل
          </Button>
          {!hasClaimedMonthlyBefore && (
            <button
              type="button"
              onClick={() => setMonthlyModalOpen(true)}
              className="flex w-full items-center justify-between rounded-xl border border-sky-500/40 bg-sky-500/10 px-3.5 py-2.5 text-xs font-bold text-sky-200 hover:bg-sky-500/20 transition-colors"
            >
              <span>الاشتراك الشهري</span>
              <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[11px] font-bold text-sky-300">
                110 ج مجاناً لفترة محدودة
              </span>
            </button>
          )}
          {!hasClaimedTrialBefore ? (
            <button
              type="button"
              onClick={() => setTrialModalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              <Gift className="h-4 w-4" />
              <span>تجربة محاضرة مجانية (7 أيام)</span>
            </button>
          ) : (
            <p className="text-center text-[11px] text-slate-500">
              تمت الاستفادة من تجربة المحاضرة المجانية مسبقاً لهذا الحساب
            </p>
          )}
        </div>
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-10 lg:pb-10">
      {!canAccess && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-800 bg-navy-950/95 p-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
            <CoursePrice course={course} />
            <div className="flex items-center gap-1.5">
              {!firebaseUser ? (
                <>
                  <Link
                    to={`/register?redirect=/courses/${course.id}&action=trial`}
                    className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                  >
                    تجربة مجانية
                  </Link>
                  <Button size="sm" onClick={() => navigate(`/register?redirect=/courses/${course.id}`)}>
                    أنشئ حسابك
                  </Button>
                </>
              ) : grantStatus.plan === 'monthly' && grantStatus.expired ? (
                <Button size="sm" onClick={() => navigate(`/student/checkout/${course.id}`)}>
                  الترم كامل
                </Button>
              ) : (
                <>
                  {!hasClaimedTrialBefore && (
                    <Button size="sm" variant="secondary" onClick={() => setTrialModalOpen(true)}>
                      تجربة مجانية
                    </Button>
                  )}
                  <Button size="sm" onClick={() => navigate(`/student/checkout/${course.id}`)}>
                    اشتراك
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              {gradeLabel && <Badge variant="info">{gradeLabel}</Badge>}
              {course.hidden && isAdmin && <Badge variant="danger">مخفي عن الطلاب</Badge>}
            </div>
            <h1 className="text-3xl font-extrabold leading-snug text-white">{course.title}</h1>
            {course.desc && (
              <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-300">{course.desc}</p>
            )}
          </div>

          {canAccess && activeItem && (
            <div ref={playerRef} className="space-y-3 scroll-mt-20">
              <ProtectedVideoPlayer
                key={activeItem.id}
                title={activeItem.title}
                url={activeItem.videoUrl}
                watermarkText={watermarkText}
                itemId={activeItem.id}
                studentId={student?.id}
                onProgressChange={(coverage) => {
                  setLocalWatch((prev) => ({
                    ...prev,
                    [activeItem.id]: Math.max(prev[activeItem.id] ?? 0, Math.round(coverage * 100)),
                  }));
                }}
              />
              <h2 className="text-lg font-bold text-white">{activeItem.title}</h2>
              {canTrackProgress &&
                (activeWatched || (effectiveWatch[activeItem.id] ?? 0) >= 95 ? (
                  <Badge variant="success">
                    <CheckCircle2 className="h-4 w-4" />
                    تمت مشاهدتها ({Math.max(student?.watchProgress?.[activeItem.id] ?? 0, effectiveWatch[activeItem.id] ?? 0)}%)
                  </Badge>
                ) : (
                  <Button size="sm" variant="secondary" onClick={handleMarkWatched} disabled={marking}>
                    <CheckCircle2 className="h-4 w-4" />
                    أنهيت المشاهدة
                  </Button>
                ))}
            </div>
          )}

          <div className="space-y-4">
            <Tabs
              tabs={[
                { id: 'content', label: 'المحتوى' },
                { id: 'about', label: 'عن الكورس' },
              ]}
              value={activeTab}
              onChange={(id) => setActiveTab(id as 'content' | 'about')}
            />

            {activeTab === 'content' && (
              <div className="space-y-4">
                {/* تنبيهات حالة الاشتراك */}
                {grantStatus.plan === 'monthly' && !grantStatus.expired && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-xs text-sky-200">
                    <div className="flex items-center gap-2 font-semibold">
                      <Calendar className="h-4 w-4 text-sky-400" />
                      <span>اشتراك شهري نشط (متبقي {grantStatus.remainingDays} يوم)</span>
                    </div>
                    {grantStatus.expiresAt && (
                      <span className="text-slate-400">ينتهي بتوقيت القاهرة: {formatCairoDateTime(grantStatus.expiresAt)}</span>
                    )}
                  </div>
                )}

                {grantStatus.plan === 'trial_lecture' && !grantStatus.expired && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200">
                    <div className="flex items-center gap-2 font-semibold">
                      <Sparkles className="h-4 w-4 text-emerald-400" />
                      <span>محاضرة تجريبية مجانية: الدرس #{grantStatus.targetLectureOrder} (متبقي {grantStatus.remainingDays} يوم)</span>
                    </div>
                    {grantStatus.expiresAt && (
                      <span className="text-slate-400">ينتهي بتوقيت القاهرة: {formatCairoDateTime(grantStatus.expiresAt)}</span>
                    )}
                  </div>
                )}

                {student && student.courses.includes(course.id) && grantStatus.expired && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-amber-300">
                      <Clock className="h-4 w-4 text-amber-400" />
                      <span>{grantStatus.message || 'انتهت مدة اشتراكك في هذا الكورس'}</span>
                    </div>
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                      جميع درجاتك ونسب مشاهداتك محفوظة بالكامل في حسابك، يمكنك الاشتراك أو تجديد الاشتراك لمتابعة باقي المحاضرات.
                    </p>
                  </div>
                )}

                <CourseTocSidebar
                  grantStatus={grantStatus}
                courseId={course.id}
                courseTitle={course.title}
                sections={course.sections}
                lectures={course.content.lectures}
                homeworks={visibleHomeworks}
                exams={visibleExams}
                effectiveWatch={effectiveWatch}
                canAccess={canAccess}
                isAdmin={isAdmin}
                student={student}
                contentRules={contentRules}
                fullWidth
                onPlayLecture={(lec) =>
                  setActiveItem({
                    id: lec.id,
                    title: lec.title,
                    videoUrl: lec.youtubeUrl,
                    type: 'video',
                    assessmentKind: null,
                    pdfUrl: lec.pdfUrl,
                    duration: lec.duration || '',
                    archived: false,
                    availableFrom: lec.availableFrom ?? null,
                    availableUntil: lec.availableUntil ?? null,
                    children: [],
                    raw: lec.raw || {},
                  })
                }
              />
              </div>
            )}

            {activeTab === 'about' && (
              <Card className="space-y-4">
                <h3 className="text-lg font-bold text-white">عن الكورس</h3>
                {course.desc ? (
                  <p className="whitespace-pre-line leading-relaxed text-slate-300">{course.desc}</p>
                ) : (
                  <p className="text-slate-400">لا يوجد وصف تفصيلي إضافي لهذا الكورس.</p>
                )}
                {gradeLabel && (
                  <div className="border-t border-navy-800 pt-3 text-sm text-slate-400">
                    <span>الصف الدراسي: </span>
                    <span className="font-bold text-gold-400">{gradeLabel}</span>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>

        <aside className="lg:col-span-1">
          <Card padded={false} className="sticky top-20 overflow-hidden">
            {course.image && !imageFailed ? (
              <img
                src={course.image}
                alt={course.title}
                onError={() => setImageFailed(true)}
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="grid aspect-video w-full place-items-center bg-navy-800 text-gold-500/60">
                <BookOpen className="h-12 w-12" />
              </div>
            )}

            <div className="space-y-4 p-5">
              <CoursePrice course={course} />
              {statusBox}
              <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                المحتوى محمي بعلامة مائية باسمك، ومشاركته أو تسريبه مخالف لشروط المنصة.
              </p>
            </div>
          </Card>
        </aside>
      </div>

      {/* نافذة تأكيد تفعيل المحاضرة التجريبية المجانية */}
      <Modal
        open={trialModalOpen}
        onClose={() => setTrialModalOpen(false)}
        title="تجربة محاضرة مجانية"
        className="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="success">مفعل لمرة واحدة فقط</Badge>
            <Badge variant="gold">مجاناً (0 ج)</Badge>
          </div>
          <div className="rounded-xl border border-navy-800 bg-navy-950/60 p-3 space-y-1.5 text-xs text-slate-300">
            <p className="font-bold text-white text-sm">
              {latestLecture
                ? `الدرس #${latestLecture.order}: ${latestLecture.title}`
                : 'آخر محاضرة منشورة في المنهج'}
            </p>
            <p className="text-slate-400 leading-relaxed">
              تتضمن المحاضرة بجميع مشتملاتها (فيديو الشرح، الامتحان/الواجب، والمرفقات) وتتاح لمدة 7 أيام كحد أقصى.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setTrialModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={claimingTrial || !latestLecture}
              onClick={() => void handleClaimTrial()}
            >
              {claimingTrial ? 'جاري التفعيل...' : 'بدء التجربة المجانية الآن'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* نافذة تأكيد الاشتراك الشهري المجاني */}
      <Modal
        open={monthlyModalOpen}
        onClose={() => setMonthlyModalOpen(false)}
        title="الاشتراك الشهري"
        className="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-navy-800 pb-3">
            <span className="font-bold text-white text-sm">الاشتراك الشهري (30 يوماً)</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 line-through">110 ج</span>
              <Badge variant="gold">مجاناً لفترة محدودة</Badge>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            يتيح لك وصولاً لكافة المحاضرات بدءاً من آخر محاضرة متاحة وما ينزل جديد طوال مدة الـ 30 يوماً.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setMonthlyModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={claimingMonthly}
              onClick={() => void handleClaimMonthlyPromo()}
            >
              {claimingMonthly ? 'جاري التفعيل...' : 'تأكيد تفعيل الاشتراك الشهري'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
import { recordDownloadClick, getAllLocalWatchProgress } from '../../services/watchProgress';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
} from 'lucide-react';
import CoursePrice from '../../components/course/CoursePrice';
import ProtectedVideoPlayer from '../../components/course/ProtectedVideoPlayer';
import { Badge, Button, Card, EmptyState, Spinner, Tabs, buttonClasses, useToast } from '../../components/ui';
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

  const [activeItem, setActiveItem] = useState<CourseItem | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const playerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeItem) {
      playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeItem]);

  const canAccess = Boolean(course && canAccessCourseContent(course, student, isAdmin));

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
          {isAdmin ? 'معاينة الأدمن: يمكنك رؤية كل المحتوى' : course.isFree ? 'كورس مجاني' : 'أنت مشترك في هذا الكورس'}
        </div>
        <Link to="/student/my-courses" className={buttonClasses({ variant: 'secondary', fullWidth: true })}>
          كورساتي
        </Link>
      </div>
    );
  } else if (!firebaseUser) {
    statusBox = (
      <div className="space-y-3">
        <p className="text-sm text-slate-400">سجّل دخولك أو أنشئ حسابًا للاشتراك ومشاهدة الحصص.</p>
        <Link to="/login" className={buttonClasses({ variant: 'primary', fullWidth: true })}>
          تسجيل الدخول
        </Link>
        <Link to="/register" className={buttonClasses({ variant: 'secondary', fullWidth: true })}>
          إنشاء حساب جديد
        </Link>
      </div>
    );
  } else {
    statusBox = (
      <Button size="lg" fullWidth onClick={() => navigate(`/student/checkout/${course.id}`)}>
        اشترك في الكورس
      </Button>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-10 lg:pb-10">
      {!canAccess && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-800 bg-navy-950/95 p-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <CoursePrice course={course} />
            <Button onClick={() => navigate(firebaseUser ? `/student/checkout/${course.id}` : '/register')}>
              {firebaseUser ? 'اشترك الآن' : 'أنشئ حسابك'}
            </Button>
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
              <div className="space-y-6">
                {/* 1. صندوق المحاضرات - يُخفى إن كان فارغًا */}
                {course.content.lectures.length > 0 && (
                  <Card className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-navy-800 pb-3">
                      <PlayCircle className="h-5 w-5 text-gold-400" />
                      <h3 className="text-lg font-bold text-white">المحاضرات</h3>
                      <Badge variant="neutral">{course.content.lectures.length}</Badge>
                    </div>

                    <div className="space-y-3">
                      {course.content.lectures.map((lec, idx) => {
                        const isCurrentVideo = activeItem?.id === lec.id;
                        const watchPct = effectiveWatch[lec.id] ?? 0;
                        const isWatched = watchPct >= 95;
                        const lectureLock = checkLectureLock(
                          course,
                          idx,
                          student,
                          effectiveWatch,
                          student?.examResults || [],
                          contentRules,
                          Date.now(),
                          isAdmin
                        );

                        return (
                          <div
                            key={lec.id}
                            className={cn(
                              'space-y-3 rounded-xl border p-4 transition-all',
                              isCurrentVideo
                                ? 'border-gold-500/60 bg-gold-500/5'
                                : 'border-navy-800 bg-navy-900/50 hover:border-navy-700',
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-800 text-xs font-bold text-gold-400">
                                  #{lec.order}
                                </span>
                                <div>
                                  <h4 className="font-bold text-white">{lec.title}</h4>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                    {lec.duration && <span>المدة: {lec.duration}</span>}
                                    {lec.openAt && (
                                      <span className="text-sky-400">
                                        يفتح: {formatCairoDateTime(lec.openAt)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                {isWatched && (
                                  <Badge variant="success">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    تمت المشاهدة ({watchPct}%)
                                  </Badge>
                                )}

                                {canAccess ? (
                                  <>
                                    {lectureLock.locked ? (
                                      <div className="flex items-center gap-1.5 rounded-lg bg-navy-800/80 px-3 py-1.5 text-xs font-semibold text-amber-300">
                                        <Lock className="h-3.5 w-3.5 text-amber-400" />
                                        <span>{lectureLock.message}</span>
                                      </div>
                                    ) : lec.youtubeUrl ? (
                                      <Button
                                        size="sm"
                                        variant={isCurrentVideo ? 'primary' : 'secondary'}
                                        onClick={() =>
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
                                      >
                                        <PlayCircle className="h-4 w-4" />
                                        {isCurrentVideo ? 'مشغّل الآن' : 'مشاهدة المحاضرة'}
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-slate-500">الفيديو قيد التجهيز</span>
                                    )}

                                    {/* مرفقات ومذكرات المحاضرة */}
                                    <LectureFilesSection
                                      lecture={lec}
                                      student={student}
                                      effectiveWatch={effectiveWatch}
                                      contentRules={contentRules}
                                      courseId={course.id}
                                      isAdmin={isAdmin}
                                    />
                                  </>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <Lock className="h-3.5 w-3.5" />
                                    مقفول
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* التدريبات الخاصة بهذه المحاضرة */}
                            {lec.trainings && lec.trainings.length > 0 && (
                              <div className="ms-2 rounded-xl border border-navy-800/80 bg-navy-950/60 p-3 sm:ms-6">
                                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-300">
                                  <ClipboardList className="h-3.5 w-3.5 text-gold-400" />
                                  التدريبات الخاصة بهذه المحاضرة ({lec.trainings.length})
                                </div>
                                <div className="space-y-2">
                                  {lec.trainings.map((tr) => {
                                    const trLink = isAdmin
                                      ? `/admin/preview/assessment/${encodeURIComponent(course.id)}/${encodeURIComponent(tr.id)}`
                                      : `/student/assessment/${encodeURIComponent(course.id)}/${encodeURIComponent(tr.id)}`;

                                    const trLock = checkInLectureItemLock(
                                      lec,
                                      tr,
                                      'training',
                                      student,
                                      effectiveWatch,
                                      contentRules,
                                      course.id,
                                      Date.now(),
                                      isAdmin
                                    );

                                    return (
                                      <div
                                        key={tr.id}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-navy-900/80 px-3 py-2 text-xs"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="text-slate-500">#{tr.order}</span>
                                          <span className="font-medium text-slate-200">{tr.title}</span>
                                        </div>
                                        {canAccess ? (
                                          trLock.locked ? (
                                            <span className="flex items-center gap-1 text-xs text-amber-300">
                                              <Lock className="h-3 w-3 text-amber-400" />
                                              {trLock.message}
                                            </span>
                                          ) : (
                                            <Link
                                              to={trLink}
                                              className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                                            >
                                              دخول التدريب
                                            </Link>
                                          )
                                        ) : (
                                          <span className="flex items-center gap-1 text-slate-500">
                                            <Lock className="h-3 w-3" />
                                            مقفول
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* الواجبات الخاصة بهذه المحاضرة */}
                            {lec.homeworks && lec.homeworks.length > 0 && (
                              <div className="ms-2 rounded-xl border border-navy-800/80 bg-navy-950/60 p-3 sm:ms-6">
                                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-300">
                                  <ClipboardList className="h-3.5 w-3.5 text-gold-400" />
                                  واجب المحاضرة ({lec.homeworks.length})
                                </div>
                                <div className="space-y-2">
                                  {lec.homeworks.map((hw) => {
                                    const hwLink = isAdmin
                                      ? `/admin/preview/assessment/${encodeURIComponent(course.id)}/${encodeURIComponent(hw.id)}`
                                      : `/student/assessment/${encodeURIComponent(course.id)}/${encodeURIComponent(hw.id)}`;
                                    const hwLock = checkInLectureItemLock(
                                      lec,
                                      hw,
                                      'homework',
                                      student,
                                      effectiveWatch,
                                      contentRules,
                                      course.id,
                                      Date.now(),
                                      isAdmin
                                    );
                                    return (
                                      <div
                                        key={hw.id}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-navy-900/80 px-3 py-2 text-xs"
                                      >
                                        <span className="font-medium text-slate-200">{hw.title}</span>
                                        {canAccess ? (
                                          hwLock.locked ? (
                                            <span className="flex items-center gap-1 text-xs text-amber-300">
                                              <Lock className="h-3 w-3 text-amber-400" />
                                              {hwLock.message}
                                            </span>
                                          ) : (
                                            <Link
                                              to={hwLink}
                                              className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                                            >
                                              دخول الواجب
                                            </Link>
                                          )
                                        ) : (
                                          <span className="flex items-center gap-1 text-slate-500">
                                            <Lock className="h-3 w-3" />
                                            مقفول
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* 2. صندوق الواجبات - يُخفى إن كان فارغًا */}
                {looseHomeworks.length > 0 && (
                  <Card className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-navy-800 pb-3">
                      <ClipboardList className="h-5 w-5 text-gold-400" />
                      <h3 className="text-lg font-bold text-white">الواجبات</h3>
                      <Badge variant="neutral">{looseHomeworks.length}</Badge>
                    </div>

                    <div className="space-y-2.5">
                      {looseHomeworks.map((hw) => {
                        const hwLink = isAdmin
                          ? `/admin/preview/assessment/${encodeURIComponent(course.id)}/${encodeURIComponent(hw.id)}`
                          : `/student/assessment/${encodeURIComponent(course.id)}/${encodeURIComponent(hw.id)}`;
                        const isLockedOpenAt = !isAdmin && typeof hw.openAt === 'number' && hw.openAt > Date.now();

                        return (
                          <div
                            key={hw.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-800 bg-navy-900/50 p-4 transition-all hover:border-navy-700"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-800 text-xs font-bold text-gold-400">
                                #{hw.order}
                              </span>
                              <div>
                                <h4 className="font-bold text-white">{hw.title}</h4>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                  {Number(hw.duration) > 0 && <span>المدة: {hw.duration} دقيقة</span>}
                                  {hw.strictMode && <Badge variant="gold">مؤمّن</Badge>}
                                  {isDraftAssessment(hw) && <Badge variant="danger">مسودة</Badge>}
                                  {hw.openAt && (
                                    <span className="text-sky-400">
                                      يفتح: {formatCairoDateTime(hw.openAt)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {canAccess ? (
                              isLockedOpenAt ? (
                                <span className="flex items-center gap-1.5 text-xs text-amber-300">
                                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                                  بيفتح يوم {formatCairoDateTime(hw.openAt!)}
                                </span>
                              ) : (
                                <Link
                                  to={hwLink}
                                  className={buttonClasses({ variant: 'primary', size: 'sm' })}
                                >
                                  دخول الواجب
                                </Link>
                              )
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Lock className="h-3.5 w-3.5" />
                                مقفول
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* 3. صندوق الامتحانات - يُخفى إن كان فارغًا */}
                {visibleExams.length > 0 && (
                  <Card className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-navy-800 pb-3">
                      <Award className="h-5 w-5 text-gold-400" />
                      <h3 className="text-lg font-bold text-white">الامتحانات</h3>
                      <Badge variant="neutral">{visibleExams.length}</Badge>
                    </div>

                    <div className="space-y-2.5">
                      {visibleExams.map((exam) => {
                        const examLink = isAdmin
                          ? `/admin/preview/assessment/${encodeURIComponent(course.id)}/${encodeURIComponent(exam.id)}`
                          : `/student/assessment/${encodeURIComponent(course.id)}/${encodeURIComponent(exam.id)}`;
                        const isLockedOpenAt = !isAdmin && typeof exam.openAt === 'number' && exam.openAt > Date.now();

                        return (
                          <div
                            key={exam.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-800 bg-navy-900/50 p-4 transition-all hover:border-navy-700"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-800 text-xs font-bold text-gold-400">
                                #{exam.order}
                              </span>
                              <div>
                                <h4 className="font-bold text-white">{exam.title}</h4>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                  {Number(exam.duration) > 0 && <span>المدة: {exam.duration} دقيقة</span>}
                                  {exam.strictMode && <Badge variant="gold">مؤمّن</Badge>}
                                  {isDraftAssessment(exam) && <Badge variant="danger">مسودة</Badge>}
                                  {exam.openAt && (
                                    <span className="text-sky-400">
                                      يفتح: {formatCairoDateTime(exam.openAt)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {canAccess ? (
                              isLockedOpenAt ? (
                                <span className="flex items-center gap-1.5 text-xs text-amber-300">
                                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                                  بيفتح يوم {formatCairoDateTime(exam.openAt!)}
                                </span>
                              ) : (
                                <Link
                                  to={examLink}
                                  className={buttonClasses({ variant: 'primary', size: 'sm' })}
                                >
                                  دخول الامتحان
                                </Link>
                              )
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Lock className="h-3.5 w-3.5" />
                                مقفول
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* Empty State when course has neither lectures, homeworks, nor exams */}
                {course.content.lectures.length === 0 &&
                  course.content.homeworks.length === 0 &&
                  course.content.exams.length === 0 && (
                    <Card>
                      <EmptyState
                        icon={BookOpen}
                        title="لا يوجد محتوى في هذا الكورس بعد"
                        description="سيتم إضافة المحاضرات والواجبات والامتحانات قريبًا."
                      />
                    </Card>
                  )}
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
    </div>
  );
}

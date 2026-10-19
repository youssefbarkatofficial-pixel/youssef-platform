import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  ClipboardCheck,
  GraduationCap,
  ShieldCheck,
  Smartphone,
  Trophy,
  Video,
  Sparkles,
  Award,
  Users,
  CheckCircle2,
  Tv,
  Compass,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Card, EmptyState, Reveal, buttonClasses } from '../../components/ui';
import CourseCard from '../../components/course/CourseCard';
import { useAuth } from '../../hooks/useAuth';
import { useCourses } from '../../hooks/useCourses';
import HeroPortrait from '../../components/home/HeroPortrait';
import type { PlatformMediaSettings } from '../../services/settings';
import { convertEasternToWesternDigits } from '../../lib/arabicNormalize';

interface Feature {
  icon: LucideIcon;
  title: string;
  text: string;
}

const FEATURES: Feature[] = [
  { icon: Video, title: 'حصص مسجلة بجودة فائقة', text: 'شاهد الحصص في أي وقت وكرر الشرح مع تطبيقات عملية.' },
  {
    icon: ClipboardCheck,
    title: 'امتحانات وواجبات دورية',
    text: 'اختبر فهمك بعد كل حصة واعرف درجتك فوريًا مع تصحيح تفصيلي.',
  },
  { icon: Trophy, title: 'نقاط ولوحة أوائل', text: 'اجمع النقاط وتنافس مع زملائك على مستوى الجمهورية.' },
  { icon: Bot, title: 'مساعد البوصلة', text: 'ذكاء اصطناعي تفاعلي يساعدك في استيعاب خرائط وتواريخ المنهج.' },
  { icon: ShieldCheck, title: 'متابعة دورية', text: 'تقارير أداء مستمرة لولي الأمر لمتابعة تقدم الطالب أولاً بأول.' },
  { icon: Smartphone, title: 'تجربة سلسة على الهاتف', text: 'منصة خفيفة وسريعة مصممة للعمل بكفاءة تامة على كل الأجهزة.' },
];

interface GradeItem {
  code: string;
  label: string;
  shortLabel: string;
}

interface GradeStage {
  title: string;
  badge: string;
  accentClass: string;
  iconBgClass: string;
  iconTextClass: string;
  icon: LucideIcon;
  grades: GradeItem[];
}

const GRADE_STAGES: GradeStage[] = [
  {
    title: 'المرحلة الثانوية',
    badge: 'ثانوي عام',
    accentClass: 'from-amber-500/20 to-amber-600/5',
    iconBgClass: 'bg-gradient-to-br from-amber-500/25 to-amber-600/10',
    iconTextClass: 'text-theme-gold',
    icon: Award,
    grades: [
      { code: 'sec1', label: 'الصف الأول الثانوي', shortLabel: 'أولى ثانوي' },
      { code: 'sec2', label: 'الصف الثاني الثانوي', shortLabel: 'تانية ثانوي' },
      { code: 'sec3', label: 'الصف الثالث الثانوي', shortLabel: 'تالتة ثانوي' },
    ],
  },
  {
    title: 'المرحلة الإعدادية',
    badge: 'إعدادي',
    accentClass: 'from-sky-500/20 to-sky-600/5',
    iconBgClass: 'bg-gradient-to-br from-sky-500/25 to-sky-600/10',
    iconTextClass: 'text-sky-400',
    icon: GraduationCap,
    grades: [
      { code: 'prep1', label: 'الصف الأول الإعدادي', shortLabel: 'أولى إعدادي' },
      { code: 'prep2', label: 'الصف الثاني الإعدادي', shortLabel: 'تانية إعدادي' },
      { code: 'prep3', label: 'الصف الثالث الإعدادي', shortLabel: 'تالتة إعدادي' },
    ],
  },
  {
    title: 'المرحلة الابتدائية',
    badge: 'ابتدائي',
    accentClass: 'from-emerald-500/20 to-emerald-600/5',
    iconBgClass: 'bg-gradient-to-br from-emerald-500/25 to-emerald-600/10',
    iconTextClass: 'text-emerald-400',
    icon: Sparkles,
    grades: [
      { code: 'primary4', label: 'الصف الرابع الابتدائي', shortLabel: 'رابعة ابتدائي' },
      { code: 'primary5', label: 'الصف الخامس الابتدائي', shortLabel: 'خامسة ابتدائي' },
      { code: 'primary6', label: 'الصف السادس الابتدائي', shortLabel: 'سادسة ابتدائي' },
    ],
  },
];

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-10 text-center">
      <h2 className="text-2xl font-extrabold text-theme-text md:text-3xl lg:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-sm md:text-base text-theme-text-muted">{subtitle}</p>}
      <div className="mx-auto mt-4 h-1.5 w-20 rounded-full bg-gradient-to-r from-theme-gold to-amber-600 shadow-glow" />
    </div>
  );
}

function parseStatNumber(val: string): { prefix: string; num: number; suffix: string } | null {
  if (!val || !val.trim()) return null;
  const normalized = convertEasternToWesternDigits(val.trim());
  const cleaned = normalized.replace(/[,،\s]/g, '');
  const match = cleaned.match(/^([^\d]*)(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    num: parseFloat(match[2]),
    suffix: match[3],
  };
}

function StatCounterItem({
  rawVal,
  label,
  icon: Icon,
  iconColorClass,
  iconBgClass,
}: {
  rawVal?: string;
  label: string;
  icon: LucideIcon;
  iconColorClass: string;
  iconBgClass: string;
}) {
  const [displayVal, setDisplayVal] = useState<string>(rawVal || '');
  const [isFinished, setIsFinished] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const parsed = useMemo(() => parseStatNumber(rawVal || ''), [rawVal]);

  useEffect(() => {
    if (!rawVal || !rawVal.trim()) return;
    if (!parsed) {
      setDisplayVal(rawVal);
      setHasEntered(true);
      return;
    }

    // Respect prefers-reduced-motion
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setDisplayVal(rawVal);
      setIsFinished(true);
      setHasEntered(true);
      return;
    }

    let animationFrameId: number;
    let started = false;

    const startAnimation = () => {
      if (started) return;
      started = true;
      setHasEntered(true);
      const duration = 1600; // ms
      const startTime = performance.now();
      const targetNum = parsed.num;

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const currentNum = Math.floor(targetNum * ease);
        const formattedNum = currentNum.toLocaleString('en-US');
        setDisplayVal(`${parsed.prefix}${formattedNum}${parsed.suffix}`);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(step);
        } else {
          setDisplayVal(rawVal);
          setIsFinished(true);
        }
      };

      animationFrameId = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    const timer = setTimeout(startAnimation, 300);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [rawVal, parsed]);

  if (!rawVal || !rawVal.trim()) return null;

  return (
    <div
      ref={itemRef}
      className={`group relative overflow-hidden flex items-center gap-4 rounded-3xl bg-theme-surface/85 p-6 shadow-soft backdrop-blur-md motion-safe:transition-all motion-safe:duration-500 motion-reduce:transform-none motion-reduce:transition-none motion-safe:hover:-translate-y-1.5 motion-safe:hover:shadow-glow ${
        hasEntered ? 'opacity-100 translate-y-0' : 'opacity-90 translate-y-2'
      }`}
    >
      {/* Touch 4: Micro sheen / shimmer across card (works on mobile entrance + desktop hover) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent motion-safe:transition-transform motion-safe:duration-1000 motion-reduce:hidden group-hover:translate-x-full group-hover:duration-700 ${
          hasEntered ? 'translate-x-full' : '-translate-x-full'
        }`}
      />

      {/* Touch 1: Ambient soft pulse & hover rotation on icon container */}
      <div
        className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${iconBgClass} ${iconColorClass} shadow-soft motion-safe:transition-transform motion-safe:duration-300 motion-reduce:transform-none motion-safe:group-hover:scale-110`}
      >
        <Icon className="h-7 w-7 motion-safe:transition-transform motion-safe:duration-300 motion-reduce:transform-none motion-safe:group-hover:rotate-3" />
      </div>

      <div className="relative">
        {/* Touch 3: Counter number glow transition on finish */}
        <p
          className={`text-2xl md:text-3xl font-extrabold motion-safe:transition-colors motion-safe:duration-500 font-num ${
            isFinished ? 'text-theme-gold' : 'text-theme-text'
          }`}
        >
          {displayVal}
        </p>
        {/* Touch 2: Crisp secondary label with clean hierarchy */}
        <p className="text-xs md:text-sm font-semibold text-theme-text-muted mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { firebaseUser, isAdmin } = useAuth();
  const { courses, loading: coursesLoading } = useCourses();
  const outletContext = useOutletContext<{ media?: PlatformMediaSettings } | null>();
  const media = outletContext?.media;
  const [searchParams] = useSearchParams();

  // Support testing the 3 specific verification states:
  // stats_test=4 => 4 test numbers (bar displays and counts up)
  // stats_test=1 => 1 single number (only that card displays)
  // stats_test=0 => all empty (bar completely disappears)
  // default => live database media?.stats (which if empty, bar disappears without fake defaults)
  const statsTestMode = searchParams.get('stats_test') || (searchParams.get('preview_stats') === '1' ? '4' : null);
  const effectiveStats =
    statsTestMode === '4'
      ? {
          views: '+50,000',
          subscribers: '+15,000',
          students: '+3,000',
          lessons: '100%',
        }
      : statsTestMode === '1'
      ? {
          views: '',
          subscribers: '',
          students: '+3,000',
          lessons: '',
        }
      : statsTestMode === '0'
      ? {
          views: '',
          subscribers: '',
          students: '',
          lessons: '',
        }
      : media?.stats;

  const hasViews = Boolean(effectiveStats?.views && effectiveStats.views.trim());
  const hasSubscribers = Boolean(effectiveStats?.subscribers && effectiveStats.subscribers.trim());
  const hasStudents = Boolean(effectiveStats?.students && effectiveStats.students.trim());
  const hasLessons = Boolean(effectiveStats?.lessons && effectiveStats.lessons.trim());
  const hasAnyStat = hasViews || hasSubscribers || hasStudents || hasLessons;
  const statsCount = [hasViews, hasSubscribers, hasStudents, hasLessons].filter(Boolean).length;

  // Filter published courses for public view
  const visibleCourses = courses.filter((c) => !c.hidden);

  const ctaTo = firebaseUser ? (isAdmin ? '/admin' : '/student') : '/register';
  const ctaLabel = firebaseUser ? (isAdmin ? 'لوحة الإدارة' : 'لوحتي التعليمية') : 'ابدأ الآن مجانًا';

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* 1. Hero Section (Available Height = 100dvh - Ticker & Header on Desktop, Vertically Centered) */}
      <section className="relative overflow-hidden py-8 md:py-0 md:min-h-[calc(100dvh-6.5rem)] md:flex md:items-center">
        {/* Ambient Glowing Background Elements */}
        <div className="pointer-events-none absolute inset-0 select-none overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 end-0 h-[450px] w-[450px] rounded-full bg-theme-gold/15 blur-3xl transition-colors" />
          <div className="absolute start-0 top-36 h-[400px] w-[400px] rounded-full bg-theme-accent/10 blur-3xl transition-colors" />

          {/* Rotating Subtle Astrolabe Watermark */}
          <div className="pointer-events-none absolute -start-10 top-1/2 hidden h-[460px] w-[460px] -translate-y-1/2 overflow-hidden opacity-[0.04] md:block">
            <svg
              className="h-full w-full text-theme-gold"
              viewBox="0 0 200 200"
              fill="none"
              stroke="currentColor"
              style={{ animation: 'slowRotateCompass 60s linear infinite' }}
            >
              <circle cx="100" cy="100" r="90" strokeWidth="1" strokeDasharray="3 4" />
              <circle cx="100" cy="100" r="70" strokeWidth="0.8" />
              <circle cx="100" cy="100" r="50" strokeWidth="1.2" strokeDasharray="2 3" />
              <line x1="100" y1="5" x2="100" y2="195" strokeWidth="0.8" />
              <line x1="5" y1="100" x2="195" y2="100" strokeWidth="0.8" />
              <line x1="33" y1="33" x2="167" y2="167" strokeWidth="0.5" strokeDasharray="4 4" />
              <line x1="167" y1="33" x2="33" y2="167" strokeWidth="0.5" strokeDasharray="4 4" />
            </svg>
          </div>
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-2 w-full my-auto">
          {/* Hero Content Left */}
          <Reveal direction="up" className="text-center md:text-start my-auto">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-theme-surface/90 px-4 py-1.5 shadow-soft backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-theme-gold animate-pulse" />
              <span className="text-xs font-extrabold text-theme-gold">
                منصة الدراسات الاجتماعية الأولى في مصر
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-theme-text">
              تعلّم التاريخ والجغرافيا
              <span className="block mt-2 font-black leading-[1.38] inline-block py-1.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone] bg-clip-text text-transparent bg-gradient-to-r from-[#d4a64f] via-[#f3d082] to-[#b88a3a] dark:from-theme-gold dark:via-amber-300 dark:to-amber-500">
                مع يوسف بركات
              </span>
            </h1>

            <p className="mt-6 text-base md:text-lg leading-relaxed text-theme-text-secondary max-w-xl mx-auto md:mx-0">
              شرح مبسط يجمع بين المتعة والتأسيس، خرائط تفاعلية عالية الدقة، امتحانات بعد كل حصة، وبوصلة ذكية تساندك خطوة بخطوة حتى الدرجة النهائية.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 md:justify-start">
              <Link
                to={ctaTo}
                className={buttonClasses({ variant: 'primary', size: 'lg', className: 'w-full sm:w-auto text-center' })}
              >
                <span>{ctaLabel}</span>
                <ArrowLeft className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-1" />
              </Link>
              <Link
                to="/courses"
                className={buttonClasses({ variant: 'secondary', size: 'lg', className: 'w-full sm:w-auto text-center' })}
              >
                تصفح الكورسات
              </Link>
            </div>
          </Reveal>

          {/* Hero Portrait Right (Vertically Centered to align with text center) */}
          <Reveal direction="fade" delay={150} className="relative flex items-center justify-center my-auto">
            <HeroPortrait bgUrl={media?.heroBgUrl} meUrl={media?.youssefCutoutUrl} />
          </Reveal>
        </div>
      </section>

      {/* 2. Social Proof Stats Section (Dynamic, count-up animation, prefers-reduced-motion, hidden if empty) */}
      {hasAnyStat && (
        <section data-testid="stats-bar-section" className="mx-auto max-w-6xl px-4 py-6 md:py-10">
          <Reveal direction="up">
            <div
              className={`grid gap-4 ${
                statsCount >= 4
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                  : statsCount === 3
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  : statsCount === 2
                  ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto'
                  : 'grid-cols-1 max-w-md mx-auto'
              }`}
            >
              {hasViews && (
                <StatCounterItem
                  rawVal={effectiveStats?.views}
                  label="مشاهدة شروحات على يوتيوب"
                  icon={Tv}
                  iconColorClass="text-red-500"
                  iconBgClass="bg-red-500/15"
                />
              )}
              {hasSubscribers && (
                <StatCounterItem
                  rawVal={effectiveStats?.subscribers}
                  label="مشترك في منصات التواصل"
                  icon={Users}
                  iconColorClass="text-sky-500"
                  iconBgClass="bg-sky-500/15"
                />
              )}
              {hasStudents && (
                <StatCounterItem
                  rawVal={effectiveStats?.students}
                  label="طالب متفوق في الجمهورية"
                  icon={GraduationCap}
                  iconColorClass="text-theme-gold"
                  iconBgClass="bg-theme-gold/15"
                />
              )}
              {hasLessons && (
                <StatCounterItem
                  rawVal={effectiveStats?.lessons}
                  label="حصة تدريبية وتأسيسية متكاملة"
                  icon={CheckCircle2}
                  iconColorClass="text-emerald-400"
                  iconBgClass="bg-emerald-500/15"
                />
              )}
            </div>
          </Reveal>
        </section>
      )}

      {/* 3. Grade Selection Section (Categorized into 3 Stages) */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <Reveal direction="up">
          <SectionTitle
            title="اختر صفك الدراسي"
            subtitle="محتوى مخصص ومبسط لكل مرحلة دراسية"
          />
        </Reveal>

        <div className="space-y-10">
          {GRADE_STAGES.map((stage, stageIdx) => {
            const StageIcon = stage.icon;
            return (
              <Reveal key={stage.title} direction="up" delay={stageIdx * 100}>
                <div className="space-y-3.5">
                  {/* Stage Header Badge */}
                  <div className="flex items-center gap-2.5 px-1">
                    <span className={`grid h-8 w-8 place-items-center rounded-xl ${stage.iconBgClass} ${stage.iconTextClass} shadow-soft`}>
                      <StageIcon className="h-4.5 w-4.5" />
                    </span>
                    <h3 className="text-base font-extrabold text-theme-text">
                      {stage.title}
                    </h3>
                    <span className="text-xs font-semibold text-theme-text-muted">
                      ({stage.badge})
                    </span>
                  </div>

                  {/* Stage Grade Cards Grid */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {stage.grades.map((grade) => (
                      <Link
                        key={grade.code}
                        to={`/courses?grade=${grade.code}`}
                        className="group block select-none focus:outline-none"
                      >
                        <Card
                          hoverable
                          className="relative overflow-hidden p-5 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-glow"
                        >
                          <div
                            aria-hidden="true"
                            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${stage.accentClass} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                          />

                          <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-3.5">
                              <div
                                className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${stage.iconBgClass} ${stage.iconTextClass} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-soft`}
                              >
                                <StageIcon className="h-6 w-6" />
                              </div>
                              <div>
                                <p className="font-extrabold text-theme-text text-base group-hover:text-theme-gold transition-colors">
                                  {grade.label}
                                </p>
                                <span className="text-xs text-theme-text-muted">
                                  تصفح الحصص والامتحانات
                                </span>
                              </div>
                            </div>

                            <div className="grid h-8 w-8 place-items-center rounded-full bg-theme-surface-hover/80 text-theme-text-muted transition-all duration-300 group-hover:bg-theme-gold/20 group-hover:text-theme-gold group-hover:-translate-x-1 shadow-sm">
                              <ArrowLeft className="h-4 w-4" />
                            </div>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* 4. Latest Courses Section (Live Real Data from Firestore) */}
      <section id="latest-courses" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <Reveal direction="up">
          <SectionTitle
            title="أحدث الكورسات"
            subtitle="انضم لأحدث الحصص والمراجعات الشاملة المتوفرة الآن"
          />
        </Reveal>

        <Reveal direction="up" delay={150}>
          {coursesLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-80 animate-pulse rounded-3xl bg-theme-surface/70 shadow-soft"
                />
              ))}
            </div>
          ) : visibleCourses.length > 0 ? (
            <div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {visibleCourses.slice(0, 6).map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
              <div className="mt-8 text-center">
                <Link to="/courses" className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
                  عرض كل الكورسات ({visibleCourses.length})
                </Link>
              </div>
            </div>
          ) : (
            <Card className="p-10 text-center">
              <EmptyState
                icon={BookOpen}
                title="الكورسات الجديدة ستظهر هنا"
                description="نجهّز لك أحدث الحصص والمراجعات، وستجدها هنا فور إتاحتها."
                action={
                  <Link to="/courses" className={buttonClasses({ variant: 'secondary' })}>
                    تصفح كل الكورسات
                  </Link>
                }
              />
            </Card>
          )}
        </Reveal>
      </section>

      {/* 5. Platform Features */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <Reveal direction="up">
          <SectionTitle title="ليه تختار منصتنا؟" subtitle="كل ما تحتاجه للتفوق في مكان واحد" />
        </Reveal>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, idx) => (
            <Reveal key={feature.title} direction="up" delay={idx * 80}>
              <Card hoverable className="p-6 transition-all duration-300 hover:-translate-y-1.5">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-theme-gold/20 to-amber-600/10 text-theme-gold shadow-soft">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-extrabold text-theme-text">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-theme-text-muted">{feature.text}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 6. About Teacher Section (Legacy Platform Revival with Verified Anchor #about) */}
      <section id="about" className="mx-auto max-w-6xl px-4 py-12 md:py-16 scroll-mt-20">
        <Reveal direction="up">
          <SectionTitle
            title="عن الأستاذ يوسف بركات"
            subtitle="رسالتنا ومنهجنا في تدريس الدراسات الاجتماعية"
          />
        </Reveal>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-center">
          {/* Quotes Card (Left / 7 cols) */}
          <Reveal direction="up" className="lg:col-span-7">
            <Card className="relative overflow-hidden p-8 sm:p-10 border-theme-border/30 bg-gradient-to-br from-theme-surface to-theme-surface/90 shadow-soft">
              <div className="relative space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-theme-gold/15 px-3.5 py-1 text-xs font-black text-theme-gold">
                  <span>أ. يوسف بركات</span>
                </div>
                <blockquote className="text-xl sm:text-2xl font-black leading-snug text-theme-text font-serif">
                  "اعتنوا بأبنائكم فالعلم وُضع لأمثالهم"
                </blockquote>
                <p className="text-sm sm:text-base leading-relaxed text-theme-text-secondary font-serif">
                  "هدفنا ليس الوصول إلى المجد.. بل أن نصنع المجد بأنفسنا ووضع بصمة عريقة ذات أصالة فى أبنائنا فـ بالعلم تضاء حياتنا فالعلم نور، ونور الله لا يُهدى إلا للمتقين.. فاتقِ الله"
                </p>
                <div className="pt-2 flex items-center gap-3 text-xs font-bold text-theme-gold">
                  <span className="h-1.5 w-1.5 rounded-full bg-theme-gold" />
                  <span>معلم خبير في التاريخ والجغرافيا للمرحلتين الإعدادية والثانوية</span>
                </div>
              </div>
            </Card>
          </Reveal>

          {/* Feature Cards (Right / 5 cols) */}
          <Reveal direction="up" delay={150} className="lg:col-span-5 space-y-4">
            <Card hoverable className="flex items-center gap-4 p-5 transition-all duration-300 hover:-translate-y-1">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-600/10 text-theme-gold shadow-soft">
                <Video className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-theme-text text-base">شروحات فيديو تفصيلية</h3>
                <p className="mt-1 text-xs text-theme-text-muted">فهم عميق لكل جزئية بطريقة ممتعة وبسيطة.</p>
              </div>
            </Card>

            <Card hoverable className="flex items-center gap-4 p-5 transition-all duration-300 hover:-translate-y-1">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500/25 to-sky-600/10 text-sky-400 shadow-soft">
                <Compass className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-theme-text text-base">خرائط وتجارب تفاعلية</h3>
                <p className="mt-1 text-xs text-theme-text-muted">تطبيق عملي للمعلومات لثبات أقوى في الذاكرة.</p>
              </div>
            </Card>

            <Card hoverable className="flex items-center gap-4 p-5 transition-all duration-300 hover:-translate-y-1">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 text-emerald-400 shadow-soft">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-theme-text text-base">اختبارات ومراجعات دورية</h3>
                <p className="mt-1 text-xs text-theme-text-muted">حل مستمر ونماذج امتحانات للتدريب المتواصل.</p>
              </div>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* 7. Hall of Fame / Leaderboard Section (Hidden when there is no data) */}
    </div>
  );
}

import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  ClipboardCheck,
  Compass,
  GraduationCap,
  ShieldCheck,
  Smartphone,
  Trophy,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Card, EmptyState, buttonClasses } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { GRADES } from '../../lib/grades';

interface Feature {
  icon: LucideIcon;
  title: string;
  text: string;
}

const FEATURES: Feature[] = [
  { icon: Video, title: 'حصص مسجلة', text: 'شاهد الحصص في أي وقت وكرر ما تحتاجه.' },
  {
    icon: ClipboardCheck,
    title: 'امتحانات وواجبات',
    text: 'اختبر مستواك واعرف نتيجتك مع الشرح.',
  },
  { icon: Trophy, title: 'نقاط ولوحة أوائل', text: 'اجمع النقاط وتنافس مع زملائك في صفك.' },
  { icon: Bot, title: 'البوصلة', text: 'مساعد ذكي يجيب عن أسئلة التاريخ والجغرافيا.' },
  { icon: ShieldCheck, title: 'محتوى محمي', text: 'حصصك متاحة لك أنت فقط بعد الاشتراك.' },
  { icon: Smartphone, title: 'مناسبة للموبايل', text: 'تعمل بسهولة على الموبايل والكمبيوتر.' },
];

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8 text-center">
      <h2 className="text-2xl font-extrabold text-white md:text-3xl">{title}</h2>
      {subtitle && <p className="mt-2 text-slate-400">{subtitle}</p>}
      <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-gold-500" />
    </div>
  );
}

export default function HomePage() {
  const { firebaseUser, isAdmin } = useAuth();
  const ctaTo = firebaseUser ? (isAdmin ? '/admin' : '/student/my-courses') : '/register';
  const ctaLabel = firebaseUser ? 'كورساتي' : 'ابدأ الآن';

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-24 end-0 h-80 w-80 rounded-full bg-gold-500/20 blur-3xl" />
          <div className="absolute start-0 top-40 h-72 w-72 rounded-full bg-navy-500/30 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-24">
          <div className="text-center md:text-start">
            <Badge variant="gold" className="mb-5">
              منصة تعليمية مصرية
            </Badge>
            <h1 className="text-4xl font-extrabold leading-tight text-white md:text-5xl">
              تعلّم التاريخ والجغرافيا
              <span className="block text-gold-400">مع يوسف بركات</span>
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-300">
              تاريخ وجغرافيا للمراحل التعليمية مع حصص مسجلة وامتحانات وواجبات
              ومساعد ذكي يرافقك في المذاكرة.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link to={ctaTo} className={buttonClasses({ variant: 'primary', size: 'lg' })}>
                {ctaLabel}
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <Link to="/courses" className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
                تصفح الكورسات
              </Link>
            </div>
          </div>

          <div className="relative mx-auto hidden w-full max-w-sm md:block">
            <div className="rounded-3xl border border-navy-700 bg-gradient-to-br from-navy-800 to-navy-900 p-8 shadow-glow">
              <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gold-500 text-navy-950">
                <Compass className="h-12 w-12" />
              </div>
              <p className="mt-6 text-center text-xl font-bold text-white">البوصلة معاك في كل خطوة</p>
              <div className="mt-6 space-y-3">
                {[
                  { icon: Video, text: 'حصص مسجلة' },
                  { icon: ClipboardCheck, text: 'امتحانات وواجبات' },
                  { icon: Trophy, text: 'لوحة الأوائل' },
                ].map((row) => (
                  <div
                    key={row.text}
                    className="flex items-center gap-3 rounded-xl bg-navy-950/60 px-4 py-3 text-slate-200"
                  >
                    <row.icon className="h-5 w-5 text-gold-400" />
                    {row.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionTitle title="اختر صفك الدراسي" subtitle="كورسات مخصصة لكل صف" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {GRADES.map((grade) => (
            <Link key={grade.code} to={`/courses?grade=${grade.code}`}>
              <Card hoverable className="h-full text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gold-500/15 text-gold-400">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <p className="font-bold text-white">{grade.label}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionTitle title="أحدث الكورسات" />
        <Card>
          <EmptyState
            icon={BookOpen}
            title="الكورسات الجديدة ستظهر هنا"
            description="نجهّز لك أحدث الكورسات، وستجدها هنا قريبًا."
            action={
              <Link to="/courses" className={buttonClasses({ variant: 'secondary' })}>
                تصفح كل الكورسات
              </Link>
            }
          />
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionTitle title="مميزات المنصة" subtitle="كل ما تحتاجه للتفوق في مكان واحد" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} hoverable>
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gold-500/15 text-gold-400">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{feature.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionTitle title="أوائل الطلاب" />
        <Card>
          <EmptyState
            icon={Trophy}
            title="لوحة الأوائل ستظهر هنا"
            description="سيظهر هنا أعلى الطلاب نقاطًا بعد تشغيل نظام الترتيب."
          />
        </Card>
      </section>
    </>
  );
}

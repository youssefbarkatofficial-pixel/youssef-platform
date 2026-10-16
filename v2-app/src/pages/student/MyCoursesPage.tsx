import { Link } from 'react-router-dom';
import { BookOpen, ServerCrash } from 'lucide-react';
import CourseCard from '../../components/course/CourseCard';
import { Button, Card, EmptyState, ProgressBar, Spinner, buttonClasses } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCourses } from '../../hooks/useCourses';

// قراءة متسامحة لنسبة التقدم المخزنة في students.progress (شكلها القديم غير مضمون).
// تسجيل التقدم الجديد يتم لاحقًا على السيرفر (المرحلة 5)، وهنا نعرض ما هو موجود فقط.
function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function readCourseProgress(progress: unknown, courseId: string): number {
  if (typeof progress !== 'object' || progress === null || Array.isArray(progress)) return 0;

  const entry = (progress as Record<string, unknown>)[courseId];

  if (typeof entry === 'number' && Number.isFinite(entry)) return clampPercent(entry);

  if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
    const record = entry as Record<string, unknown>;
    for (const key of ['percent', 'percentage', 'progress']) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) return clampPercent(value);
    }
  }

  return 0;
}

export default function MyCoursesPage() {
  const { student } = useAuth();
  const { courses, loading, error, reload } = useCourses();

  const myCourses = student ? courses.filter((course) => student.courses.includes(course.id)) : [];

  let content;
  if (loading) {
    content = (
      <div className="grid min-h-[40vh] place-items-center text-gold-400">
        <Spinner size="lg" />
      </div>
    );
  } else if (error) {
    content = (
      <Card>
        <EmptyState
          icon={ServerCrash}
          title="تعذر تحميل كورساتك"
          description="تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى."
          action={<Button onClick={reload}>إعادة المحاولة</Button>}
        />
      </Card>
    );
  } else if (myCourses.length === 0) {
    content = (
      <Card>
        <EmptyState
          icon={BookOpen}
          title="لم تشترك في أي كورس بعد"
          description="تصفح الكورسات المتاحة واختر ما يناسب صفك الدراسي."
          action={
            <Link to="/courses" className={buttonClasses({ variant: 'primary' })}>
              تصفح الكورسات
            </Link>
          }
        />
      </Card>
    );
  } else {
    content = (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {myCourses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            showPrice={false}
            actionLabel="متابعة التعلم"
            footer={
              <ProgressBar value={readCourseProgress(student?.progress, course.id)} label="التقدم" />
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <h1 className="text-2xl font-extrabold text-white">كورساتي</h1>
      <p className="mt-1.5 text-sm text-slate-400">الكورسات التي اشتركت فيها ونسبة تقدمك.</p>
      <div className="mt-6">{content}</div>
    </div>
  );
}

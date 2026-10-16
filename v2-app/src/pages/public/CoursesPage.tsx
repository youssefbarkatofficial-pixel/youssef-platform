import { useSearchParams } from 'react-router-dom';
import { BookOpen, ServerCrash } from 'lucide-react';
import CourseCard from '../../components/course/CourseCard';
import { Button, Card, EmptyState, Spinner, Tabs } from '../../components/ui';
import { useCourses } from '../../hooks/useCourses';
import { GRADES, isGradeCode } from '../../lib/grades';

const TABS = [{ id: 'all', label: 'كل الصفوف' }, ...GRADES.map((grade) => ({ id: grade.code, label: grade.label }))];

export default function CoursesPage() {
  const { courses, loading, error, reload } = useCourses();
  const [searchParams, setSearchParams] = useSearchParams();

  const requested = searchParams.get('grade') ?? 'all';
  const selected = isGradeCode(requested) ? requested : 'all';

  const handleChange = (id: string) => {
    if (id === 'all') setSearchParams({});
    else setSearchParams({ grade: id });
  };

  const visible = courses.filter(
    (course) => !course.hidden && (selected === 'all' || course.grade === selected),
  );

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
          title="تعذر تحميل الكورسات"
          description="تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى."
          action={<Button onClick={reload}>إعادة المحاولة</Button>}
        />
      </Card>
    );
  } else if (visible.length === 0) {
    content = (
      <Card>
        <EmptyState
          icon={BookOpen}
          title="لا توجد كورسات حاليًا"
          description={
            selected === 'all'
              ? 'سنضيف الكورسات هنا قريبًا.'
              : 'لا توجد كورسات منشورة لهذا الصف حتى الآن.'
          }
        />
      </Card>
    );
  } else {
    content = (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-white">الكورسات</h1>
      <p className="mt-2 text-slate-400">اختر صفك الدراسي وتصفح الكورسات المتاحة.</p>

      <Tabs tabs={TABS} value={selected} onChange={handleChange} className="mt-6" />

      <div className="mt-6">{content}</div>
    </div>
  );
}

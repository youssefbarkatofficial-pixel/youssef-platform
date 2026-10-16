import { useEffect, useState } from 'react';
import { Button, Card, Spinner, useToast } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import {
  adoptLegacyCourse,
  exportCoursesBackup,
  listCourses,
  revertAdoptedCourse,
} from '../../services/courses';
import type { Course } from '../../services/courses';

const OWNER_EMAIL = 'youssefbarkatofficial@gmail.com';

// صفحة للمالك فقط: تحويل الكورسات القديمة إلى "كورسات جديدة" (source = v2) لتصبح قابلة للتعديل
// من المحرر الجديد. العملية لا تغيّر أي حقل آخر، ويمكن التراجع عنها. الرابط: /admin/adopt-courses
export default function AdoptCoursesPage() {
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [backedUp, setBackedUp] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isOwner = (firebaseUser?.email ?? '').toLowerCase() === OWNER_EMAIL;

  const reload = async () => {
    setLoading(true);
    try {
      setCourses(await listCourses());
    } catch {
      showToast('تعذر تحميل الكورسات.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isOwner) {
    return <p className="text-slate-300">هذه الصفحة للمالك فقط.</p>;
  }

  const handleBackup = async () => {
    try {
      const text = await exportCoursesBackup();
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `courses-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setBackedUp(true);
      showToast('تم تنزيل النسخة الاحتياطية. احتفظ بالملف ولا ترفعه على الإنترنت.', 'success');
    } catch {
      showToast('تعذر إنشاء النسخة الاحتياطية.', 'error');
    }
  };

  const run = async (course: Course, action: 'adopt' | 'revert') => {
    if (action === 'revert' && !window.confirm('تراجع عن تبنّي هذا الكورس؟ (لا تفعل هذا لكورس أنشأته من المنصة الجديدة)')) {
      return;
    }
    setBusyId(course.id);
    try {
      if (action === 'adopt') await adoptLegacyCourse(course.id);
      else await revertAdoptedCourse(course.id);
      showToast(action === 'adopt' ? 'تم التبنّي.' : 'تم التراجع.', 'success');
      await reload();
    } catch {
      showToast('تعذر تنفيذ العملية. تأكد أنك مسجّل بحساب المالك.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <h1 className="text-2xl font-extrabold text-white">تبنّي الكورسات القديمة</h1>
      <p className="text-sm leading-relaxed text-slate-400">
        التبنّي يجعل الكورس القديم قابلًا للتعديل الكامل من المحرر الجديد، ولا يغيّر أي بيانات فيه.
        أخفِ الكورس أولًا وجرّب التعديل عليه، ثم انشره. نزّل نسخة احتياطية قبل أي تبنّي.
      </p>

      <Button variant="secondary" onClick={() => void handleBackup()}>
        1. تنزيل نسخة احتياطية من الكورسات
      </Button>

      {loading ? (
        <Spinner />
      ) : (
        courses.map((course) => (
          <Card key={course.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-white">{course.title}</p>
              <p className="text-xs text-slate-400" dir="ltr">
                {course.id} · {course.isV2 ? 'جديد (v2)' : 'قديم'} · {course.hidden ? 'مخفي' : 'منشور'}
              </p>
            </div>
            {course.isV2 ? (
              <Button
                variant="secondary"
                size="sm"
                loading={busyId === course.id}
                onClick={() => void run(course, 'revert')}
              >
                تراجع
              </Button>
            ) : (
              <Button
                size="sm"
                loading={busyId === course.id}
                disabled={!backedUp}
                onClick={() => void run(course, 'adopt')}
              >
                2. تبنّي
              </Button>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

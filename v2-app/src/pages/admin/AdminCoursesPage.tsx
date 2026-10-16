import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ServerCrash } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Table,
  buttonClasses,
  useToast,
} from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { useCourses } from '../../hooks/useCourses';
import { getGradeLabel } from '../../lib/grades';
import { toEnglishDigits } from '../../lib/phone';
import { setCourseHidden, setCourseOrder } from '../../services/courses';
import type { Course } from '../../services/courses';

export default function AdminCoursesPage() {
  const { courses, loading, error, reload } = useCourses();
  const { showToast } = useToast();

  const [hiddenOverrides, setHiddenOverrides] = useState<Record<string, boolean>>({});
  const [orderOverrides, setOrderOverrides] = useState<Record<string, number>>({});
  const [orderDrafts, setOrderDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows: Course[] = courses.map((course) => ({
    ...course,
    hidden: hiddenOverrides[course.id] ?? course.hidden,
    order: orderOverrides[course.id] ?? course.order,
  }));

  const toggleHidden = async (course: Course) => {
    const nextHidden = !course.hidden;
    const message = nextHidden
      ? 'سيختفي الكورس من قائمة الكورسات للطلاب (من اشتراه يظل يراه). هل تريد المتابعة؟'
      : 'سيظهر هذا الكورس للطلاب الحقيقيين فورًا. هل تريد نشره؟';
    if (!window.confirm(message)) return;

    setBusyId(course.id);
    try {
      await setCourseHidden(course.id, nextHidden);
      setHiddenOverrides((previous) => ({ ...previous, [course.id]: nextHidden }));
      showToast(nextHidden ? 'تم إخفاء الكورس.' : 'تم نشر الكورس.', 'success');
    } catch {
      showToast('تعذر الحفظ. تأكد من صلاحياتك واتصالك بالإنترنت.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const saveOrder = async (course: Course) => {
    const draft = orderDrafts[course.id];
    const value = Number(draft);
    if (draft === undefined || draft.trim() === '' || !Number.isFinite(value) || value < 0) {
      showToast('اكتب رقم ترتيب صحيحًا.', 'error');
      return;
    }

    setBusyId(course.id);
    try {
      await setCourseOrder(course.id, value);
      setOrderOverrides((previous) => ({ ...previous, [course.id]: value }));
      setOrderDrafts((previous) => {
        const next = { ...previous };
        delete next[course.id];
        return next;
      });
      showToast('تم حفظ الترتيب.', 'success');
    } catch {
      showToast('تعذر الحفظ. تأكد من صلاحياتك واتصالك بالإنترنت.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const columns: TableColumn<Course>[] = [
    {
      key: 'title',
      header: 'الكورس',
      render: (course) => (
        <div className="space-y-1">
          <p className="font-bold text-white">{course.title || 'بدون عنوان'}</p>
          <Badge variant={course.isV2 ? 'gold' : 'neutral'}>{course.isV2 ? 'جديد' : 'قديم'}</Badge>
        </div>
      ),
    },
    {
      key: 'grade',
      header: 'الصف',
      render: (course) => (course.grade ? getGradeLabel(course.grade) : course.rawGrade || '-'),
    },
    {
      key: 'price',
      header: 'السعر',
      render: (course) => (course.isFree ? 'مجاني' : `${course.price} جنيه`),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (course) =>
        course.hidden ? <Badge variant="danger">مخفي</Badge> : <Badge variant="success">منشور</Badge>,
    },
    {
      key: 'order',
      header: 'الترتيب',
      render: (course) => {
        const current = course.order === null ? '' : String(course.order);
        const draft = orderDrafts[course.id];
        const value = draft ?? current;

        return (
          <div className="flex items-center gap-2">
            <div className="w-20">
              <Input
                dir="ltr"
                inputMode="numeric"
                aria-label="ترتيب الكورس"
                className="h-9 px-2 text-center"
                value={value}
                onChange={(event) => {
                  const text = toEnglishDigits(event.target.value).replace(/[^0-9]/g, '');
                  setOrderDrafts((previous) => ({ ...previous, [course.id]: text }));
                }}
              />
            </div>
            {draft !== undefined && draft !== current && (
              <Button
                size="sm"
                variant="secondary"
                loading={busyId === course.id}
                onClick={() => saveOrder(course)}
              >
                حفظ
              </Button>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (course) => (
        <div className="flex flex-wrap gap-2">
          <Link to={`/courses/${course.id}`} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
            عرض
          </Link>
          {course.isV2 && (
            <Link
              to={`/admin/courses/${course.id}`}
              className={buttonClasses({ variant: 'secondary', size: 'sm' })}
            >
              تعديل
            </Link>
          )}
          <Button
            size="sm"
            variant={course.hidden ? 'primary' : 'secondary'}
            loading={busyId === course.id}
            onClick={() => toggleHidden(course)}
          >
            {course.hidden ? 'نشر' : 'إخفاء'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white">إدارة الكورسات</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            الكورسات القديمة: عرض وإخفاء وترتيب فقط. التعديل الكامل للكورسات التي تُنشأ من المنصة الجديدة.
          </p>
        </div>
        <Link to="/admin/courses/new" className={buttonClasses({ variant: 'primary' })}>
          <Plus className="h-5 w-5" />
          إضافة كورس
        </Link>
      </div>

      <div className="mt-6">
        {error ? (
          <Card>
            <EmptyState
              icon={ServerCrash}
              title="تعذر تحميل الكورسات"
              description="تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى."
              action={<Button onClick={reload}>إعادة المحاولة</Button>}
            />
          </Card>
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(course) => course.id}
            loading={loading}
            emptyMessage="لا توجد كورسات بعد"
          />
        )}
      </div>
    </div>
  );
}

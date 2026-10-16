import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, ServerCrash } from 'lucide-react';
import CourseContentEditor from '../../components/admin/CourseContentEditor';
import CourseForm from '../../components/admin/CourseForm';
import { Badge, Button, Card, EmptyState, Spinner, buttonClasses, useToast } from '../../components/ui';
import { useCourse, useCourses } from '../../hooks/useCourses';
import {
  createCourse,
  generateCourseId,
  saveCourseContent,
  setCourseHidden,
  updateCourseDetails,
} from '../../services/courses';
import type { CourseFormValues, NormalizedCourseContent } from '../../services/courses';

const SAVE_ERROR = 'تعذر الحفظ. تأكد من صلاحياتك واتصالك بالإنترنت.';
const IMAGE_ERROR = 'صورة الغلاف أكبر من الحد المسموح. اختر صورة أبسط.';

function getSaveMessage(error: unknown): string {
  return error instanceof Error && error.message === 'image-too-large' ? IMAGE_ERROR : SAVE_ERROR;
}

function BackLink() {
  return (
    <Link
      to="/admin/courses"
      className="inline-flex items-center gap-1.5 text-sm font-bold text-gold-400 hover:text-gold-300"
    >
      <ArrowRight className="h-4 w-4" />
      العودة لقائمة الكورسات
    </Link>
  );
}

export default function AdminCourseEditPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isNew = courseId === 'new';
  const { courses, loading: coursesLoading } = useCourses();
  const { course, loading, error, reload } = useCourse(isNew ? undefined : courseId);

  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (course) {
      setHidden(course.hidden);
    }
  }, [course]);

  const nextOrder = Math.max(0, ...courses.map((item) => item.order ?? 0)) + 1;

  const handleCreate = async (values: CourseFormValues, coverDataUrl: string | null) => {
    setSubmitting(true);
    try {
      const newId = generateCourseId();
      await createCourse(newId, values, coverDataUrl ?? '');
      showToast('تم إنشاء الكورس. هو مخفي عن الطلاب حتى تضغط «نشر».', 'success');
      navigate(`/admin/courses/${newId}`, { replace: true });
    } catch (createError) {
      showToast(getSaveMessage(createError), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (values: CourseFormValues, coverDataUrl: string | null) => {
    if (!course) return;

    setSubmitting(true);
    try {
      await updateCourseDetails(course.id, values, coverDataUrl ?? undefined);
      showToast('تم حفظ بيانات الكورس.', 'success');
    } catch (updateError) {
      showToast(getSaveMessage(updateError), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!course) return;

    const nextHidden = !hidden;
    const message = nextHidden
      ? 'سيختفي الكورس من قائمة الكورسات للطلاب. هل تريد المتابعة؟'
      : 'سيظهر هذا الكورس للطلاب الحقيقيين فورًا. هل تريد نشره؟';
    if (!window.confirm(message)) return;

    setPublishing(true);
    try {
      await setCourseHidden(course.id, nextHidden);
      setHidden(nextHidden);
      showToast(nextHidden ? 'تم إخفاء الكورس.' : 'تم نشر الكورس.', 'success');
    } catch {
      showToast(SAVE_ERROR, 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveContent = async (updatedContent: NormalizedCourseContent) => {
    if (!course) return;

    setSavingContent(true);
    try {
      await saveCourseContent(course.id, updatedContent);
      await reload();
    } finally {
      setSavingContent(false);
    }
  };

  if (isNew) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <BackLink />
        <h1 className="text-2xl font-extrabold text-white">إضافة كورس جديد</h1>
        {coursesLoading ? (
          <div className="grid min-h-[30vh] place-items-center text-gold-400">
            <Spinner size="lg" />
          </div>
        ) : (
          <Card>
            <p className="mb-5 text-sm text-slate-400">
              يُنشأ الكورس مخفيًا عن الطلاب، وبعد إضافة المحتوى اضغط «نشر» لإظهاره.
            </p>
            <CourseForm
              defaultOrder={nextOrder}
              submitting={submitting}
              submitLabel="إنشاء الكورس"
              onSubmit={handleCreate}
            />
          </Card>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-gold-400">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <BackLink />
        <Card>
          <EmptyState
            icon={ServerCrash}
            title="تعذر تحميل الكورس"
            description="تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى."
            action={<Button onClick={reload}>إعادة المحاولة</Button>}
          />
        </Card>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <BackLink />
        <Card>
          <EmptyState icon={BookOpen} title="الكورس غير موجود" />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-white">تعديل الكورس</h1>
        <Link to={`/courses/${course.id}`} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
          معاينة الكورس
        </Link>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white">حالة الكورس:</span>
          {hidden ? <Badge variant="danger">مخفي عن الطلاب</Badge> : <Badge variant="success">منشور</Badge>}
        </div>
        <Button
          variant={hidden ? 'primary' : 'secondary'}
          loading={publishing}
          onClick={handleTogglePublish}
        >
          {hidden ? 'نشر الكورس' : 'إخفاء الكورس'}
        </Button>
      </Card>

      <Card>
        <h2 className="mb-5 text-lg font-bold text-white">بيانات الكورس</h2>
        <CourseForm
          key={course.id}
          initial={course}
          defaultOrder={nextOrder}
          submitting={submitting}
          submitLabel="حفظ بيانات الكورس"
          onSubmit={handleUpdate}
        />
      </Card>

      <div>
        <CourseContentEditor
          courseId={course.id}
          initialContent={course.content}
          onSave={handleSaveContent}
          saving={savingContent}
        />
      </div>
    </div>
  );
}

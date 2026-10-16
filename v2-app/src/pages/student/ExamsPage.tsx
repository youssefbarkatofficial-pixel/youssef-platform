import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Lock, ServerCrash } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Spinner, Tabs, buttonClasses } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCourses } from '../../hooks/useCourses';
import { KIND_LABELS, MAX_ATTEMPTS } from '../../lib/grading';
import type { AssessmentKind } from '../../lib/grading';
import {
  collectAssessments,
  findItem,
  formatDateTime,
  getAssessmentAccess,
  getAssessmentPath,
  getAssessmentStatus,
  getAttemptsFor,
  parseExamResults,
} from '../../services/assessments';
import type { AssessmentListEntry } from '../../services/assessments';
import { getVisibleSections } from '../../services/courses';
import type { Course, CourseSection } from '../../services/courses';

interface Row {
  course: Course;
  sections: CourseSection[];
  entry: AssessmentListEntry;
}

export default function ExamsPage() {
  const { student } = useAuth();
  const { courses, loading, error, reload } = useCourses();
  const [filter, setFilter] = useState('all');

  const results = parseExamResults(student?.examResults);
  const myCourses = student ? courses.filter((course) => student.courses.includes(course.id)) : [];

  const rows: Row[] = [];
  myCourses.forEach((course) => {
    const sections = getVisibleSections(course.sections);
    collectAssessments(course.id, sections).forEach((entry) => {
      rows.push({ course, sections, entry });
    });
  });

  const countOf = (kind: AssessmentKind) =>
    rows.filter((row) => row.entry.assessment.kind === kind).length;

  const tabs = [
    { id: 'all', label: `الكل (${rows.length})` },
    { id: 'exam', label: `امتحانات (${countOf('exam')})` },
    { id: 'training', label: `تدريبات (${countOf('training')})` },
    { id: 'homework', label: `واجبات (${countOf('homework')})` },
  ];

  const visible = rows.filter((row) => filter === 'all' || row.entry.assessment.kind === filter);

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
          title="تعذر تحميل البيانات"
          description="تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى."
          action={<Button onClick={reload}>إعادة المحاولة</Button>}
        />
      </Card>
    );
  } else if (myCourses.length === 0) {
    content = (
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="لم تشترك في أي كورس بعد"
          description="اشترك في كورس لتظهر لك امتحاناته وواجباته هنا."
          action={
            <Link to="/courses" className={buttonClasses({ variant: 'primary' })}>
              تصفح الكورسات
            </Link>
          }
        />
      </Card>
    );
  } else if (visible.length === 0) {
    content = (
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="لا توجد عناصر هنا"
          description="لم تُضف امتحانات أو تدريبات أو واجبات في هذا التصنيف حتى الآن."
        />
      </Card>
    );
  } else {
    content = (
      <div className="space-y-4">
        {visible.map(({ course, sections, entry }) => {
          const { assessment } = entry;
          const attempts = getAttemptsFor(results, assessment);
          const status = getAssessmentStatus(assessment, attempts);
          const access = getAssessmentAccess(assessment, sections, results, false);
          const item = findItem(sections, assessment.id);
          const deadlineText = item && typeof item.raw.deadlineDate === 'string' ? item.raw.deadlineDate : '';

          let actionLabel = 'التفاصيل';
          if (access.state === 'open') {
            actionLabel = attempts.length === 0 ? 'ابدأ' : 'محاولة جديدة';
          }

          return (
            <Card key={`${course.id}_${assessment.id}`} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="gold">{KIND_LABELS[assessment.kind]}</Badge>
                    <Badge variant="neutral">{entry.sectionTitle}</Badge>
                  </div>
                  <h2 className="text-lg font-bold text-white">{assessment.title}</h2>
                  <p className="text-sm text-slate-400">{course.title}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {status.official && (
                    <span dir="ltr" className="text-xl font-extrabold text-gold-400">
                      {status.official.effectivePercent}%
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-400">
                {assessment.availableFrom !== null && (
                  <span>يبدأ: {formatDateTime(assessment.availableFrom)}</span>
                )}
                {assessment.availableUntil !== null && (
                  <span>آخر موعد: {formatDateTime(assessment.availableUntil)}</span>
                )}
                {deadlineText && <span>الديدلاين: {deadlineText}</span>}
                <span>
                  المحاولات: {attempts.length} من {MAX_ATTEMPTS}
                </span>
              </div>

              {access.state !== 'open' && (
                <p className="flex items-start gap-2 text-sm text-gold-300">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                  {access.message}
                </p>
              )}

              <Link
                to={getAssessmentPath(course.id, assessment.id)}
                className={buttonClasses({
                  variant: access.state === 'open' ? 'primary' : 'secondary',
                  size: 'sm',
                })}
              >
                {actionLabel}
              </Link>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-extrabold text-white">الامتحانات والواجبات</h1>
      <p className="mt-1.5 text-sm text-slate-400">
        امتحانات وتدريبات وواجبات الكورسات التي اشتركت فيها وحالة كل واحد منها.
      </p>

      <Tabs tabs={tabs} value={filter} onChange={setFilter} className="mt-6" />

      <div className="mt-6">{content}</div>
    </div>
  );
}

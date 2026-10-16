import { Link } from 'react-router-dom';
import { Archive, ArchiveRestore, ClipboardList, Pencil, Plus } from 'lucide-react';
import { Badge, Button, Card, buttonClasses } from '../ui';
import { cn } from '../ui/cn';
import { KIND_LABELS } from '../../lib/grading';
import { listAssessmentItems } from '../../services/assessmentAdmin';
import { formatDateTime } from '../../services/assessments';
import type { CourseSection } from '../../services/courses';

interface AssessmentsPanelProps {
  courseId: string;
  sections: CourseSection[];
  // هل في تغييرات غير محفوظة في المحتوى؟ (لتنبيه الأدمن قبل إضافة عنصر جديد)
  dirty: boolean;
  onChange: (sections: CourseSection[]) => void;
}

export default function AssessmentsPanel({ courseId, sections, dirty, onChange }: AssessmentsPanelProps) {
  const entries = listAssessmentItems(sections);

  // الأرشفة تغيّر حقل archived داخل بيانات العنصر نفسها (العناصر من هذا النوع تُكتب كما هي).
  const toggleArchive = (itemId: string, archived: boolean) => {
    onChange(
      sections.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.id === itemId
            ? { ...item, archived, raw: { ...item.raw, archived } }
            : item,
        ),
      })),
    );
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">الامتحانات والتدريبات والواجبات</h2>
          <p className="text-sm text-slate-400">أسئلتها محفوظة في مستند منفصل، وإجاباتها لا يقرؤها الطالب قبل أن يسلّم.</p>
        </div>
        <Link
          to={`/admin/courses/${courseId}/assessments/new`}
          className={buttonClasses({ variant: 'primary', size: 'sm' })}
        >
          <Plus className="h-4 w-4" />
          إضافة
        </Link>
      </div>

      {dirty && (
        <p className="rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2 text-sm text-gold-200">
          لديك تغييرات غير محفوظة في المحتوى. احفظها (زر «حفظ المحتوى» بالأسفل) قبل إضافة أو تعديل أي عنصر
          هنا، حتى لا تضيع.
        </p>
      )}

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-navy-700 px-4 py-6 text-center text-sm text-slate-400">
          لا توجد امتحانات أو تدريبات أو واجبات بعد.
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map(({ section, item }) => {
            const kind = item.assessmentKind;
            const hasInlineQuestions = Array.isArray(item.raw.questions);
            const questionCount =
              typeof item.raw.questionCount === 'number'
                ? item.raw.questionCount
                : hasInlineQuestions
                  ? (item.raw.questions as unknown[]).length
                  : null;

            return (
              <li
                key={item.id}
                className={cn(
                  'space-y-3 rounded-xl border border-navy-800 bg-navy-950/40 p-3',
                  item.archived && 'opacity-60',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-gold-400" />
                      {kind && <Badge variant="gold">{KIND_LABELS[kind]}</Badge>}
                      <Badge variant="neutral">{section.title}</Badge>
                      {item.archived && <Badge variant="danger">مؤرشف</Badge>}
                    </div>
                    <p className="font-bold text-white">{item.title || 'بدون عنوان'}</p>
                    <p className="text-xs text-slate-400">
                      {questionCount !== null && `${questionCount} سؤال`}
                      {item.availableFrom !== null && ` · يبدأ ${formatDateTime(item.availableFrom)}`}
                      {item.availableUntil !== null && ` · آخر موعد ${formatDateTime(item.availableUntil)}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/admin/preview/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(item.id)}`}
                      className={buttonClasses({ variant: 'ghost', size: 'sm' })}
                    >
                      معاينة
                    </Link>
                    {!hasInlineQuestions && (
                      <Link
                        to={`/admin/courses/${courseId}/assessments/${encodeURIComponent(item.id)}/results`}
                        className={buttonClasses({ variant: 'ghost', size: 'sm' })}
                      >
                        النتائج
                      </Link>
                    )}
                    <Link
                      to={`/admin/courses/${courseId}/assessments/${encodeURIComponent(item.id)}`}
                      className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                    >
                      <Pencil className="h-4 w-4" />
                      تعديل
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleArchive(item.id, !item.archived)}
                    >
                      {item.archived ? (
                        <>
                          <ArchiveRestore className="h-4 w-4" />
                          استعادة
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4" />
                          أرشفة
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

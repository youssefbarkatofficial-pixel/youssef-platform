import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { ArrowRight, BookOpen, ClipboardList, ServerCrash, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Spinner, Table, useToast } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { KIND_LABELS, hasAnswerKeys } from '../../lib/grading';
import type { Question } from '../../lib/grading';
import { findItem, formatDateTime, loadQuestions, toAssessment } from '../../services/assessments';
import type { Assessment } from '../../services/assessments';
import { getCourse } from '../../services/courses';
import { listExamSubmissions, verifySubmission } from '../../services/examSubmissions';
import type { ExamSubmissionRow, VerificationOutcome } from '../../services/examSubmissions';

const PAGE_SIZE = 30;

function BackLink({ courseId }: { courseId: string }) {
  return (
    <Link
      to={`/admin/courses/${courseId}`}
      className="inline-flex items-center gap-1.5 text-sm font-bold text-gold-400 hover:text-gold-300"
    >
      <ArrowRight className="h-4 w-4" />
      العودة لتعديل الكورس
    </Link>
  );
}

export default function AssessmentResultsPage() {
  const { courseId = '', itemId = '' } = useParams();
  const { showToast } = useToast();

  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(false);
  const [metaReload, setMetaReload] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [keysReady, setKeysReady] = useState(false);

  const [rows, setRows] = useState<ExamSubmissionRow[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState(false);
  const [rowsReload, setRowsReload] = useState(0);

  const [outcomes, setOutcomes] = useState<Record<string, VerificationOutcome>>({});

  // 1) بيانات الامتحان وأسئلته مع مفاتيحه (الأدمن فقط يقرأ المفاتيح).
  useEffect(() => {
    let active = true;
    setMetaLoading(true);
    setMetaError(false);
    setNotFound(false);

    const load = async () => {
      try {
        const course = await getCourse(courseId);
        const item = course ? findItem(course.sections, itemId) : null;
        const found = course && item ? toAssessment(course.id, item) : null;

        if (!active) return;
        if (!found) {
          setNotFound(true);
          return;
        }

        setAssessment(found);

        const loaded = await loadQuestions(found, true);
        if (!active) return;
        setQuestions(loaded.questions);
        setKeysReady(loaded.questions.length > 0 && hasAnswerKeys(loaded.questions));
      } catch {
        if (active) setMetaError(true);
      } finally {
        if (active) setMetaLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [courseId, itemId, metaReload]);

  const isLegacy = assessment !== null && assessment.inlineQuestions.length > 0;

  // 2) أول صفحة من التسليمات (للامتحانات الجديدة فقط).
  useEffect(() => {
    if (!assessment || isLegacy) return;

    let active = true;
    setRowsLoading(true);
    setRowsError(false);

    listExamSubmissions(assessment.id, PAGE_SIZE, null)
      .then((page) => {
        if (!active) return;
        setRows(page.rows);
        setCursor(page.cursor);
        setHasMore(page.hasMore);
      })
      .catch(() => {
        if (active) setRowsError(true);
      })
      .finally(() => {
        if (active) setRowsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [assessment, isLegacy, rowsReload]);

  const loadMore = async () => {
    if (!assessment) return;

    setRowsLoading(true);
    try {
      const page = await listExamSubmissions(assessment.id, PAGE_SIZE, cursor);
      setRows((previous) => [...previous, ...page.rows]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch {
      showToast('تعذر تحميل المزيد من النتائج.', 'error');
    } finally {
      setRowsLoading(false);
    }
  };

  const verifyAll = (list: ExamSubmissionRow[]): Record<string, VerificationOutcome> => {
    const next: Record<string, VerificationOutcome> = {};
    if (!assessment || !keysReady) return next;

    list.forEach((row) => {
      next[row.docId] = verifySubmission(row, assessment, questions);
    });
    return next;
  };

  // التحقق محلي بالكامل (بدون قراءات إضافية)، فنشغّله تلقائيًا عند وصول التسليمات.
  useEffect(() => {
    setOutcomes(verifyAll(rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, assessment, questions, keysReady]);

  const handleVerifyAll = () => {
    if (!keysReady) {
      showToast('لا توجد مفاتيح تصحيح لهذا الامتحان، فلا يمكن التحقق.', 'error');
      return;
    }

    const next = verifyAll(rows);
    setOutcomes(next);

    const values = Object.values(next);
    const matches = values.filter((item) => item.status === 'match').length;
    const mismatches = values.filter((item) => item.status === 'mismatch').length;
    showToast(`تم التحقق: ${matches} متطابقة، ${mismatches} بها فروق.`, mismatches > 0 ? 'error' : 'success');
  };

  if (metaLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-gold-400">
        <Spinner size="lg" />
      </div>
    );
  }

  if (metaError) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <BackLink courseId={courseId} />
        <Card>
          <EmptyState
            icon={ServerCrash}
            title="تعذر التحميل"
            description="تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى."
            action={<Button onClick={() => setMetaReload((value) => value + 1)}>إعادة المحاولة</Button>}
          />
        </Card>
      </div>
    );
  }

  if (notFound || !assessment) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <BackLink courseId={courseId} />
        <Card>
          <EmptyState icon={BookOpen} title="الامتحان غير موجود" />
        </Card>
      </div>
    );
  }

  const outcomeList = Object.values(outcomes);
  const matchCount = outcomeList.filter((item) => item.status === 'match').length;
  const mismatchCount = outcomeList.filter((item) => item.status === 'mismatch').length;

  const columns: TableColumn<ExamSubmissionRow>[] = [
    {
      key: 'student',
      header: 'الطالب',
      render: (row) => (
        <div>
          <p className="font-bold text-white">{row.userName || 'بدون اسم'}</p>
          <p dir="ltr" className="text-start text-xs text-slate-500">
            {row.userId.slice(0, 8)}...
          </p>
        </div>
      ),
    },
    {
      key: 'attempt',
      header: 'المحاولة',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span>{row.attempt}</span>
          {row.attempt === 1 && <Badge variant="gold">رسمية</Badge>}
          {row.autoSubmit && <Badge variant="danger">تلقائي</Badge>}
        </div>
      ),
    },
    {
      key: 'time',
      header: 'وقت التسليم',
      render: (row) => (
        <span dir="ltr">{row.submittedAtMs !== null ? formatDateTime(row.submittedAtMs) : '-'}</span>
      ),
    },
    {
      key: 'stored',
      header: 'الدرجة المخزنة',
      render: (row) =>
        row.result ? (
          <span dir="ltr" className="font-bold text-gold-400">
            {row.result.effectivePercent}%
          </span>
        ) : (
          <Badge variant="neutral">لم تُصحَّح</Badge>
        ),
    },
    {
      key: 'recomputed',
      header: 'المحسوبة الآن',
      render: (row) => {
        const outcome = outcomes[row.docId];
        return outcome && outcome.recomputed ? (
          <span dir="ltr" className="font-bold text-slate-200">
            {outcome.recomputed.effectivePercent}%
          </span>
        ) : (
          <span className="text-slate-500">-</span>
        );
      },
    },
    {
      key: 'status',
      header: 'التحقق',
      render: (row) => {
        const outcome = outcomes[row.docId];
        if (!outcome) return <span className="text-slate-500">-</span>;

        if (outcome.status === 'match') {
          return <Badge variant="success">✓ متطابقة</Badge>;
        }
        if (outcome.status === 'ungraded') {
          return <Badge variant="neutral">بلا نتيجة</Badge>;
        }
        return (
          <div className="space-y-1">
            <Badge variant="danger">⚠ فرق</Badge>
            <ul className="max-w-64 space-y-0.5 text-xs text-red-300">
              {outcome.differences.map((difference) => (
                <li key={difference}>{difference}</li>
              ))}
            </ul>
          </div>
        );
      },
    },
  ];

  let content;
  if (isLegacy) {
    content = (
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="امتحان قديم"
          description="الامتحانات القديمة تُصحَّح في المتصفح وتُحفظ نتائجها في مستند الطالب، ولا تُسجَّل هنا."
        />
      </Card>
    );
  } else if (rowsError) {
    content = (
      <Card>
        <EmptyState
          icon={ServerCrash}
          title="تعذر تحميل النتائج"
          description="تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى."
          action={<Button onClick={() => setRowsReload((value) => value + 1)}>إعادة المحاولة</Button>}
        />
      </Card>
    );
  } else {
    content = (
      <>
        <Table
          columns={columns}
          rows={rows}
          rowKey={(row) => row.docId}
          loading={rowsLoading && rows.length === 0}
          emptyMessage="لا توجد تسليمات لهذا الامتحان بعد"
        />
        {hasMore && (
          <div className="mt-4 text-center">
            <Button variant="secondary" loading={rowsLoading} onClick={() => void loadMore()}>
              تحميل المزيد
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <BackLink courseId={courseId} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge variant="gold">{KIND_LABELS[assessment.kind]}</Badge>
            <Badge variant="neutral">نتائج الطلاب</Badge>
          </div>
          <h1 className="text-2xl font-extrabold text-white">{assessment.title}</h1>
        </div>

        {!isLegacy && (
          <Button onClick={handleVerifyAll} disabled={rows.length === 0}>
            <ShieldCheck className="h-5 w-5" />
            تحقق من الكل
          </Button>
        )}
      </div>

      {!isLegacy && (
        <Card className="space-y-2 text-sm leading-relaxed text-slate-300">
          <p>
            الدرجة تُحسب على جهاز الطالب، لذلك تُعاد هنا من إجاباته المحفوظة ومفاتيح التصحيح، وتُقارن
            بالدرجة المخزنة.
          </p>
          {keysReady ? (
            <p>
              المحمّل الآن: {rows.length} تسليم. متطابقة: <span className="font-bold text-emerald-300">{matchCount}</span>
              ، بها فروق: <span className="font-bold text-red-300">{mismatchCount}</span>.
            </p>
          ) : (
            <p className="text-gold-300">لا توجد مفاتيح تصحيح لهذا الامتحان، فلا يمكن التحقق من الدرجات.</p>
          )}
        </Card>
      )}

      {content}
    </div>
  );
}

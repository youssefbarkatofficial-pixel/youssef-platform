import { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, HelpCircle, Pencil, Plus, ServerCrash } from 'lucide-react';
import QuestionForm from '../../components/admin/QuestionForm';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
  useToast,
} from '../../components/ui';
import { GRADE_OPTIONS, getGradeLabel } from '../../lib/grades';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS } from '../../lib/questionDraft';
import type { QuestionDraft } from '../../lib/questionDraft';
import {
  createBankQuestion,
  listBankQuestions,
  setBankQuestionArchived,
  updateBankQuestion,
} from '../../services/questionBank';
import type { BankMeta, BankQuestion } from '../../services/questionBank';

const OPTION_LABELS: Record<string, string> = { a: 'أ', b: 'ب', c: 'ج', d: 'د' };

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'كل الأنواع' },
  ...QUESTION_TYPES.map((type) => ({ value: type, label: QUESTION_TYPE_LABELS[type] })),
];

const GRADE_FILTER_OPTIONS = [{ value: 'all', label: 'كل الصفوف' }, ...GRADE_OPTIONS];

const SAVE_ERROR = 'تعذر الحفظ. تأكد من صلاحياتك واتصالك بالإنترنت.';

function describeAnswer(question: BankQuestion): string {
  if (question.type === 'choose' && question.options) {
    const text = question.options[question.answer];
    return text !== undefined ? `${OPTION_LABELS[question.answer] ?? question.answer}) ${text}` : '-';
  }
  return question.answer || '-';
}

export default function QuestionBankPage() {
  const { showToast } = useToast();

  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BankQuestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);

    listBankQuestions()
      .then((list) => {
        if (active) setQuestions(list);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const reload = () => setReloadKey((value) => value + 1);

  const handleCreate = async (draft: QuestionDraft, meta: BankMeta) => {
    setSaving(true);
    try {
      await createBankQuestion(draft, meta);
      setCreating(false);
      showToast('تمت إضافة السؤال إلى البنك.', 'success');
      reload();
    } catch {
      showToast(SAVE_ERROR, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (draft: QuestionDraft, meta: BankMeta) => {
    if (!editing) return;

    setSaving(true);
    try {
      await updateBankQuestion(editing.docId, draft, meta);
      setEditing(null);
      showToast('تم حفظ التعديل.', 'success');
      reload();
    } catch {
      showToast(SAVE_ERROR, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleArchive = async (question: BankQuestion) => {
    const next = !question.archived;
    if (next && !window.confirm('سيُؤرشف هذا السؤال ولن يظهر عند اختيار الأسئلة. هل تريد المتابعة؟')) {
      return;
    }

    setBusyId(question.docId);
    try {
      await setBankQuestionArchived(question.docId, next);
      setQuestions((previous) =>
        previous.map((item) => (item.docId === question.docId ? { ...item, archived: next } : item)),
      );
      showToast(next ? 'تمت أرشفة السؤال.' : 'تمت استعادة السؤال.', 'success');
    } catch {
      showToast(SAVE_ERROR, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const term = search.trim().toLowerCase();
  const visible = questions.filter((question) => {
    if (!showArchived && question.archived) return false;
    if (typeFilter !== 'all' && question.type !== typeFilter) return false;
    if (gradeFilter !== 'all' && question.grade !== gradeFilter) return false;
    if (term && !`${question.text} ${question.topic}`.toLowerCase().includes(term)) return false;
    return true;
  });

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
          title="تعذر تحميل بنك الأسئلة"
          description="تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى."
          action={<Button onClick={reload}>إعادة المحاولة</Button>}
        />
      </Card>
    );
  } else if (visible.length === 0) {
    content = (
      <Card>
        <EmptyState
          icon={HelpCircle}
          title={questions.length === 0 ? 'البنك فارغ' : 'لا توجد أسئلة مطابقة'}
          description={
            questions.length === 0
              ? 'أضف أول سؤال لتستخدمه في الامتحانات والواجبات.'
              : 'غيّر البحث أو الفلاتر.'
          }
        />
      </Card>
    );
  } else {
    content = (
      <div className="space-y-3">
        {visible.map((question) => (
          <Card key={question.docId} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="gold">{QUESTION_TYPE_LABELS[question.type]}</Badge>
                <Badge variant="neutral">{question.points} درجة</Badge>
                {question.grade && <Badge variant="info">{getGradeLabel(question.grade)}</Badge>}
                {question.topic && <Badge variant="neutral">{question.topic}</Badge>}
                {question.archived && <Badge variant="danger">مؤرشف</Badge>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(question)}>
                  <Pencil className="h-4 w-4" />
                  تعديل
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busyId === question.docId}
                  onClick={() => handleToggleArchive(question)}
                >
                  {question.archived ? (
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

            <p className="whitespace-pre-line font-bold leading-relaxed text-white">{question.text}</p>

            {question.type === 'choose' && question.options && (
              <ul className="grid gap-1.5 text-sm text-slate-300 sm:grid-cols-2">
                {Object.keys(question.options).map((key) => (
                  <li
                    key={key}
                    className={key === question.answer ? 'font-bold text-emerald-300' : undefined}
                  >
                    {OPTION_LABELS[key] ?? key}) {question.options?.[key]}
                  </li>
                ))}
              </ul>
            )}

            <p className="text-sm text-slate-400">
              الإجابة: <span className="whitespace-pre-line font-bold text-emerald-300">{describeAnswer(question)}</span>
            </p>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white">بنك الأسئلة</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            أسئلة قابلة لإعادة الاستخدام في الامتحانات والتدريبات والواجبات. الإجابات الصحيحة تظهر هنا للأدمن فقط.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-5 w-5" />
          إضافة سؤال
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Input
          aria-label="بحث"
          placeholder="ابحث في نص السؤال أو الموضوع"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          aria-label="نوع السؤال"
          options={TYPE_FILTER_OPTIONS}
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        />
        <Select
          aria-label="الصف"
          options={GRADE_FILTER_OPTIONS}
          value={gradeFilter}
          onChange={(event) => setGradeFilter(event.target.value)}
        />
      </div>

      <label className="mt-3 flex items-center gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
          className="h-5 w-5 rounded border-navy-600 bg-navy-900 accent-gold-500"
        />
        إظهار الأسئلة المؤرشفة
      </label>

      <div className="mt-6">{content}</div>

      <Modal open={creating} onClose={() => setCreating(false)} title="إضافة سؤال إلى البنك">
        <QuestionForm
          showBankMeta
          submitLabel="حفظ السؤال"
          submitting={saving}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="تعديل السؤال">
        {editing && (
          <QuestionForm
            key={editing.docId}
            initial={editing}
            showBankMeta
            initialMeta={{ grade: editing.grade, topic: editing.topic }}
            submitLabel="حفظ التعديل"
            submitting={saving}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

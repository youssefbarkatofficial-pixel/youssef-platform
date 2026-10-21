import { cairoInputToUtcMs } from '../../lib/cairoTime';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Library,
  Pencil,
  Plus,
  ServerCrash,
  Trash2,
  UploadCloud,
  FileText,
  Sparkles,
  Bell,
  AlertTriangle,
} from 'lucide-react';
import {
  parseQuestionsFromJson,
  parseQuestionsFromTxt,
  parseQuestionsFromDocx,
  splitQuestionAt,
  mergeWithPreviousQuestion,
  getCairoNextSchedule,
  formatCairoScheduleSummary,
} from '../../lib/questionImport';
import { sendBroadcastNotification } from '../../services/notifications';
import QuestionForm from '../../components/admin/QuestionForm';
import QuestionPicker from '../../components/admin/QuestionPicker';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
  buttonClasses,
  useToast,
} from '../../components/ui';
import { KIND_LABELS } from '../../lib/grading';
import type { AssessmentKind } from '../../lib/grading';
import { toEnglishDigits } from '../../lib/phone';
import {
  QUESTION_TYPE_LABELS,
  isEssayType,
  validateDraft,
} from '../../lib/questionDraft';
import type { QuestionDraft } from '../../lib/questionDraft';
import {
  createAssessment,
  listAssessmentItems,
  loadAssessmentForEdit,
  updateAssessment,
} from '../../services/assessmentAdmin';
import type { AssessmentMeta } from '../../services/assessmentAdmin';
import { getCourse } from '../../services/courses';
import type { Course } from '../../services/courses';
import { createBankQuestion } from '../../services/questionBank';
import type { BankMeta } from '../../services/questionBank';

const DEFAULT_META: AssessmentMeta = {
  kind: 'exam',
  title: '',
  duration: 0,
  strictMode: false,
  availableFrom: '',
  availableUntil: '',
  lockedUntilTrainingId: '',
  deadlineDate: '',
  passingScore: 50,
  requirePassingToUnlock: false,
};

const KIND_OPTIONS = [
  { value: 'exam', label: KIND_LABELS.exam },
  { value: 'training', label: KIND_LABELS.training },
  { value: 'homework', label: KIND_LABELS.homework },
];

const SAVE_ERROR = 'تعذر الحفظ. تأكد من صلاحياتك واتصالك بالإنترنت.';

const OPTION_LABELS: Record<string, string> = { a: 'أ', b: 'ب', c: 'ج', d: 'د' };

type QuestionModalState = { mode: 'new' } | { mode: 'edit'; index: number } | null;

function findKind(value: string): AssessmentKind | null {
  if (value === 'exam' || value === 'training' || value === 'homework') return value;
  return null;
}

function summarizeAnswer(question: QuestionDraft): string {
  if (question.type === 'choose') {
    const text = question.options?.[question.answer];
    return text ? `${OPTION_LABELS[question.answer] ?? question.answer}) ${text}` : '-';
  }
  if (question.type === 'tf') return question.answer || '-';
  return isEssayType(question.type) ? 'إجابة نموذجية مكتوبة' : '-';
}

function validateAll(
  meta: AssessmentMeta,
  questions: QuestionDraft[],
  sectionId: string,
  isNew: boolean,
): string {
  if (isNew && sectionId === '') return 'اختر القسم الذي سيُضاف فيه.';
  if (meta.title.trim().length < 3) return 'اكتب عنوانًا (3 أحرف على الأقل).';
  if (meta.availableFrom && meta.availableUntil && meta.availableUntil < meta.availableFrom) {
    return 'آخر موعد لازم يكون بعد وقت البداية.';
  }
  if (questions.length === 0) return 'أضف سؤالًا واحدًا على الأقل.';

  for (let index = 0; index < questions.length; index += 1) {
    const message = validateDraft(questions[index]);
    if (message) return `السؤال ${index + 1}: ${message}`;
  }
  return '';
}

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

export default function AdminAssessmentEditPage() {
  const { courseId = '', itemId = '' } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isNew = itemId === 'new';

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [meta, setMeta] = useState<AssessmentMeta>(DEFAULT_META);
  const [durationText, setDurationText] = useState('0');
  const [sectionId, setSectionId] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);

  const [questionModal, setQuestionModal] = useState<QuestionModalState>(null);
  const [saveToBank, setSaveToBank] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notifyStudents, setNotifyStudents] = useState(false);

  const applyWeeklySchedule = () => {
    const s = getCairoNextSchedule(meta.kind);
    updateMeta({
      availableFrom: s.availableFrom,
      availableUntil: s.availableUntil,
    });
    showToast(`تم تطبيق جدول الأسبوع: ${s.summary}`, 'success');
  };

  // استيراد الأسئلة (JSON / TXT / Word)
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importSourceType, setImportSourceType] = useState<'json' | 'txt' | 'docx'>('json');
  const [importText, setImportText] = useState('');
  const [importPreviewQuestions, setImportPreviewQuestions] = useState<QuestionDraft[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importProcessing, setImportProcessing] = useState(false);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportProcessing(true);
    setImportWarnings([]);
    try {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.json')) {
        setImportSourceType('json');
        const text = await file.text();
        setImportText(text);
        const res = parseQuestionsFromJson(text);
        setImportPreviewQuestions(res.questions);
        setImportWarnings(res.warnings);
      } else if (fileName.endsWith('.docx')) {
        setImportSourceType('docx');
        const buffer = await file.arrayBuffer();
        const res = await parseQuestionsFromDocx(buffer);
        setImportPreviewQuestions(res.questions);
        setImportWarnings(res.warnings);
      } else {
        setImportSourceType('txt');
        const text = await file.text();
        setImportText(text);
        const res = parseQuestionsFromTxt(text);
        setImportPreviewQuestions(res.questions);
        setImportWarnings(res.warnings);
      }
    } catch (err: any) {
      setImportWarnings([`حدث خطأ أثناء قراءة الملف: ${err.message}`]);
    } finally {
      setImportProcessing(false);
    }
  };

  const handleParsePastedText = () => {
    if (!importText.trim()) return;
    if (importSourceType === 'json') {
      const res = parseQuestionsFromJson(importText);
      setImportPreviewQuestions(res.questions);
      setImportWarnings(res.warnings);
    } else {
      const res = parseQuestionsFromTxt(importText);
      setImportPreviewQuestions(res.questions);
      setImportWarnings(res.warnings);
    }
  };

  const handleConfirmImport = () => {
    if (importPreviewQuestions.length === 0) return;
    setQuestions((prev) => [...prev, ...importPreviewQuestions]);
    showToast(
      `تم استيراد ${importPreviewQuestions.length} سؤال بنجاح كمسودة. اضغط «حفظ التعديلات» لحفظها.`,
      'success',
    );
    setImportModalOpen(false);
    setImportPreviewQuestions([]);
    setImportText('');
    setImportWarnings([]);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setNotFound(false);

    const load = async () => {
      try {
        if (isNew) {
          const loadedCourse = await getCourse(courseId);
          if (!active) return;
          if (!loadedCourse) {
            setNotFound(true);
          } else {
            setCourse(loadedCourse);
          }
        } else {
          const loaded = await loadAssessmentForEdit(courseId, itemId);
          if (!active) return;
          if (!loaded) {
            setNotFound(true);
          } else {
            setCourse(loaded.course);
            setMeta(loaded.meta);
            setDurationText(String(loaded.meta.duration));
            setSectionId(loaded.sectionId);
            setQuestions(loaded.questions);
          }
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [courseId, itemId, isNew, reloadKey]);

  const updateMeta = (patch: Partial<AssessmentMeta>) => {
    setMeta((previous) => ({ ...previous, ...patch }));
    setFormError('');
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;

    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    setQuestions(next);
  };

  const handleQuestionSubmit = async (draft: QuestionDraft, bankMeta: BankMeta) => {
    if (questionModal?.mode === 'edit') {
      const index = questionModal.index;
      setQuestions((previous) => previous.map((item, position) => (position === index ? draft : item)));
      setQuestionModal(null);
      return;
    }

    if (saveToBank) {
      try {
        await createBankQuestion(draft, bankMeta);
      } catch {
        showToast('تعذر حفظ السؤال في البنك، لكنه أُضيف للامتحان.', 'error');
      }
    }

    setQuestions((previous) => [...previous, draft]);
    setQuestionModal(null);
  };

  const handleSave = async () => {
    const duration = Math.max(0, Math.round(Number(durationText) || 0));
    const finalMeta: AssessmentMeta = { ...meta, duration };

    const message = validateAll(finalMeta, questions, sectionId, isNew);
    if (message) {
      setFormError(message);
      return;
    }

    setFormError('');
    setSaving(true);
    try {
      if (isNew) {
        await createAssessment(courseId, sectionId, finalMeta, questions);
        if (notifyStudents) {
          try {
            await sendBroadcastNotification({
              title: 'تحديث في المنهج',
              message: `تمت إضافة ${KIND_LABELS[finalMeta.kind]} جديد: «${finalMeta.title.trim()}»`,
              category: 'curriculumUpdates',
              targetType: 'course',
              targetValue: courseId,
              courseId,
              openAt: finalMeta.availableFrom ? cairoInputToUtcMs(finalMeta.availableFrom) : null,
              sentBy: 'admin',
            });
          } catch {
            // notification error ignored
          }
        }
        showToast('تم إنشاء العنصر وإضافته للكورس.', 'success');
        navigate(`/admin/courses/${courseId}`, { replace: true });
      } else {
        await updateAssessment(courseId, itemId, finalMeta, questions);
        if (notifyStudents) {
          try {
            await sendBroadcastNotification({
              title: 'تحديث في المنهج',
              message: `تم تعديل ${KIND_LABELS[finalMeta.kind]}: «${finalMeta.title.trim()}»`,
              category: 'curriculumUpdates',
              targetType: 'course',
              targetValue: courseId,
              courseId,
              openAt: finalMeta.availableFrom ? cairoInputToUtcMs(finalMeta.availableFrom) : null,
              sentBy: 'admin',
            });
          } catch {
            // notification error ignored
          }
        }
        showToast('تم حفظ التعديلات.', 'success');
      }
    } catch {
      showToast(SAVE_ERROR, 'error');
    } finally {
      setSaving(false);
    }
  };

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
        <BackLink courseId={courseId} />
        <Card>
          <EmptyState
            icon={ServerCrash}
            title="تعذر التحميل"
            description="تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى."
            action={<Button onClick={() => setReloadKey((value) => value + 1)}>إعادة المحاولة</Button>}
          />
        </Card>
      </div>
    );
  }

  if (notFound || !course) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <BackLink courseId={courseId} />
        <Card>
          <EmptyState icon={BookOpen} title="الكورس أو العنصر غير موجود" />
        </Card>
      </div>
    );
  }

  if (!course.isV2) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <BackLink courseId={courseId} />
        <Card>
          <EmptyState
            icon={BookOpen}
            title="هذا كورس قديم"
            description="الامتحانات والواجبات تُنشأ وتُعدَّل في الكورسات الجديدة فقط."
          />
        </Card>
      </div>
    );
  }

  const sectionOptions = course.sections
    .filter((section) => !section.archived)
    .map((section) => ({ value: section.id, label: section.title }));

  const trainingOptions = [
    { value: '', label: 'بدون قفل' },
    ...listAssessmentItems(course.sections)
      .filter(
        (entry) =>
          entry.item.assessmentKind === 'training' && !entry.item.archived && entry.item.id !== itemId,
      )
      .map((entry) => ({ value: entry.item.id, label: entry.item.title || 'تدريب بدون عنوان' })),
  ];

  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);

  const modalOpen = questionModal !== null;
  const editingDraft =
    questionModal?.mode === 'edit' ? (questions[questionModal.index] ?? null) : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <BackLink courseId={courseId} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-white">
          {isNew ? 'إضافة امتحان أو تدريب أو واجب' : 'تعديل العنصر'}
        </h1>
        {!isNew && (
          <Link
            to={`/admin/preview/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(itemId)}`}
            className={buttonClasses({ variant: 'secondary', size: 'sm' })}
          >
            معاينة وتجربة
          </Link>
        )}
      </div>

      <Card className="space-y-5">
        <h2 className="text-lg font-bold text-white">البيانات الأساسية</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="النوع"
            options={KIND_OPTIONS}
            value={meta.kind}
            disabled={!isNew}
            onChange={(event) => {
              const kind = findKind(event.target.value);
              if (kind) updateMeta({ kind, lockedUntilTrainingId: '' });
            }}
          />
          <Select
            label="القسم"
            options={sectionOptions}
            placeholder="اختر القسم"
            value={sectionId}
            disabled={!isNew}
            onChange={(event) => {
              setSectionId(event.target.value);
              setFormError('');
            }}
          />
        </div>

        <Input
          label="العنوان"
          value={meta.title}
          onChange={(event) => updateMeta({ title: event.target.value })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="المدة بالدقائق"
            dir="ltr"
            inputMode="numeric"
            value={durationText}
            hint="0 = بدون وقت محدد. وضع منع الغش بدون مدة يعني 5 دقائق."
            onChange={(event) => {
              setDurationText(toEnglishDigits(event.target.value).replace(/[^0-9]/g, ''));
              setFormError('');
            }}
          />
          <div className="flex items-end">
            <label className="flex items-center gap-3 pb-3 text-slate-200">
              <input
                type="checkbox"
                checked={meta.kind === 'exam' ? true : meta.strictMode}
                disabled={meta.kind === 'exam'}
                onChange={(event) => updateMeta({ strictMode: event.target.checked })}
                className="h-5 w-5 rounded border-navy-600 bg-navy-900 accent-gold-500"
              />
              <span>
                وضع منع الغش
                {meta.kind === 'exam' && (
                  <span className="block text-xs text-slate-500">إجباري في الامتحانات</span>
                )}
              </span>
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-navy-800 bg-navy-950/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-gold-400">مواعيد الفتح والإغلاق (بتوقيت القاهرة)</span>
            <button
              type="button"
              onClick={applyWeeklySchedule}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500/20 px-3 py-1.5 text-xs font-bold text-gold-300 hover:bg-gold-500/30"
            >
              <Sparkles className="h-3.5 w-3.5 text-gold-400" />
              <span>طبّق جدول الأسبوع تلقائيًا</span>
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="يبدأ في (availableFrom)"
              type="datetime-local"
              dir="ltr"
              value={meta.availableFrom}
              hint="بتوقيت القاهرة."
              onChange={(event) => updateMeta({ availableFrom: event.target.value })}
            />
            <Input
              label="آخر موعد (availableUntil)"
              type="datetime-local"
              dir="ltr"
              value={meta.availableUntil}
              hint="التسليم بعده يخصم 20 نقطة مئوية."
              onChange={(event) => updateMeta({ availableUntil: event.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="نسبة النجاح لفتح ما بعده (%)"
              type="number"
              min={0}
              max={100}
              value={String(meta.passingScore ?? 50)}
              hint="افتراضي 50%. اجتيازه يفتح المحاضرة التالية."
              onChange={(event) => updateMeta({ passingScore: Number(event.target.value) || 0 })}
            />
            <div className="flex items-end pb-3">
              <label className="flex items-center gap-2 text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={meta.requirePassingToUnlock ?? false}
                  onChange={(event) => updateMeta({ requirePassingToUnlock: event.target.checked })}
                  className="h-4 w-4 rounded border-navy-600 bg-navy-900 accent-gold-500"
                />
                <span>اجتياز هذا التقييم إلزامي لفتح المحاضرة التالية</span>
              </label>
            </div>
          </div>

          {/* ملخص القواعد قبل الحفظ */}
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-200">
            <div className="font-bold text-sky-300 mb-1">ملخص القواعد والمواعيد:</div>
            <p>{formatCairoScheduleSummary(meta.kind, meta.availableFrom, meta.availableUntil, meta.passingScore ?? 50)}</p>
          </div>

          <label className="flex items-center gap-2 pt-1 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={notifyStudents}
              onChange={(e) => setNotifyStudents(e.target.checked)}
              className="h-4 w-4 rounded border-navy-600 bg-navy-900 accent-gold-500"
            />
            <Bell className="h-3.5 w-3.5 text-gold-400" />
            <span>إشعار الطلاب المشتركين بهذا التقييم عبر الإشعارات العامة فور الحفظ</span>
          </label>
        </div>

        {meta.kind === 'homework' && (
          <Select
            label="يُفتح بعد إنهاء التدريب (اختياري)"
            options={trainingOptions}
            value={meta.lockedUntilTrainingId}
            onChange={(event) => updateMeta({ lockedUntilTrainingId: event.target.value })}
          />
        )}

        <Input
          label="نص الديدلاين للعرض (اختياري)"
          value={meta.deadlineDate}
          hint="يظهر للطالب بجوار العنصر فقط، ولا يؤثر على التصحيح."
          onChange={(event) => updateMeta({ deadlineDate: event.target.value })}
        />
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">الأسئلة</h2>
            <p className="text-sm text-slate-400">
              {questions.length} سؤال، مجموع الدرجات {totalPoints}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setImportModalOpen(true)}>
              <UploadCloud className="h-4 w-4" />
              استيراد سريع (JSON / TXT / Word)
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
              <Library className="h-4 w-4" />
              من البنك
            </Button>
            <Button size="sm" onClick={() => setQuestionModal({ mode: 'new' })}>
              <Plus className="h-4 w-4" />
              سؤال جديد
            </Button>
          </div>
        </div>

        {questions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-700 px-4 py-6 text-center text-sm text-slate-400">
            لم تُضف أسئلة بعد.
          </p>
        ) : (
          <ul className="space-y-3">
            {questions.map((question, index) => (
              <li
                key={question.id}
                className="space-y-2 rounded-xl border border-navy-800 bg-navy-950/40 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{index + 1}</Badge>
                    <Badge variant="gold">{QUESTION_TYPE_LABELS[question.type]}</Badge>
                    <Badge variant="neutral">{question.points} درجة</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="تحريك لأعلى"
                      disabled={index === 0}
                      onClick={() => moveQuestion(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="تحريك لأسفل"
                      disabled={index === questions.length - 1}
                      onClick={() => moveQuestion(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <button
                      type="button"
                      title="قسّم هذا السؤال"
                      onClick={() => {
                        const splitText = window.prompt('اكتب الكلمة أو العبارة التي تريد التقسيم عندها:');
                        if (splitText !== null) {
                          setQuestions(splitQuestionAt(questions, index, splitText));
                        }
                      }}
                      className="rounded bg-navy-800 px-2 py-1 text-[11px] font-bold text-gold-400 hover:bg-navy-700"
                    >
                      قسّم هنا
                    </button>
                    {index > 0 && (
                      <button
                        type="button"
                        title="ادمج مع السؤال السابق"
                        onClick={() => setQuestions(mergeWithPreviousQuestion(questions, index))}
                        className="rounded bg-navy-800 px-2 py-1 text-[11px] font-bold text-sky-400 hover:bg-navy-700"
                      >
                        ادمج مع السابق
                      </button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="تعديل السؤال"
                      onClick={() => setQuestionModal({ mode: 'edit', index })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="إزالة السؤال من القائمة"
                      onClick={() =>
                        setQuestions((previous) => previous.filter((_, position) => position !== index))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="whitespace-pre-line text-sm font-bold leading-relaxed text-white">
                  {question.text}
                </p>
                <p className="text-sm text-slate-400">
                  الإجابة: <span className="font-bold text-emerald-300">{summarizeAnswer(question)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {formError && (
        <p role="alert" className="text-sm text-red-400">
          {formError}
        </p>
      )}

      <Button size="lg" loading={saving} onClick={handleSave}>
        {isNew ? 'إنشاء وإضافة للكورس' : 'حفظ التعديلات'}
      </Button>

      <QuestionPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={(drafts) => setQuestions((previous) => [...previous, ...drafts])}
      />

      <Modal
        open={modalOpen}
        onClose={() => setQuestionModal(null)}
        title={questionModal?.mode === 'edit' ? 'تعديل السؤال' : 'سؤال جديد'}
      >
        {modalOpen && (
          <QuestionForm
            key={questionModal?.mode === 'edit' ? `edit-${questionModal.index}` : 'new'}
            initial={editingDraft}
            showBankMeta={questionModal?.mode === 'new' && saveToBank}
            submitLabel={questionModal?.mode === 'edit' ? 'حفظ السؤال' : 'إضافة السؤال'}
            onSubmit={handleQuestionSubmit}
            onCancel={() => setQuestionModal(null)}
            extra={
              questionModal?.mode === 'new' ? (
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={saveToBank}
                    onChange={(event) => setSaveToBank(event.target.checked)}
                    className="h-5 w-5 rounded border-navy-600 bg-navy-900 accent-gold-500"
                  />
                  احفظ هذا السؤال في بنك الأسئلة أيضًا
                </label>
              ) : undefined
            }
          />
        )}
      </Modal>

      {/* مودال استيراد الأسئلة السريع */}
      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="الاستيراد السريع للأسئلة (JSON / TXT / Word docx)"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-navy-700 bg-navy-950/60 p-3 text-xs text-slate-300 space-y-1">
            <p className="font-bold text-gold-400">الصيغ المدعومة:</p>
            <p>• <b>ملف JSON:</b> يدعم مصفوفة الأسئلة المباشرة أو ملفات الفيكستشر (مثل fixture-draft_3prep_unit2_mcq.json).</p>
            <p>• <b>ملف TXT أو نص ملصوق:</b> ترقيم الأسئلة (1. س:)، الاختيارات (أ، ب، ج، د)، والإجابة (ج: أو الإجابة:).</p>
            <p>• <b>مستند Word (.docx):</b> استخراج مباشر للنص والأسئلة كمسودة تحتاج مراجعة المعلم.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-2 text-xs font-bold text-gold-400 hover:bg-gold-500/20">
              <UploadCloud className="h-4 w-4" />
              <span>اختر ملف من جهازك (JSON, TXT, DOCX)</span>
              <input
                type="file"
                accept=".json,.txt,.docx"
                className="hidden"
                onChange={(e) => void handleImportFile(e)}
              />
            </label>
            {importProcessing && <Spinner className="h-4 w-4 text-gold-400" />}
          </div>

          <div>
            <label className="block mb-1.5 text-xs font-bold text-slate-300">أو الصق النص هنا مباشرة:</label>
            <textarea
              rows={5}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="الصق نص الأسئلة أو كود JSON هنا..."
              className="w-full rounded-xl border border-navy-700 bg-navy-900 p-3 text-xs text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none"
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="secondary" onClick={handleParsePastedText} disabled={!importText.trim()}>
                تحليل النص الملصوق
              </Button>
            </div>
          </div>

          {importWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 space-y-1">
              <p className="font-bold">تنبيهات الاستيراد:</p>
              {importWarnings.map((w, idx) => (
                <p key={idx}>• {w}</p>
              ))}
            </div>
          )}

          {importPreviewQuestions.length > 0 && (
            <div className="space-y-2 border-t border-navy-800 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">
                  تم استخراج {importPreviewQuestions.length} سؤالاً (معاينة مسودة):
                </span>
                <Badge variant="gold">مسودة تحتاج مراجعة</Badge>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 rounded-xl border border-navy-800 bg-navy-950/40 p-2">
                {importPreviewQuestions.map((q, idx) => (
                  <div key={idx} className="rounded-lg border border-navy-800/80 bg-navy-900/60 p-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{idx + 1}. {q.text}</span>
                      <Badge variant="neutral">{q.type === 'choose' ? 'اختيار' : q.type === 'tf' ? 'صح/خطأ' : 'مقالي'}</Badge>
                    </div>
                    {q.options && (
                      <div className="text-[11px] text-slate-400 grid grid-cols-2 gap-1 pt-1">
                        {Object.entries(q.options).map(([k, val]) => (
                          <span key={k} className={q.answer === k ? 'text-gold-400 font-bold' : ''}>
                            {k}) {val}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setImportModalOpen(false)}>
                  إلغاء
                </Button>
                <Button variant="primary" size="sm" onClick={handleConfirmImport}>
                  تأكيد واستيراد {importPreviewQuestions.length} سؤال للمسودة
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

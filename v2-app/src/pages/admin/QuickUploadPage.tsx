import { cairoInputToUtcMs, formatCairoDateTime, tzOffsetMs, cairoToUtcMs } from '../../lib/cairoTime';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Plus, ArrowUp, ArrowDown, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, FileText, PlayCircle, Trash2, UploadCloud, Calendar, Sparkles, PlusCircle, Split, Layers, Bell } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, Spinner, useToast } from '../../components/ui';
import { useCourses } from '../../hooks/useCourses';
import {
  parseQuestionsFromDocx,
  parseQuestionsFromJson,
  parseQuestionsFromPdf,
  parseQuestionsFromTxt,
  parseExamText,
  parseExamFromDocx,
  parsedExamToQuestionDrafts,
  splitQuestionAt,
  mergeWithPreviousQuestion,
  deleteQuestion,
  changeQuestionType,
  setQuestionCorrectAnswer,
  getCairoNextSchedule,
  formatCairoScheduleSummary,
} from '../../lib/questionImport';
import { sendBroadcastNotification } from '../../services/notifications';
import { newQuestionId, createEmptyDraft, isEssayType } from '../../lib/questionDraft';
import type { QuestionType } from '../../lib/grading';
import type { ParsedExam, ImportResult } from '../../lib/questionImport';
import type { QuestionDraft } from '../../lib/questionDraft';
import { QUESTION_TYPE_LABELS } from '../../lib/questionDraft';
import type { AssessmentKind } from '../../lib/grading';
import { KIND_LABELS } from '../../lib/grading';
import { getCourse } from '../../services/courses';
import type { NormalizedLecture } from '../../services/courses';
import { createAssessment, listAssessmentItems, loadAssessmentForEdit, updateAssessment } from '../../services/assessmentAdmin';
import { addFilesToLecture, addLectures, isHttpUrl, normalizeDriveUrl } from '../../services/contentWriter';
import type { LectureDraft } from '../../services/contentWriter';

type TabKey = 'lectures' | 'files' | 'assessments';

const FIELD =
  'w-full rounded-xl border border-navy-700 bg-navy-950 p-3 text-sm text-white placeholder-slate-500 focus:border-gold-400 focus:outline-none';

const FILE_HINT = /\.(pdf|docx?|pptx?|xlsx?)(\?|$)|drive\.google\.com|docs\.google\.com|dropbox\.com|onedrive|1drv\.ms/i;

function toLatinDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

// سطر لكل محاضرة: العنوان | رابط الفيديو | رابط PDF أو Drive | رابط ملف آخر ...
export function parseLectureLines(raw: string): LectureDraft[] {
  const drafts: LectureDraft[] = [];
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.includes('|')
        ? line.split('|').map((part) => part.trim()).filter(Boolean)
        : line.replace(/\s+-\s+(https?:\/\/)/g, '|$1').split('|').map((part) => part.trim()).filter(Boolean);

      let title = '';
      let video = '';
      const files: { title: string; url: string }[] = [];

      parts.forEach((part) => {
        if (isHttpUrl(part)) {
          if (FILE_HINT.test(part) && !/youtu/i.test(part)) {
            files.push({ title: `ملف ${files.length + 1}`, url: part });
          } else if (!video) {
            video = part;
          } else {
            files.push({ title: `ملف ${files.length + 1}`, url: part });
          }
        } else if (!title) {
          title = toLatinDigits(part).replace(/^\d+\s*[.\-:)]\s*/, '').trim();
        }
      });

      if (files.length === 1) files[0].title = 'مذكرة المحاضرة (PDF)';
      drafts.push({ title, videoUrl: video, files });
    });
  return drafts;
}

function parseFileLines(raw: string): { title: string; url: string }[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split('|').map((part) => part.trim());
      const url = parts.find((part) => isHttpUrl(part)) || '';
      const title = parts.find((part) => !isHttpUrl(part)) || `ملف ${index + 1}`;
      return { title, url };
    });
}

export default function QuickUploadPage() {
  const { courses, loading: loadingCourses } = useCourses();
  const { showToast } = useToast();

  const [courseId, setCourseId] = useState('');
  const [tab, setTab] = useState<TabKey>('lectures');
  const [lectures, setLectures] = useState<NormalizedLecture[]>([]);
  const [existing, setExisting] = useState<{ id: string; title: string; kind: AssessmentKind }[]>([]);
  const [loadingCourse, setLoadingCourse] = useState(false);

  // محاضرات
  const [lectureText, setLectureText] = useState('');
  const [lectureMode, setLectureMode] = useState<'append' | 'replace'>('append');
  const [savingLectures, setSavingLectures] = useState(false);
  const [lectureOpenAt, setLectureOpenAt] = useState('');
  const [lectureCloseAt, setLectureCloseAt] = useState('');
  const [useMultiWeekLectures, setUseMultiWeekLectures] = useState(false);
  const [lectureStartDateTime, setLectureStartDateTime] = useState('');
  const lectureDrafts = useMemo(() => parseLectureLines(lectureText), [lectureText]);

  // ملفات
  const [fileLectureId, setFileLectureId] = useState('');
  const [fileText, setFileText] = useState('');
  const [savingFiles, setSavingFiles] = useState(false);
  const [fileOpenAt, setFileOpenAt] = useState('');
  const [fileCloseAt, setFileCloseAt] = useState('');
  const fileDrafts = useMemo(() => parseFileLines(fileText), [fileText]);

  // تقييمات
  const [kind, setKind] = useState<AssessmentKind>('training');
  const [attachLectureId, setAttachLectureId] = useState('');
  const [target, setTarget] = useState<'new' | 'existing'>('new');
  const [existingId, setExistingId] = useState('');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('0');
  const [strict, setStrict] = useState(false);
  const [rawText, setRawText] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [parsedExam, setParsedExam] = useState<ParsedExam | null>(null);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [savingQuestions, setSavingQuestions] = useState(false);

  // التوقيت والقواعد الأسبوعية (Part 4)
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [passingScore, setPassingScore] = useState(50);
  const [requirePassingToUnlock, setRequirePassingToUnlock] = useState(true);
  const [notifyStudents, setNotifyStudents] = useState(false);

  // وضع الإضافة اليدوية سؤال بسؤال (Part 3)
  const [assessmentMode, setAssessmentMode] = useState<'import' | 'manual'>('import');
  const [manualType, setManualType] = useState<QuestionType>('choose');
  const [manualText, setManualText] = useState('');
  const [manualPoints, setManualPoints] = useState(1);
  const [manualOptionKeys, setManualOptionKeys] = useState<string[]>(['a', 'b', 'c', 'd']);
  const [manualOptions, setManualOptions] = useState<Record<string, string>>({ a: '', b: '', c: '', d: '' });
  const [manualAnswer, setManualAnswer] = useState('a');
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // حساب الأعداد حسب النوع لشاشة المراجعة التفاعلية (Part 2d)
  const typeCounts = useMemo(() => {
    let choose = 0;
    let tf = 0;
    let fill = 0;
    let essay = 0;
    questions.forEach((q) => {
      if (q.type === 'choose') choose++;
      else if (q.type === 'tf') tf++;
      else if (q.type === 'fill' || q.type === 'short') fill++;
      else essay++;
    });
    return { choose, tf, fill, essay };
  }, [questions]);

  // حماية الفشل الصامت
  const hasSilentFailure = useMemo(() => {
    return (
      (rawText.trim().length > 300 && questions.length <= 1) ||
      (parsedExam?.warnings.some((w) => w.includes('تنبيه: يبدو أن تنسيق الملف منع التقسيم التلقائي')) ?? false)
    );
  }, [rawText, questions.length, parsedExam]);

  const applyWeeklySchedule = (offset = weekOffset) => {
    const baseDate = new Date();
    if (offset > 0) {
      baseDate.setDate(baseDate.getDate() + offset * 7);
    }
    const s = getCairoNextSchedule(kind, baseDate);
    setAvailableFrom(s.availableFrom);
    setAvailableUntil(s.availableUntil);
    showToast(`تم تطبيق جدول الأسبوع ${offset > 0 ? `(${offset + 1})` : ''}: ${s.summary}`, 'success');
  };

  const addManualQuestion = () => {
    if (!manualText.trim()) {
      showToast('اكتب نص السؤال أولاً', 'error');
      return;
    }
    const newDraft: QuestionDraft = {
      id: newQuestionId(),
      type: manualType,
      text: manualText.trim(),
      points: Number(manualPoints) || 1,
      options: manualType === 'choose' ? { ...manualOptions } : null,
      answer: manualAnswer,
      altAnswers: [],
      rubric: [],
      needsReview: !manualAnswer,
    };
    setQuestions((prev) => [...prev, newDraft]);
    setManualText('');
    setManualAnswer(manualType === 'tf' ? 'صح' : 'a');
    showToast('تمت إضافة السؤال للقائمة', 'success');
  };

  const missingCount = useMemo(() => {
    return questions.filter((q) => q.needsReview || !q.answer).length;
  }, [questions]);

  const reloadCourse = useCallback(async (id: string) => {
    if (!id) {
      setLectures([]);
      setExisting([]);
      return;
    }
    setLoadingCourse(true);
    try {
      const course = await getCourse(id);
      if (!course) throw new Error('الكورس غير موجود');
      setLectures(course.content.lectures);
      setExisting(
        listAssessmentItems(course.sections)
          .filter((ref) => ref.item.assessmentKind !== null)
          .map((ref) => ({ id: ref.item.id, title: ref.item.title, kind: ref.item.assessmentKind as AssessmentKind })),
      );
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'تعذر تحميل الكورس', 'error');
    } finally {
      setLoadingCourse(false);
    }
  }, [showToast]);

  useEffect(() => {
    void reloadCourse(courseId);
  }, [courseId, reloadCourse]);

  const saveLectures = async () => {
    if (!courseId || lectureDrafts.length === 0) return;
    if (lectureMode === 'replace' && !window.confirm('هيتم استبدال كل المحاضرات الحالية. متأكد؟')) return;
    setSavingLectures(true);
    try {
      const baseMs = lectureStartDateTime
        ? (cairoInputToUtcMs(lectureStartDateTime) ?? Date.now())
        : (cairoInputToUtcMs(lectureOpenAt) ?? Date.now());
      const closeBaseMs = lectureCloseAt ? cairoInputToUtcMs(lectureCloseAt) : null;

      const processedDrafts = lectureDrafts.map((d, idx) => {
        let openAt: number | null = null;
        let closeAt: number | null = null;
        if (useMultiWeekLectures) {
          openAt = baseMs + idx * 7 * 24 * 60 * 60 * 1000;
          if (closeBaseMs) closeAt = closeBaseMs + idx * 7 * 24 * 60 * 60 * 1000;
        } else {
          openAt = cairoInputToUtcMs(lectureOpenAt);
          closeAt = cairoInputToUtcMs(lectureCloseAt);
        }
        return { ...d, openAt, closeAt };
      });

      const count = await addLectures(courseId, processedDrafts, lectureMode);
      showToast(`تم حفظ ${count} محاضرة`, 'success');
      setLectureText('');
      await reloadCourse(courseId);
    } catch (err: unknown) {
      showToast(`تعذر الحفظ: ${err instanceof Error ? err.message : 'خطأ'}`, 'error');
    } finally {
      setSavingLectures(false);
    }
  };

  const saveFiles = async () => {
    if (!courseId || !fileLectureId) return;
    setSavingFiles(true);
    try {
      const fOpen = cairoInputToUtcMs(fileOpenAt);
      const fClose = cairoInputToUtcMs(fileCloseAt);
      const processedFiles = fileDrafts.map((f) => ({ ...f, openAt: fOpen, closeAt: fClose }));
      const count = await addFilesToLecture(courseId, fileLectureId, processedFiles);
      showToast(`تمت إضافة ${count} ملف للمحاضرة`, 'success');
      setFileText('');
      await reloadCourse(courseId);
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message === 'no-valid-file' ? 'ما فيش رابط صالح (لازم يبدأ بـ https)' : 'تعذر الحفظ';
      showToast(msg, 'error');
    } finally {
      setSavingFiles(false);
    }
  };

  const onQuestionsFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const name = file.name.toLowerCase();
      let result: ImportResult;
      if (name.endsWith('.docx')) {
        const parsed = await parseExamFromDocx(file);
        setParsedExam(parsed);
        if (!title.trim() && parsed.title) setTitle(parsed.title);
        result = {
          questions: parsedExamToQuestionDrafts(parsed),
          warnings: parsed.warnings,
          errors: parsed.errors,
          parsedExam: parsed,
        };
      } else if (name.endsWith('.json')) {
        result = parseQuestionsFromJson(await file.text());
        if (result.parsedExam) {
          setParsedExam(result.parsedExam);
          if (!title.trim() && result.parsedExam.title) setTitle(result.parsedExam.title);
        }
      } else if (name.endsWith('.pdf')) {
        result = await parseQuestionsFromPdf(file);
        if (result.parsedExam) {
          setParsedExam(result.parsedExam);
          if (!title.trim() && result.parsedExam.title) setTitle(result.parsedExam.title);
        }
      } else {
        const raw = await file.text();
        const parsed = parseExamText(raw);
        if (parsed.sections.length > 0) {
          setParsedExam(parsed);
          if (!title.trim() && parsed.title) setTitle(parsed.title);
          result = {
            questions: parsedExamToQuestionDrafts(parsed),
            warnings: parsed.warnings,
            errors: parsed.errors,
            parsedExam: parsed,
          };
        } else {
          result = parseQuestionsFromTxt(raw);
        }
      }
      setQuestions(result.questions);
      showToast(`تم استخراج ${result.questions.length} سؤال`, result.questions.length > 0 ? 'success' : 'error');
    } catch (err: unknown) {
      showToast(`تعذر قراءة الملف: ${err instanceof Error ? err.message : ''}`, 'error');
    }
    event.target.value = '';
  };

  const onTextareaChange = (val: string) => {
    setRawText(val);
    const parsed = parseExamText(val);
    if (parsed.sections.length > 0) {
      setParsedExam(parsed);
      if (!title.trim() && parsed.title) setTitle(parsed.title);
      setQuestions(parsedExamToQuestionDrafts(parsed));
    } else {
      setParsedExam(null);
      setQuestions(parseQuestionsFromTxt(val).questions);
    }
  };

  const saveQuestions = async (publish: boolean = false) => {
    if (!courseId || questions.length === 0) return;
    if (publish && missingCount > 0) {
      showToast(`لا يمكن النشر للطلاب لوجود ${missingCount} سؤال ناقص إجابة. يمكنك الحفظ كمسودة مخفية.`, 'error');
      return;
    }

    setSavingQuestions(true);
    try {
      if (target === 'new') {
        if (!title.trim()) throw new Error('اكتب عنوان التقييم.');
        if (kind === 'training' && !attachLectureId) throw new Error('التدريب لازم يتربط بمحاضرة');
        const course = await getCourse(courseId);
        const section = course?.sections[0];
        await createAssessment(
          courseId,
          section ? section.id : 'sec_lectures',
          {
            title: title.trim(),
            kind,
            duration: parseInt(duration, 10) || 0,
            strictMode: strict,
            availableFrom,
            availableUntil,
            passingScore: Number(passingScore) || 50,
            requirePassingToUnlock,
            lockedUntilTrainingId: '',
            deadlineDate: '',
          },
          questions,
          kind === 'exam' ? '' : attachLectureId,
        );

        if (notifyStudents) {
          try {
            await sendBroadcastNotification({
              title: 'تحديث في المنهج',
              message: `تمت إضافة ${KIND_LABELS[kind]} جديد: «${title.trim()}»`,
              category: 'curriculumUpdates',
              targetType: 'course',
              targetValue: courseId,
              courseId,
              lectureId: attachLectureId || undefined,
              openAt: availableFrom ? cairoInputToUtcMs(availableFrom) : null,
              sentBy: 'admin',
            });
          } catch {
            // notification error ignored
          }
        }
        showToast(
          publish
            ? `تم إنشاء ونشر «${title.trim()}» بـ ${questions.length} سؤال`
            : `تم حفظ «${title.trim()}» كمسودة مخفية بـ ${questions.length} سؤال (${missingCount} ناقص إجابة)`,
          'success',
        );
        setTitle('');
      } else {
        if (!existingId) throw new Error('اختر التقييم');
        const loaded = await loadAssessmentForEdit(courseId, existingId);
        if (!loaded) throw new Error('تعذر تحميل التقييم');
        await updateAssessment(courseId, existingId, loaded.meta, [...loaded.questions, ...questions]);
        showToast(`تمت إضافة ${questions.length} سؤال إلى «${loaded.meta.title}»`, 'success');
      }
      setQuestions([]);
      setParsedExam(null);
      setRawText('');
      await reloadCourse(courseId);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'تعذر الحفظ', 'error');
    } finally {
      setSavingQuestions(false);
    }
  };

  const moveQuestionInDraft = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    setQuestions((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  const updateQuestionInDraft = (idx: number, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      if (patch.answer && next[idx].answer) {
        next[idx].needsReview = false;
      }
      return next;
    });
  };

  const tabs: { key: TabKey; label: string; icon: typeof PlayCircle }[] = [
    { key: 'lectures', label: 'محاضرات (فيديو + ملفات)', icon: PlayCircle },
    { key: 'files', label: 'ملفات PDF / Drive', icon: FileText },
    { key: 'assessments', label: 'تدريب / واجب / امتحان', icon: ClipboardList },
  ];

  const lectureSelect = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
      <option value="">{placeholder}</option>
      {lectures.map((lec) => (
        <option key={lec.id} value={lec.id}>
          {lec.order}. {lec.title}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">الرفع السريع للمحتوى</h1>
          <p className="text-xs text-slate-400">
            أضف محاضرات، ملفات، أو امتحانات كاملة من ملفات Word أو نصية دفعة واحدة.
          </p>
        </div>
        {courseId && (
          <Link to={`/admin/courses/${courseId}`} className="text-xs font-bold text-gold-400 hover:text-gold-300">
            فتح محرر الكورس ←
          </Link>
        )}
      </div>

      <Card className="p-4">
        <label className="mb-1 block text-xs font-bold text-slate-300">اختر الكورس المستهدف</label>
        {loadingCourses ? (
          <Spinner size="sm" />
        ) : (
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={FIELD}>
            <option value="">— اختر كورس —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.grade ? c.grade : 'عام'})
              </option>
            ))}
          </select>
        )}
      </Card>

      {courseId && (
        <>
          <div className="flex border-b border-navy-800">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
                    active ? 'border-gold-400 text-gold-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === 'lectures' && (
            <Card className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">
                  الصق قائمة المحاضرات (سطر لكل محاضرة: العنوان | رابط الفيديو | رابط PDF)
                </label>
                <textarea
                  value={lectureText}
                  onChange={(e) => setLectureText(e.target.value)}
                  rows={8}
                  placeholder={`1. الدرس الأول: الموقع والمساحة | https://youtube.com/watch?v=... | https://drive.google.com/...\n2. الدرس الثاني: تضاريس مصر | https://youtube.com/watch?v=...`}
                  className={`${FIELD} text-xs`}
                />
              </div>

              <div className="space-y-3 rounded-xl border border-navy-800 bg-navy-950/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gold-400">مواعيد الفتح والإغلاق بتوقيت القاهرة</span>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useMultiWeekLectures}
                      onChange={(e) => setUseMultiWeekLectures(e.target.checked)}
                      className="h-4 w-4 rounded border-navy-600 bg-navy-900 accent-gold-500"
                    />
                    <span>توزيع المحاضرات أسبوعيًا بالتتالي (كل خميس 9:00 م)</span>
                  </label>
                </div>

                {useMultiWeekLectures ? (
                  <div className="space-y-2">
                    <Input
                      label="تاريخ بداية أول محاضرة (الخميس 9:00 م بتوقيت القاهرة)"
                      type="datetime-local"
                      dir="ltr"
                      value={lectureStartDateTime}
                      onChange={(e) => setLectureStartDateTime(e.target.value)}
                    />
                    <p className="text-[11px] text-slate-400">
                      سيتم فتح المحاضرة الأولى في هذا الموعد، والمحاضرة الثانية بعد 7 أيام، والثالثة بعد 14 يومًا تلقائيًا.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="موعد فتح المحاضرات (openAt)"
                      type="datetime-local"
                      dir="ltr"
                      value={lectureOpenAt}
                      onChange={(e) => setLectureOpenAt(e.target.value)}
                    />
                    <Input
                      label="موعد إغلاق اختياري (closeAt)"
                      type="datetime-local"
                      dir="ltr"
                      value={lectureCloseAt}
                      onChange={(e) => setLectureCloseAt(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-slate-300">
                    <input
                      type="radio"
                      name="lecMode"
                      checked={lectureMode === 'append'}
                      onChange={() => setLectureMode('append')}
                    />
                    إضافة للمحاضرات الحالية ({lectures.length})
                  </label>
                  <label className="flex items-center gap-1.5 text-rose-300">
                    <input
                      type="radio"
                      name="lecMode"
                      checked={lectureMode === 'replace'}
                      onChange={() => setLectureMode('replace')}
                    />
                    استبدال الكل
                  </label>
                </div>
                <Button onClick={saveLectures} loading={savingLectures} disabled={lectureDrafts.length === 0}>
                  حفظ {lectureDrafts.length || ''} محاضرة
                </Button>
              </div>

              {lectureDrafts.length > 0 && (
                <div className="space-y-1.5 rounded-xl border border-navy-800 bg-navy-950/60 p-3 text-xs">
                  <div className="font-bold text-slate-300">معاينة ({lectureDrafts.length} محاضرة)</div>
                  {lectureDrafts.map((lec, i) => (
                    <div key={i} className="flex items-center justify-between text-slate-300">
                      <span>
                        {i + 1}. {lec.title || '(بدون عنوان)'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {lec.videoUrl ? 'فيديو ✓' : 'بدون فيديو'} • {lec.files.length} ملف
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === 'files' && (
            <Card className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">اختر المحاضرة لإضافة الملفات إليها</label>
                {lectureSelect(fileLectureId, setFileLectureId, '— اختر المحاضرة —')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">
                  الصق روابط الملفات (سطر لكل ملف: العنوان | الرابط)
                </label>
                <textarea
                  value={fileText}
                  onChange={(e) => setFileText(e.target.value)}
                  rows={6}
                  placeholder={`مذكرة الشرح | https://drive.google.com/file/d/.../view\nواجب الأسبوع | https://drive.google.com/...`}
                  className={`${FIELD} text-xs`}
                />
              </div>

              <div className="space-y-3 rounded-xl border border-navy-800 bg-navy-950/70 p-3">
                <span className="text-xs font-bold text-gold-400">مواعيد إتاحة الملفات بتوقيت القاهرة</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="موعد فتح الملفات (openAt)"
                    type="datetime-local"
                    dir="ltr"
                    value={fileOpenAt}
                    onChange={(e) => setFileOpenAt(e.target.value)}
                  />
                  <Input
                    label="موعد إغلاق اختياري (closeAt)"
                    type="datetime-local"
                    dir="ltr"
                    value={fileCloseAt}
                    onChange={(e) => setFileCloseAt(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={saveFiles} loading={savingFiles} disabled={!fileLectureId || fileDrafts.every((f) => !f.url)}>
                إضافة الملفات
              </Button>
              {fileDrafts.some((f) => f.url) && (
                <div className="text-[11px] text-slate-500" dir="ltr">
                  {fileDrafts.filter((f) => f.url).map((f) => normalizeDriveUrl(f.url)).join('  •  ')}
                </div>
              )}
            </Card>
          )}

          {tab === 'assessments' && (
            <Card className="space-y-4 p-4">
              <div className="flex flex-wrap gap-2 text-xs">
                {(['training', 'homework', 'exam'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`rounded-lg px-3 py-1.5 font-bold ${kind === k ? 'bg-gold-400 text-navy-950' : 'bg-navy-900 text-slate-300'}`}
                  >
                    {KIND_LABELS[k]}
                  </button>
                ))}
                <span className="mx-1 text-slate-600">|</span>
                {(['new', 'existing'] as const).map((tg) => (
                  <button
                    key={tg}
                    type="button"
                    onClick={() => setTarget(tg)}
                    className={`rounded-lg px-3 py-1.5 font-bold ${target === tg ? 'bg-navy-700 text-white' : 'bg-navy-900 text-slate-400'}`}
                  >
                    {tg === 'new' ? 'عنصر جديد' : 'إضافة أسئلة لعنصر موجود'}
                  </button>
                ))}
              </div>

              {target === 'new' ? (
                <div className="space-y-3">
                  <Input label="العنوان" value={title} onChange={(e) => setTitle(e.target.value)} />
                  {kind !== 'exam' && (
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-300">
                        {kind === 'training' ? 'اربط التدريب بمحاضرة (إجباري)' : 'اربط الواجب بمحاضرة (اختياري، وبيقفل المحاضرة التالية لحد ما يتسلم)'}
                      </label>
                      {lectureSelect(attachLectureId, setAttachLectureId, kind === 'training' ? '— اختر المحاضرة —' : '— بدون ربط —')}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input label="المدة بالدقائق (0 = مفتوح)" type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} />
                    <Input
                      label="نسبة النجاح لفتح ما بعده (%)"
                      type="number"
                      min={0}
                      max={100}
                      value={String(passingScore)}
                      hint="افتراضي 50%"
                      onChange={(e) => setPassingScore(Number(e.target.value) || 0)}
                    />
                    <div className="flex flex-col justify-end gap-2 pb-2">
                      <label className="flex items-center gap-2 text-xs text-slate-200">
                        <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} /> وضع صارم لمنع الخروج
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-200">
                        <input type="checkbox" checked={requirePassingToUnlock} onChange={(e) => setRequirePassingToUnlock(e.target.checked)} /> اجتيازه متطلب لفتح التالي
                      </label>
                    </div>
                  </div>

                  {/* التوقيتات وجدول الأسبوع الذكي بتوقيت القاهرة */}
                  <div className="space-y-2 rounded-xl border border-navy-800 bg-navy-950/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gold-400">مواعيد الفتح والإغلاق (بتوقيت القاهرة)</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={weekOffset}
                          onChange={(e) => {
                            const offset = Number(e.target.value) || 0;
                            setWeekOffset(offset);
                            applyWeeklySchedule(offset);
                          }}
                          className="rounded-lg border border-navy-700 bg-navy-900 px-2 py-1 text-xs text-white"
                        >
                          <option value={0}>الأسبوع الحالي</option>
                          <option value={1}>الأسبوع القادم (+7 أيام)</option>
                          <option value={2}>الأسبوع الثالث (+14 يوم)</option>
                          <option value={3}>الأسبوع الرابع (+21 يوم)</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => applyWeeklySchedule(weekOffset)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500/20 px-3 py-1 text-xs font-bold text-gold-300 hover:bg-gold-500/30"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-gold-400" />
                          <span>طبّق جدول الأسبوع</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="موعد الفتح (availableFrom)"
                        type="datetime-local"
                        dir="ltr"
                        value={availableFrom}
                        onChange={(e) => setAvailableFrom(e.target.value)}
                      />
                      <Input
                        label="موعد الإغلاق (availableUntil)"
                        type="datetime-local"
                        dir="ltr"
                        value={availableUntil}
                        onChange={(e) => setAvailableUntil(e.target.value)}
                      />
                    </div>

                    {/* ملخص القواعد قبل الحفظ */}
                    <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 text-xs text-sky-200">
                      <div className="font-bold text-sky-300 mb-0.5">ملخص القواعد والمواعيد:</div>
                      <p>{formatCairoScheduleSummary(kind, availableFrom, availableUntil, passingScore)}</p>
                    </div>

                    <label className="flex items-center gap-2 pt-1 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={notifyStudents}
                        onChange={(e) => setNotifyStudents(e.target.checked)}
                        className="h-4 w-4 rounded border-navy-600 bg-navy-900 accent-gold-500"
                      />
                      <Bell className="h-3.5 w-3.5 text-gold-400" />
                      <span>أشعر الطلاب المشتركين بهذا التقييم الجديد فور الحفظ</span>
                    </label>
                  </div>
                </div>
              ) : (
                <select value={existingId} onChange={(e) => setExistingId(e.target.value)} className={FIELD}>
                  <option value="">— اختر التقييم —</option>
                  {existing.map((item) => (
                    <option key={item.id} value={item.id}>
                      [{KIND_LABELS[item.kind]}] {item.title}
                    </option>
                  ))}
                </select>
              )}

              {/* أزرار اختيار طريقة الإضافة */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-800 pb-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAssessmentMode('import')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                      assessmentMode === 'import' ? 'bg-gold-400 text-navy-950' : 'bg-navy-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    رفع أو لصق ملف
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssessmentMode('manual')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                      assessmentMode === 'manual' ? 'bg-gold-400 text-navy-950' : 'bg-navy-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    إضافة تدريب/واجب/امتحان يدويًا (سؤال بسؤال)
                  </button>
                </div>
              </div>

              {assessmentMode === 'manual' ? (
                <div className="space-y-3 rounded-xl border border-navy-800 bg-navy-950/60 p-4">
                  <div className="font-bold text-sm text-gold-400">نموذج إنشاء سؤال جديد يدويًا:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-300">نوع السؤال</label>
                      <select
                        value={manualType}
                        onChange={(e) => setManualType(e.target.value as QuestionType)}
                        className={FIELD}
                      >
                        <option value="choose">اختيار من متعدد</option>
                        <option value="tf">صح أو خطأ</option>
                        <option value="fill">أكمل الفراغ</option>
                        <option value="short">إجابة قصيرة</option>
                        <option value="explain">اشرح / بم تفسر</option>
                        <option value="result">ما النتائج المترتبة</option>
                        <option value="prove">دلل / أثبت</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-300">الدرجة</label>
                      <input
                        type="number"
                        min={1}
                        value={manualPoints}
                        onChange={(e) => setManualPoints(Number(e.target.value) || 1)}
                        className={FIELD}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-300">نص السؤال</label>
                    <textarea
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      rows={3}
                      placeholder="اكتب نص السؤال هنا..."
                      className={`${FIELD} text-xs`}
                    />
                  </div>

                  {manualType === 'choose' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">
                          الخيارات ({manualOptionKeys.length} خيارات — اختر الإجابة بالدائرة):
                        </span>
                        <div className="flex items-center gap-2">
                          {manualOptionKeys.length < 6 && (
                            <button
                              type="button"
                              onClick={() => {
                                const allKeys = ['a', 'b', 'c', 'd', 'e', 'f'];
                                const nextKey = allKeys[manualOptionKeys.length];
                                if (nextKey) setManualOptionKeys([...manualOptionKeys, nextKey]);
                              }}
                              className="rounded-lg bg-navy-800 px-2.5 py-1 text-xs font-bold text-gold-400 hover:bg-navy-700"
                            >
                              + إضافة خيار
                            </button>
                          )}
                          {manualOptionKeys.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const removed = manualOptionKeys[manualOptionKeys.length - 1];
                                setManualOptionKeys(manualOptionKeys.slice(0, -1));
                                if (manualAnswer === removed) setManualAnswer('a');
                              }}
                              className="rounded-lg bg-navy-800 px-2.5 py-1 text-xs font-bold text-rose-400 hover:bg-navy-700"
                            >
                              - حذف خيار
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {manualOptionKeys.map((k) => (
                          <div key={k} className="flex items-center gap-2 rounded-lg border border-navy-800 bg-navy-950 p-2">
                            <input
                              type="radio"
                              name="manual_opt_ans"
                              checked={manualAnswer === k}
                              onChange={() => setManualAnswer(k)}
                            />
                            <span className="font-bold text-gold-400 uppercase">{k})</span>
                            <input
                              type="text"
                              placeholder={`الخيار ${k}`}
                              value={manualOptions[k] ?? ''}
                              onChange={(e) => setManualOptions({ ...manualOptions, [k]: e.target.value })}
                              className="flex-1 bg-transparent text-xs text-white focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {manualType === 'tf' && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400">الإجابة الصحيحة:</span>
                      <button
                        type="button"
                        onClick={() => setManualAnswer('صح')}
                        className={`rounded-lg px-4 py-1.5 text-xs font-bold ${
                          manualAnswer === 'صح' ? 'bg-emerald-500 text-white' : 'bg-navy-800 text-slate-300'
                        }`}
                      >
                        صح
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualAnswer('خطأ')}
                        className={`rounded-lg px-4 py-1.5 text-xs font-bold ${
                          manualAnswer === 'خطأ' ? 'bg-rose-500 text-white' : 'bg-navy-800 text-slate-300'
                        }`}
                      >
                        خطأ
                      </button>
                    </div>
                  )}

                  {manualType !== 'choose' && manualType !== 'tf' && (
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-300">الإجابة النموذجية المعتمدة</label>
                      <input
                        type="text"
                        placeholder="اكتب الإجابة النموذجية..."
                        value={manualAnswer}
                        onChange={(e) => setManualAnswer(e.target.value)}
                        className={FIELD}
                      />
                    </div>
                  )}

                  <Button type="button" onClick={addManualQuestion} size="sm">
                    <Plus className="h-4 w-4" />
                    إضافة السؤال إلى التقييم
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-300">الأسئلة: الصقها هنا أو ارفع ملف TXT / Word / JSON</label>
                    <textarea
                      value={rawText}
                      onChange={(e) => onTextareaChange(e.target.value)}
                      rows={7}
                      placeholder="الصق نص الامتحان أو اختر ملفًا من الأسفل..."
                      className={`${FIELD} text-xs`}
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".txt,.docx,.json,.pdf"
                  onChange={onQuestionsFile}
                  className="text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-gold-400 hover:file:bg-navy-700"
                />
              </div>

              {/* حماية الفشل الصامت (Silent Failure Protection) */}
              {hasSilentFailure && (
                <div className="space-y-2 rounded-xl border border-rose-500/50 bg-rose-500/15 p-4 text-xs text-rose-200">
                  <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
                    <span>تنبيه: يبدو أن تنسيق الملف منع التقسيم التلقائي. هل تريد المحاولة بمحلل بديل أو المراجعة اليدوية؟</span>
                  </div>
                  <p className="text-slate-300">
                    تم رصد نص يحتوي على أكثر من 300 حرف لكن لم يتم استخراج سوى سؤال واحد أو أقل. يمكنك استخدام أداة التقسيم اليدوي أدناه أو التبديل للبناء اليدوي.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setAssessmentMode('manual')}
                      className="rounded-lg bg-gold-400 px-3 py-1.5 font-bold text-navy-950 hover:bg-gold-300"
                    >
                      التحويل للبناء اليدوي
                    </button>
                  </div>
                </div>
              )}

              {/* عداد ومراجعة الأسئلة التفاعلية (Part 2d) */}
              {questions.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-800 bg-navy-950/80 p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-white">إجمالي الأسئلة: {questions.length}</span>
                    <span className="text-slate-500">•</span>
                    <Badge variant="gold">اختر: {typeCounts.choose}</Badge>
                    <Badge variant="neutral">صح/خطأ: {typeCounts.tf}</Badge>
                    <Badge variant="neutral">إكمال: {typeCounts.fill}</Badge>
                    <Badge variant="neutral">مقالي: {typeCounts.essay}</Badge>
                  </div>
                </div>
              )}

              {/* تقرير التحذيرات والأخطاء البنيوية */}
              {parsedExam && parsedExam.errors.length > 0 && (
                <div className="space-y-1 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>توجد أخطاء بنيوية في الملف:</span>
                  </div>
                  <ul className="list-inside list-disc space-y-0.5 pr-2">
                    {parsedExam.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {parsedExam && parsedExam.warnings.length > 0 && (
                <div className="space-y-1 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>تنبيهات تنسيق:</span>
                  </div>
                  <ul className="list-inside list-disc space-y-0.5 pr-2">
                    {parsedExam.warnings.map((warn, idx) => (
                      <li key={idx}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* جدول الأقسام المستخرجة (معاينة الأقسام) */}
              {parsedExam && parsedExam.sections.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-200">
                    أقسام الامتحان المكتشفة ({parsedExam.sections.length} أقسام — إجمالي {questions.length} سؤال):
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-navy-800 bg-navy-950">
                    <table className="w-full text-right text-xs text-slate-300">
                      <thead className="border-b border-navy-800 bg-navy-900/60 text-[11px] font-bold text-slate-400">
                        <tr>
                          <th className="p-2.5">القسم</th>
                          <th className="p-2.5">النوع</th>
                          <th className="p-2.5 text-center">المعلن</th>
                          <th className="p-2.5 text-center">المستخرج</th>
                          <th className="p-2.5 text-center">ناقص إجابة</th>
                          <th className="p-2.5 text-center">المعاينة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-navy-800/60">
                        {parsedExam.sections.map((sec, sIdx) => {
                          const secMissing = sec.questions.filter((q) => q.needsAnswer).length;
                          const isOpen = expandedSection === sIdx;
                          return (
                            <tr key={sIdx} className="hover:bg-navy-900/40">
                              <td className="p-2.5 font-medium text-white">{sec.header}</td>
                              <td className="p-2.5">
                                <Badge variant="neutral">{sec.type}</Badge>
                              </td>
                              <td className="p-2.5 text-center">{sec.declaredCount}</td>
                              <td className="p-2.5 text-center font-bold text-white">{sec.questions.length}</td>
                              <td className="p-2.5 text-center">
                                {secMissing > 0 ? (
                                  <span className="inline-flex items-center rounded-md bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-300">
                                    {secMissing} ناقص
                                  </span>
                                ) : (
                                  <span className="text-emerald-400 font-bold">مكتمل ✓</span>
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => setExpandedSection(isOpen ? null : sIdx)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-navy-800 px-2.5 py-1 text-[11px] font-bold text-gold-400 hover:bg-navy-700"
                                >
                                  {isOpen ? (
                                    <>
                                      إخفاء <ChevronUp className="h-3 w-3" />
                                    </>
                                  ) : (
                                    <>
                                      تعديل <ChevronDown className="h-3 w-3" />
                                    </>
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* تعديل أسئلة القسم المفتوح */}
                  {expandedSection !== null && parsedExam.sections[expandedSection] && (
                    <div className="space-y-3 rounded-xl border border-gold-500/30 bg-navy-950/80 p-4">
                      <div className="flex items-center justify-between border-b border-navy-800 pb-2">
                        <span className="text-xs font-bold text-gold-400">
                          تعديل أسئلة: {parsedExam.sections[expandedSection].header}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedSection(null)}
                          className="text-xs text-slate-400 hover:text-white"
                        >
                          إغلاق
                        </button>
                      </div>

                      <div className="space-y-4">
                        {parsedExam.sections[expandedSection].questions.map((q, qLocalIdx) => {
                          // تحديد المؤشر العام في مصفوفة questions
                          let globalIdx = 0;
                          for (let i = 0; i < expandedSection; i++) {
                            globalIdx += parsedExam.sections[i].questions.length;
                          }
                          globalIdx += qLocalIdx;

                          const draft = questions[globalIdx];
                          if (!draft) return null;

                          return (
                            <div
                              key={globalIdx}
                              className="space-y-2 rounded-lg border border-navy-800 bg-navy-900/50 p-3 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-400">#{q.number}</span>
                                  <Badge variant="neutral">{draft.type}</Badge>
                                  {(draft.needsReview || !draft.answer) && (
                                    <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                                      ناقص إجابة
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="text-[11px] text-slate-400">الدرجة:</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={draft.points}
                                    onChange={(e) =>
                                      updateQuestionInDraft(globalIdx, { points: Number(e.target.value) || 1 })
                                    }
                                    className="w-14 rounded border border-navy-700 bg-navy-950 px-2 py-0.5 text-center text-xs text-white"
                                  />
                                </div>
                              </div>

                              <div>
                                <textarea
                                  value={draft.text}
                                  onChange={(e) => updateQuestionInDraft(globalIdx, { text: e.target.value })}
                                  rows={2}
                                  className={`${FIELD} text-xs`}
                                />
                              </div>

                              {draft.type === 'choose' && draft.options && (
                                <div className="space-y-1.5 pt-1">
                                  <span className="text-[11px] font-bold text-slate-400">الخيارات والإجابة:</span>
                                  <div className="grid gap-1.5 sm:grid-cols-2">
                                    {Object.entries(draft.options).map(([optKey, optVal]) => (
                                      <div
                                        key={optKey}
                                        className={`flex items-center gap-2 rounded-lg border p-1.5 ${
                                          draft.answer === optKey
                                            ? 'border-emerald-500 bg-emerald-500/10'
                                            : 'border-navy-800 bg-navy-950'
                                        }`}
                                      >
                                        <input
                                          type="radio"
                                          name={`q_${globalIdx}_opt`}
                                          checked={draft.answer === optKey}
                                          onChange={() => updateQuestionInDraft(globalIdx, { answer: optKey })}
                                        />
                                        <span className="font-bold uppercase text-slate-400">{optKey})</span>
                                        <input
                                          type="text"
                                          value={optVal}
                                          onChange={(e) => {
                                            const updated = { ...draft.options, [optKey]: e.target.value };
                                            updateQuestionInDraft(globalIdx, { options: updated });
                                          }}
                                          className="flex-1 bg-transparent text-xs text-white focus:outline-none"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {draft.type === 'tf' && (
                                <div className="flex items-center gap-3 pt-1">
                                  <span className="text-[11px] font-bold text-slate-400">الإجابة:</span>
                                  <button
                                    type="button"
                                    onClick={() => updateQuestionInDraft(globalIdx, { answer: 'صح' })}
                                    className={`rounded-lg px-3 py-1 font-bold ${
                                      draft.answer === 'صح'
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-navy-800 text-slate-300 hover:bg-navy-700'
                                    }`}
                                  >
                                    صح
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateQuestionInDraft(globalIdx, { answer: 'خطأ' })}
                                    className={`rounded-lg px-3 py-1 font-bold ${
                                      draft.answer === 'خطأ'
                                        ? 'bg-rose-500 text-white'
                                        : 'bg-navy-800 text-slate-300 hover:bg-navy-700'
                                    }`}
                                  >
                                    خطأ
                                  </button>
                                </div>
                              )}

                              {draft.type !== 'choose' && draft.type !== 'tf' && (
                                <div className="pt-1">
                                  <label className="text-[11px] font-bold text-slate-400">الإجابة النموذجية:</label>
                                  <input
                                    type="text"
                                    value={draft.answer}
                                    placeholder="اكتب الإجابة النموذجية..."
                                    onChange={(e) => updateQuestionInDraft(globalIdx, { answer: e.target.value })}
                                    className={`${FIELD} mt-1 text-xs`}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* قائمة الأسئلة العادية عند عدم وجود أقسام منسقة */}
              {(!parsedExam || parsedExam.sections.length === 0) && questions.length > 0 && (
                <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-navy-800 bg-navy-950/60 p-3">
                  <div className="text-xs font-bold text-slate-300">معاينة ({questions.length} سؤال)</div>
                  {questions.map((q, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs text-slate-200">
                      <span className="text-slate-500">{index + 1}</span>
                      <Badge variant="neutral">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                      {(q.needsReview || !q.answer) && (
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                          ناقص إجابة
                        </span>
                      )}
                      <span className="flex-1 font-medium">{q.text}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          title="قسّم هذا السؤال عند فاصل"
                          onClick={() => {
                            const splitAt = window.prompt('اكتب الكلمة أو العبارة التي تريد التقسيم عندها (أو اترك فارغًا للتقسيم بالمنتصف):');
                            if (splitAt !== null) {
                              setQuestions(splitQuestionAt(questions, index, splitAt));
                            }
                          }}
                          className="rounded bg-navy-800 px-2 py-0.5 text-[11px] font-bold text-gold-400 hover:bg-navy-700"
                        >
                          قسّم هنا
                        </button>
                        {index > 0 && (
                          <button
                            type="button"
                            title="ادمج هذا السؤال مع السؤال السابق"
                            onClick={() => setQuestions(mergeWithPreviousQuestion(questions, index))}
                            className="rounded bg-navy-800 px-2 py-0.5 text-[11px] font-bold text-sky-400 hover:bg-navy-700"
                          >
                            ادمج مع السابق
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={index === 0}
                          aria-label="تحريك لأعلى"
                          onClick={() => moveQuestionInDraft(index, -1)}
                          className="p-1 hover:bg-navy-800 rounded text-slate-400 hover:text-white disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === questions.length - 1}
                          aria-label="تحريك لأسفل"
                          onClick={() => moveQuestionInDraft(index, 1)}
                          className="p-1 hover:bg-navy-800 rounded text-slate-400 hover:text-white disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="حذف السؤال"
                          onClick={() => setQuestions(deleteQuestion(questions, index))}
                          className="p-1 hover:bg-rose-500/20 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* شريط الإجراءات وأزرار الحفظ والنشر */}
              {questions.length > 0 && (
                <div className="space-y-2 border-t border-navy-800 pt-3">
                  {missingCount > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                        <span>
                          يوجد <strong>{missingCount}</strong> سؤالاً ناقص إجابة. سيتم حفظ الامتحان كمسودة مخفية للطلاب
                          تلقائيًا.
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={() => saveQuestions(false)} loading={savingQuestions}>
                          حفظ كمسودة مخفية ({questions.length} سؤال)
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={true}
                          title={`يوجد ${missingCount} سؤال ناقص إجابة. يجب إكمال الإجابات للنشر للطلاب.`}
                          className="cursor-not-allowed opacity-50"
                        >
                          نشر للطلاب ({missingCount} سؤال ناقص)
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        <span>جميع الأسئلة مكتملة الإجابات وجاهزة للنشر للطلاب فورًا!</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={() => saveQuestions(true)} loading={savingQuestions}>
                          نشر التقييم للطلاب ({questions.length} سؤال)
                        </Button>
                        <Button variant="secondary" onClick={() => saveQuestions(false)} loading={savingQuestions}>
                          حفظ كمسودة
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

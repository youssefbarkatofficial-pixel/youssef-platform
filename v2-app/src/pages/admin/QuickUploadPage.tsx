import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ClipboardList,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  PlayCircle,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Spinner,
  useToast,
} from '../../components/ui';
import { useCourses } from '../../hooks/useCourses';
import type { NormalizedCourseContent, NormalizedLecture } from '../../lib/courseNormalize';
import {
  parseBulkLectureInput,
  proposeLectureOrderingFromFiles,
  parseQuestionsFromJson,
  parseQuestionsFromTxt,
  parseQuestionsFromDocx,
} from '../../lib/questionImport';
import type { ProposedLectureDraft } from '../../lib/questionImport';
import type { QuestionDraft } from '../../lib/questionDraft';
import { QUESTION_TYPE_LABELS } from '../../lib/questionDraft';
import { getCourse, saveCourseContent } from '../../services/courses';
import {
  createAssessment,
  listAssessmentItems,
  loadAssessmentForEdit,
  updateAssessment,
} from '../../services/assessmentAdmin';
import type { AssessmentKind } from '../../lib/grading';
import { KIND_LABELS } from '../../lib/grading';

export default function QuickUploadPage() {
  const { courses, loading: loadingCourses } = useCourses();
  const { showToast } = useToast();

  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'lectures' | 'assessments'>('lectures');

  // ---------- Lectures State ----------
  const [lectureInputMode, setLectureInputMode] = useState<'text' | 'files'>('text');
  const [lectureRawText, setLectureRawText] = useState('');
  const [proposedLectures, setProposedLectures] = useState<ProposedLectureDraft[]>([]);
  const [savingLectures, setSavingLectures] = useState(false);
  const [lectureAppendMode, setLectureAppendMode] = useState<'append' | 'replace'>('append');

  // ---------- Assessments State ----------
  const [targetType, setTargetType] = useState<'new' | 'existing'>('new');
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<AssessmentKind>('exam');
  const [newDuration, setNewDuration] = useState('30');
  const [newStrictMode, setNewStrictMode] = useState(false);

  const [existingItems, setExistingItems] = useState<{ id: string; title: string; kind: AssessmentKind; sectionId: string }[]>([]);
  const [selectedExistingId, setSelectedExistingId] = useState('');
  const [loadingExisting, setLoadingExisting] = useState(false);

  const [importMethod, setImportMethod] = useState<'txt' | 'json' | 'docx'>('txt');
  const [assessmentRawText, setAssessmentRawText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<QuestionDraft[]>([]);
  const [savingQuestions, setSavingQuestions] = useState(false);

  const handleCourseChange = async (courseId: string) => {
    setSelectedCourseId(courseId);
    setProposedLectures([]);
    setParsedQuestions([]);
    if (!courseId) {
      setExistingItems([]);
      return;
    }
    setLoadingExisting(true);
    try {
      const course = await getCourse(courseId);
      if (course) {
        const items = listAssessmentItems(course.sections);
        const mapped = items
          .filter((ref) => ref.item.assessmentKind !== null)
          .map((ref) => ({
            id: ref.item.id,
            title: ref.item.title,
            kind: ref.item.assessmentKind as AssessmentKind,
            sectionId: ref.section.id,
          }));
        setExistingItems(mapped);
        if (mapped.length > 0) {
          setSelectedExistingId(mapped[0].id);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingExisting(false);
    }
  };

  // Lecture handlers
  const handleLectureTextChange = (text: string) => {
    setLectureRawText(text);
    setProposedLectures(parseBulkLectureInput(text));
  };

  const handleLectureFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const names = Array.from(e.target.files).map((f) => f.name);
    setProposedLectures(proposeLectureOrderingFromFiles(names));
  };

  const handleSaveLectures = async () => {
    if (!selectedCourseId || proposedLectures.length === 0) return;
    setSavingLectures(true);
    try {
      const course = await getCourse(selectedCourseId);
      if (!course) throw new Error('الكورس غير موجود');
      const normalized = course.content;

      const baseOrder = lectureAppendMode === 'append' ? normalized.lectures.length : 0;
      const newLectures: NormalizedLecture[] = proposedLectures.map((draft, idx) => ({
        id: `lec_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        order: baseOrder + idx + 1,
        title: draft.title || `محاضرة ${baseOrder + idx + 1}`,
        youtubeUrl: draft.videoUrl || '',
        pdfUrl: '',
        files: [],
        trainings: [],
        published: true,
        openAt: null,
      }));

      const finalLectures =
        lectureAppendMode === 'append'
          ? [...normalized.lectures, ...newLectures]
          : newLectures;

      const updatedContent: NormalizedCourseContent = {
        ...normalized,
        lectures: finalLectures,
      };

      await saveCourseContent(selectedCourseId, updatedContent);
      showToast(`تم حفظ ${newLectures.length} محاضرات بنجاح في الكورس!`, 'success');
      setProposedLectures([]);
      setLectureRawText('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر الحفظ';
      showToast(`خطأ أثناء حفظ المحاضرات: ${msg}`, 'error');
    } finally {
      setSavingLectures(false);
    }
  };

  // Assessment question handlers
  const handleAssessmentTextChange = (text: string) => {
    setAssessmentRawText(text);
    const result = parseQuestionsFromTxt(text);
    setParsedQuestions(result.questions);
  };

  const handleAssessmentFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const res = parseQuestionsFromJson(text);
        setParsedQuestions(res.questions);
        showToast(`تم استيراد ${res.questions.length} أسئلة من ملف JSON بنجاح`, 'success');
      } else if (file.name.endsWith('.docx')) {
        const res = await parseQuestionsFromDocx(file);
        setParsedQuestions(res.questions);
        showToast(`تم استخراج ${res.questions.length} أسئلة من مستند Word بنجاح`, 'success');
      } else {
        const text = await file.text();
        const res = parseQuestionsFromTxt(text);
        setParsedQuestions(res.questions);
        showToast(`تم تحليل ${res.questions.length} أسئلة من الملف النصي بنجاح`, 'success');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر قراءة الملف';
      showToast(`خطأ في معالجة الملف: ${msg}`, 'error');
    }
  };

  const handleSaveQuestions = async () => {
    if (!selectedCourseId || parsedQuestions.length === 0) return;
    setSavingQuestions(true);

    try {
      const course = await getCourse(selectedCourseId);
      if (!course) throw new Error('الكورس غير موجود');

      if (targetType === 'new') {
        if (!newTitle.trim()) {
          showToast('يرجى كتابة عنوان للامتحان/التدريب الجديد', 'error');
          setSavingQuestions(false);
          return;
        }

        const targetSection = course.sections[0];
        if (!targetSection) {
          showToast('لا يوجد أقسام في هذا الكورس لإضافة الامتحان.', 'error');
          setSavingQuestions(false);
          return;
        }

        const durationNum = parseInt(newDuration, 10) || 0;
        const newId = await createAssessment(
          selectedCourseId,
          targetSection.id,
          {
            title: newTitle.trim(),
            kind: newKind,
            duration: durationNum,
            strictMode: newStrictMode,
            availableFrom: '',
            availableUntil: '',
            lockedUntilTrainingId: '',
            deadlineDate: '',
          },
          parsedQuestions,
        );

        showToast(`تم إنشاء «${newTitle}» وحفظ ${parsedQuestions.length} أسئلة بنجاح!`, 'success');
        setParsedQuestions([]);
        setAssessmentRawText('');
        setNewTitle('');

        // Refresh existing list
        const updatedCourse = await getCourse(selectedCourseId);
        if (updatedCourse) {
          const items = listAssessmentItems(updatedCourse.sections);
          const mapped = items
            .filter((ref) => ref.item.assessmentKind !== null)
            .map((ref) => ({
              id: ref.item.id,
              title: ref.item.title,
              kind: ref.item.assessmentKind as AssessmentKind,
              sectionId: ref.section.id,
            }));
          setExistingItems(mapped);
          setSelectedExistingId(newId);
        }
      } else {
        if (!selectedExistingId) {
          showToast('اختر التقييم المطلوب الإضافة إليه', 'error');
          setSavingQuestions(false);
          return;
        }

        const loaded = await loadAssessmentForEdit(selectedCourseId, selectedExistingId);
        if (!loaded) {
          showToast('تعذر تحميل بيانات التقييم المحدد', 'error');
          setSavingQuestions(false);
          return;
        }

        await updateAssessment(
          selectedCourseId,
          selectedExistingId,
          loaded.meta,
          [...loaded.questions, ...parsedQuestions],
        );

        showToast(`تمت إضافة ${parsedQuestions.length} أسئلة إلى «${loaded.meta.title}» بنجاح!`, 'success');
        setParsedQuestions([]);
        setAssessmentRawText('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر الحفظ';
      showToast(`خطأ أثناء حفظ الأسئلة: ${msg}`, 'error');
    } finally {
      setSavingQuestions(false);
    }
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="space-y-6 text-start" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <UploadCloud className="h-7 w-7 text-gold-400" />
            الرفع السريع للمحتوى
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            أداة ذكية للمالك لرفع وتنظيم محتوى شهر أو فصل دراسي كامل (دروس، تدريبات، امتحانات) في دقائق معدودة.
          </p>
        </div>
      </div>

      {/* Course Selection Card */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-gold-400" />
            اختر الكورس المستهدف:
          </label>
          {selectedCourse && (
            <div className="flex items-center gap-2">
              <Link
                to={`/admin/courses/${selectedCourse.id}/content`}
                className="inline-flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300 font-bold"
              >
                فتح محرر المحتوى الكامل
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>

        {loadingCourses ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Spinner /> جارٍ تحميل الكورسات...
          </div>
        ) : courses.length === 0 ? (
          <EmptyState title="لا توجد كورسات" description="قم بإنشاء كورس أولاً من صفحة الكورسات." />
        ) : (
          <select
            value={selectedCourseId}
            onChange={(e) => handleCourseChange(e.target.value)}
            className="w-full rounded-xl border border-navy-700 bg-navy-950 p-3 text-sm text-white focus:border-gold-400 focus:outline-none"
          >
            <option value="">-- اضغط هنا لاختيار الكورس --</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.grade})
              </option>
            ))}
          </select>
        )}
      </Card>

      {selectedCourseId && (
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex rounded-2xl border border-navy-800 bg-navy-950/70 p-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('lectures')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all ${
                activeTab === 'lectures'
                  ? 'bg-gold-500 text-navy-950 shadow-soft'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PlayCircle className="h-4 w-4" />
              1. استيراد المحاضرات والفيديوهات (مجمّع)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('assessments')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all ${
                activeTab === 'assessments'
                  ? 'bg-gold-500 text-navy-950 shadow-soft'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              2. استيراد الامتحانات وبنوك الأسئلة (Word / JSON / TXT)
            </button>
          </div>

          {/* TAB 1: Lectures */}
          {activeTab === 'lectures' && (
            <Card className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-gold-400" />
                  رفع وترتيب المحاضرات لمحتوى الكورس
                </h3>
                <p className="text-xs text-slate-400">
                  الصق قائمة بروابط الفيديوهات مع عناوينها أو ارفع ملفات ليقوم المحرك الذكي باستخراج الأسماء وترتيبها تلقائياً.
                </p>
              </div>

              {/* Mode switch */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={lectureInputMode === 'text' ? 'primary' : 'ghost'}
                  onClick={() => setLectureInputMode('text')}
                >
                  لصق روابط / نصوص
                </Button>
                <Button
                  size="sm"
                  variant={lectureInputMode === 'files' ? 'primary' : 'ghost'}
                  onClick={() => setLectureInputMode('files')}
                >
                  تحليل وترتيب من أسماء ملفات
                </Button>
              </div>

              {lectureInputMode === 'text' ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300">
                    الصق الروابط والعناوين (سطر لكل درس):
                  </label>
                  <textarea
                    value={lectureRawText}
                    onChange={(e) => handleLectureTextChange(e.target.value)}
                    rows={7}
                    dir="ltr"
                    placeholder={`1. مقدمة الوحدة الأولى - https://youtu.be/xxxx\n2. الدرس الأول: التفاعلات الكيميائية - https://youtu.be/yyyy\n3. الدرس الثاني: سرعة التفاعل`}
                    className="w-full rounded-xl border border-navy-700 bg-navy-950 p-3 text-xs text-white placeholder-slate-500 font-mono focus:border-gold-400 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400">
                    يدعم أرقام الدروس وروابط اليوتيوب بأي شكل. يقوم المحرك الذكي بفصل العنوان عن الرابط وترتيبها تصاعدياً.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-300">
                    اختر ملفات الدروس / الفيديوهات على جهازك لتحليل أسمائها وترتيبها:
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={handleLectureFilesChange}
                    className="block w-full text-xs text-slate-400 file:me-4 file:rounded-xl file:border-0 file:bg-gold-500 file:px-4 file:py-2.5 file:text-xs file:font-bold file:text-navy-950 hover:file:bg-gold-400 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400">
                    يتم استخراج أرقام الدروس من الأسماء (مثال: Lecture 01, درس 2) وتنقيتها من الامتدادات والرموز تلقائياً.
                  </p>
                </div>
              )}

              {/* Proposed lectures preview */}
              {proposedLectures.length > 0 && (
                <div className="space-y-4 rounded-xl border border-navy-700 bg-navy-900/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-gold-400">
                        معاينة الدروس المستخرجة ({proposedLectures.length})
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        يمكنك تعديل أي عنوان أو حذف درس قبل الحفظ النهائي في الكورس.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-slate-300">
                        <input
                          type="radio"
                          name="lecMode"
                          checked={lectureAppendMode === 'append'}
                          onChange={() => setLectureAppendMode('append')}
                          className="text-gold-500 focus:ring-gold-500"
                        />
                        إضافة للمحاضرات الحالية
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-300">
                        <input
                          type="radio"
                          name="lecMode"
                          checked={lectureAppendMode === 'replace'}
                          onChange={() => setLectureAppendMode('replace')}
                          className="text-gold-500 focus:ring-gold-500"
                        />
                        استبدال المحاضرات
                      </label>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto space-y-2 pe-1">
                    {proposedLectures.map((draft, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-lg border border-navy-800 bg-navy-950/80 p-2 text-xs"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-navy-800 font-bold text-gold-400">
                          {draft.order}
                        </span>
                        <input
                          type="text"
                          value={draft.title}
                          onChange={(e) => {
                            const updated = [...proposedLectures];
                            updated[idx] = { ...draft, title: e.target.value };
                            setProposedLectures(updated);
                          }}
                          placeholder="عنوان المحاضرة"
                          className="flex-1 rounded border border-navy-800 bg-navy-900 px-2 py-1 text-xs text-white focus:border-gold-400 focus:outline-none"
                        />
                        {draft.videoUrl && (
                          <span
                            className="shrink-0 max-w-[200px] truncate text-[11px] text-emerald-400"
                            title={draft.videoUrl}
                          >
                            {draft.videoUrl}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = proposedLectures.filter((_, i) => i !== idx);
                            setProposedLectures(filtered.map((d, i) => ({ ...d, order: i + 1 })));
                          }}
                          className="p-1 text-slate-500 hover:text-red-400"
                          title="حذف هذا الدرس"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="primary"
                      loading={savingLectures}
                      onClick={handleSaveLectures}
                    >
                      حفظ المحاضرات مباشرة في الكورس ({proposedLectures.length} درس)
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* TAB 2: Assessments */}
          {activeTab === 'assessments' && (
            <Card className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-gold-400" />
                  استيراد مجمّع للأسئلة والامتحانات
                </h3>
                <p className="text-xs text-slate-400">
                  ارفع ملف Word (.docx)، أو ملف JSON، أو الصق نص أسئلة منسق ليقوم المحرك بتحويلها لأسئلة تفاعلية مع خياراتها وتصحيحها التلقائي.
                </p>
              </div>

              {/* Target assessment config */}
              <div className="rounded-xl border border-navy-700 bg-navy-900/60 p-4 space-y-4">
                <h4 className="text-sm font-bold text-gold-400">الوجهة المستهدفة لحفظ الأسئلة:</h4>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <input
                      type="radio"
                      name="targetType"
                      checked={targetType === 'new'}
                      onChange={() => setTargetType('new')}
                      className="text-gold-500 focus:ring-gold-500"
                    />
                    إنشاء امتحان / تدريب جديد
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <input
                      type="radio"
                      name="targetType"
                      checked={targetType === 'existing'}
                      onChange={() => setTargetType('existing')}
                      className="text-gold-500 focus:ring-gold-500"
                    />
                    إضافة لتقييم موجود في الكورس
                  </label>
                </div>

                {targetType === 'new' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="sm:col-span-2">
                      <Input
                        label="عنوان التقييم الجديد *"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="مثال: امتحان شامل على الباب الثاني"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">النوع:</label>
                      <select
                        value={newKind}
                        onChange={(e) => setNewKind(e.target.value as AssessmentKind)}
                        className="w-full rounded-xl border border-navy-700 bg-navy-950 p-2.5 text-xs text-white focus:border-gold-400 focus:outline-none"
                      >
                        <option value="exam">{KIND_LABELS.exam}</option>
                        <option value="training">{KIND_LABELS.training}</option>
                        <option value="homework">{KIND_LABELS.homework}</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      اختر التقييم الموجود:
                    </label>
                    {loadingExisting ? (
                      <Spinner />
                    ) : existingItems.length === 0 ? (
                      <p className="text-xs text-amber-400">
                        لا توجد امتحانات في هذا الكورس بعد. يرجى اختيار &quot;إنشاء امتحان جديد&quot;.
                      </p>
                    ) : (
                      <select
                        value={selectedExistingId}
                        onChange={(e) => setSelectedExistingId(e.target.value)}
                        className="w-full rounded-xl border border-navy-700 bg-navy-950 p-2.5 text-xs text-white focus:border-gold-400 focus:outline-none"
                      >
                        {existingItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            [{KIND_LABELS[it.kind]}] {it.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Import source */}
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={importMethod === 'txt' ? 'primary' : 'ghost'}
                    onClick={() => setImportMethod('txt')}
                  >
                    <FileText className="h-4 w-4" />
                    لصق نص منسق (TXT)
                  </Button>
                  <Button
                    size="sm"
                    variant={importMethod === 'docx' ? 'primary' : 'ghost'}
                    onClick={() => setImportMethod('docx')}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    مستند Word (.docx)
                  </Button>
                  <Button
                    size="sm"
                    variant={importMethod === 'json' ? 'primary' : 'ghost'}
                    onClick={() => setImportMethod('json')}
                  >
                    <HelpCircle className="h-4 w-4" />
                    ملف أسئلة JSON
                  </Button>
                </div>

                {importMethod === 'txt' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300">
                      الصق نص الأسئلة بصيغة منسقة:
                    </label>
                    <textarea
                      value={assessmentRawText}
                      onChange={(e) => handleAssessmentTextChange(e.target.value)}
                      rows={8}
                      dir="rtl"
                      placeholder={`1. ما هي وحدة قياس القوة الدافعة الكهربائية؟\nأ) الفولت (صح)\nب) الأمبير\nج) الأوم\nد) الكولوم\n\n2. يتكون الماء من عنصري الهيدروجين والأكسجين (صح)\n\n3. اشرح باختصار أهمية قانون حفظ الكتلة في التفاعلات الكيميائية.`}
                      className="w-full rounded-xl border border-navy-700 bg-navy-950 p-3 text-xs text-white placeholder-slate-500 font-mono focus:border-gold-400 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-400">
                      يدعم الأسئلة الاختيارية بتحديد &quot;(صح)&quot; أمام الاختيار الصحيح أو بسطر &quot;ج: أ&quot;، وأسئلة الصواب والخطأ، والأسئلة المقالية.
                    </p>
                  </div>
                )}

                {importMethod === 'docx' && (
                  <div className="space-y-3 rounded-xl border border-navy-700 bg-navy-900/60 p-4">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-sky-400" />
                      اختر ملف Word (.docx) يحتوي على أسئلة الامتحان:
                    </label>
                    <input
                      type="file"
                      accept=".docx"
                      onChange={handleAssessmentFileSelect}
                      className="block w-full text-xs text-slate-400 file:me-4 file:rounded-xl file:border-0 file:bg-sky-500 file:px-4 file:py-2.5 file:text-xs file:font-bold file:text-navy-950 hover:file:bg-sky-400 cursor-pointer"
                    />
                    <p className="text-[11px] text-slate-400">
                      يتم فك ضغط ملف Word واستخراج نصوص الأسئلة والاختيارات في المتصفح مباشرة. تُعلَّم الأسئلة المستخرجة التي تحتاج تحديد إجابة صحيحة بـ &quot;مسودة تحتاج مراجعة&quot;.
                    </p>
                  </div>
                )}

                {importMethod === 'json' && (
                  <div className="space-y-3 rounded-xl border border-navy-700 bg-navy-900/60 p-4">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-emerald-400" />
                      اختر ملف أسئلة بصيغة JSON (بنك أسئلة أو تصدير سابق):
                    </label>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleAssessmentFileSelect}
                      className="block w-full text-xs text-slate-400 file:me-4 file:rounded-xl file:border-0 file:bg-emerald-500 file:px-4 file:py-2.5 file:text-xs file:font-bold file:text-navy-950 hover:file:bg-emerald-400 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Parsed questions preview */}
              {parsedQuestions.length > 0 && (
                <div className="space-y-4 rounded-xl border border-navy-700 bg-navy-900/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-gold-400">
                        معاينة الأسئلة المستخرجة ({parsedQuestions.length} سؤال)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        تأكد من نوع كل سؤال والإجابة الصحيحة قبل الاعتماد.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setParsedQuestions([])}
                      >
                        مسح الكل
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-3 pe-1">
                    {parsedQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-navy-800 bg-navy-950/80 p-3 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-navy-800 font-bold text-gold-400">
                              {idx + 1}
                            </span>
                            <Badge variant="neutral">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                            {q.needsReview && (
                              <Badge variant="gold">يحتاج تحديد الإجابة</Badge>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setParsedQuestions(parsedQuestions.filter((_, i) => i !== idx));
                            }}
                            className="p-1 text-slate-500 hover:text-red-400"
                            title="حذف هذا السؤال"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <p className="font-bold text-white leading-relaxed">{q.text}</p>

                        {q.options && Object.keys(q.options).length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {Object.entries(q.options).map(([key, optText]) => {
                              const isCorrect = q.answer === key;
                              return (
                                <div
                                  key={key}
                                  className={`rounded-lg px-2.5 py-1.5 text-xs ${
                                    isCorrect
                                      ? 'border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-bold'
                                      : 'border border-navy-800 bg-navy-900/60 text-slate-300'
                                  }`}
                                >
                                  <span className="me-1.5 text-slate-400">({key})</span>
                                  {optText}
                                  {isCorrect && ' ✓'}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="primary"
                      loading={savingQuestions}
                      onClick={handleSaveQuestions}
                    >
                      حفظ الأسئلة المستخرجة ({parsedQuestions.length} سؤال) في التقييم
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, FileText, PlayCircle, Trash2, UploadCloud } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, Spinner, useToast } from '../../components/ui';
import { useCourses } from '../../hooks/useCourses';
import {
  parseQuestionsFromDocx,
  parseQuestionsFromJson,
  parseQuestionsFromPdf,
  parseQuestionsFromTxt,
} from '../../lib/questionImport';
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
// الترتيب بين الأجزاء حر: الرابط الذي يبدو ملفًا (PDF/Drive/Docs) يعتبر ملفًا، وأي رابط آخر فيديو.
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
  const lectureDrafts = useMemo(() => parseLectureLines(lectureText), [lectureText]);

  // ملفات
  const [fileLectureId, setFileLectureId] = useState('');
  const [fileText, setFileText] = useState('');
  const [savingFiles, setSavingFiles] = useState(false);
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
  const [savingQuestions, setSavingQuestions] = useState(false);

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
      const count = await addLectures(courseId, lectureDrafts, lectureMode);
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
      const count = await addFilesToLecture(courseId, fileLectureId, fileDrafts);
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
      const result = name.endsWith('.json')
        ? parseQuestionsFromJson(await file.text())
        : name.endsWith('.docx')
          ? await parseQuestionsFromDocx(file)
          : name.endsWith('.pdf')
            ? await parseQuestionsFromPdf(file)
            : parseQuestionsFromTxt(await file.text());
      setQuestions(result.questions);
      showToast(`تم استخراج ${result.questions.length} سؤال`, result.questions.length > 0 ? 'success' : 'error');
    } catch (err: unknown) {
      showToast(`تعذر قراءة الملف: ${err instanceof Error ? err.message : ''}`, 'error');
    }
    event.target.value = '';
  };

  const saveQuestions = async () => {
    if (!courseId || questions.length === 0) return;
    setSavingQuestions(true);
    try {
      if (target === 'new') {
        if (!title.trim()) throw new Error('اكتب عنوان');
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
            availableFrom: '',
            availableUntil: '',
            lockedUntilTrainingId: '',
            deadlineDate: '',
          },
          questions,
          kind === 'exam' ? '' : attachLectureId,
        );
        showToast(`تم إنشاء «${title.trim()}» بـ ${questions.length} سؤال`, 'success');
        setTitle('');
      } else {
        if (!existingId) throw new Error('اختر التقييم');
        const loaded = await loadAssessmentForEdit(courseId, existingId);
        if (!loaded) throw new Error('تعذر تحميل التقييم');
        await updateAssessment(courseId, existingId, loaded.meta, [...loaded.questions, ...questions]);
        showToast(`تمت إضافة ${questions.length} سؤال إلى «${loaded.meta.title}»`, 'success');
      }
      setQuestions([]);
      setRawText('');
      await reloadCourse(courseId);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'تعذر الحفظ', 'error');
    } finally {
      setSavingQuestions(false);
    }
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
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white">
          <UploadCloud className="h-6 w-6 text-gold-400" /> الرفع السريع
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          ارفع محاضرات وفيديوهات وملفات PDF (روابط Drive) وتدريبات وواجبات وامتحانات في دقيقة، وكلها بتتربط بالمحاضرة الصح.
        </p>
      </div>

      <Card className="space-y-3 p-4">
        <label className="text-xs font-bold text-slate-300">الكورس</label>
        {loadingCourses ? (
          <Spinner />
        ) : (
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={FIELD}>
            <option value="">— اختر الكورس —</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        )}
        {courseId && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {loadingCourse ? <Spinner size="sm" /> : <Badge variant="neutral">{lectures.length} محاضرة</Badge>}
            <Link to={`/admin/courses/${encodeURIComponent(courseId)}`} className="text-gold-400 underline">
              فتح محرر الكورس
            </Link>
          </div>
        )}
      </Card>

      {!courseId ? (
        <EmptyState title="اختر كورس الأول" description="بعدها هتظهر لك أدوات الرفع." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition ${
                  tab === key ? 'bg-gold-400 text-navy-950' : 'bg-navy-900 text-slate-300 hover:bg-navy-800'
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {tab === 'lectures' && (
            <Card className="space-y-3 p-4">
              <label className="text-xs font-bold text-slate-300">سطر لكل محاضرة: العنوان | رابط الفيديو | رابط PDF أو Drive</label>
              <textarea
                value={lectureText}
                onChange={(e) => setLectureText(e.target.value)}
                rows={8}
                dir="ltr"
                placeholder={'1. الدرس الأول | https://youtu.be/xxxx | https://drive.google.com/file/d/ID/view\n2. الدرس الثاني | https://youtu.be/yyyy\n3. الدرس الثالث | https://drive.google.com/file/d/ID2/view'}
                className={`${FIELD} font-mono text-xs`}
              />
              <p className="text-[11px] text-slate-400">
                الترتيب بين الأجزاء حر. روابط Drive و PDF بتتحسب ملفات تلقائيًا وبتتحول لرابط عرض ثابت. ممكن تحط أكتر من ملف في نفس السطر.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {(['append', 'replace'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setLectureMode(mode)}
                    className={`rounded-lg px-3 py-1.5 font-bold ${lectureMode === mode ? 'bg-gold-400 text-navy-950' : 'bg-navy-900 text-slate-300'}`}
                  >
                    {mode === 'append' ? 'إضافة بعد الموجود' : 'استبدال كل المحاضرات'}
                  </button>
                ))}
              </div>
              {lectureDrafts.length > 0 && (
                <div className="space-y-1.5 rounded-xl border border-navy-800 bg-navy-950/60 p-3">
                  <div className="text-xs font-bold text-slate-300">معاينة ({lectureDrafts.length})</div>
                  {lectureDrafts.map((draft, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
                      <span className="text-slate-500">#{index + 1}</span>
                      <span className="font-bold">{draft.title || `محاضرة ${index + 1}`}</span>
                      {draft.videoUrl ? <Badge variant="success">فيديو</Badge> : <Badge variant="danger">بدون فيديو</Badge>}
                      {draft.files.length > 0 && <Badge variant="gold">{draft.files.length} ملف</Badge>}
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={saveLectures} loading={savingLectures} disabled={lectureDrafts.length === 0}>
                حفظ {lectureDrafts.length || ''} محاضرة
              </Button>
            </Card>
          )}

          {tab === 'files' && (
            <Card className="space-y-3 p-4">
              <label className="text-xs font-bold text-slate-300">المحاضرة</label>
              {lectureSelect(fileLectureId, setFileLectureId, '— اختر المحاضرة —')}
              <label className="text-xs font-bold text-slate-300">سطر لكل ملف: الاسم | الرابط</label>
              <textarea
                value={fileText}
                onChange={(e) => setFileText(e.target.value)}
                rows={5}
                dir="ltr"
                placeholder={'مذكرة الدرس | https://drive.google.com/file/d/ID/view\nملخص | https://drive.google.com/open?id=ID2'}
                className={`${FIELD} font-mono text-xs`}
              />
              <p className="text-[11px] text-slate-400">لازم الملف يكون على Drive بصلاحية «أي شخص معه الرابط». الطالب لازم يشاهد المحاضرة الأول لو قواعد المحتوى مفعّلة.</p>
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
            <Card className="space-y-3 p-4">
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
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="المدة بالدقائق (0 = مفتوح)" type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} />
                    <label className="flex items-end gap-2 pb-2 text-sm text-slate-200">
                      <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} /> وضع صارم
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

              <label className="text-xs font-bold text-slate-300">الأسئلة: الصقها هنا أو ارفع ملف TXT / Word / JSON</label>
              <textarea
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  setQuestions(parseQuestionsFromTxt(e.target.value).questions);
                }}
                rows={7}
                className={`${FIELD} text-xs`}
              />
              <input type="file" accept=".txt,.docx,.json,.pdf" onChange={onQuestionsFile} className="text-xs text-slate-300" />

              {questions.length > 0 && (
                <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-navy-800 bg-navy-950/60 p-3">
                  <div className="text-xs font-bold text-slate-300">معاينة ({questions.length} سؤال)</div>
                  {questions.map((q, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs text-slate-200">
                      <span className="text-slate-500">{index + 1}</span>
                      <Badge variant="neutral">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                      <span className="flex-1">{q.text}</span>
                      <button type="button" aria-label="حذف السؤال" onClick={() => setQuestions(questions.filter((_, i) => i !== index))}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={saveQuestions} loading={savingQuestions} disabled={questions.length === 0}>
                حفظ {questions.length || ''} سؤال
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

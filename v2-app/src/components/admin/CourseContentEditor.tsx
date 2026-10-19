import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Award,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  GripVertical,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { Badge, Button, Card, Input, Modal, buttonClasses, useToast } from '../ui';
import type {
  NormalizedAssessment,
  NormalizedCourseContent,
  NormalizedLecture,
  NormalizedTraining,
  LectureFile,
} from '../../lib/courseNormalize';

function toLocalDatetimeString(ms?: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromLocalDatetimeString(val: string): number | null {
  if (!val.trim()) return null;
  const d = new Date(val);
  const t = d.getTime();
  return isNaN(t) ? null : t;
}

interface CourseContentEditorProps {
  courseId: string;
  initialContent: NormalizedCourseContent;
  onSave: (content: NormalizedCourseContent) => Promise<void>;
  saving: boolean;
}

type ModalType =
  | { kind: 'add_lecture' }
  | { kind: 'edit_lecture'; lecture: NormalizedLecture; index: number }
  | { kind: 'add_training'; lectureId: string }
  | { kind: 'edit_training'; lectureId: string; training: NormalizedTraining; index: number }
  | { kind: 'add_homework' }
  | { kind: 'edit_homework'; homework: NormalizedAssessment; index: number }
  | { kind: 'add_exam' }
  | { kind: 'edit_exam'; exam: NormalizedAssessment; index: number }
  | { kind: 'confirm_delete'; title: string; onConfirm: () => void }
  | null;

export default function CourseContentEditor({
  courseId,
  initialContent,
  onSave,
  saving,
}: CourseContentEditorProps) {
  const { showToast } = useToast();
  const [content, setContent] = useState<NormalizedCourseContent>(initialContent);
  const [dirty, setDirty] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);

  // Drag and drop states
  const [draggedLecIdx, setDraggedLecIdx] = useState<number | null>(null);
  const [draggedTr, setDraggedTr] = useState<{ lectureId: string; idx: number } | null>(null);
  const [draggedHwIdx, setDraggedHwIdx] = useState<number | null>(null);
  const [draggedExamIdx, setDraggedExamIdx] = useState<number | null>(null);

  // Form states for modals
  const [formTitle, setFormTitle] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formPdfUrl, setFormPdfUrl] = useState('');
  const [formFiles, setFormFiles] = useState<LectureFile[]>([]);
  const [formOpenAt, setFormOpenAt] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formStrictMode, setFormStrictMode] = useState(false);
  const [formError, setFormError] = useState('');

  const openAddLecture = () => {
    setFormTitle('');
    setFormVideoUrl('');
    setFormPdfUrl('');
    setFormFiles([]);
    setFormOpenAt('');
    setFormError('');
    setModal({ kind: 'add_lecture' });
  };

  const openEditLecture = (lecture: NormalizedLecture, index: number) => {
    setFormTitle(lecture.title);
    setFormVideoUrl(lecture.youtubeUrl || '');
    setFormPdfUrl(lecture.pdfUrl || '');
    setFormFiles(
      lecture.files && lecture.files.length > 0
        ? [...lecture.files]
        : lecture.pdfUrl
          ? [{ id: `f_${Date.now()}`, title: 'ملف المحاضرة (PDF)', url: lecture.pdfUrl }]
          : []
    );
    setFormOpenAt(toLocalDatetimeString(lecture.openAt));
    setFormError('');
    setModal({ kind: 'edit_lecture', lecture, index });
  };

  const openAddTraining = (lectureId: string) => {
    setFormTitle('');
    setFormDuration('');
    setFormOpenAt('');
    setFormError('');
    setModal({ kind: 'add_training', lectureId });
  };

  const openEditTraining = (lectureId: string, training: NormalizedTraining, index: number) => {
    setFormTitle(training.title);
    setFormDuration(training.duration || '');
    setFormOpenAt(toLocalDatetimeString(training.openAt));
    setFormError('');
    setModal({ kind: 'edit_training', lectureId, training, index });
  };

  const openAddHomework = () => {
    setFormTitle('');
    setFormDuration('');
    setFormOpenAt('');
    setFormStrictMode(false);
    setFormError('');
    setModal({ kind: 'add_homework' });
  };

  const openEditHomework = (homework: NormalizedAssessment, index: number) => {
    setFormTitle(homework.title);
    setFormDuration(homework.duration || '');
    setFormOpenAt(toLocalDatetimeString(homework.openAt));
    setFormStrictMode(homework.strictMode ?? false);
    setFormError('');
    setModal({ kind: 'edit_homework', homework, index });
  };

  const openAddExam = () => {
    setFormTitle('');
    setFormDuration('');
    setFormOpenAt('');
    setFormStrictMode(false);
    setFormError('');
    setModal({ kind: 'add_exam' });
  };

  const openEditExam = (exam: NormalizedAssessment, index: number) => {
    setFormTitle(exam.title);
    setFormDuration(exam.duration || '');
    setFormOpenAt(toLocalDatetimeString(exam.openAt));
    setFormStrictMode(exam.strictMode ?? false);
    setFormError('');
    setModal({ kind: 'edit_exam', exam, index });
  };

  // Re-ordering helpers
  const moveLecture = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= content.lectures.length) return;
    const newLectures = [...content.lectures];
    const [moved] = newLectures.splice(index, 1);
    newLectures.splice(targetIndex, 0, moved);
    const reindexed = newLectures.map((l, i) => ({ ...l, order: i + 1 }));
    setContent({ ...content, lectures: reindexed });
    setDirty(true);
  };

  const moveTraining = (lectureId: string, trIndex: number, direction: 'up' | 'down') => {
    const lectureIndex = content.lectures.findIndex((l) => l.id === lectureId);
    if (lectureIndex === -1) return;
    const lecture = content.lectures[lectureIndex];
    const targetTrIndex = direction === 'up' ? trIndex - 1 : trIndex + 1;
    if (targetTrIndex < 0 || targetTrIndex >= lecture.trainings.length) return;
    const newTrainings = [...lecture.trainings];
    const [moved] = newTrainings.splice(trIndex, 1);
    newTrainings.splice(targetTrIndex, 0, moved);
    const reindexedTr = newTrainings.map((t, i) => ({ ...t, order: i + 1 }));
    const newLectures = [...content.lectures];
    newLectures[lectureIndex] = { ...lecture, trainings: reindexedTr };
    setContent({ ...content, lectures: newLectures });
    setDirty(true);
  };

  const moveHomework = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= content.homeworks.length) return;
    const newHws = [...content.homeworks];
    const [moved] = newHws.splice(index, 1);
    newHws.splice(targetIndex, 0, moved);
    const reindexed = newHws.map((h, i) => ({ ...h, order: i + 1 }));
    setContent({ ...content, homeworks: reindexed });
    setDirty(true);
  };

  const moveExam = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= content.exams.length) return;
    const newExams = [...content.exams];
    const [moved] = newExams.splice(index, 1);
    newExams.splice(targetIndex, 0, moved);
    const reindexed = newExams.map((e, i) => ({ ...e, order: i + 1 }));
    setContent({ ...content, exams: reindexed });
    setDirty(true);
  };

  // Delete helpers with confirmation
  const confirmDeleteLecture = (lecture: NormalizedLecture) => {
    setModal({
      kind: 'confirm_delete',
      title: `حذف محاضرة "${lecture.title}"؟ سيتم حذف التدريبات التابعة لها من الكورس.`,
      onConfirm: () => {
        const filtered = content.lectures.filter((l) => l.id !== lecture.id);
        const reindexed = filtered.map((l, i) => ({ ...l, order: i + 1 }));
        setContent({ ...content, lectures: reindexed });
        setDirty(true);
        setModal(null);
      },
    });
  };

  const confirmDeleteTraining = (lectureId: string, training: NormalizedTraining) => {
    setModal({
      kind: 'confirm_delete',
      title: `حذف التدريب "${training.title}" من هذه المحاضرة؟`,
      onConfirm: () => {
        const newLectures = content.lectures.map((lec) => {
          if (lec.id !== lectureId) return lec;
          const filtered = lec.trainings.filter((t) => t.id !== training.id);
          return { ...lec, trainings: filtered.map((t, i) => ({ ...t, order: i + 1 })) };
        });
        setContent({ ...content, lectures: newLectures });
        setDirty(true);
        setModal(null);
      },
    });
  };

  const confirmDeleteHomework = (homework: NormalizedAssessment) => {
    setModal({
      kind: 'confirm_delete',
      title: `حذف الواجب "${homework.title}" من الكورس؟`,
      onConfirm: () => {
        const filtered = content.homeworks.filter((h) => h.id !== homework.id);
        const reindexed = filtered.map((h, i) => ({ ...h, order: i + 1 }));
        setContent({ ...content, homeworks: reindexed });
        setDirty(true);
        setModal(null);
      },
    });
  };

  const confirmDeleteExam = (exam: NormalizedAssessment) => {
    setModal({
      kind: 'confirm_delete',
      title: `حذف الامتحان "${exam.title}" من الكورس؟`,
      onConfirm: () => {
        const filtered = content.exams.filter((e) => e.id !== exam.id);
        const reindexed = filtered.map((e, i) => ({ ...e, order: i + 1 }));
        setContent({ ...content, exams: reindexed });
        setDirty(true);
        setModal(null);
      },
    });
  };

  // Modal Submit Handlers
  const handleSaveModal = () => {
    if (!modal) return;
    const titleTrimmed = formTitle.trim();
    if (!titleTrimmed) {
      setFormError('اكتب عنوان العنصر أولاً.');
      return;
    }

    if (modal.kind === 'add_lecture') {
      const newLec: NormalizedLecture = {
        id: `lec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: titleTrimmed,
        youtubeUrl: formVideoUrl.trim(),
        pdfUrl: formFiles[0]?.url || formPdfUrl.trim(),
        files: formFiles,
        openAt: fromLocalDatetimeString(formOpenAt),
        order: content.lectures.length + 1,
        trainings: [],
      };
      setContent({ ...content, lectures: [...content.lectures, newLec] });
      setDirty(true);
      setModal(null);
    } else if (modal.kind === 'edit_lecture') {
      const newLectures = [...content.lectures];
      newLectures[modal.index] = {
        ...modal.lecture,
        title: titleTrimmed,
        youtubeUrl: formVideoUrl.trim(),
        pdfUrl: formFiles[0]?.url || formPdfUrl.trim(),
        files: formFiles,
        openAt: fromLocalDatetimeString(formOpenAt),
      };
      setContent({ ...content, lectures: newLectures });
      setDirty(true);
      setModal(null);
    } else if (modal.kind === 'add_training') {
      const newTr: NormalizedTraining = {
        id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: titleTrimmed,
        type: 'training',
        order: 1,
        duration: formDuration.trim(),
        openAt: fromLocalDatetimeString(formOpenAt),
      };
      const newLectures = content.lectures.map((lec) => {
        if (lec.id !== modal.lectureId) return lec;
        const newTrainings = [...lec.trainings, { ...newTr, order: lec.trainings.length + 1 }];
        return { ...lec, trainings: newTrainings };
      });
      setContent({ ...content, lectures: newLectures });
      setDirty(true);
      setModal(null);
    } else if (modal.kind === 'edit_training') {
      const newLectures = content.lectures.map((lec) => {
        if (lec.id !== modal.lectureId) return lec;
        const newTrainings = [...lec.trainings];
        newTrainings[modal.index] = {
          ...modal.training,
          title: titleTrimmed,
          duration: formDuration.trim(),
          openAt: fromLocalDatetimeString(formOpenAt),
        };
        return { ...lec, trainings: newTrainings };
      });
      setContent({ ...content, lectures: newLectures });
      setDirty(true);
      setModal(null);
    } else if (modal.kind === 'add_homework') {
      const newHw: NormalizedAssessment = {
        id: `hw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: titleTrimmed,
        type: 'homework',
        order: content.homeworks.length + 1,
        duration: formDuration.trim(),
        strictMode: formStrictMode,
        openAt: fromLocalDatetimeString(formOpenAt),
      };
      setContent({ ...content, homeworks: [...content.homeworks, newHw] });
      setDirty(true);
      setModal(null);
    } else if (modal.kind === 'edit_homework') {
      const newHws = [...content.homeworks];
      newHws[modal.index] = {
        ...modal.homework,
        title: titleTrimmed,
        duration: formDuration.trim(),
        strictMode: formStrictMode,
        openAt: fromLocalDatetimeString(formOpenAt),
      };
      setContent({ ...content, homeworks: newHws });
      setDirty(true);
      setModal(null);
    } else if (modal.kind === 'add_exam') {
      const newEx: NormalizedAssessment = {
        id: `exam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: titleTrimmed,
        type: 'exam',
        order: content.exams.length + 1,
        duration: formDuration.trim(),
        strictMode: formStrictMode,
        openAt: fromLocalDatetimeString(formOpenAt),
      };
      setContent({ ...content, exams: [...content.exams, newEx] });
      setDirty(true);
      setModal(null);
    } else if (modal.kind === 'edit_exam') {
      const newExs = [...content.exams];
      newExs[modal.index] = {
        ...modal.exam,
        title: titleTrimmed,
        duration: formDuration.trim(),
        strictMode: formStrictMode,
        openAt: fromLocalDatetimeString(formOpenAt),
      };
      setContent({ ...content, exams: newExs });
      setDirty(true);
      setModal(null);
    }
  };

  const handleSaveAll = async () => {
    if (!window.confirm('هل تريد بالتأكيد حفظ محتوى الكورس وترتيب العناصر الجديد؟')) return;
    try {
      await onSave(content);
      setDirty(false);
      showToast('تم حفظ محتوى الكورس بالكامل بنجاح.', 'success');
    } catch {
      showToast('تعذر حفظ محتوى الكورس. حاول مرة أخرى.', 'error');
    }
  };

  return (
    <div className="space-y-6 text-start" dir="rtl">
      {/* Save bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy-700 bg-navy-900/80 p-4">
        <div className="flex items-center gap-2">
          {dirty ? (
            <Badge variant="gold">لديك تغييرات غير محفوظة في محتوى الكورس</Badge>
          ) : (
            <Badge variant="success">المحتوى محفوظ ومحدّث</Badge>
          )}
        </div>
        <Button variant="primary" loading={saving} disabled={!dirty} onClick={handleSaveAll}>
          حفظ محتوى الكورس
        </Button>
      </div>

      {/* Box 1: المحاضرات */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-800 pb-3">
          <div className="flex items-center gap-2">
            <PlayCircle className="h-6 w-6 text-gold-400" />
            <h3 className="text-xl font-bold text-white">1. المحاضرات</h3>
            <Badge variant="neutral">{content.lectures.length}</Badge>
          </div>
          <Button size="sm" variant="secondary" onClick={openAddLecture}>
            <Plus className="h-4 w-4" />
            إضافة محاضرة
          </Button>
        </div>

        {content.lectures.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-700 p-6 text-center text-sm text-slate-400">
            لا توجد محاضرات في هذا الكورس بعد. اضغط «إضافة محاضرة» لإنشاء أول محاضرة.
          </p>
        ) : (
          <div className="space-y-4">
            {content.lectures.map((lec, idx) => (
              <div
                key={lec.id}
                draggable
                onDragStart={() => setDraggedLecIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedLecIdx !== null && draggedLecIdx !== idx) {
                    const newLectures = [...content.lectures];
                    const [moved] = newLectures.splice(draggedLecIdx, 1);
                    newLectures.splice(idx, 0, moved);
                    const reindexed = newLectures.map((l, i) => ({ ...l, order: i + 1 }));
                    setContent({ ...content, lectures: reindexed });
                    setDirty(true);
                  }
                  setDraggedLecIdx(null);
                }}
                className={`space-y-3 rounded-xl border p-4 transition-all ${
                  draggedLecIdx === idx
                    ? 'border-gold-400 bg-navy-900/90 shadow-glow opacity-80'
                    : 'border-navy-700/80 bg-navy-950/60 hover:border-navy-600'
                }`}
              >
                {/* Lecture row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-gold-400 touch-none"
                      title="اسحب المحاضرة لإعادة ترتيبها"
                      aria-label="مقبض السحب لإعادة الترتيب"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-800 text-xs font-bold text-gold-400">
                      #{lec.order}
                    </span>
                    <div>
                      <h4 className="font-bold text-white">{lec.title}</h4>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        {lec.youtubeUrl ? (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <PlayCircle className="h-3.5 w-3.5" />
                            فيديو مسجل
                          </span>
                        ) : (
                          <span className="text-slate-500">بدون رابط فيديو</span>
                        )}
                        {lec.files && lec.files.length > 0 ? (
                          <span className="flex items-center gap-1 text-gold-400">
                            <FileText className="h-3.5 w-3.5" />
                            {lec.files.length === 1 ? 'ملف مرفق (1)' : `${lec.files.length} ملفات مرفقة`}
                          </span>
                        ) : lec.pdfUrl ? (
                          <span className="flex items-center gap-1 text-gold-400">
                            <FileText className="h-3.5 w-3.5" />
                            مذكرة مرفقة
                          </span>
                        ) : null}
                        {lec.openAt && (
                          <span className="flex items-center gap-1 text-sky-400">
                            <Clock className="h-3.5 w-3.5" />
                            يفتح: {new Date(lec.openAt).toLocaleString('ar-EG')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={idx === 0}
                      onClick={() => moveLecture(idx, 'up')}
                      aria-label="تحريك لأعلى"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={idx === content.lectures.length - 1}
                      onClick={() => moveLecture(idx, 'down')}
                      aria-label="تحريك لأسفل"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEditLecture(lec, idx)}>
                      <Pencil className="h-4 w-4 text-slate-300" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => confirmDeleteLecture(lec)}
                      aria-label="حذف المحاضرة"
                    >
                      <Trash2 className="h-4 w-4 text-red-400 hover:text-red-300" />
                    </Button>
                  </div>
                </div>

                {/* Attached Trainings Sub-box */}
                <div className="ms-4 rounded-xl border border-navy-800 bg-navy-900/60 p-3 sm:ms-8">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                      <ClipboardList className="h-4 w-4 text-gold-400" />
                      التدريبات التابعة للمحاضرة ({lec.trainings.length})
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => openAddTraining(lec.id)}>
                      <Plus className="h-3.5 w-3.5" />
                      إضافة تدريب
                    </Button>
                  </div>

                  {lec.trainings.length === 0 ? (
                    <p className="text-xs text-slate-500">لا توجد تدريبات تابعة لهذه المحاضرة.</p>
                  ) : (
                    <div className="space-y-2">
                      {lec.trainings.map((tr, trIdx) => (
                        <div
                          key={tr.id}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDraggedTr({ lectureId: lec.id, idx: trIdx });
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.stopPropagation();
                            if (draggedTr && draggedTr.lectureId === lec.id && draggedTr.idx !== trIdx) {
                              const newTrainings = [...lec.trainings];
                              const [moved] = newTrainings.splice(draggedTr.idx, 1);
                              newTrainings.splice(trIdx, 0, moved);
                              const reindexedTr = newTrainings.map((t, i) => ({ ...t, order: i + 1 }));
                              const newLectures = [...content.lectures];
                              newLectures[idx] = { ...lec, trainings: reindexedTr };
                              setContent({ ...content, lectures: newLectures });
                              setDirty(true);
                            }
                            setDraggedTr(null);
                          }}
                          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs transition-all ${
                            draggedTr?.lectureId === lec.id && draggedTr?.idx === trIdx
                              ? 'border border-gold-400/60 bg-navy-900 shadow-soft'
                              : 'bg-navy-950/70 hover:bg-navy-950'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="cursor-grab active:cursor-grabbing p-0.5 text-slate-500 hover:text-gold-400 touch-none"
                              title="اسحب التدريب لإعادة ترتيبه"
                              aria-label="مقبض السحب"
                            >
                              <GripVertical className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-slate-500">#{tr.order}</span>
                            <span className="font-medium text-slate-200">{tr.title}</span>
                            {tr.questions && tr.questions.length > 0 && (
                              <Badge variant="neutral">{tr.questions.length} سؤال</Badge>
                            )}
                            {tr.openAt && (
                              <Badge variant="info">
                                يفتح: {new Date(tr.openAt).toLocaleDateString('ar-EG')}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Link
                              to={`/admin/courses/${courseId}/assessments/${tr.id}`}
                              className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                            >
                              الأسئلة
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={trIdx === 0}
                              onClick={() => moveTraining(lec.id, trIdx, 'up')}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={trIdx === lec.trainings.length - 1}
                              onClick={() => moveTraining(lec.id, trIdx, 'down')}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditTraining(lec.id, tr, trIdx)}
                            >
                              <Pencil className="h-3.5 w-3.5 text-slate-300" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => confirmDeleteTraining(lec.id, tr)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Box 2: الواجبات */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-800 pb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-gold-400" />
            <h3 className="text-xl font-bold text-white">2. الواجبات</h3>
            <Badge variant="neutral">{content.homeworks.length}</Badge>
          </div>
          <Button size="sm" variant="secondary" onClick={openAddHomework}>
            <Plus className="h-4 w-4" />
            إضافة واجب
          </Button>
        </div>

        {content.homeworks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-700 p-6 text-center text-sm text-slate-400">
            لا توجد واجبات في هذا الكورس بعد. اضغط «إضافة واجب» لإنشاء أول واجب.
          </p>
        ) : (
          <div className="space-y-3">
            {content.homeworks.map((hw, idx) => (
              <div
                key={hw.id}
                draggable
                onDragStart={() => setDraggedHwIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedHwIdx !== null && draggedHwIdx !== idx) {
                    const newHws = [...content.homeworks];
                    const [moved] = newHws.splice(draggedHwIdx, 1);
                    newHws.splice(idx, 0, moved);
                    const reindexed = newHws.map((h, i) => ({ ...h, order: i + 1 }));
                    setContent({ ...content, homeworks: reindexed });
                    setDirty(true);
                  }
                  setDraggedHwIdx(null);
                }}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition-all ${
                  draggedHwIdx === idx
                    ? 'border-gold-400 bg-navy-900/90 shadow-glow opacity-80'
                    : 'border-navy-700/80 bg-navy-950/60 hover:border-navy-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-gold-400 touch-none"
                    title="اسحب الواجب لإعادة ترتيبه"
                    aria-label="مقبض السحب"
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-800 text-xs font-bold text-gold-400">
                    #{hw.order}
                  </span>
                  <div>
                    <h4 className="font-bold text-white">{hw.title}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      {hw.duration && <span>المدة: {hw.duration}</span>}
                      {hw.strictMode && <Badge variant="gold">مؤمّن (Strict)</Badge>}
                      {hw.questions && hw.questions.length > 0 && (
                        <Badge variant="neutral">{hw.questions.length} سؤال</Badge>
                      )}
                      {hw.openAt && (
                        <Badge variant="info">
                          يفتح: {new Date(hw.openAt).toLocaleDateString('ar-EG')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Link
                    to={`/admin/courses/${courseId}/assessments/${hw.id}`}
                    className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                  >
                    تعديل الأسئلة
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={idx === 0}
                    onClick={() => moveHomework(idx, 'up')}
                    aria-label="تحريك لأعلى"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={idx === content.homeworks.length - 1}
                    onClick={() => moveHomework(idx, 'down')}
                    aria-label="تحريك لأسفل"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEditHomework(hw, idx)}>
                    <Pencil className="h-4 w-4 text-slate-300" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => confirmDeleteHomework(hw)}
                    aria-label="حذف الواجب"
                  >
                    <Trash2 className="h-4 w-4 text-red-400 hover:text-red-300" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Box 3: الامتحانات */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-800 pb-3">
          <div className="flex items-center gap-2">
            <Award className="h-6 w-6 text-gold-400" />
            <h3 className="text-xl font-bold text-white">3. الامتحانات</h3>
            <Badge variant="neutral">{content.exams.length}</Badge>
          </div>
          <Button size="sm" variant="secondary" onClick={openAddExam}>
            <Plus className="h-4 w-4" />
            إضافة امتحان
          </Button>
        </div>

        {content.exams.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-700 p-6 text-center text-sm text-slate-400">
            لا توجد امتحانات في هذا الكورس بعد. اضغط «إضافة امتحان» لإنشاء أول امتحان.
          </p>
        ) : (
          <div className="space-y-3">
            {content.exams.map((exam, idx) => (
              <div
                key={exam.id}
                draggable
                onDragStart={() => setDraggedExamIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedExamIdx !== null && draggedExamIdx !== idx) {
                    const newExs = [...content.exams];
                    const [moved] = newExs.splice(draggedExamIdx, 1);
                    newExs.splice(idx, 0, moved);
                    const reindexed = newExs.map((e, i) => ({ ...e, order: i + 1 }));
                    setContent({ ...content, exams: reindexed });
                    setDirty(true);
                  }
                  setDraggedExamIdx(null);
                }}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition-all ${
                  draggedExamIdx === idx
                    ? 'border-gold-400 bg-navy-900/90 shadow-glow opacity-80'
                    : 'border-navy-700/80 bg-navy-950/60 hover:border-navy-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-gold-400 touch-none"
                    title="اسحب الامتحان لإعادة ترتيبه"
                    aria-label="مقبض السحب"
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-800 text-xs font-bold text-gold-400">
                    #{exam.order}
                  </span>
                  <div>
                    <h4 className="font-bold text-white">{exam.title}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      {exam.duration && <span>المدة: {exam.duration}</span>}
                      {exam.strictMode && <Badge variant="gold">مؤمّن (Strict)</Badge>}
                      {exam.questions && exam.questions.length > 0 && (
                        <Badge variant="neutral">{exam.questions.length} سؤال</Badge>
                      )}
                      {exam.openAt && (
                        <Badge variant="info">
                          يفتح: {new Date(exam.openAt).toLocaleDateString('ar-EG')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Link
                    to={`/admin/courses/${courseId}/assessments/${exam.id}`}
                    className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                  >
                    تعديل الأسئلة
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={idx === 0}
                    onClick={() => moveExam(idx, 'up')}
                    aria-label="تحريك لأعلى"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={idx === content.exams.length - 1}
                    onClick={() => moveExam(idx, 'down')}
                    aria-label="تحريك لأسفل"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEditExam(exam, idx)}>
                    <Pencil className="h-4 w-4 text-slate-300" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => confirmDeleteExam(exam)}
                    aria-label="حذف الامتحان"
                  >
                    <Trash2 className="h-4 w-4 text-red-400 hover:text-red-300" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* MODALS */}
      {/* 1. Lecture Modal */}
      {(modal?.kind === 'add_lecture' || modal?.kind === 'edit_lecture') && (
        <Modal
          open={true}
          onClose={() => setModal(null)}
          title={modal.kind === 'add_lecture' ? 'إضافة محاضرة جديدة' : 'تعديل المحاضرة'}
          footer={
            <>
              <Button variant="secondary" onClick={() => setModal(null)}>
                إلغاء
              </Button>
              <Button variant="primary" onClick={handleSaveModal}>
                حفظ
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {formError && (
              <p className="rounded-lg bg-red-500/10 p-2.5 text-xs font-bold text-red-300">
                {formError}
              </p>
            )}
            <Input
              label="عنوان المحاضرة *"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="مثال: محاضرة الدرس الأول: جغرافيا"
            />
            <Input
              label="رابط الفيديو (YouTube أو رابط مباشر)"
              value={formVideoUrl}
              onChange={(e) => setFormVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <Input
              type="datetime-local"
              label="موعد الفتح التلقائي (اختياري - بتوقيت القاهرة)"
              value={formOpenAt}
              onChange={(e) => setFormOpenAt(e.target.value)}
            />

            {/* ملفات ومذكرات المحاضرة */}
            <div className="space-y-3 rounded-xl border border-navy-800 bg-navy-950/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  ملفات ومذكرات المحاضرة ({formFiles.length})
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const newF: LectureFile = {
                      id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                      title: `ملف ${formFiles.length + 1}`,
                      url: '',
                    };
                    setFormFiles([...formFiles, newF]);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة ملف
                </Button>
              </div>

              {formFiles.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">لا توجد ملفات حاليًا. يمكنك إضافة ملف أو كتابة رابط سريع بالأسفل.</p>
                  <Input
                    label="رابط ملف سريع / PDF (اختياري)"
                    value={formPdfUrl}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormPdfUrl(v);
                      if (v.trim()) {
                        setFormFiles([{ id: `f_${Date.now()}`, title: 'ملف المحاضرة (PDF)', url: v.trim() }]);
                      } else {
                        setFormFiles([]);
                      }
                    }}
                    placeholder="https://drive.google.com/... أو رابط PDF مباشر"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  {formFiles.map((file, fIdx) => (
                    <div key={file.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-navy-800 bg-navy-900/60 p-2 sm:flex-nowrap">
                      <input
                        className="min-w-0 flex-1 rounded-lg border border-navy-700 bg-navy-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-gold-400 focus:outline-none"
                        placeholder="اسم الملف (مثال: ملخص الدرس)"
                        value={file.title}
                        onChange={(e) => {
                          const next = [...formFiles];
                          next[fIdx] = { ...next[fIdx], title: e.target.value };
                          setFormFiles(next);
                        }}
                      />
                      <input
                        className="min-w-0 flex-1 rounded-lg border border-navy-700 bg-navy-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-gold-400 focus:outline-none"
                        placeholder="رابط الملف (Google Drive أو مباشر)"
                        value={file.url}
                        onChange={(e) => {
                          const next = [...formFiles];
                          next[fIdx] = { ...next[fIdx], url: e.target.value };
                          setFormFiles(next);
                          if (fIdx === 0) setFormPdfUrl(e.target.value);
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const next = formFiles.filter((_, i) => i !== fIdx);
                          setFormFiles(next);
                          setFormPdfUrl(next[0]?.url || '');
                        }}
                        title="حذف الملف"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* 2. Training Modal */}
      {(modal?.kind === 'add_training' || modal?.kind === 'edit_training') && (
        <Modal
          open={true}
          onClose={() => setModal(null)}
          title={modal.kind === 'add_training' ? 'إضافة تدريب للمحاضرة' : 'تعديل التدريب'}
          footer={
            <>
              <Button variant="secondary" onClick={() => setModal(null)}>
                إلغاء
              </Button>
              <Button variant="primary" onClick={handleSaveModal}>
                حفظ
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {formError && (
              <p className="rounded-lg bg-red-500/10 p-2.5 text-xs font-bold text-red-300">
                {formError}
              </p>
            )}
            <Input
              label="عنوان التدريب *"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="مثال: تدريب الدرس الأول"
            />
            <Input
              label="المدة المتوقعة (اختياري)"
              value={formDuration}
              onChange={(e) => setFormDuration(e.target.value)}
              placeholder="مثال: 15 دقيقة"
            />
            <Input
              type="datetime-local"
              label="موعد الفتح التلقائي (اختياري - بتوقيت القاهرة)"
              value={formOpenAt}
              onChange={(e) => setFormOpenAt(e.target.value)}
            />
          </div>
        </Modal>
      )}

      {/* 3. Homework / Exam Modal */}
      {(modal?.kind === 'add_homework' ||
        modal?.kind === 'edit_homework' ||
        modal?.kind === 'add_exam' ||
        modal?.kind === 'edit_exam') && (
        <Modal
          open={true}
          onClose={() => setModal(null)}
          title={
            modal.kind === 'add_homework'
              ? 'إضافة واجب جديد'
              : modal.kind === 'edit_homework'
                ? 'تعديل الواجب'
                : modal.kind === 'add_exam'
                  ? 'إضافة امتحان جديد'
                  : 'تعديل الامتحان'
          }
          footer={
            <>
              <Button variant="secondary" onClick={() => setModal(null)}>
                إلغاء
              </Button>
              <Button variant="primary" onClick={handleSaveModal}>
                حفظ
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {formError && (
              <p className="rounded-lg bg-red-500/10 p-2.5 text-xs font-bold text-red-300">
                {formError}
              </p>
            )}
            <Input
              label="العنوان *"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="مثال: واجب الأسبوع الثاني"
            />
            <Input
              label="المدة بالدقائق (اختياري)"
              value={formDuration}
              onChange={(e) => setFormDuration(e.target.value)}
              placeholder="مثال: 30"
            />
            <Input
              type="datetime-local"
              label="موعد الفتح التلقائي (اختياري - بتوقيت القاهرة)"
              value={formOpenAt}
              onChange={(e) => setFormOpenAt(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={formStrictMode}
                onChange={(e) => setFormStrictMode(e.target.checked)}
                className="h-4 w-4 rounded border-navy-700 bg-navy-950 text-gold-500 focus:ring-gold-500"
              />
              تفعيل الوضع الصارم (Strict Mode) - يمنع فتح صفحات أخرى أثناء الحل
            </label>
          </div>
        </Modal>
      )}

      {/* 4. Confirmation Modal */}
      {modal?.kind === 'confirm_delete' && (
        <Modal
          open={true}
          onClose={() => setModal(null)}
          title="تأكيد الحذف"
          footer={
            <>
              <Button variant="secondary" onClick={() => setModal(null)}>
                تراجع
              </Button>
              <Button variant="primary" onClick={modal.onConfirm}>
                تأكيد الحذف
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-300">{modal.title}</p>
        </Modal>
      )}
    </div>
  );
}

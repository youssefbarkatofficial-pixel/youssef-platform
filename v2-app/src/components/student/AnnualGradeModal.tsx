import { useState } from 'react';
import { Button, Modal, Select, useToast } from '../ui';
import { cn } from '../ui/cn';
import { useAuth } from '../../hooks/useAuth';
import { getAcademicYear } from '../../lib/dates';
import { GRADE_OPTIONS, getGradeLabel, isGradeCode, isSecondaryGrade, suggestNextGrade } from '../../lib/grades';
import type { GradeTrack } from '../../lib/grades';
import { updateStudentGrade } from '../../services/students';

// نافذة التحديث السنوي للصف: تظهر عند أول دخول بعد بداية السنة الدراسية (25 يوليو).
export default function AnnualGradeModal() {
  const { student, refresh } = useAuth();
  const { showToast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<GradeTrack | ''>('');
  const [saving, setSaving] = useState(false);

  if (!student) return null;

  const currentYear = getAcademicYear();
  const needsUpdate =
    !student.archived &&
    (student.lastUpdatedAcademicYear === null || student.lastUpdatedAcademicYear < currentYear);

  const suggested = suggestNextGrade(student.grade);
  const value = selected || suggested || '';
  const currentLabel = student.grade
    ? getGradeLabel(student.grade, student.track)
    : student.rawGrade || 'غير محدد';

  const isSec = isSecondaryGrade(value);

  const handleConfirm = async () => {
    if (!isGradeCode(value)) {
      showToast('اختر صفك الدراسي أولًا', 'error');
      return;
    }

    let trackToSave: GradeTrack | null = null;
    if (isSec) {
      if (value === 'sec2' || value === 'sec3') {
        trackToSave = 'bacc';
      } else {
        trackToSave = selectedTrack || student.track || 'general';
      }
    }

    setSaving(true);
    try {
      await updateStudentGrade(student.id, value, currentYear, trackToSave);
      await refresh();
      showToast('تم تحديث صفك الدراسي', 'success');
    } catch {
      showToast('تعذر تحديث الصف. حاول مرة أخرى.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={needsUpdate && !dismissed}
      onClose={() => setDismissed(true)}
      closeOnOverlay={false}
      title="سنة دراسية جديدة"
      footer={
        <>
          <Button variant="ghost" onClick={() => setDismissed(true)} disabled={saving}>
            لاحقًا
          </Button>
          <Button onClick={handleConfirm} loading={saving}>
            تأكيد الصف
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="leading-relaxed text-slate-300">
          بدأت سنة دراسية جديدة. من فضلك اختر صفك الدراسي الحالي لنعرض لك الكورسات المناسبة.
        </p>
        <p className="text-sm text-slate-400">
          الصف المسجّل حاليًا: <span className="font-bold text-gold-400">{currentLabel}</span>
        </p>
        <Select
          label="صفك الدراسي الحالي"
          options={GRADE_OPTIONS}
          value={value}
          placeholder="اختر الصف"
          onChange={(event) => setSelected(event.target.value)}
        />

        {value === 'sec1' && (
          <div className="space-y-2 rounded-xl border border-navy-700 bg-navy-950/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">المسار (أولى ثانوي):</span>
              <span className="text-xs text-gold-400">نفس المادة: تاريخ</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedTrack('general')}
                className={cn(
                  'rounded-lg border p-2 text-xs text-center transition-all',
                  (selectedTrack || student.track || 'general') === 'general'
                    ? 'border-gold-500 bg-gold-500/20 text-gold-300 font-bold'
                    : 'border-navy-700 bg-navy-900 text-slate-300',
                )}
              >
                أولى ثانوي عام
              </button>
              <button
                type="button"
                onClick={() => setSelectedTrack('bacc')}
                className={cn(
                  'rounded-lg border p-2 text-xs text-center transition-all',
                  (selectedTrack || student.track) === 'bacc'
                    ? 'border-gold-500 bg-gold-500/20 text-gold-300 font-bold'
                    : 'border-navy-700 bg-navy-900 text-slate-300',
                )}
              >
                أولى ثانوي بكالوريا
              </button>
            </div>
          </div>
        )}

        {value === 'sec2' && (
          <div className="rounded-xl border border-navy-700 bg-navy-950/60 p-3 text-xs text-slate-300">
            <span className="font-bold text-gold-400">تانية ثانوي بكالوريا:</span> تاريخ بالمنهج الجديد، ولا يوجد جغرافيا.
          </div>
        )}

        {value === 'sec3' && (
          <div className="rounded-xl border border-navy-700 bg-navy-950/60 p-3 text-xs text-slate-300">
            <span className="font-bold text-gold-400">تالتة ثانوي بكالوريا:</span> المنهج الجديد من العام القادم.
          </div>
        )}
      </div>
    </Modal>
  );
}

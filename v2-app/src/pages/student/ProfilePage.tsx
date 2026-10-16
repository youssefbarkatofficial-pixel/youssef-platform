import { useState } from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  MapPin,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Badge, Button, Card, Spinner, useToast } from '../../components/ui';
import { cn } from '../../components/ui/cn';
import { useAuth } from '../../hooks/useAuth';
import { getGradeLabel, getTrackLabel, isSecondaryGrade } from '../../lib/grades';
import type { GradeTrack } from '../../lib/grades';
import { updateStudentTrack } from '../../services/students';

export default function ProfilePage() {
  const { student, loading, refresh } = useAuth();
  const { showToast } = useToast();

  const [selectedTrack, setSelectedTrack] = useState<GradeTrack | ''>('');
  const [savingTrack, setSavingTrack] = useState(false);

  if (loading || !student) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-gold-400">
        <Spinner size="lg" />
      </div>
    );
  }

  const isSec = isSecondaryGrade(student.grade);
  const hasTrack = Boolean(student.track);
  const needsTrackSelection = isSec && !hasTrack;

  // عند اختيار المسار من قبل الطالب القديم
  const handleSaveTrack = async () => {
    let trackToSave: GradeTrack | '' = selectedTrack;
    if (student.grade === 'sec2' || student.grade === 'sec3') {
      trackToSave = 'bacc';
    }

    if (!trackToSave) {
      showToast('من فضلك اختر المسار الدراسي أولًا', 'error');
      return;
    }

    setSavingTrack(true);
    try {
      await updateStudentTrack(student.id, trackToSave);
      await refresh();
      showToast('تم حفظ مسارك الدراسي بنجاح', 'success');
    } catch {
      showToast('تعذر حفظ المسار. حاول مرة أخرى.', 'error');
    } finally {
      setSavingTrack(false);
    }
  };

  const gradeDisplay = student.grade
    ? getGradeLabel(student.grade, student.track)
    : student.rawGrade || 'غير محدد';

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-extrabold text-white">الملف الشخصي</h1>
        <p className="mt-1 text-sm text-slate-400">بيانات حسابك والصف والمسار الدراسي.</p>
      </div>

      {/* طلب تحديد المسار لطلاب الثانوي القدام الذين ليس لديهم مسار مسجّل */}
      {needsTrackSelection && (
        <Card className="border-gold-500/50 bg-gold-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-gold-400" />
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="font-bold text-gold-300">تحديد المسار الدراسي للمرحلة الثانوية</h3>
                <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                  نرجو تحديد مسارك الدراسي مرة واحدة لتخصيص المحتوى المناسب لك.
                </p>
              </div>

              {student.grade === 'sec1' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">اختر المسار (أولى ثانوي):</span>
                    <span className="text-xs text-gold-400">نفس المادة: تاريخ</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedTrack('general')}
                      className={cn(
                        'rounded-xl border p-3 text-center transition-all',
                        selectedTrack === 'general'
                          ? 'border-gold-500 bg-gold-500/20 text-gold-300 font-bold'
                          : 'border-navy-700 bg-navy-900/80 text-slate-300 hover:border-slate-500',
                      )}
                    >
                      أولى ثانوي عام
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTrack('bacc')}
                      className={cn(
                        'rounded-xl border p-3 text-center transition-all',
                        selectedTrack === 'bacc'
                          ? 'border-gold-500 bg-gold-500/20 text-gold-300 font-bold'
                          : 'border-navy-700 bg-navy-900/80 text-slate-300 hover:border-slate-500',
                      )}
                    >
                      أولى ثانوي بكالوريا
                    </button>
                  </div>
                </div>
              )}

              {student.grade === 'sec2' && (
                <div className="rounded-xl border border-navy-700 bg-navy-950/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">المسار: تانية ثانوي بكالوريا</span>
                    <Badge variant="gold">بكالوريا</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                    تاريخ بالمنهج الجديد، ولا يوجد جغرافيا.
                  </p>
                </div>
              )}

              {student.grade === 'sec3' && (
                <div className="rounded-xl border border-navy-700 bg-navy-950/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">المسار: تالتة ثانوي بكالوريا</span>
                    <Badge variant="gold">بكالوريا</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                    المنهج الجديد من العام القادم.
                  </p>
                </div>
              )}

              <Button onClick={handleSaveTrack} loading={savingTrack}>
                تأكيد وحفظ المسار
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* بطاقة معلومات الحساب */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-navy-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gold-500/15 text-gold-400">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{student.name}</h2>
              <p className="text-xs text-slate-400">كود الطالب: <span className="font-mono text-gold-400">{student.studentCode}</span></p>
            </div>
          </div>
          <Badge variant="gold">{student.role === 'admin' ? 'إدارة' : 'طالب'}</Badge>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl bg-navy-950/40 p-4 border border-navy-800/80">
            <GraduationCap className="mt-0.5 h-5 w-5 text-gold-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">الصف الدراسي</p>
              <p className="mt-1 font-bold text-white">{gradeDisplay}</p>
            </div>
          </div>

          {isSec && (
            <div className="flex items-start gap-3 rounded-xl bg-navy-950/40 p-4 border border-navy-800/80">
              <BookOpen className="mt-0.5 h-5 w-5 text-gold-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-400">المسار الدراسي</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-bold text-white">
                    {student.track ? getTrackLabel(student.track) : 'لم يُحدد بعد'}
                  </span>
                  {student.track && (
                    <span className="inline-flex items-center text-xs text-emerald-400 gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      مؤكد
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 rounded-xl bg-navy-950/40 p-4 border border-navy-800/80">
            <Phone className="mt-0.5 h-5 w-5 text-gold-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">رقم الهاتف</p>
              <p className="mt-1 font-mono font-bold text-white" dir="ltr">{student.phone}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-navy-950/40 p-4 border border-navy-800/80">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-gold-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">رقم ولي الأمر</p>
              <p className="mt-1 font-mono font-bold text-white" dir="ltr">{student.parentPhone}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-navy-950/40 p-4 border border-navy-800/80">
            <MapPin className="mt-0.5 h-5 w-5 text-gold-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">المحافظة / الدولة</p>
              <p className="mt-1 font-bold text-white">{student.gov || 'غير محدد'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-navy-950/40 p-4 border border-navy-800/80">
            <Award className="mt-0.5 h-5 w-5 text-gold-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">النقاط والمستوى</p>
              <p className="mt-1 font-bold text-white">{student.points} نقطة ({student.xp} XP)</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

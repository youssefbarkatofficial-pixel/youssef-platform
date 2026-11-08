import { useState } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Badge, Button, Modal, Select, useToast } from '../ui';
import type { SelectOption } from '../ui';
import type { Course } from '../../services/courses';
import type { Student } from '../../services/students';
import {
  grantStudentCourseAccess,
  revokeStudentCourseAccess,
} from '../../services/students';
import type { CourseGrantType } from '../../lib/subscriptions';
import { formatCairoDateTime } from '../../lib/cairoTime';

interface ManageStudentSubscriptionsModalProps {
  open: boolean;
  onClose: () => void;
  student: Student | null;
  courses: Course[];
  onUpdated: () => void;
}

export default function ManageStudentSubscriptionsModal({
  open,
  onClose,
  student,
  courses,
  onUpdated,
}: ManageStudentSubscriptionsModalProps) {
  const { showToast } = useToast();
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<CourseGrantType>('full_term');
  const [submitting, setSubmitting] = useState(false);
  const [revokingCourseId, setRevokingCourseId] = useState<string | null>(null);

  if (!student) return null;

  const enrolledCourseIds = student.courses || [];
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  // حساب معلومات آخر محاضرة للكورس المحدد
  const latestLecture = selectedCourse?.content?.lectures
    ? [...selectedCourse.content.lectures].sort((a, b) => b.order - a.order)[0]
    : undefined;

  const courseOptions: SelectOption[] = [
    { value: '', label: 'اختر الكورس...' },
    ...courses.map((c) => ({
      value: c.id,
      label: `${c.title} (${enrolledCourseIds.includes(c.id) ? 'مشترك بالفعل' : 'غير مشترك'})`,
    })),
  ];

  const handleGrant = async () => {
    if (!selectedCourseId) {
      showToast('يرجى اختيار الكورس أولاً', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const options: {
        startLectureOrder?: number;
        targetLectureId?: string;
        targetLectureOrder?: number;
      } = {};

      if (selectedPlan === 'monthly') {
        options.startLectureOrder = latestLecture ? latestLecture.order : 1;
      } else if (selectedPlan === 'trial_lecture') {
        if (latestLecture) {
          options.targetLectureId = latestLecture.id;
          options.targetLectureOrder = latestLecture.order;
        } else {
          showToast('لا توجد محاضرات منشورة في هذا الكورس بعد', 'error');
          setSubmitting(false);
          return;
        }
      }

      await grantStudentCourseAccess(student.id, selectedCourseId, selectedPlan, options);
      showToast('تم تفعيل الصلاحية للطالب بنجاح', 'success');
      setSelectedCourseId('');
      onUpdated();
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء حفظ الصلاحية', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (courseId: string, courseName: string) => {
    if (!window.confirm(`هل أنت متأكد من إلغاء صلاحية كورس "${courseName}" لهذا الطالب؟`)) {
      return;
    }

    setRevokingCourseId(courseId);
    try {
      await revokeStudentCourseAccess(student.id, courseId);
      showToast('تم إلغاء صلاحية الكورس بنجاح', 'success');
      onUpdated();
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء إلغاء الصلاحية', 'error');
    } finally {
      setRevokingCourseId(null);
    }
  };

  const now = Date.now();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="إدارة اشتراكات وصلاحيات الكورسات"
      className="max-w-2xl"
    >
      <div className="space-y-6">
        {/* بيانات الطالب */}
        <div className="rounded-xl border border-navy-700 bg-navy-950/60 p-3.5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-bold text-white text-base">{student.name || 'بدون اسم'}</p>
            <p className="text-xs text-slate-400 mt-0.5" dir="ltr">
              {student.phone} | كود: {student.studentCode}
            </p>
          </div>
          <span className="rounded-lg bg-navy-800 px-3 py-1 text-xs font-semibold text-gold-400">
            {enrolledCourseIds.length} كورس متاح حالياً
          </span>
        </div>

        {/* الكورسات الحالية للطالب */}
        <div>
          <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-slate-200">
            <GraduationCap className="h-4 w-4 text-gold-400" />
            <span>الكورسات المفعلة للطالب ونوع الاشتراك:</span>
          </h3>

          {enrolledCourseIds.length === 0 ? (
            <p className="rounded-lg border border-dashed border-navy-700 p-4 text-center text-xs text-slate-500">
              لا توجد كورسات مفعلة لهذا الطالب حالياً.
            </p>
          ) : (
            <div className="space-y-2">
              {enrolledCourseIds.map((cid) => {
                const c = courses.find((item) => item.id === cid);
                const grant = student.accessGrants?.[cid];
                const cTitle = c?.title || cid;

                let planBadge = <Badge variant="gold">ترم كامل</Badge>;
                let extraInfo = '';

                if (grant?.type === 'monthly') {
                  const isExpired = grant.expiresAt && now >= grant.expiresAt;
                  const daysLeft = grant.expiresAt
                    ? Math.max(0, Math.ceil((grant.expiresAt - now) / (1000 * 60 * 60 * 24)))
                    : 0;

                  planBadge = isExpired ? (
                    <Badge variant="danger">اشتراك شهري (منتهي)</Badge>
                  ) : (
                    <Badge variant="info">اشتراك شهري (متبقي {daysLeft} يوم)</Badge>
                  );

                  if (grant.expiresAt) {
                    extraInfo = `ينتهي: ${formatCairoDateTime(grant.expiresAt)} | يبدأ من درس #${grant.startLectureOrder || 1}`;
                  }
                } else if (grant?.type === 'trial_lecture') {
                  const isExpired = grant.expiresAt && now >= grant.expiresAt;
                  const daysLeft = grant.expiresAt
                    ? Math.max(0, Math.ceil((grant.expiresAt - now) / (1000 * 60 * 60 * 24)))
                    : 0;

                  planBadge = isExpired ? (
                    <Badge variant="danger">محاضرة تجريبية (منتهية)</Badge>
                  ) : (
                    <Badge variant="success">محاضرة تجريبية (متبقي {daysLeft} يوم)</Badge>
                  );

                  if (grant.expiresAt) {
                    extraInfo = `الدرس #${grant.targetLectureOrder || ''} | ينتهي: ${formatCairoDateTime(grant.expiresAt)}`;
                  }
                }

                return (
                  <div
                    key={cid}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-800 bg-navy-900/60 p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{cTitle}</span>
                        {planBadge}
                      </div>
                      {extraInfo && (
                        <p className="mt-1 text-xs text-slate-400">{extraInfo}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={revokingCourseId === cid}
                      onClick={() => void handleRevoke(cid, cTitle)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      title="إلغاء الصلاحية"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>إلغاء</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* قسم منح صلاحية جديدة / تجديد */}
        <div className="rounded-xl border border-navy-700 bg-navy-950/40 p-4 space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white border-b border-navy-800 pb-2">
            <Sparkles className="h-4 w-4 text-gold-400" />
            <span>منح كورس جديد أو تغيير نوع الاشتراك:</span>
          </h3>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              الكورس المستهدف:
            </label>
            <Select
              options={courseOptions}
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-300">
              نوع الصلاحية المطلوبة:
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {/* خيار 1: ترم كامل */}
              <button
                type="button"
                onClick={() => setSelectedPlan('full_term')}
                className={`rounded-xl border p-3 text-start transition-all ${
                  selectedPlan === 'full_term'
                    ? 'border-gold-500 bg-gold-500/10 text-white'
                    : 'border-navy-800 bg-navy-900/50 text-slate-300 hover:border-navy-700'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Award className="h-4 w-4 text-gold-400" />
                  <span>ترم كامل</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                  وصول مفتوح دائم لكامل محتويات الترم.
                </p>
              </button>

              {/* خيار 2: اشتراك شهري */}
              <button
                type="button"
                onClick={() => setSelectedPlan('monthly')}
                className={`rounded-xl border p-3 text-start transition-all ${
                  selectedPlan === 'monthly'
                    ? 'border-sky-500 bg-sky-500/10 text-white'
                    : 'border-navy-800 bg-navy-900/50 text-slate-300 hover:border-navy-700'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Calendar className="h-4 w-4 text-sky-400" />
                  <span>اشتراك شهري (30 يوم)</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                  عد تنازلي 30 يوم من آخر محاضرة بالجديد.
                </p>
              </button>

              {/* خيار 3: محاضرة تجريبية مجانية */}
              <button
                type="button"
                onClick={() => setSelectedPlan('trial_lecture')}
                className={`rounded-xl border p-3 text-start transition-all ${
                  selectedPlan === 'trial_lecture'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white'
                    : 'border-navy-800 bg-navy-900/50 text-slate-300 hover:border-navy-700'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <span>محاضرة تجريبية (7 أيام)</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                  آخر محاضرة فقط بجميع مشتملاتها.
                </p>
              </button>
            </div>
          </div>

          {/* تفاصيل توضيحية لما سيحدث */}
          {selectedCourse && (
            <div className="rounded-lg bg-navy-900/90 border border-navy-800 p-3 text-xs space-y-1.5 text-slate-300">
              <div className="flex items-center gap-1.5 font-semibold text-gold-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>معاينة تفاصيل التفعيل:</span>
              </div>
              {selectedPlan === 'full_term' && (
                <p>• سيتاح للطالب كورس "{selectedCourse.title}" بالكامل بدون قيود زمنية.</p>
              )}
              {selectedPlan === 'monthly' && (
                <>
                  <p>• المدة: 30 يوماً من اليوم (تنتهي يوم {formatCairoDateTime(now + 30 * 24 * 60 * 60 * 1000)}).</p>
                  <p>
                    • المحاضرات المتاحة: تبدأ من الدرس #{latestLecture?.order || 1} وكل ما ينزل جديد.
                    (المحاضرات السابقة تظل مقفولة).
                  </p>
                </>
              )}
              {selectedPlan === 'trial_lecture' && (
                <>
                  <p>• المحاضرة المتاحة: الدرس #{latestLecture?.order || 'غير محدد'} ({latestLecture?.title || 'آخر محاضرة'}).</p>
                  <p>• الصلاحية: 7 أيام كحد أقصى (تنتهي يوم {formatCairoDateTime(now + 7 * 24 * 60 * 60 * 1000)}).</p>
                  <p>• تغلق تلقائياً فور إنهاء امتحانها ونزول محاضرة أحدث.</p>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={submitting || !selectedCourseId}
              onClick={() => void handleGrant()}
            >
              {submitting ? 'جاري الحفظ...' : 'تأكيد وحفظ الصلاحية'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

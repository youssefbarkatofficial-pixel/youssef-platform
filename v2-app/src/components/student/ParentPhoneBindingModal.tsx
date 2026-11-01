import { useState } from 'react';
import type { FormEvent } from 'react';
import { Phone, ShieldCheck } from 'lucide-react';
import { Button, Input, Modal, useToast } from '../ui';
import { useAuth } from '../../hooks/useAuth';
import { isValidEgyptPhone, normalizePhone } from '../../lib/phone';
import { updateStudentProfile } from '../../services/students';
import FormAlert from '../auth/FormAlert';

/**
 * نافذة تأكيد وتسجيل رقم ولي الأمر الإلزامية:
 * تظهر فور دخول الطالب إذا لم يكن رقم ولي أمره مسجلاً في قاعدة البيانات
 * ويُطلب منه كتابة الرقم وتأكيده (مرتين) للتأكد من صحته وحفظه فوراً في حسابه.
 */
export default function ParentPhoneBindingModal() {
  const { student, refresh } = useAuth();
  const { showToast } = useToast();

  const [parentPhone, setParentPhone] = useState('');
  const [confirmPhone, setConfirmPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // لا تظهر النافذة إذا لم يكن هناك طالب مسجل أو حسابه مجمّد
  if (!student || student.archived) return null;

  // إذا كان رقم ولي الأمر مسجلاً ومطابقاً للشروط المصرية فلا حاجة للنافذة
  const existingParent = (student.parentPhone || '').trim();
  const hasValidParent =
    existingParent !== '' &&
    existingParent !== 'غير مسجل' &&
    existingParent !== '-' &&
    isValidEgyptPhone(normalizePhone(existingParent));

  if (hasValidParent) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const normParent = normalizePhone(parentPhone);
    const normConfirm = normalizePhone(confirmPhone);
    const normStudent = normalizePhone(student.phone);

    if (!normParent || !isValidEgyptPhone(normParent)) {
      setError('يجب كتابة رقم هاتف ولي الأمر صحيحاً (11 رقماً يبدأ بـ 01).');
      return;
    }

    if (normParent !== normConfirm) {
      setError('الأرقام غير متطابقة، حاول تاني.');
      return;
    }

    if (normStudent && normParent === normStudent) {
      setError('رقم ولي الأمر يجب أن يكون مختلفاً عن رقم هاتف الطالب.');
      return;
    }

    setLoading(true);
    try {
      await updateStudentProfile(student.id, { parentPhone: normParent });
      await refresh();
      showToast('تم تسجيل وتأكيد رقم ولي الأمر بنجاح!', 'success');
    } catch {
      setError('تعذر حفظ رقم ولي الأمر. تأكد من اتصالك بالإنترنت وحاول مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={() => {
        // نافذة إلزامية لا يمكن تخطيها
      }}
      title="تأكيد وتسجيل رقم ولي الأمر"
      closeOnOverlay={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div className="flex items-start gap-3 rounded-xl border border-gold-500/30 bg-gold-500/10 p-3.5 text-xs text-gold-300 leading-relaxed">
          <ShieldCheck className="h-5 w-5 shrink-0 text-gold-400 mt-0.5" />
          <p>
            حرصاً على متابعة مستواك الدراسي وأمان حسابك، يرجى كتابة رقم هاتف ولي أمرك وتأكيده لمرة واحدة فقط للمتابعة.
          </p>
        </div>

        {error && <FormAlert type="error">{error}</FormAlert>}

        <Input
          label="رقم هاتف ولي الأمر (11 رقماً)"
          type="tel"
          dir="ltr"
          placeholder="01xxxxxxxxx"
          value={parentPhone}
          onChange={(e) => setParentPhone(e.target.value)}
        />

        <Input
          label="تأكيد رقم هاتف ولي الأمر (أعد كتابته مرة أخرى)"
          type="tel"
          dir="ltr"
          placeholder="01xxxxxxxxx"
          value={confirmPhone}
          onChange={(e) => setConfirmPhone(e.target.value)}
        />

        <div className="pt-2">
          <Button type="submit" variant="primary" loading={loading} fullWidth>
            حفظ ومتابعة
          </Button>
        </div>
      </form>
    </Modal>
  );
}

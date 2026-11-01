import { useState } from 'react';
import type { FormEvent } from 'react';
import { UserCheck } from 'lucide-react';
import { Button, Input, Modal, useToast } from '../ui';
import { useAuth } from '../../hooks/useAuth';
import { updateStudentProfile } from '../../services/students';
import { isPasswordResetDone } from '../../lib/studentPasswords';
import { isValidEgyptPhone, normalizePhone } from '../../lib/phone';
import FormAlert from '../auth/FormAlert';

/**
 * نافذة تأكيد الاسم الرباعي الإلزامية:
 * تظهر فور دخول الطالب إذا كان حسابه مسجلاً باسم افتراضي (مثل "طالب" أو "طالب جديد")
 * أو للطالب ذي الكود YB-K9X2M7P4 / الهاتف 01037483675 لكتابة اسمه رباعياً بالكامل باللغة العربية.
 */
export default function StudentNameConfirmationModal() {
  const { student, refresh } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!student || student.archived) return null;

  // 1. لا تتداخل مع نافذة تعيين كلمة المرور إن كانت مطلوبة أولاً
  if (!isPasswordResetDone(student.id) && !isPasswordResetDone(student.phone)) return null;

  // 2. لا تتداخل مع نافذة تأكيد رقم ولي الأمر إن كانت مطلوبة أولاً
  const existingParent = (student.parentPhone || '').trim();
  const hasValidParent =
    existingParent !== '' &&
    existingParent !== 'غير مسجل' &&
    existingParent !== '-' &&
    isValidEgyptPhone(normalizePhone(existingParent));
  if (!hasValidParent) return null;

  const currentName = (student.name || '').trim();
  const parts = currentName.split(/\s+/).filter(Boolean);

  const isTargetStudent =
    student.studentCode === 'YB-K9X2M7P4' ||
    student.phone === '01037483675';

  // تظهر النافذة إذا كان الاسم افتراضياً أو أقل من اسمين، أو لحساب الطالب المستهدف إذا لم يكن رباعياً
  const isPlaceholderName =
    currentName === '' ||
    currentName === 'طالب' ||
    currentName === 'طالب جديد' ||
    currentName.toLowerCase() === 'student' ||
    parts.length < 2 ||
    (isTargetStudent && parts.length < 4);

  if (!isPlaceholderName) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = fullName.trim().replace(/\s+/g, ' ');
    const nameWords = cleanName.split(' ').filter(Boolean);

    if (nameWords.length < 4) {
      setError('يرجى كتابة الاسم رباعياً بالكامل (أربعة مقاطع: الاسم الأول، اسم الأب، اسم الجد، واللقب).');
      return;
    }

    if (nameWords.some((w) => w.length < 2)) {
      setError('يرجى التأكد من كتابة كل اسم من الأسماء الأربعة بشكل صحيح ودون اختصارات.');
      return;
    }

    if (cleanName.length < 8 || cleanName.length > 80) {
      setError('يرجى كتابة اسم صحيح يتراوح بين 8 و80 حرفاً.');
      return;
    }

    // التحقق من خلو الاسم من الرموز أو الأرقام وأن الحروف عربية
    if (!/^[\u0600-\u06FF\s]+$/.test(cleanName)) {
      setError('يرجى كتابة الاسم بالحروف العربية فقط دون أرقام أو رموز.');
      return;
    }

    setLoading(true);
    try {
      await updateStudentProfile(student.id, { name: cleanName });
      await refresh();
      showToast('تم حفظ اسمك وتحديث ملفك الشخصي بنجاح!', 'success');
    } catch {
      setError('تعذر حفظ الاسم. تأكد من اتصالك بالإنترنت وحاول مجدداً.');
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
      title="تأكيد وتسجيل اسم الطالب"
      closeOnOverlay={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div className="flex items-start gap-3 rounded-xl border border-gold-500/30 bg-gold-500/10 p-3.5 text-xs text-gold-300 leading-relaxed">
          <UserCheck className="h-5 w-5 shrink-0 text-gold-400 mt-0.5" />
          <p>
            حرصاً على توثيق ملفك الدراسي وإصدار شهاداتك وتقاريرك باسمك الحقيقي، يرجى كتابة اسمك رباعياً باللغة العربية لمرة واحدة فقط للمتابعة.
          </p>
        </div>

        {error && <FormAlert type="error">{error}</FormAlert>}

        <Input
          label="الاسم رباعي بالكامل"
          type="text"
          placeholder="مثال: يوسف أحمد محمد علي"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <div className="pt-2">
          <Button type="submit" variant="primary" loading={loading} fullWidth>
            تأكيد الاسم ومتابعة
          </Button>
        </div>
      </form>
    </Modal>
  );
}

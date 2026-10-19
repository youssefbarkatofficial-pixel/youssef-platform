import { useState } from 'react';
import type { FormEvent } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { Button, Card, Input } from '../ui';
import FormAlert from '../auth/FormAlert';

export default function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword) {
      setError('اكتب كلمة المرور الحالية.');
      return;
    }

    if (newPassword.length < 8) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمة المرور الجديدة وتأكيدها غير متطابقين.');
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
      setError('يجب تسجيل الدخول بحساب المالك أولًا.');
      return;
    }

    setSubmitting(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setSuccess('تم تغيير كلمة المرور بنجاح.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';

      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('كلمة المرور الحالية غير صحيحة.');
      } else if (code === 'auth/weak-password') {
        setError('كلمة المرور ضعيفة. اختر كلمة مرور أقوى (8 أحرف على الأقل).');
      } else if (code === 'auth/requires-recent-login') {
        setError('انتهت صلاحية الجلسة. أعد تسجيل الدخول ثم حاول مرة أخرى.');
      } else {
        setError('حدث خطأ أثناء تغيير كلمة المرور. حاول مرة أخرى.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-gold-400" />
        <h2 className="text-lg font-bold text-white">تغيير كلمة المرور</h2>
      </div>

      <p className="text-xs leading-relaxed text-slate-400">
        تغيير كلمة مرور حساب الإدارة مباشرة عبر المصادقة الآمنة. تتطلب كتابة كلمة المرور الحالية والجديدة (8 أحرف على الأقل).
      </p>

      {error && <FormAlert type="error">{error}</FormAlert>}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-400">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-3 max-w-md">
        <Input
          label="كلمة المرور الحالية"
          type={showCurrent ? 'text' : 'password'}
          dir="ltr"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          rightElement={
            <button
              type="button"
              tabIndex={-1}
              aria-label={showCurrent ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              className="text-slate-400 hover:text-white transition-colors"
              onClick={() => setShowCurrent((p) => !p)}
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <Input
          label="كلمة المرور الجديدة (8 أحرف على الأقل)"
          type={showNew ? 'text' : 'password'}
          dir="ltr"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          rightElement={
            <button
              type="button"
              tabIndex={-1}
              aria-label={showNew ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              className="text-slate-400 hover:text-white transition-colors"
              onClick={() => setShowNew((p) => !p)}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <Input
          label="تأكيد كلمة المرور الجديدة"
          type={showConfirm ? 'text' : 'password'}
          dir="ltr"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          rightElement={
            <button
              type="button"
              tabIndex={-1}
              aria-label={showConfirm ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              className="text-slate-400 hover:text-white transition-colors"
              onClick={() => setShowConfirm((p) => !p)}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <Button type="submit" loading={submitting} disabled={submitting}>
          حفظ كلمة المرور الجديدة
        </Button>
      </form>
    </Card>
  );
}

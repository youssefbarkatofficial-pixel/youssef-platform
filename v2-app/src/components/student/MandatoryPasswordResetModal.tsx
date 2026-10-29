import { useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, Phone, ShieldAlert } from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { Button, Input, Modal, useToast } from '../ui';
import { useAuth } from '../../hooks/useAuth';
import { isValidEgyptPhone, normalizePhone } from '../../lib/phone';
import { isPasswordResetDone, markPasswordResetDone, setStoredAdminPassword } from '../../lib/studentPasswords';
import { updateStudentProfile } from '../../services/students';
import FormAlert from '../auth/FormAlert';

type FlowMode = 'choose' | 'old-pwd' | 'parent-phone';

/**
 * نافذة التحديث الأمني الإلزامي لكلمة المرور لجميع الطلاب الحاليين:
 * تظهر فور فتح الطالب لحسابه ولا يمكن إغلاقها إلا بعد إتمام إعادة التعيين لمرة واحدة.
 */
export default function MandatoryPasswordResetModal() {
  const { student, firebaseUser } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<FlowMode>('choose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // خيار 1: كلمة المرور القديمة
  const [oldPwd, setOldPwd] = useState('');
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [newPwdA, setNewPwdA] = useState('');
  const [showNewPwdA, setShowNewPwdA] = useState(false);
  const [confirmPwdA, setConfirmPwdA] = useState('');

  // خيار 2: رقم ولي الأمر
  const [parentPhoneInput, setParentPhoneInput] = useState('');
  const [newPwdB, setNewPwdB] = useState('');
  const [showNewPwdB, setShowNewPwdB] = useState(false);
  const [confirmPwdB, setConfirmPwdB] = useState('');

  // فحص هل يجب ظهور النافذة
  if (!student || student.archived || !firebaseUser) return null;
  if (isPasswordResetDone(student.id) || isPasswordResetDone(student.phone)) return null;

  // 1. إعادة التعيين بكلمة المرور القديمة
  const handleOldPwdSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!oldPwd) {
      setError('من فضلك اكتب كلمة المرور الحالية.');
      return;
    }
    if (newPwdA.length < 8) {
      setError('كلمة المرور الجديدة يجب أن تكون 8 أحرف أو أرقام على الأقل.');
      return;
    }
    if (newPwdA !== confirmPwdA) {
      setError('كلمتا المرور الجديدتان غير متطابقتين.');
      return;
    }

    setLoading(true);
    try {
      // إعادة المصادقة للتأكد من كلمة المرور القديمة
      const userEmail = firebaseUser.email || `${student.phone}@student.youssefbarakat.com`;
      const cred = EmailAuthProvider.credential(userEmail, oldPwd);
      await reauthenticateWithCredential(firebaseUser, cred);

      // تحديث كلمة المرور في Firebase Auth
      await updatePassword(firebaseUser, newPwdA);

      // حفظ كلمة المرور للأدمن وتسجيل اكتمال العملية
      setStoredAdminPassword(student.id, newPwdA, student.phone);
      markPasswordResetDone(student.id);
      if (student.phone) markPasswordResetDone(student.phone);

      showToast('تم تحديث كلمة المرور بنجاح! حسابك آمن الآن.', 'success');
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('كلمة المرور الحالية غير صحيحة. إن كنت لا تتذكرها، يمكنك اختيار التحقق برقم ولي الأمر.');
      } else {
        setError('حدث خطأ أثناء التحديث. تأكد من اتصالك بالإنترنت وحاول مجدداً.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. إعادة التعيين برقم ولي الأمر
  const handleParentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const normParent = normalizePhone(parentPhoneInput);
    const normStudent = normalizePhone(student.phone);

    if (!normParent || !isValidEgyptPhone(normParent)) {
      setError('يجب كتابة رقم ولي الأمر صحيحاً (11 رقماً يبدأ بـ 01).');
      return;
    }

    if (normStudent && normParent === normStudent) {
      setError('رقم ولي الأمر يجب أن يكون مختلفاً تماماً عن رقم هاتف الطالب.');
      return;
    }

    // التحقق من رقم ولي الأمر المسجل
    const registeredParent = normalizePhone(student.parentPhone || '');
    const hasRegisteredParent = registeredParent && isValidEgyptPhone(registeredParent);

    if (hasRegisteredParent && registeredParent !== normParent) {
      setError('رقم ولي الأمر غير مطابق للرقم المسجل في حسابك. يرجى إدخال رقم ولي أمرك المسجل للمتابعة.');
      return;
    }

    if (newPwdB.length < 8) {
      setError('كلمة المرور الجديدة يجب أن تكون 8 أحرف أو أرقام على الأقل.');
      return;
    }
    if (newPwdB !== confirmPwdB) {
      setError('كلمتا المرور الجديدتان غير متطابقتين.');
      return;
    }

    setLoading(true);
    try {
      // إذا لم يكن رقم ولي الأمر مسجلاً مسبقاً في قاعدة البيانات، نقوم بتسجيله الآن فوراً
      if (!hasRegisteredParent) {
        try {
          await updateStudentProfile(student.id, { parentPhone: normParent });
        } catch {
          // ignore profile update failure
        }
      }

      // تحديث كلمة المرور في Firebase Auth
      await updatePassword(firebaseUser, newPwdB);

      // حفظ كلمة المرور للأدمن وتسجيل اكتمال العملية
      setStoredAdminPassword(student.id, newPwdB, student.phone);
      markPasswordResetDone(student.id);
      if (student.phone) markPasswordResetDone(student.phone);

      showToast('تم تأكيد بيانات ولي الأمر وتحديث كلمة المرور بنجاح!', 'success');
    } catch {
      setError('تعذر تحديث كلمة المرور. تأكد من اتصالك بالإنترنت أو أعد المحاولة بعد قليل.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={() => {
        // إلزامي: لا يمكن الإغلاق
      }}
      title="تحديث أمني إلزامي لكلمة المرور"
      closeOnOverlay={false}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 leading-relaxed">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
          <p>
            حرصاً على أمان حسابك الدراسي وتأكيد بياناتك، يرجى تحديث كلمة المرور لمرة واحدة فقط للمتابعة. لن يستغرق ذلك سوى دقيقة واحدة.
          </p>
        </div>

        {error && <FormAlert type="error">{error}</FormAlert>}

        {mode === 'choose' && (
          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setError('');
                setMode('old-pwd');
              }}
              className="flex w-full items-start gap-3.5 rounded-xl border border-theme-border bg-theme-surface-hover/60 p-4 text-right transition-all hover:border-gold-400/60 hover:bg-gold-500/10"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-500/15 text-gold-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-white">أعرف كلمة المرور الحالية</p>
                <p className="mt-1 text-xs text-slate-400">اكتب كلمة المرور الحالية ثم حدد كلمة مرورك الجديدة.</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setError('');
                setMode('parent-phone');
              }}
              className="flex w-full items-start gap-3.5 rounded-xl border border-theme-border bg-theme-surface-hover/60 p-4 text-right transition-all hover:border-gold-400/60 hover:bg-gold-500/10"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-500/15 text-gold-400">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-white">نسيت كلمة المرور؟ (التحقق برقم ولي الأمر)</p>
                <p className="mt-1 text-xs text-slate-400">اكتب رقم هاتف ولي أمرك لتأكيد هويتك وتعيين كلمة مرور جديدة مباشرة.</p>
              </div>
            </button>
          </div>
        )}

        {mode === 'old-pwd' && (
          <form onSubmit={handleOldPwdSubmit} className="space-y-4 pt-1">
            <Input
              label="كلمة المرور الحالية"
              type={showOldPwd ? 'text' : 'password'}
              dir="ltr"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              rightElement={
                <button
                  type="button"
                  tabIndex={-1}
                  className="text-slate-400 hover:text-white"
                  onClick={() => setShowOldPwd(!showOldPwd)}
                >
                  {showOldPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <Input
              label="كلمة المرور الجديدة (8 أحرف أو أرقام على الأقل)"
              type={showNewPwdA ? 'text' : 'password'}
              dir="ltr"
              value={newPwdA}
              onChange={(e) => setNewPwdA(e.target.value)}
              rightElement={
                <button
                  type="button"
                  tabIndex={-1}
                  className="text-slate-400 hover:text-white"
                  onClick={() => setShowNewPwdA(!showNewPwdA)}
                >
                  {showNewPwdA ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <Input
              label="تأكيد كلمة المرور الجديدة"
              type="password"
              dir="ltr"
              value={confirmPwdA}
              onChange={(e) => setConfirmPwdA(e.target.value)}
            />

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" variant="primary" loading={loading} fullWidth>
                حفظ كلمة المرور الجديدة
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={() => {
                  setError('');
                  setMode('choose');
                }}
              >
                رجوع
              </Button>
            </div>
          </form>
        )}

        {mode === 'parent-phone' && (
          <form onSubmit={handleParentSubmit} className="space-y-4 pt-1">
            <Input
              label="رقم هاتف ولي الأمر (11 رقماً)"
              type="tel"
              dir="ltr"
              placeholder="01xxxxxxxxx"
              value={parentPhoneInput}
              onChange={(e) => setParentPhoneInput(e.target.value)}
            />

            <Input
              label="كلمة المرور الجديدة (8 أحرف أو أرقام على الأقل)"
              type={showNewPwdB ? 'text' : 'password'}
              dir="ltr"
              value={newPwdB}
              onChange={(e) => setNewPwdB(e.target.value)}
              rightElement={
                <button
                  type="button"
                  tabIndex={-1}
                  className="text-slate-400 hover:text-white"
                  onClick={() => setShowNewPwdB(!showNewPwdB)}
                >
                  {showNewPwdB ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <Input
              label="تأكيد كلمة المرور الجديدة"
              type="password"
              dir="ltr"
              value={confirmPwdB}
              onChange={(e) => setConfirmPwdB(e.target.value)}
            />

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" variant="primary" loading={loading} fullWidth>
                تأكيد وتحديث كلمة المرور
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={() => {
                  setError('');
                  setMode('choose');
                }}
              >
                رجوع
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

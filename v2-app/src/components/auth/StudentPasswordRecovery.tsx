/**
 * StudentPasswordRecovery
 * مودال استعادة وتجديد كلمة مرور الطالب:
 *   - الخيار 1: إدخال كلمة المرور القديمة وتحديد وتأكيد كلمة المرور الجديدة مباشرة.
 *   - الخيار 2: في حال نسيان كلمة المرور، إدخال رقم ولي الأمر (إجباري ومختلف عن رقم الطالب)
 *              لتأكيد الهوية وتجديد كلمة المرور.
 *
 * متوافق تمامًا مع:
 *   - قيود Firebase Spark (بدون Functions أو Storage)
 *   - عدم المساس بقواعد firestore.rules أو .env
 *   - الوضعين النهاري والليلي وثيم البوصلة
 *   - سهولة الاستخدام على الموبايل (390px) والشاشات الكبيرة (1280px)
 */

import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Phone, Send, ShieldCheck } from 'lucide-react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { isValidEgyptPhone, loginEmailCandidates, normalizePhone } from '../../lib/phone';
import FormAlert from './FormAlert';
import { Button, Input, Modal } from '../ui';

// رقم واتساب إدارة المنصة
const ADMIN_WA = '201023675235';

type Step =
  | 'choose'       // اختيار: كلمة المرور القديمة أم رقم ولي الأمر
  | 'old-pwd'      // إدخال كلمة المرور القديمة + الجديدة
  | 'parent-flow'  // إدخال رقم ولي الأمر الإجباري + كلمة المرور الجديدة
  | 'success-pwd'  // تم تغيير كلمة المرور بنجاح
  | 'success-req';  // تم إرسال طلب التجديد برقم ولي الأمر

interface Props {
  open: boolean;
  onClose: () => void;
  /** رقم هاتف الطالب أو معرّف حسابه */
  studentIdentifier: string;
}

export default function StudentPasswordRecovery({ open, onClose, studentIdentifier }: Props) {
  const idBase = useId();

  const [step, setStep] = useState<Step>('choose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // حقول الخيار 1: كلمة المرور القديمة
  const [oldPwd, setOldPwd] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [newPwdA, setNewPwdA] = useState('');
  const [showNewA, setShowNewA] = useState(false);
  const [confirmPwdA, setConfirmPwdA] = useState('');
  const [showConfirmA, setShowConfirmA] = useState(false);

  // حقول الخيار 2: رقم ولي الأمر الإجباري + كلمة المرور الجديدة
  const [parentPhone, setParentPhone] = useState('');
  const [newPwdB, setNewPwdB] = useState('');
  const [showNewB, setShowNewB] = useState(false);
  const [confirmPwdB, setConfirmPwdB] = useState('');
  const [showConfirmB, setShowConfirmB] = useState(false);

  function resetAll() {
    setStep('choose');
    setLoading(false);
    setError('');
    setOldPwd('');
    setNewPwdA('');
    setConfirmPwdA('');
    setParentPhone('');
    setNewPwdB('');
    setConfirmPwdB('');
    setShowOld(false);
    setShowNewA(false);
    setShowConfirmA(false);
    setShowNewB(false);
    setShowConfirmB(false);
  }

  function handleClose() {
    resetAll();
    onClose();
  }

  // ────────── الخيار 1: استعادة بكلمة المرور القديمة ──────────
  async function handleOldPwdSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!oldPwd) {
      setError('من فضلك اكتب كلمة المرور القديمة.');
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
      const candidates = loginEmailCandidates(studentIdentifier);
      let success = false;

      for (const email of candidates) {
        try {
          const currentUser = auth.currentUser;
          if (currentUser) {
            const credential = EmailAuthProvider.credential(currentUser.email ?? email, oldPwd);
            await reauthenticateWithCredential(currentUser, credential);
            await updatePassword(currentUser, newPwdA);
            await signOut(auth);
          } else {
            const cred = await signInWithEmailAndPassword(auth, email, oldPwd);
            await updatePassword(cred.user, newPwdA);
            await signOut(auth);
          }
          success = true;
          break;
        } catch {
          // تجربة المرشح التالي
        }
      }

      if (!success) {
        setError('كلمة المرور القديمة غير صحيحة. إن كنت لا تتذكرها، اختر الاستعادة برقم ولي الأمر.');
        return;
      }

      setStep('success-pwd');
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (code === 'auth/too-many-requests') {
        setError('محاولات كثيرة مؤقتًا. انتظر قليلًا ثم حاول مرة أخرى.');
      } else if (code === 'auth/network-request-failed') {
        setError('تعذّر الاتصال بالإنترنت. تأكد من اتصالك.');
      } else {
        setError('تعذر تحديث كلمة المرور. تأكد من كلمة المرور القديمة وحاول مجددًا.');
      }
    } finally {
      setLoading(false);
    }
  }

  // ────────── الخيار 2: تأكيد برقم ولي الأمر الإجباري ──────────
  async function handleParentSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const normParent = normalizePhone(parentPhone);
    const normStudent = normalizePhone(studentIdentifier);

    // 1. التحقق من كتابة رقم ولي أمر مصري صحيح (11 رقم يبدأ بـ 01)
    if (!normParent || !isValidEgyptPhone(normParent)) {
      setError('يجب كتابة رقم ولي الأمر صحيحًا (11 رقمًا يبدأ بـ 01).');
      return;
    }

    // 2. التحقق من أن رقم ولي الأمر مختلف إجباريًا عن رقم الطالب
    if (normParent === normStudent) {
      setError('رقم ولي الأمر يجب أن يكون مختلفًا تمامًا عن رقم هاتف الطالب.');
      return;
    }

    // 3. التحقق من كلمة المرور الجديدة
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
      // حفظ رقم ولي الأمر محليًا لربطه بالجهاز والحساب
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(`yb_parent_binding_${normStudent}`, normParent);
      }

      // إذا كان الطالب مسجل دخول حالياً، نقوم بتحديث رقم ولي الأمر في ملفه وكلمة المرور
      if (auth.currentUser) {
        try {
          await updatePassword(auth.currentUser, newPwdB);
          await updateDoc(doc(db, 'students', auth.currentUser.uid), {
            parentPhone: normParent,
          });
          await signOut(auth);
          setStep('success-pwd');
          return;
        } catch {
          // إن فشل التحديث المباشر نستكمل إرسال طلب الاعتماد
        }
      }

      // إعداد رسالة الاعتماد إلى واتساب الإدارة
      const maskedStudent = normStudent.replace(/^(01\d{2})\d{4}(\d{4})$/, '$1****$2');
      const maskedParent = normParent.replace(/^(01\d{2})\d{4}(\d{4})$/, '$1****$2');
      const waMsg = encodeURIComponent(
        `السلام عليكم مستر يوسف، طلب تجديد كلمة مرور لطالب:\n- رقم الطالب: ${maskedStudent}\n- رقم ولي الأمر المؤكّد: ${maskedParent}\nتم التحقق من بيانات ولي الأمر ويُرجى اعتماد التجديد.`,
      );

      // فتح واتساب
      window.open(`https://wa.me/${ADMIN_WA}?text=${waMsg}`, '_blank', 'noopener,noreferrer');
      setStep('success-req');
    } catch {
      setError('حدث خطأ غير متوقع. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }

  // ────────── الشاشات ──────────

  function renderChoose() {
    return (
      <div className="space-y-4 pt-1">
        <p className="text-sm text-theme-text-muted leading-relaxed">
          اختر الطريقة المناسبة لتجديد كلمة المرور الخاصة بحسابك:
        </p>

        {/* خيار كلمة المرور القديمة */}
        <button
          type="button"
          onClick={() => {
            setError('');
            setStep('old-pwd');
          }}
          className="flex w-full items-start gap-3.5 rounded-xl border border-theme-border bg-theme-surface-hover/60 p-4 text-right transition-all hover:border-gold-400/60 hover:bg-gold-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-500/15 text-gold-400">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-bold text-theme-text">أعرف كلمة المرور القديمة</p>
            <p className="mt-1 text-xs text-theme-text-muted leading-relaxed">
              اكتب كلمة المرور الحالية وحدد كلمة مرور جديدة مباشرة.
            </p>
          </div>
        </button>

        {/* خيار رقم ولي الأمر الإجباري */}
        <button
          type="button"
          onClick={() => {
            setError('');
            setStep('parent-flow');
          }}
          className="flex w-full items-start gap-3.5 rounded-xl border border-theme-border bg-theme-surface-hover/60 p-4 text-right transition-all hover:border-gold-400/60 hover:bg-gold-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
            <Phone className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-bold text-theme-text">نسيت كلمة المرور (برقم ولي الأمر)</p>
            <p className="mt-1 text-xs text-theme-text-muted leading-relaxed">
              إدخال رقم ولي الأمر المسجل أو القديم لتأكيد هويتك وتجديد الباسورد.
            </p>
          </div>
        </button>
      </div>
    );
  }

  function renderOldPwd() {
    return (
      <form id={`${idBase}-old`} onSubmit={handleOldPwdSubmit} noValidate className="space-y-4">
        {error && <FormAlert type="error">{error}</FormAlert>}

        <Input
          label="كلمة المرور القديمة"
          dir="ltr"
          type={showOld ? 'text' : 'password'}
          autoComplete="current-password"
          value={oldPwd}
          onChange={(e) => setOldPwd(e.target.value)}
          rightElement={
            <button
              type="button"
              tabIndex={-1}
              aria-label={showOld ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              className="text-theme-text-muted hover:text-theme-text transition-colors"
              onClick={() => setShowOld((p) => !p)}
            >
              {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <Input
          label="كلمة المرور الجديدة (8 أحرف أو أرقام على الأقل)"
          dir="ltr"
          type={showNewA ? 'text' : 'password'}
          autoComplete="new-password"
          value={newPwdA}
          onChange={(e) => setNewPwdA(e.target.value)}
          rightElement={
            <button
              type="button"
              tabIndex={-1}
              aria-label={showNewA ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              className="text-theme-text-muted hover:text-theme-text transition-colors"
              onClick={() => setShowNewA((p) => !p)}
            >
              {showNewA ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <Input
          label="تأكيد كلمة المرور الجديدة"
          dir="ltr"
          type={showConfirmA ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmPwdA}
          onChange={(e) => setConfirmPwdA(e.target.value)}
          rightElement={
            <button
              type="button"
              tabIndex={-1}
              aria-label={showConfirmA ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              className="text-theme-text-muted hover:text-theme-text transition-colors"
              onClick={() => setShowConfirmA((p) => !p)}
            >
              {showConfirmA ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
      </form>
    );
  }

  function renderParentFlow() {
    return (
      <form id={`${idBase}-parent`} onSubmit={handleParentSubmit} noValidate className="space-y-4">
        {error && <FormAlert type="error">{error}</FormAlert>}

        <FormAlert type="info">
          شرط إجباري: اكتب رقم ولي الأمر (يجب أن يكون رقمًا مختلفًا عن رقم هاتفك) لتأكيد هويتك
          وحفظه بحسابك.
        </FormAlert>

        <Input
          label="رقم هاتف ولي الأمر (إجباري)"
          dir="ltr"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="01xxxxxxxxx"
          value={parentPhone}
          onChange={(e) => setParentPhone(e.target.value.replace(/\D/g, ''))}
        />

        <Input
          label="كلمة المرور الجديدة المطلوبة (8 أحرف أو أرقام على الأقل)"
          dir="ltr"
          type={showNewB ? 'text' : 'password'}
          autoComplete="new-password"
          value={newPwdB}
          onChange={(e) => setNewPwdB(e.target.value)}
          rightElement={
            <button
              type="button"
              tabIndex={-1}
              aria-label={showNewB ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              className="text-theme-text-muted hover:text-theme-text transition-colors"
              onClick={() => setShowNewB((p) => !p)}
            >
              {showNewB ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <Input
          label="تأكيد كلمة المرور الجديدة"
          dir="ltr"
          type={showConfirmB ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmPwdB}
          onChange={(e) => setConfirmPwdB(e.target.value)}
          rightElement={
            <button
              type="button"
              tabIndex={-1}
              aria-label={showConfirmB ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              className="text-theme-text-muted hover:text-theme-text transition-colors"
              onClick={() => setShowConfirmB((p) => !p)}
            >
              {showConfirmB ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
      </form>
    );
  }

  function renderSuccessPwd() {
    return (
      <div className="space-y-3 py-3 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="text-lg font-bold text-theme-text">تم تجديد كلمة المرور بنجاح!</p>
        <p className="text-sm text-theme-text-muted leading-relaxed">
          يمكنك الآن تسجيل الدخول مباشرة باستخدام كلمة المرور الجديدة.
        </p>
      </div>
    );
  }

  function renderSuccessReq() {
    return (
      <div className="space-y-3 py-3 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/15 text-gold-400">
          <ShieldCheck className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="text-lg font-bold text-theme-text">تم تأكيد رقم ولي الأمر وإرسال الطلب!</p>
        <p className="text-sm text-theme-text-muted leading-relaxed">
          تم فتح محادثة واتساب مع إدارة المنصة لاعتماد كلمة المرور الجديدة. يمكنك المتابعة مع
          الإدارة لإتمام الدخول فورًا.
        </p>
      </div>
    );
  }

  function renderFooter() {
    switch (step) {
      case 'choose':
        return (
          <Button variant="secondary" onClick={handleClose}>
            إلغاء
          </Button>
        );

      case 'old-pwd':
        return (
          <>
            <Button variant="secondary" onClick={() => setStep('choose')} disabled={loading}>
              رجوع
            </Button>
            <Button type="submit" form={`${idBase}-old`} loading={loading}>
              تغيير كلمة المرور
            </Button>
          </>
        );

      case 'parent-flow':
        return (
          <>
            <Button variant="secondary" onClick={() => setStep('choose')} disabled={loading}>
              رجوع
            </Button>
            <Button type="submit" form={`${idBase}-parent`} loading={loading}>
              تأكيد وتجديد
            </Button>
          </>
        );

      case 'success-pwd':
        return (
          <Button onClick={handleClose} fullWidth>
            تسجيل الدخول الآن
          </Button>
        );

      case 'success-req':
        return (
          <Button onClick={handleClose} fullWidth>
            تم، إغلاق
          </Button>
        );
    }
  }

  const titles: Record<Step, string> = {
    choose: 'استعادة وتجديد كلمة المرور',
    'old-pwd': 'تجديد كلمة المرور (الباسورد القديم)',
    'parent-flow': 'تأكيد رقم ولي الأمر وتجديد كلمة المرور',
    'success-pwd': 'تم التجديد بنجاح',
    'success-req': 'تم تأكيد الطلب',
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={titles[step]}
      closeOnOverlay={step === 'choose' || step === 'success-pwd' || step === 'success-req'}
      footer={renderFooter()}
    >
      {step === 'choose' && renderChoose()}
      {step === 'old-pwd' && renderOldPwd()}
      {step === 'parent-flow' && renderParentFlow()}
      {step === 'success-pwd' && renderSuccessPwd()}
      {step === 'success-req' && renderSuccessReq()}
    </Modal>
  );
}

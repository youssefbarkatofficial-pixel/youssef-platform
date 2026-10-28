import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import AccountProblemScreen from '../../components/auth/AccountProblemScreen';
import FormAlert from '../../components/auth/FormAlert';
import StudentPasswordRecovery from '../../components/auth/StudentPasswordRecovery';
import { Button, Card, Input, Spinner } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { isStudentEmail, loginEmailCandidates, toEnglishDigits } from '../../lib/phone';
import { getAuthErrorMessage, loginWithIdentifier } from '../../services/auth';

/** الأكواد التي تعني خطأ في كلمة المرور أو الحساب (تُظهر زر الاستعادة للطلاب) */
const PASSWORD_ERROR_CODES = new Set([
  'auth/wrong-password',
  'auth/invalid-credential',
  'auth/user-not-found',
  'auth/invalid-email',
]);

function isStudentIdentifier(id: string): boolean {
  if (!id) return false;
  if (id.includes('@')) return isStudentEmail(id);
  // رقم موبايل → أول صيغة ستحمل دومين الطالب
  const candidates = loginEmailCandidates(id);
  return candidates.length > 0 && isStudentEmail(candidates[0]);
}

export default function LoginPage() {
  const { firebaseUser, student, isAdmin, loading, profileError } = useAuth();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);

  const state = location.state as { from?: string } | null;
  const from = state?.from && state.from.startsWith('/student') ? state.from : '/student';

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-gold-400">
        <Spinner size="lg" />
      </div>
    );
  }

  if (student) {
    return student.archived ? (
      <AccountProblemScreen reason="archived" />
    ) : (
      <Navigate to={from} replace />
    );
  }

  if (isAdmin) return <Navigate to="/admin" replace />;

  if (firebaseUser) {
    return <AccountProblemScreen reason={profileError ? 'load-error' : 'incomplete'} />;
  }

  const cleanIdentifier = () => {
    const trimmed = identifier.trim();
    return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const id = cleanIdentifier();
    if (!id || !password) {
      setFormError('اكتب رقم الموبايل (أو البريد الإلكتروني) وكلمة المرور.');
      return;
    }

    setSubmitting(true);
    try {
      await loginWithIdentifier(id, password);
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code: unknown }).code)
          : '';

      setFormError(getAuthErrorMessage(error, id));

      // لو الخطأ في كلمة المرور وكان المستخدم طالبًا → أظهر زر الاستعادة تحت رسالة الخطأ
      if (PASSWORD_ERROR_CODES.has(code) && isStudentIdentifier(id)) {
        setFormError(
          'رقم الموبايل أو كلمة المرور غير صحيحة. يمكنك استعادة كلمة المرور من الزر أدناه.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotClick = (e: React.MouseEvent) => {
    const id = cleanIdentifier();
    // لو المعرّف يبدو طالبًا → نفتح المودال مباشرة بدلاً من الانتقال لصفحة نسيت كلمة المرور
    if (id && isStudentIdentifier(id)) {
      e.preventDefault();
      setShowRecovery(true);
    }
    // لو إيميل عادي (أدمن/مدرس) → نكمّل الـ Link للصفحة العادية
  };

  const id = cleanIdentifier();
  const showRecoveryButton =
    !!formError && !!id && isStudentIdentifier(id);

  return (
    <>
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <Card>
          <h1 className="text-2xl font-extrabold text-white">تسجيل الدخول</h1>
          <p className="mt-1.5 text-sm text-slate-400">أهلًا بعودتك! ادخل لتكمل مذاكرتك.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            {formError && <FormAlert type="error">{formError}</FormAlert>}

            {/* زر استعادة كلمة المرور — يظهر فقط للطلاب بعد فشل الدخول */}
            {showRecoveryButton && (
              <button
                type="button"
                className="w-full rounded-xl border border-gold-400/50 bg-gold-500/10 px-4 py-2.5 text-sm font-bold text-gold-300 transition-colors hover:bg-gold-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                onClick={() => setShowRecovery(true)}
              >
                استعادة كلمة المرور
              </button>
            )}

            <Input
              label="رقم الموبايل أو البريد الإلكتروني"
              dir="ltr"
              type={identifier.includes('@') ? 'email' : 'text'}
              inputMode={identifier.includes('@') ? 'email' : 'text'}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              value={identifier}
              onChange={(event) => setIdentifier(toEnglishDigits(event.target.value))}
            />

            <Input
              label="كلمة المرور"
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              rightElement={
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  className="text-slate-400 hover:text-white transition-colors"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <div className="text-end">
              <Link
                to="/forgot-password"
                className="text-sm font-bold text-gold-400 hover:text-gold-300"
                onClick={handleForgotClick}
              >
                نسيت كلمة المرور؟
              </Link>
            </div>

            <Button type="submit" size="lg" fullWidth loading={submitting}>
              دخول
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-400">
            ليس لديك حساب؟{' '}
            <Link to="/register" className="font-bold text-gold-400 hover:text-gold-300">
              أنشئ حسابًا جديدًا
            </Link>
          </p>
        </Card>
      </div>

      {/* مودال استعادة كلمة المرور للطلاب */}
      <StudentPasswordRecovery
        open={showRecovery}
        onClose={() => setShowRecovery(false)}
        studentIdentifier={cleanIdentifier()}
      />
    </>
  );
}

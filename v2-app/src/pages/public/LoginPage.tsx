import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import AccountProblemScreen from '../../components/auth/AccountProblemScreen';
import FormAlert from '../../components/auth/FormAlert';
import { Button, Card, Input, Spinner } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { toEnglishDigits } from '../../lib/phone';
import { getAuthErrorMessage, loginWithIdentifier } from '../../services/auth';

export default function LoginPage() {
  const { firebaseUser, student, isAdmin, loading, profileError } = useAuth();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const trimmed = identifier.trim();
    const cleanIdentifier = trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
    if (!cleanIdentifier || !password) {
      setFormError('اكتب رقم الموبايل (أو البريد الإلكتروني) وكلمة المرور.');
      return;
    }

    setSubmitting(true);
    try {
      await loginWithIdentifier(cleanIdentifier, password);
    } catch (error) {
      setFormError(getAuthErrorMessage(error, cleanIdentifier));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <Card>
        <h1 className="text-2xl font-extrabold text-white">تسجيل الدخول</h1>
        <p className="mt-1.5 text-sm text-slate-400">أهلًا بعودتك! ادخل لتكمل مذاكرتك.</p>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          {formError && <FormAlert type="error">{formError}</FormAlert>}

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
  );
}

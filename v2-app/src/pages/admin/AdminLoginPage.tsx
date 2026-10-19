import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import AccountProblemScreen from '../../components/auth/AccountProblemScreen';
import FormAlert from '../../components/auth/FormAlert';
import Brand from '../../components/layout/Brand';
import FullScreenLoader from '../../components/layout/FullScreenLoader';
import { Button, Card, Input } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { getAuthErrorMessage, loginWithIdentifier } from '../../services/auth';

function getAdminErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email'
  ) {
    return 'اتأكد إن الإيميل مكتوب صح بدون مسافات أو حروف كبيرة، أو استخدم نسيت كلمة المرور.';
  }

  return getAuthErrorMessage(error, 'admin@domain.com');
}

export default function AdminLoginPage() {
  const { firebaseUser, isAdmin, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  if (loading) return <FullScreenLoader />;

  if (isAdmin) return <Navigate to="/admin" replace />;

  if (firebaseUser) return <AccountProblemScreen reason="not-admin" />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !password) {
      setFormError('اكتب البريد الإلكتروني الخاص بحساب الإدارة وكلمة المرور.');
      return;
    }

    setSubmitting(true);
    try {
      await loginWithIdentifier(cleanEmail, password);
    } catch (error) {
      setFormError(getAdminErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>

        <Card>
          <h1 className="text-2xl font-extrabold text-white">دخول الإدارة</h1>
          <p className="mt-1.5 text-sm text-slate-400">هذه الصفحة خاصة بالمدرس والأدمن فقط.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            {formError && <FormAlert type="error">{formError}</FormAlert>}

            <Input
              label="البريد الإلكتروني"
              type="email"
              inputMode="email"
              dir="ltr"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
            <Link to="/" className="font-bold text-gold-400 hover:text-gold-300">
              العودة للموقع
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

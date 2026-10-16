import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import FormAlert from '../../components/auth/FormAlert';
import { Button, Card, Input } from '../../components/ui';
import { isStudentEmail, toEnglishDigits } from '../../lib/phone';
import { getAuthErrorMessage, sendResetEmail } from '../../services/auth';

interface Message {
  type: 'error' | 'success' | 'info';
  text: string;
}

const STUDENT_NOTICE =
  'حسابات الطلاب مرتبطة برقم الموبايل، ولا يمكن إرسال رسالة استعادة لها. تواصل مع إدارة المنصة ليعيدوا تعيين كلمة المرور لك.';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const value = identifier.trim();
    if (!value) {
      setMessage({ type: 'error', text: 'اكتب رقم الموبايل أو البريد الإلكتروني.' });
      return;
    }

    // الطلاب: الإيميل وهمي (رقم@student...) فلا يصله أي بريد.
    if (!value.includes('@') || isStudentEmail(value)) {
      setMessage({ type: 'info', text: STUDENT_NOTICE });
      return;
    }

    setSubmitting(true);
    try {
      await sendResetEmail(value);
      setMessage({
        type: 'success',
        text: 'إن كان هذا البريد مسجّلًا لدينا فستصلك رسالة لإعادة تعيين كلمة المرور خلال دقائق. راجع أيضًا البريد المزعج.',
      });
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code: unknown }).code)
          : '';
      setMessage({
        type: 'error',
        text:
          code === 'auth/invalid-email'
            ? 'اكتب بريدًا إلكترونيًا صحيحًا.'
            : getAuthErrorMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <Card>
        <h1 className="text-2xl font-extrabold text-white">استعادة كلمة المرور</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          اكتب رقم الموبايل (للطلاب) أو البريد الإلكتروني (للإدارة).
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          {message && <FormAlert type={message.type}>{message.text}</FormAlert>}

          <Input
            label="رقم الموبايل أو البريد الإلكتروني"
            dir="ltr"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(toEnglishDigits(event.target.value))}
          />

          <Button type="submit" size="lg" fullWidth loading={submitting}>
            متابعة
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          تذكرت كلمة المرور؟{' '}
          <Link to="/login" className="font-bold text-gold-400 hover:text-gold-300">
            تسجيل الدخول
          </Link>
        </p>
      </Card>
    </div>
  );
}

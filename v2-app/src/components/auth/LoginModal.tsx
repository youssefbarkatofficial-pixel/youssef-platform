import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, LogIn } from 'lucide-react';
import { Button, Input } from '../ui';
import FormAlert from './FormAlert';
import { toEnglishDigits } from '../../lib/phone';
import { auth } from '../../lib/firebase';
import { getAdminRole } from '../../services/admins';
import { getStudent } from '../../services/students';
import { getAuthErrorMessage, loginWithIdentifier } from '../../services/auth';
import { useLocation } from 'react-router-dom';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const state = location.state as { from?: string } | null;
  const from = state?.from && state.from.startsWith('/student') ? state.from : '/student';

  // Focus trap, Escape key, and prevent body scroll
  useEffect(() => {
    if (!open) return;

    // Save previous active element to restore on close
    triggerRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Initial focus on input
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
      if (triggerRef.current) {
        triggerRef.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    if (!identifier.trim() || !password) {
      setFormError('اكتب رقم الموبايل (أو البريد الإلكتروني) وكلمة المرور.');
      return;
    }

    setSubmitting(true);
    try {
      await loginWithIdentifier(identifier, password);
      onClose();

      // نفس منطق LoginPage للتوجيه:
      const currentUser = auth.currentUser;
      const adminRole = currentUser ? await getAdminRole(currentUser.email) : null;
      if (adminRole !== null) {
        navigate('/admin', { replace: true });
      } else {
        const studentProfile = currentUser
          ? await getStudent(currentUser.uid).catch(() => null)
          : null;
        if (studentProfile?.archived) {
          navigate('/login', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      }
    } catch (error) {
      setFormError(getAuthErrorMessage(error, identifier));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="تسجيل الدخول"
        className="w-full max-w-md rounded-3xl bg-theme-surface p-6 text-theme-text shadow-2xl transition-all duration-300 animate-in zoom-in-95"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-theme-gold/15 text-theme-gold">
              <LogIn className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-theme-text">تسجيل الدخول</h2>
              <p className="text-xs text-theme-text-muted">أهلًا بعودتك! ادخل لتتابع مذاكرتك.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="grid h-8 w-8 place-items-center rounded-full text-theme-text-muted hover:bg-theme-surface-hover hover:text-theme-text transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          {formError && <FormAlert type="error">{formError}</FormAlert>}

          <Input
            ref={inputRef}
            label="رقم الموبايل أو البريد الإلكتروني"
            dir="ltr"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(toEnglishDigits(event.target.value))}
          />

          <Input
            label="كلمة المرور"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <div className="flex items-center justify-between text-xs">
            <Link
              to="/forgot-password"
              onClick={onClose}
              className="font-bold text-theme-gold hover:underline"
            >
              نسيت كلمة المرور؟
            </Link>
            <Link
              to="/register"
              onClick={onClose}
              className="text-theme-text-secondary hover:text-theme-text"
            >
              ليس لديك حساب؟ <span className="font-bold text-theme-gold">إنشاء حساب</span>
            </Link>
          </div>

          <Button type="submit" size="lg" fullWidth loading={submitting}>
            دخول
          </Button>
        </form>
      </div>
    </div>
  );
}

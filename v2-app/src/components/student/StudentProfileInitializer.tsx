import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Button, Card, Input, Spinner } from '../ui';
import { isValidEgyptPhone, normalizePhone, phoneToEmail } from '../../lib/phone';
import { createStudentProfile } from '../../services/students';
import { logout } from '../../services/auth';
import FormAlert from '../auth/FormAlert';

interface Props {
  user: User;
  onComplete: () => Promise<void>;
}

/**
 * نافذة استكمال وتفعيل ملف الطالب تلقائيًا:
 * تحل محل رسالة "بيانات حسابك غير مكتملة" نهائيًا.
 * إذا كان رقم ولي الأمر محفوظًا مسبقًا في الذاكرة المحلية يتم التفعيل فورًا وبلا أي توقف،
 * وإلا يُطلب من الطالب إدخال رقم ولي أمره وتأكيده للدخول فوراً.
 */
export default function StudentProfileInitializer({ user, onComplete }: Props) {
  const [parentPhone, setParentPhone] = useState('');
  const [confirmPhone, setConfirmPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoInitializing, setAutoInitializing] = useState(true);
  const [error, setError] = useState('');

  const rawPhone = user.email ? user.email.replace(/@.*$/, '') : '';
  const normStudent = normalizePhone(rawPhone);

  useEffect(() => {
    let active = true;

    async function tryAutoHeal() {
      if (!normStudent || !isValidEgyptPhone(normStudent)) {
        if (active) setAutoInitializing(false);
        return;
      }

      const cachedParent =
        typeof window !== 'undefined'
          ? localStorage.getItem(`yb_parent_binding_${normStudent}`)
          : null;

      const normCached = cachedParent ? normalizePhone(cachedParent) : '';

      if (normCached && isValidEgyptPhone(normCached) && normCached !== normStudent) {
        try {
          await createStudentProfile({
            uid: user.uid,
            name: 'طالب',
            phone: normStudent,
            parentPhone: normCached,
            grade: 'prep3',
            gov: 'القاهرة',
            email: phoneToEmail(normStudent),
          });
          if (active) {
            await onComplete();
            return;
          }
        } catch {
          // في حال حدوث خطأ، نعرض واجهة الإدخال اليدوية
        }
      }

      if (active) {
        setAutoInitializing(false);
      }
    }

    void tryAutoHeal();

    return () => {
      active = false;
    };
  }, [user.uid, normStudent, onComplete]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const normParent = normalizePhone(parentPhone);
    const normConfirm = normalizePhone(confirmPhone);

    if (!normParent || !isValidEgyptPhone(normParent)) {
      setError('يجب كتابة رقم هاتف ولي الأمر صحيحاً (11 رقماً يبدأ بـ 01).');
      return;
    }

    if (normParent !== normConfirm) {
      setError('الأرقام غير متطابقة، حاول تاني.');
      return;
    }

    if (normStudent && normParent === normStudent) {
      setError('رقم ولي الأمر يجب أن يكون مختلفاً تماماً عن رقم الطالب.');
      return;
    }

    setLoading(true);
    try {
      const emailToUse = isValidEgyptPhone(normStudent)
        ? phoneToEmail(normStudent)
        : user.email || `${normStudent}@student.youssefbarakat.com`;

      await createStudentProfile({
        uid: user.uid,
        name: 'طالب',
        phone: isValidEgyptPhone(normStudent) ? normStudent : '01000000000',
        parentPhone: normParent,
        grade: 'prep3',
        gov: 'القاهرة',
        email: emailToUse,
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem(`yb_parent_binding_${normStudent}`, normParent);
      }

      await onComplete();
    } catch {
      setError('تعذر حفظ البيانات وتفعيل الحساب. تأكد من اتصالك بالإنترنت وحاول مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  if (autoInitializing) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-gold-400">
        <div className="text-center space-y-3">
          <Spinner size="lg" />
          <p className="text-sm font-bold text-theme-text-muted">جاري تفعيل وفتح حسابك...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid min-h-[70vh] w-full max-w-md place-items-center px-4 py-8">
      <Card className="w-full">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gold-500/15 text-gold-400">
          <ShieldCheck className="h-7 w-7" />
        </div>

        <h1 className="text-center text-xl font-extrabold text-theme-text">استكمال تفعيل حسابك</h1>
        <p className="mt-2 text-center text-xs leading-relaxed text-theme-text-muted">
          أهلاً بك يا بطل! لمتابعة مستواك الدراسي وأمان حسابك، اكتب رقم ولي أمرك وتأكيده للدخول فوراً إلى المنصة.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <FormAlert type="error">{error}</FormAlert>}

          <Input
            label="رقم هاتف ولي الأمر (11 رقماً)"
            type="tel"
            dir="ltr"
            placeholder="01xxxxxxxxx"
            autoComplete="tel"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
          />

          <Input
            label="تأكيد رقم هاتف ولي الأمر (أعد كتابته)"
            type="tel"
            dir="ltr"
            placeholder="01xxxxxxxxx"
            autoComplete="tel"
            value={confirmPhone}
            onChange={(e) => setConfirmPhone(e.target.value)}
          />

          <Button type="submit" variant="primary" loading={loading} fullWidth>
            حفظ ودخول المنصة فوراً
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => void logout()}
            fullWidth
            className="gap-2 text-xs text-theme-text-muted hover:text-rose-400"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </Button>
        </form>
      </Card>
    </div>
  );
}

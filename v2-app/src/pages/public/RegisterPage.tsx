import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import PasswordStrength from '../../components/auth/PasswordStrength';
import { Button, Card, Input, Select, useToast } from '../../components/ui';
import { cn } from '../../components/ui/cn';
import { useAuth } from '../../hooks/useAuth';
import { GOVERNORATE_OPTIONS, OUTSIDE_EGYPT } from '../../lib/governorates';
import { GRADE_OPTIONS, isGradeCode, isSecondaryGrade } from '../../lib/grades';
import type { GradeTrack } from '../../lib/grades';
import { isValidEgyptPhone, toEnglishDigits } from '../../lib/phone';
import { isPasswordValid, isValidPersonName } from '../../lib/validation';
import { getAuthErrorMessage, registerStudent } from '../../services/auth';
import { markPasswordResetDone, setStoredAdminPassword } from '../../lib/studentPasswords';
import { auth } from '../../lib/firebase';
import { getGeneralSettings } from '../../services/settings';

interface FormState {
  firstName: string;
  middleName: string;
  lastName: string;
  phone: string;
  parentPhone: string;
  grade: string;
  track: GradeTrack | '';
  gov: string;
  country: string;
  password: string;
  confirmPassword: string;
}

type FieldName = keyof FormState;
type FormErrors = Partial<Record<FieldName, string>>;

const initialForm: FormState = {
  firstName: '',
  middleName: '',
  lastName: '',
  phone: '',
  parentPhone: '',
  grade: '',
  track: '',
  gov: '',
  country: '',
  password: '',
  confirmPassword: '',
};

// أرقام إنجليزية فقط (مع تحويل الأرقام العربية تلقائيًا).
function digitsOnly(value: string): string {
  return toEnglishDigits(value).replace(/[^0-9]/g, '');
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!isValidPersonName(form.firstName)) errors.firstName = 'اكتب الاسم الأول (حرفان على الأقل)';
  if (!isValidPersonName(form.middleName)) errors.middleName = 'اكتب الاسم الأوسط (حرفان على الأقل)';
  if (!isValidPersonName(form.lastName)) errors.lastName = 'اكتب الاسم الأخير (حرفان على الأقل)';

  if (!isValidEgyptPhone(form.phone)) {
    errors.phone = 'اكتب رقم موبايل صحيحًا: 11 رقمًا يبدأ بـ 01';
  }
  if (!isValidEgyptPhone(form.parentPhone)) {
    errors.parentPhone = 'اكتب رقم ولي الأمر صحيحًا: 11 رقمًا يبدأ بـ 01';
  }

  if (!isGradeCode(form.grade)) {
    errors.grade = 'اختر الصف الدراسي';
  } else if (isSecondaryGrade(form.grade)) {
    if (!form.track) {
      errors.track = 'اختر المسار الدراسي';
    }
  }

  if (!form.gov) {
    errors.gov = 'اختر المحافظة';
  } else if (form.gov === OUTSIDE_EGYPT && form.country.trim().length < 2) {
    errors.country = 'اكتب اسم الدولة';
  }

  if (!isPasswordValid(form.password)) {
    errors.password = 'كلمة المرور لا تحقق الشروط الموضحة أسفل الحقل';
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'أكّد كلمة المرور';
  } else if (form.confirmPassword !== form.password) {
    errors.confirmPassword = 'كلمتا المرور غير متطابقتين';
  }

  return errors;
}

export default function RegisterPage() {
  const { student, isAdmin, refresh } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  // التسجيل مفتوح افتراضيًا. لو قفله الأدمن من الإعدادات نعرض رسالة بدل النموذج.
  const [registrationClosed, setRegistrationClosed] = useState(false);

  useEffect(() => {
    let active = true;
    void getGeneralSettings().then((settings) => {
      if (active) setRegistrationClosed(!settings.allowRegistration);
    });
    return () => {
      active = false;
    };
  }, []);

  if (student && !student.archived) return <Navigate to="/student" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;

  const setField = (field: FieldName, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const handleGradeChange = (gradeValue: string) => {
    let nextTrack: GradeTrack | '' = '';
    if (gradeValue === 'sec2' || gradeValue === 'sec3') {
      nextTrack = 'bacc';
    } else if (gradeValue === 'sec1') {
      nextTrack = form.track === 'general' || form.track === 'bacc' ? form.track : '';
    }
    setForm((previous) => ({ ...previous, grade: gradeValue, track: nextTrack }));
    setErrors((previous) => ({ ...previous, grade: undefined, track: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const grade = form.grade;
    if (!isGradeCode(grade)) return;

    setSubmitting(true);
    try {
      await registerStudent({
        name: [form.firstName, form.middleName, form.lastName]
          .map((part) => part.trim())
          .join(' '),
        phone: form.phone,
        parentPhone: form.parentPhone,
        grade,
        track: isSecondaryGrade(grade) ? (form.track as GradeTrack) : null,
        gov: form.gov === OUTSIDE_EGYPT ? form.country.trim() : form.gov,
        password: form.password,
      });
      if (auth.currentUser) {
        markPasswordResetDone(auth.currentUser.uid);
        setStoredAdminPassword(auth.currentUser.uid, form.password, form.phone);
      }
      markPasswordResetDone(form.phone);
      setStoredAdminPassword(form.phone, form.password, form.phone);
      await refresh();
      showToast('تم إنشاء حسابك بنجاح. أهلًا بك!', 'success');
      navigate('/student', { replace: true });
    } catch (error) {
      showToast(getAuthErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (registrationClosed) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-10">
        <Card className="text-center">
          <h1 className="text-2xl font-extrabold text-white">التسجيل مغلق حاليًا</h1>
          <p className="mt-2 text-slate-400">
            فتح باب التسجيل الجديد متوقف مؤقتًا. لو عندك حساب بالفعل يمكنك تسجيل الدخول.
          </p>
          <Link to="/login" className="mt-5 inline-block font-bold text-gold-400 hover:text-gold-300">
            تسجيل الدخول
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <Card>
        <h1 className="text-2xl font-extrabold text-white">إنشاء حساب جديد</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          سجّل بياناتك لتبدأ رحلتك التعليمية. كل الحقول مطلوبة.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="الاسم الأول"
              value={form.firstName}
              error={errors.firstName}
              autoComplete="given-name"
              onChange={(event) => setField('firstName', event.target.value)}
            />
            <Input
              label="الاسم الأوسط"
              value={form.middleName}
              error={errors.middleName}
              onChange={(event) => setField('middleName', event.target.value)}
            />
            <Input
              label="الاسم الأخير"
              value={form.lastName}
              error={errors.lastName}
              autoComplete="family-name"
              onChange={(event) => setField('lastName', event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="رقم الموبايل"
              dir="ltr"
              inputMode="numeric"
              maxLength={11}
              placeholder="01xxxxxxxxx"
              value={form.phone}
              error={errors.phone}
              autoComplete="tel"
              onChange={(event) => setField('phone', digitsOnly(event.target.value))}
            />
            <Input
              label="رقم ولي الأمر"
              dir="ltr"
              inputMode="numeric"
              maxLength={11}
              placeholder="01xxxxxxxxx"
              value={form.parentPhone}
              error={errors.parentPhone}
              onChange={(event) => setField('parentPhone', digitsOnly(event.target.value))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="الصف الدراسي"
              options={GRADE_OPTIONS}
              placeholder="اختر الصف"
              value={form.grade}
              error={errors.grade}
              onChange={(event) => handleGradeChange(event.target.value)}
            />
            <Select
              label="المحافظة"
              options={GOVERNORATE_OPTIONS}
              placeholder="اختر المحافظة"
              value={form.gov}
              error={errors.gov}
              onChange={(event) => setField('gov', event.target.value)}
            />
          </div>

          {form.grade === 'sec1' && (
            <div className="rounded-xl border border-navy-700 bg-navy-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">المسار الدراسي (الصف الأول الثانوي)</span>
                <span className="text-xs text-gold-400 font-medium">نفس المادة: تاريخ</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setField('track', 'general')}
                  className={cn(
                    'rounded-xl border p-3 text-center transition-all',
                    form.track === 'general'
                      ? 'border-gold-500 bg-gold-500/15 text-gold-300 font-bold shadow-sm'
                      : 'border-navy-700 bg-navy-900/60 text-slate-300 hover:border-slate-500',
                  )}
                >
                  أولى ثانوي عام
                </button>
                <button
                  type="button"
                  onClick={() => setField('track', 'bacc')}
                  className={cn(
                    'rounded-xl border p-3 text-center transition-all',
                    form.track === 'bacc'
                      ? 'border-gold-500 bg-gold-500/15 text-gold-300 font-bold shadow-sm'
                      : 'border-navy-700 bg-navy-900/60 text-slate-300 hover:border-slate-500',
                  )}
                >
                  أولى ثانوي بكالوريا
                </button>
              </div>
              {errors.track && <p className="text-xs text-red-400">{errors.track}</p>}
            </div>
          )}

          {form.grade === 'sec2' && (
            <div className="rounded-xl border border-navy-700 bg-navy-950/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">المسار: تانية ثانوي بكالوريا</span>
                <span className="rounded-md bg-gold-500/20 px-2.5 py-0.5 text-xs font-semibold text-gold-300">
                  بكالوريا
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                تاريخ بالمنهج الجديد، ولا يوجد جغرافيا.
              </p>
            </div>
          )}

          {form.grade === 'sec3' && (
            <div className="rounded-xl border border-navy-700 bg-navy-950/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">المسار: تالتة ثانوي بكالوريا</span>
                <span className="rounded-md bg-gold-500/20 px-2.5 py-0.5 text-xs font-semibold text-gold-300">
                  بكالوريا
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                المنهج الجديد من العام القادم.
              </p>
            </div>
          )}

          {form.gov === OUTSIDE_EGYPT && (
            <Input
              label="اسم الدولة"
              value={form.country}
              error={errors.country}
              onChange={(event) => setField('country', event.target.value)}
            />
          )}

          <div className="space-y-3">
            <Input
              label="كلمة المرور"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={form.password}
              error={errors.password}
              onChange={(event) => setField('password', event.target.value)}
            />
            <PasswordStrength password={form.password} />
          </div>

          <Input
            label="تأكيد كلمة المرور"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={form.confirmPassword}
            error={errors.confirmPassword}
            onChange={(event) => setField('confirmPassword', event.target.value)}
          />

          <Button type="submit" size="lg" fullWidth loading={submitting}>
            إنشاء الحساب
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          لديك حساب بالفعل؟{' '}
          <Link to="/login" className="font-bold text-gold-400 hover:text-gold-300">
            تسجيل الدخول
          </Link>
        </p>
      </Card>
    </div>
  );
}

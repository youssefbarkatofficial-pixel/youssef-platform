import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, Copy, ImageIcon, ServerCrash } from 'lucide-react';
import CoursePrice from '../../components/course/CoursePrice';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Spinner,
  Tabs,
  buttonClasses,
  useToast,
} from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCourse } from '../../hooks/useCourses';
import { PROOF_OPTIONS, compressImage, getImageErrorMessage } from '../../lib/image';
import type { CompressedImage } from '../../lib/image';
import { getPriceInfo } from '../../services/courses';
import {
  DEFAULT_PAYMENT_SETTINGS,
  getPaymentErrorMessage,
  getPaymentSettings,
  listMyPaymentRequests,
  submitPaymentRequest,
} from '../../services/payments';
import type { PaymentMethod, PaymentSettings } from '../../services/payments';

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card>{children}</Card>
    </div>
  );
}

export default function CheckoutPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { student } = useAuth();
  const { showToast } = useToast();
  const { course, loading, error, reload } = useCourse(courseId);

  const [settings, setSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [checking, setChecking] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>('vodafone');
  const [proof, setProof] = useState<CompressedImage | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [proofError, setProofError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void getPaymentSettings().then((value) => {
      if (active) {
        setSettings(value);
        setSettingsLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!student || !courseId) {
      setChecking(false);
      return;
    }

    let active = true;
    listMyPaymentRequests(student.id)
      .then((list) => {
        if (active) {
          setHasPending(list.some((item) => item.courseId === courseId && item.status === 'pending'));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [student, courseId]);

  if (loading || checking) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-gold-400">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Message>
        <EmptyState
          icon={ServerCrash}
          title="تعذر تحميل الكورس"
          description="تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى."
          action={<Button onClick={reload}>إعادة المحاولة</Button>}
        />
      </Message>
    );
  }

  if (!course || !student) {
    return (
      <Message>
        <EmptyState
          icon={BookOpen}
          title="الكورس غير موجود"
          action={
            <Link to="/courses" className={buttonClasses({ variant: 'primary' })}>
              تصفح الكورسات
            </Link>
          }
        />
      </Message>
    );
  }

  const owned = student.courses.includes(course.id);

  if (owned) {
    return (
      <Message>
        <EmptyState
          icon={CheckCircle2}
          title="أنت مشترك في هذا الكورس بالفعل"
          action={
            <Link to={`/courses/${course.id}`} className={buttonClasses({ variant: 'primary' })}>
              الذهاب للكورس
            </Link>
          }
        />
      </Message>
    );
  }

  if (course.hidden) {
    return (
      <Message>
        <EmptyState
          icon={BookOpen}
          title="هذا الكورس غير متاح حاليًا"
          action={
            <Link to="/courses" className={buttonClasses({ variant: 'primary' })}>
              تصفح الكورسات
            </Link>
          }
        />
      </Message>
    );
  }

  if (course.isFree) {
    return (
      <Message>
        <EmptyState
          icon={CheckCircle2}
          title="هذا الكورس مجاني"
          description="لا يحتاج إلى دفع، يمكنك مشاهدته مباشرة."
          action={
            <Link to={`/courses/${course.id}`} className={buttonClasses({ variant: 'primary' })}>
              الذهاب للكورس
            </Link>
          }
        />
      </Message>
    );
  }

  if (hasPending) {
    return (
      <Message>
        <EmptyState
          icon={CheckCircle2}
          title="لديك طلب قيد المراجعة لهذا الكورس"
          description="سنفعّل الكورس فور مراجعة الطلب. يمكنك متابعة حالته من صفحة طلبات الدفع."
          action={
            <Link to="/student/payments" className={buttonClasses({ variant: 'primary' })}>
              طلبات الدفع
            </Link>
          }
        />
      </Message>
    );
  }

  const amount = getPriceInfo(course).price;

  const tabs = [{ id: 'vodafone', label: 'فودافون كاش' }];
  if (settings.enableFawry) tabs.push({ id: 'fawry', label: 'فوري' });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(settings.vCashNum);
      showToast('تم نسخ الرقم.', 'success');
    } catch {
      showToast('تعذر النسخ، انسخ الرقم يدويًا.', 'error');
    }
  };

  // نضغط الإيصال فور اختياره (أطول ضلع 1200 بكسل وحتى 117 كيلوبايت)، فيظهر الخطأ فورًا لو تعذر.
  const handleFileChange = async (file: File | null) => {
    setProofError('');

    if (!file) {
      setProof(null);
      return;
    }

    setCompressing(true);
    try {
      setProof(await compressImage(file, PROOF_OPTIONS));
    } catch (compressError) {
      setProof(null);
      setProofError(getImageErrorMessage(compressError));
    } finally {
      setCompressing(false);
    }
  };

  const handleSubmit = async () => {
    if (!proof) {
      setProofError('ارفع صورة إيصال التحويل أولًا.');
      return;
    }

    setSubmitting(true);
    try {
      await submitPaymentRequest({ student, course, amount, method, proof });
      showToast('تم إرسال طلبك. سنراجعه ونفعّل الكورس قريبًا.', 'success');
      navigate('/student/payments', { replace: true });
    } catch (submitError) {
      showToast(getPaymentErrorMessage(submitError), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-extrabold text-white">إتمام الاشتراك</h1>
      <p className="mt-1.5 text-sm text-slate-400">حوّل المبلغ ثم ارفع صورة الإيصال لنراجع طلبك.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="space-y-3 lg:col-span-1">
          <Badge variant="info">الكورس</Badge>
          <h2 className="text-lg font-bold leading-snug text-white">{course.title}</h2>
          <CoursePrice course={course} />
          <p className="text-sm text-slate-400">
            المبلغ المطلوب: <span className="font-bold text-gold-400">{amount} جنيه</span>
          </p>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-4">
            <h2 className="text-lg font-bold text-white">1. حوّل المبلغ</h2>

            {tabs.length > 1 && (
              <Tabs
                tabs={tabs}
                value={method}
                onChange={(id) => setMethod(id === 'fawry' ? 'fawry' : 'vodafone')}
              />
            )}

            {settingsLoaded && !settings.available && (
              <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-center text-sm font-bold text-red-300">
                الدفع متوقف مؤقتًا. تواصل مع الدعم أو حاول لاحقًا.
              </p>
            )}

            <div className="rounded-xl bg-navy-950/60 p-4 text-center">
              <p className="text-sm text-slate-400">
                {method === 'fawry' ? 'ادفع عبر فوري على الرقم' : 'حوّل عبر فودافون كاش على الرقم'}
              </p>
              <p dir="ltr" className="mt-1 text-3xl font-extrabold tracking-wider text-gold-400">
                {settings.available ? settings.vCashNum : '—'}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                disabled={!settings.available}
                onClick={handleCopy}
              >
                <Copy className="h-4 w-4" />
                نسخ الرقم
              </Button>
            </div>

            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {settings.paymentInstructions}
            </p>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-bold text-white">2. ارفع صورة الإيصال</h2>

            <div className="flex flex-wrap items-center gap-4">
              <div className="grid h-32 w-32 shrink-0 place-items-center overflow-hidden rounded-xl border border-navy-700 bg-navy-900 text-slate-500">
                {proof ? (
                  <img src={proof.dataUrl} alt="معاينة الإيصال" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8" />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                aria-label="صورة إيصال التحويل"
                disabled={compressing || submitting}
                onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
                className="max-w-full text-sm text-slate-300 file:me-3 file:rounded-lg file:border-0 file:bg-gold-500 file:px-4 file:py-2 file:font-bold file:text-navy-950"
              />
            </div>

            {proofError ? (
              <p className="text-sm text-red-400">{proofError}</p>
            ) : compressing ? (
              <p className="text-sm text-gold-300">جارٍ ضغط الصورة...</p>
            ) : proof ? (
              <p className="text-sm text-emerald-400">
                الصورة جاهزة للإرسال. الحجم بعد الضغط: {Math.round(proof.bytes / 1024)} كيلوبايت.
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                تُضغط الصورة تلقائيًا قبل الإرسال، فلا تقلق من حجمها.
              </p>
            )}

            <Button
              size="lg"
              fullWidth
              loading={submitting}
              disabled={compressing || !settingsLoaded || !settings.available}
              onClick={handleSubmit}
            >
              إرسال طلب الاشتراك
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

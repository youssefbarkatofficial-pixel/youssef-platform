import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, ServerCrash } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Modal, Spinner, buttonClasses } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import {
  formatRequestDate,
  getPaymentProof,
  getStatusInfo,
  listMyPaymentRequests,
} from '../../services/payments';
import type { PaymentRequest } from '../../services/payments';

interface ProofView {
  request: PaymentRequest;
  src: string;
  loading: boolean;
  failed: boolean;
}

export default function PaymentRequestsPage() {
  const { student } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [proofView, setProofView] = useState<ProofView | null>(null);

  useEffect(() => {
    if (!student) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(false);

    listMyPaymentRequests(student.id)
      .then((list) => {
        if (active) setRequests(list);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [student, reloadKey]);

  // الإيصال الجديد يُحمَّل عند الطلب فقط (قراءة واحدة).
  const openProof = async (request: PaymentRequest) => {
    if (request.proofSrc) {
      setProofView({ request, src: request.proofSrc, loading: false, failed: false });
      return;
    }

    setProofView({ request, src: '', loading: true, failed: false });
    try {
      const src = await getPaymentProof(request.id);
      setProofView({ request, src, loading: false, failed: src === '' });
    } catch {
      setProofView({ request, src: '', loading: false, failed: true });
    }
  };

  let content;
  if (loading) {
    content = (
      <div className="grid min-h-[40vh] place-items-center text-gold-400">
        <Spinner size="lg" />
      </div>
    );
  } else if (error) {
    content = (
      <Card>
        <EmptyState
          icon={ServerCrash}
          title="تعذر تحميل طلباتك"
          description="تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى."
          action={<Button onClick={() => setReloadKey((value) => value + 1)}>إعادة المحاولة</Button>}
        />
      </Card>
    );
  } else if (requests.length === 0) {
    content = (
      <Card>
        <EmptyState
          icon={CreditCard}
          title="لا توجد طلبات دفع بعد"
          description="عند اشتراكك في كورس ستظهر هنا حالة طلبك."
          action={
            <Link to="/courses" className={buttonClasses({ variant: 'primary' })}>
              تصفح الكورسات
            </Link>
          }
        />
      </Card>
    );
  } else {
    content = (
      <div className="space-y-4">
        {requests.map((request) => {
          const info = getStatusInfo(request.status);

          return (
            <Card key={request.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-white">{request.courseName || 'كورس'}</h2>
                  <p dir="ltr" className="mt-1 text-start text-sm text-slate-400">
                    {formatRequestDate(request)}
                  </p>
                </div>
                <Badge variant={info.variant}>{info.label}</Badge>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-400">
                {request.amount !== null && (
                  <span>
                    المبلغ: <span className="font-bold text-slate-200">{request.amount} جنيه</span>
                  </span>
                )}
                {request.method && (
                  <span>
                    الطريقة:{' '}
                    <span className="font-bold text-slate-200">
                      {request.method === 'fawry' ? 'فوري' : 'فودافون كاش'}
                    </span>
                  </span>
                )}
              </div>

              {request.status === 'rejected' && request.rejectReason && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  سبب الرفض: {request.rejectReason}
                </p>
              )}

              {request.status === 'pending' && (
                <p className="text-sm text-slate-400">طلبك قيد المراجعة، وسنفعّل الكورس فور الموافقة.</p>
              )}

              <div className="flex flex-wrap gap-2">
                {(request.hasProofDoc || request.proofSrc) && (
                  <Button size="sm" variant="ghost" onClick={() => void openProof(request)}>
                    عرض الإيصال
                  </Button>
                )}
                {request.status === 'approved' && request.courseId && (
                  <Link
                    to={`/courses/${request.courseId}`}
                    className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                  >
                    الذهاب للكورس
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-extrabold text-white">طلبات الدفع</h1>
      <p className="mt-1.5 text-sm text-slate-400">تابع حالة طلبات اشتراكك في الكورسات.</p>
      <div className="mt-6">{content}</div>

      <Modal open={proofView !== null} onClose={() => setProofView(null)} title="صورة الإيصال">
        {proofView?.loading && (
          <div className="flex justify-center py-8 text-gold-400">
            <Spinner />
          </div>
        )}
        {proofView?.failed && (
          <p className="py-6 text-center text-sm text-slate-400">تعذر تحميل صورة الإيصال.</p>
        )}
        {proofView && proofView.src && (
          <img
            src={proofView.src}
            alt="إيصال الدفع"
            className="max-h-[60vh] w-full rounded-xl object-contain"
          />
        )}
      </Modal>
    </div>
  );
}

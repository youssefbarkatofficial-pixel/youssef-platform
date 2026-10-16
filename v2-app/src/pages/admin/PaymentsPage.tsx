import { useEffect, useState } from 'react';
import { CreditCard, RotateCcw, ServerCrash } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  Spinner,
  Table,
  Tabs,
  useToast,
} from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import PaymentSettingsCard from '../../components/admin/PaymentSettingsCard';
import { useAuth } from '../../hooks/useAuth';
import { useCourses } from '../../hooks/useCourses';
import { formatMoney, isCountedRevenue, totalRevenue } from '../../lib/stats';
import {
  approvePaymentRequest,
  archiveRevenue,
  formatRequestDate,
  getPaymentErrorMessage,
  getPaymentProof,
  getStatusInfo,
  listPaymentRequests,
  rejectPaymentRequest,
} from '../../services/payments';
import type { PaymentRequest, PaymentStatus } from '../../services/payments';

const PAGE_SIZE = 50;

const FILTER_TABS = [
  { id: 'all', label: 'الكل' },
  { id: 'pending', label: 'قيد المراجعة' },
  { id: 'approved', label: 'تم التفعيل' },
  { id: 'rejected', label: 'مرفوض' },
  { id: 'cancelled', label: 'ملغي' },
];

const textareaClass =
  'w-full rounded-xl border border-navy-700 bg-navy-900 px-3 py-2.5 text-white placeholder:text-slate-500 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40';

interface ProofView {
  request: PaymentRequest;
  src: string;
  loading: boolean;
  failed: boolean;
}

export default function PaymentsPage() {
  const { firebaseUser, isSeniorAdmin } = useAuth();
  const [resetting, setResetting] = useState(false);
  const { showToast } = useToast();
  const { courses } = useCourses();
  const adminEmail = firebaseUser?.email ?? '';

  const [limitCount, setLimitCount] = useState(PAGE_SIZE);
  const [reloadKey, setReloadKey] = useState(0);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [proofView, setProofView] = useState<ProofView | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PaymentRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);

    listPaymentRequests(limitCount)
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
  }, [limitCount, reloadKey]);

  // تصفير الدخل: لا حذف، فقط علامة archived_revenue على الطلبات الموافق عليها. للمالك والأدمن الكامل.
  const handleResetRevenue = async () => {
    setResetting(true);
    try {
      const all = await listPaymentRequests(500);
      const counted = all.filter(isCountedRevenue);
      if (counted.length === 0) {
        showToast('لا يوجد دخل محسوب لتصفيره.', 'info');
        return;
      }

      const total = totalRevenue(all, courses);
      const message = `سيتم تصفير الدخل: ${counted.length} طلب بإجمالي ${formatMoney(total)}. الطلبات نفسها تبقى كما هي ولا تُحذف، لكنها تخرج من حساب الإيرادات ولا يمكن التراجع من الواجهة. متابعة؟`;
      if (!window.confirm(message)) return;

      await archiveRevenue(counted.map((item) => item.id));
      showToast('تم تصفير الدخل.', 'success');
      setReloadKey((value) => value + 1);
    } catch {
      showToast('تعذر تصفير الدخل.', 'error');
    } finally {
      setResetting(false);
    }
  };

  // رقم الكورس غير موجود في قائمة الكورسات؟ (نمنع الموافقة عليه)
  const knownCourseIds = new Set(courses.map((course) => course.id));
  const coursesReady = courses.length > 0;
  const isMissingCourse = (request: PaymentRequest) =>
    coursesReady && request.courseId !== '' && !knownCourseIds.has(request.courseId);

  const updateLocal = (id: string, patch: Partial<PaymentRequest>) => {
    setRequests((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...patch, actionable: false } : item)),
    );
  };

  // الإيصال الجديد يُحمَّل عند الطلب فقط (قراءة واحدة)، والقديم يُعرض كما هو.
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

  const handleApprove = async (request: PaymentRequest) => {
    const message = `سيتم تفعيل كورس "${request.courseName || 'الكورس'}" للطالب ${request.userName || request.userPhone}. هل تريد المتابعة؟`;
    if (!window.confirm(message)) return;

    setBusyId(request.id);
    try {
      await approvePaymentRequest(request, adminEmail);
      updateLocal(request.id, { status: 'approved' as PaymentStatus, rawStatus: 'approved' });
      showToast('تمت الموافقة وتفعيل الكورس للطالب.', 'success');
    } catch (approveError) {
      showToast(getPaymentErrorMessage(approveError), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (request: PaymentRequest) => {
    setRejectTarget(request);
    setRejectReason('');
    setRejectError('');
  };

  const handleReject = async () => {
    if (!rejectTarget) return;

    if (rejectReason.trim().length < 3) {
      setRejectError('اكتب سبب الرفض (3 أحرف على الأقل).');
      return;
    }

    const target = rejectTarget;
    setBusyId(target.id);
    try {
      await rejectPaymentRequest(target, rejectReason, adminEmail);
      updateLocal(target.id, {
        status: 'rejected' as PaymentStatus,
        rawStatus: 'rejected',
        rejectReason: rejectReason.trim(),
      });
      setRejectTarget(null);
      showToast('تم رفض الطلب.', 'success');
    } catch (rejectFailure) {
      showToast(getPaymentErrorMessage(rejectFailure), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = requests.filter((item) => item.status === 'pending').length;
  const tabs = FILTER_TABS.map((tab) =>
    tab.id === 'pending' ? { ...tab, label: `${tab.label} (${pendingCount})` } : tab,
  );

  const visible = requests.filter((item) => filter === 'all' || item.status === filter);

  const columns: TableColumn<PaymentRequest>[] = [
    {
      key: 'student',
      header: 'الطالب',
      render: (request) => (
        <div>
          <p className="font-bold text-white">{request.userName || 'بدون اسم'}</p>
          <p dir="ltr" className="text-start text-xs text-slate-400">
            {request.userPhone || '-'}
          </p>
        </div>
      ),
    },
    {
      key: 'course',
      header: 'الكورس',
      render: (request) => (
        <div className="space-y-1">
          <p>{request.courseName || '-'}</p>
          {request.amount !== null && <p className="text-xs text-slate-400">{request.amount} جنيه</p>}
          {isMissingCourse(request) && <Badge variant="danger">الكورس غير موجود</Badge>}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'التاريخ',
      render: (request) => <span dir="ltr">{formatRequestDate(request)}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (request) => {
        const info = getStatusInfo(request.status);
        return (
          <div className="space-y-1">
            <Badge variant={info.variant}>{info.label}</Badge>
            {request.status === 'pending' && !request.actionable && (
              <p className="text-xs text-slate-500">للقراءة فقط (بيانات ناقصة)</p>
            )}
            {request.status === 'rejected' && request.rejectReason && (
              <p className="max-w-48 text-xs text-slate-400">{request.rejectReason}</p>
            )}
          </div>
        );
      },
    },
    {
      key: 'proof',
      header: 'الإيصال',
      render: (request) =>
        request.proofSrc || request.hasProofDoc ? (
          <Button size="sm" variant="ghost" onClick={() => void openProof(request)}>
            عرض الإيصال
          </Button>
        ) : (
          <span className="text-xs text-slate-500">لا توجد صورة</span>
        ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (request) =>
        request.actionable ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={busyId === request.id}
              disabled={isMissingCourse(request)}
              onClick={() => handleApprove(request)}
            >
              موافقة
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={busyId === request.id}
              onClick={() => openReject(request)}
            >
              رفض
            </Button>
          </div>
        ) : (
          <span className="text-xs text-slate-500">-</span>
        ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <h1 className="text-2xl font-extrabold text-white">المدفوعات</h1>
      <p className="mt-1.5 text-sm text-slate-400">
        راجع إيصالات التحويل ووافق أو ارفض. عند الموافقة يُفعَّل الكورس للطالب ويصله إشعار.
      </p>

      <PaymentSettingsCard />

      {isSeniorAdmin && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">تصفير الدخل</h2>
            <p className="mt-1 text-sm text-slate-400">
              يبدأ عداد الإيرادات من الصفر دون حذف أي طلب (يظهر العداد في لوحة الإدارة).
            </p>
          </div>
          <Button variant="danger" loading={resetting} onClick={() => void handleResetRevenue()}>
            <RotateCcw className="h-4 w-4" />
            تصفير الدخل
          </Button>
        </Card>
      )}

      <Tabs tabs={tabs} value={filter} onChange={setFilter} className="mt-6" />

      <div className="mt-6">
        {error ? (
          <Card>
            <EmptyState
              icon={ServerCrash}
              title="تعذر تحميل الطلبات"
              description="تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى."
              action={<Button onClick={() => setReloadKey((value) => value + 1)}>إعادة المحاولة</Button>}
            />
          </Card>
        ) : (
          <>
            <Table
              columns={columns}
              rows={visible}
              rowKey={(request) => request.id}
              loading={loading}
              emptyMessage="لا توجد طلبات في هذا التصنيف"
            />
            {!loading && requests.length >= limitCount && (
              <div className="mt-4 text-center">
                <Button variant="secondary" onClick={() => setLimitCount((value) => value + PAGE_SIZE)}>
                  <CreditCard className="h-4 w-4" />
                  عرض طلبات أقدم
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <Modal open={proofView !== null} onClose={() => setProofView(null)} title="صورة إثبات الدفع">
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
            alt="إثبات الدفع"
            className="max-h-[60vh] w-full rounded-xl object-contain"
          />
        )}
      </Modal>

      <Modal
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title="رفض طلب الدفع"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>
              إلغاء
            </Button>
            <Button
              variant="danger"
              loading={rejectTarget !== null && busyId === rejectTarget.id}
              onClick={handleReject}
            >
              تأكيد الرفض
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            سيصل الطالب {rejectTarget?.userName || ''} إشعار بالرفض مع السبب.
          </p>
          <div>
            <label htmlFor="reject-reason" className="mb-1.5 block text-sm font-medium text-slate-300">
              سبب الرفض
            </label>
            <textarea
              id="reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(event) => {
                setRejectReason(event.target.value);
                setRejectError('');
              }}
              className={textareaClass}
            />
            {rejectError && <p className="mt-1.5 text-sm text-red-400">{rejectError}</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
}

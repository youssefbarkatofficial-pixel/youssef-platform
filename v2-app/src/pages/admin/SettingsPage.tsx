import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { Badge, Button, Card, Input, Select, Spinner, Table, useToast } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { listAdmins, saveAdmin } from '../../services/admins';
import type { AdminRecord } from '../../services/admins';
import { getGeneralSettings, saveGeneralSettings } from '../../services/settings';

const textareaClass =
  'w-full rounded-xl border border-navy-700 bg-navy-900 px-3 py-2.5 text-white placeholder:text-slate-500 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40';

const ROLE_LABELS: Record<AdminRecord['role'], string> = { admin: 'أدمن كامل', assistant: 'مساعد' };

function GeneralSettingsCard() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [courseStatus, setCourseStatus] = useState('');

  useEffect(() => {
    let active = true;
    void getGeneralSettings().then((settings) => {
      if (!active) return;
      setAllowRegistration(settings.allowRegistration);
      setWelcomeMessage(settings.welcomeMessage);
      setCourseStatus(settings.courseStatus);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveGeneralSettings({ allowRegistration, welcomeMessage, courseStatus });
      showToast('تم حفظ الإعدادات العامة.', 'success');
    } catch {
      showToast('تعذر حفظ الإعدادات.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="grid min-h-[8rem] place-items-center text-gold-400">
        <Spinner />
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-bold text-white">إعدادات عامة</h2>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-700 p-3">
        <input
          type="checkbox"
          checked={allowRegistration}
          onChange={(event) => setAllowRegistration(event.target.checked)}
          className="mt-1 h-4 w-4 accent-[#D4A64F]"
        />
        <span>
          <span className="block font-bold text-white">السماح بتسجيل طلاب جدد</span>
          <span className="block text-xs text-slate-400">
            لو أُلغي، لا يستطيع أحد إنشاء حساب جديد (الطلاب الحاليون يدخلون عادي).
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="welcome-message" className="mb-1.5 block text-sm font-medium text-slate-300">
          رسالة ترحيب تظهر في لوحة الطالب
        </label>
        <textarea
          id="welcome-message"
          rows={3}
          maxLength={500}
          value={welcomeMessage}
          onChange={(event) => setWelcomeMessage(event.target.value)}
          className={textareaClass}
        />
      </div>

      <Input
        label="نص حالة الكورسات"
        value={courseStatus}
        maxLength={100}
        hint="نص عام محفوظ مع الإعدادات (مثل: يبدأ فورًا)"
        onChange={(event) => setCourseStatus(event.target.value)}
      />

      <Button onClick={() => void handleSave()} disabled={saving}>
        {saving ? 'جارٍ الحفظ...' : 'حفظ'}
      </Button>
    </Card>
  );
}

// إدارة المشرفين للمالك فقط (القواعد تسمح بالكتابة له وحده). لا حذف: التعطيل بحقل active.
function AdminsCard() {
  const { showToast } = useToast();
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<AdminRecord['role']>('assistant');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAdmins(await listAdmins());
    } catch {
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    setBusy(true);
    try {
      await saveAdmin({ email, name, role, active: true });
      setEmail('');
      setName('');
      showToast('تمت إضافة المشرف.', 'success');
      await load();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      showToast(
        code === 'invalid-email'
          ? 'اكتب بريدًا إلكترونيًا صحيحًا.'
          : code === 'owner-email'
            ? 'هذا بريد المالك الأساسي.'
            : 'تعذرت الإضافة.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (record: AdminRecord) => {
    const next = !record.active;
    if (!window.confirm(next ? `إعادة تفعيل ${record.email}؟` : `تعطيل ${record.email}؟ لن يستطيع دخول لوحة الإدارة.`)) return;
    setBusy(true);
    try {
      await saveAdmin({ ...record, active: next });
      await load();
    } catch {
      showToast('تعذر التحديث.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns: TableColumn<AdminRecord>[] = [
    {
      key: 'email',
      header: 'المشرف',
      render: (row) => (
        <div>
          <p dir="ltr" className="font-bold text-white">
            {row.email}
          </p>
          {row.name && <p className="text-xs text-slate-500">{row.name}</p>}
        </div>
      ),
    },
    { key: 'role', header: 'الدور', render: (row) => <Badge variant={row.role === 'admin' ? 'gold' : 'info'}>{ROLE_LABELS[row.role]}</Badge> },
    {
      key: 'active',
      header: '',
      render: (row) => (
        <Button size="sm" variant={row.active ? 'secondary' : 'primary'} disabled={busy} onClick={() => void handleToggle(row)}>
          {row.active ? 'تعطيل' : 'تفعيل'}
        </Button>
      ),
    },
  ];

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-gold-400" />
        <h2 className="text-lg font-bold text-white">المشرفون (للمالك فقط)</h2>
      </div>
      <p className="text-xs leading-relaxed text-slate-400">
        الأدمن الكامل يرى كل شيء. المساعد يدير الطلاب والمدفوعات والإشعارات، ولا يرى الدعم الفني ولا البوصلة ولا
        يصفّر الدخل. المشرف يدخل من /admin/login بحسابه الذي يجب أن يكون موجودًا في Firebase Authentication.
      </p>

      <Table columns={columns} rows={admins} rowKey={(row) => row.email} loading={loading} emptyMessage="لا يوجد مشرفون إضافيون" />

      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="البريد الإلكتروني" type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input label="الاسم" value={name} onChange={(event) => setName(event.target.value)} />
        <Select
          label="الدور"
          value={role}
          options={[
            { value: 'assistant', label: 'مساعد' },
            { value: 'admin', label: 'أدمن كامل' },
          ]}
          onChange={(event) => setRole(event.target.value === 'admin' ? 'admin' : 'assistant')}
        />
      </div>
      <Button onClick={() => void handleAdd()} disabled={busy || email.trim() === ''}>
        <UserPlus className="h-4 w-4" />
        إضافة مشرف
      </Button>
    </Card>
  );
}

export default function SettingsPage() {
  const { adminRole } = useAuth();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <h1 className="text-2xl font-extrabold text-white md:text-3xl">الإعدادات</h1>
      <GeneralSettingsCard />
      <Card>
        <h2 className="text-lg font-bold text-white">إعدادات الدفع</h2>
        <p className="mt-1 text-sm text-slate-400">رقم فودافون كاش وتعليمات الدفع تُضبط من صفحة المدفوعات.</p>
        <Link to="/admin/payments" className="mt-3 inline-block font-bold text-gold-400 hover:text-gold-300">
          فتح صفحة المدفوعات
        </Link>
      </Card>
      {adminRole === 'owner' && <AdminsCard />}
    </div>
  );
}

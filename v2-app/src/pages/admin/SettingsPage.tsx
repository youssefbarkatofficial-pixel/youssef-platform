import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  UserPlus,
  Image as ImageIcon,
  RotateCcw,
  Plus,
  Trash2,
  Sparkles,
  Compass,
  Upload,
  TrendingUp,
  Crop,
} from 'lucide-react';
import { Badge, Button, Card, Input, Select, Spinner, Table, useToast } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { listAdmins, saveAdmin } from '../../services/admins';
import type { AdminRecord } from '../../services/admins';
import {
  getGeneralSettings,
  saveGeneralSettings,
  getPlatformMediaSettings,
  savePlatformMediaSettings,
  saveUploadedMediaDoc,
  resetUploadedMediaDoc,
  DEFAULT_PLATFORM_MEDIA,
} from '../../services/settings';
import type { PlatformMediaSettings, MediaDocType, PlatformStats } from '../../services/settings';
import { processImageUpload, MEDIA_SPECS } from '../../lib/imageUpload';
import ImageCropModal from '../../components/admin/ImageCropModal';

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

interface ImageUploadControlProps {
  type: MediaDocType;
  title: string;
  currentUrl: string;
  defaultUrl: string;
  onUploaded: (dataUrl: string) => void;
  onReset: () => void;
}

function ImageUploadControl({
  type,
  title,
  currentUrl,
  defaultUrl,
  onUploaded,
  onReset,
}: ImageUploadControlProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [sizeInfo, setSizeInfo] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const spec = MEDIA_SPECS[type];
  const isCustom = currentUrl && currentUrl !== defaultUrl;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setSizeInfo(null);
    try {
      // 1. الضغط في المتصفح إلى WebP مع الحفاظ على الشفافية وسقف الحجم وجودة >= 0.85
      const result = await processImageUpload(file, type);

      // 2. الحفظ في مستند مستقل بـ Firestore وتحديث نسخته
      await saveUploadedMediaDoc(type, result.dataUrl, result.sizeBytes);

      const kbSize = Math.round(result.sizeBytes / 1024);
      setSizeInfo(`تم الضغط والرفع بنجاح: ${kbSize} KB (WebP ${result.width}×${result.height})`);
      onUploaded(result.dataUrl);
      showToast(`تم ضغط ورفع ${spec.label} بنجاح (${kbSize} KB).`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'فشل ضغط ورفع الصورة.', 'error');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetToDefault = async () => {
    try {
      await resetUploadedMediaDoc(type);
      onReset();
      setSizeInfo(null);
      showToast(`تم استرجاع ${spec.label} للافتراضي.`, 'info');
    } catch {
      showToast('تعذر استرجاع الافتراضي.', 'error');
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-navy-950/40 p-4 border border-navy-800/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-bold text-slate-200">{title}</label>
        <div className="flex items-center gap-2">
          {isCustom ? (
            <span className="rounded-md bg-gold-500/10 px-2 py-0.5 text-[11px] font-bold text-gold-400 border border-gold-500/20">
              صورة مخصصة مرفوعة
            </span>
          ) : (
            <span className="rounded-md bg-slate-500/10 px-2 py-0.5 text-[11px] font-bold text-slate-400 border border-slate-700">
              الافتراضي المدمج
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleResetToDefault()}
            className="text-xs text-gold-400 hover:underline flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            استرجاع الافتراضي
          </button>
        </div>
      </div>

      {/* تحذير الحجم الموصى به */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-300">
        <span className="font-bold">تنبيه الحجم والسقف: </span>
        <span>{spec.recommendedText}</span>
      </div>

      {/* أزرار الرفع والمعالجة والقص */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFileChange(e)}
        />
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setCropModalOpen(true)}
        >
          <Crop className="h-4 w-4" />
          <span>تعديل وقص تفاعلي (Pan & Zoom)</span>
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={processing}
          onClick={() => fileInputRef.current?.click()}
        >
          {processing ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
          <span>{processing ? 'جارٍ الضغط والمعالجة...' : 'رفع مباشر بدون قص'}</span>
        </Button>

        {sizeInfo && <span className="text-xs font-semibold text-emerald-400">{sizeInfo}</span>}
      </div>

      <ImageCropModal
        open={cropModalOpen}
        type={type}
        title={title}
        onClose={() => setCropModalOpen(false)}
        onSaved={(dataUrl, sizeBytes) => {
          const kbSize = Math.round(sizeBytes / 1024);
          setSizeInfo(`تم القص والضغط والحفظ بنجاح: ${kbSize} KB`);
          onUploaded(dataUrl);
          showToast(`تم حفظ ${spec.label} بعد القص بنجاح (${kbSize} KB).`, 'success');
        }}
      />

      {/* صندوق المعاينة */}
      {type === 'heroBg' ? (
        <div className="relative h-36 w-full overflow-hidden rounded-xl border border-navy-800 bg-navy-900">
          <img
            src={currentUrl || defaultUrl}
            alt="معاينة خلفية الهيرو"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
            <span className="text-xs font-semibold text-slate-300">معاينة خلفية الهيرو الحالية</span>
          </div>
        </div>
      ) : type === 'youssefCutout' ? (
        <div className="flex items-center gap-4 rounded-xl border border-navy-800 bg-navy-900 p-3">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-navy-950 flex items-center justify-center border border-navy-800 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:8px_8px]">
            <img
              src={currentUrl || defaultUrl}
              alt="معاينة صورة يوسف"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-200">معاينة الصورة المفرغة</p>
            <p className="leading-relaxed">
              تتم إزالة الهوامش الشفافة الزائدة آلياً وقص الفراغ وحفظ موضع الرأس لتتطابق بدقة هندسية مع دائرة الهيرو.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-navy-800 bg-navy-900 p-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-navy-950 border border-navy-800">
            {currentUrl ? (
              <img
                src={currentUrl}
                alt="شعار"
                className="h-10 w-10 object-contain rounded-lg"
              />
            ) : (
              <Compass className="h-7 w-7 text-gold-400" />
            )}
          </div>
          <div className="text-xs text-slate-300">
            <span className="font-bold text-white block">يوسف بركات</span>
            <span className="text-gold-400">{currentUrl ? 'شعار مخصص نشط' : 'شعار البوصلة الدائري الذهبي (الافتراضي)'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// مهمة S: إدارة الهوية البصرية وشريط الاقتباسات (platform_settings/generalSettings)
function PlatformMediaSettingsCard() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [heroBgUrl, setHeroBgUrl] = useState(DEFAULT_PLATFORM_MEDIA.heroBgUrl);
  const [youssefCutoutUrl, setYoussefCutoutUrl] = useState(DEFAULT_PLATFORM_MEDIA.youssefCutoutUrl);
  const [logoUrl, setLogoUrl] = useState(DEFAULT_PLATFORM_MEDIA.logoUrl);
  const [tickerQuotes, setTickerQuotes] = useState<string[]>(DEFAULT_PLATFORM_MEDIA.tickerQuotes);
  const [newQuote, setNewQuote] = useState('');
  const [stats, setStats] = useState<PlatformStats>(
    DEFAULT_PLATFORM_MEDIA.stats || { views: '', subscribers: '', students: '', lessons: '' },
  );

  useEffect(() => {
    let active = true;
    void getPlatformMediaSettings(true).then((media) => {
      if (!active) return;
      setHeroBgUrl(media.heroBgUrl);
      setYoussefCutoutUrl(media.youssefCutoutUrl);
      setLogoUrl(media.logoUrl);
      setTickerQuotes(media.tickerQuotes);
      if (media.stats) {
        setStats({
          views: media.stats.views || '',
          subscribers: media.stats.subscribers || '',
          students: media.stats.students || '',
          lessons: media.stats.lessons || '',
        });
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePlatformMediaSettings({
        heroBgUrl,
        youssefCutoutUrl,
        logoUrl,
        tickerQuotes,
        stats,
      });
      showToast('تم حفظ الهوية البصرية والاقتباسات والأرقام بنجاح.', 'success');
    } catch {
      showToast('تعذر حفظ إعدادات الهوية البصرية.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuote = () => {
    const trimmed = newQuote.trim();
    if (!trimmed) return;
    setTickerQuotes([...tickerQuotes, trimmed]);
    setNewQuote('');
  };

  const handleRemoveQuote = (index: number) => {
    setTickerQuotes(tickerQuotes.filter((_, i) => i !== index));
  };

  const handleQuoteChange = (index: number, val: string) => {
    const updated = [...tickerQuotes];
    updated[index] = val;
    setTickerQuotes(updated);
  };

  if (loading) {
    return (
      <Card className="grid min-h-[8rem] place-items-center text-gold-400">
        <Spinner />
      </Card>
    );
  }

  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-800 pb-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-gold-400" />
            الهوية البصرية وشريط الاقتباسات (المهمة S)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            روابط مباشرة فقط، باقة Spark، مع معاينة حية وزر استرجاع الافتراضي لكل عنصر.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            await Promise.all([
              resetUploadedMediaDoc('heroBg'),
              resetUploadedMediaDoc('youssefCutout'),
              resetUploadedMediaDoc('logo'),
            ]);
            setHeroBgUrl(DEFAULT_PLATFORM_MEDIA.heroBgUrl);
            setYoussefCutoutUrl(DEFAULT_PLATFORM_MEDIA.youssefCutoutUrl);
            setLogoUrl(DEFAULT_PLATFORM_MEDIA.logoUrl);
            setTickerQuotes(DEFAULT_PLATFORM_MEDIA.tickerQuotes);
            setStats(DEFAULT_PLATFORM_MEDIA.stats || { views: '', subscribers: '', students: '', lessons: '' });
            showToast('تم استرجاع جميع عناصر الهوية للافتراضي.', 'info');
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          استرجاع الكل للافتراضي
        </Button>
      </div>

      {/* 1. خلفية الهيرو */}
      <ImageUploadControl
        type="heroBg"
        title="1. خلفية الهيرو (Hero Background)"
        currentUrl={heroBgUrl}
        defaultUrl={DEFAULT_PLATFORM_MEDIA.heroBgUrl}
        onUploaded={(url) => setHeroBgUrl(url)}
        onReset={() => setHeroBgUrl(DEFAULT_PLATFORM_MEDIA.heroBgUrl)}
      />

      {/* 2. صورة يوسف المفرغة */}
      <ImageUploadControl
        type="youssefCutout"
        title="2. صورة يوسف المفرغة (Cutout Portrait)"
        currentUrl={youssefCutoutUrl}
        defaultUrl={DEFAULT_PLATFORM_MEDIA.youssefCutoutUrl}
        onUploaded={(url) => setYoussefCutoutUrl(url)}
        onReset={() => setYoussefCutoutUrl(DEFAULT_PLATFORM_MEDIA.youssefCutoutUrl)}
      />

      {/* 3. شعار الهيدر والفوتر */}
      <ImageUploadControl
        type="logo"
        title="3. شعار الهيدر والفوتر (Brand Logo)"
        currentUrl={logoUrl}
        defaultUrl={DEFAULT_PLATFORM_MEDIA.logoUrl}
        onUploaded={(url) => setLogoUrl(url)}
        onReset={() => setLogoUrl(DEFAULT_PLATFORM_MEDIA.logoUrl)}
      />

      {/* 4. قائمة اقتباسات الشريط */}
      <div className="space-y-3 rounded-2xl bg-navy-950/40 p-4 border border-navy-800/60">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold-400" />
            4. قائمة اقتباسات الشريط المدرج ({tickerQuotes.length})
          </label>
          <button
            type="button"
            onClick={() => setTickerQuotes(DEFAULT_PLATFORM_MEDIA.tickerQuotes)}
            className="text-xs text-gold-400 hover:underline flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            استرجاع الاقتباسات الافتراضية
          </button>
        </div>

        <div className="space-y-2">
          {tickerQuotes.map((quote, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={quote}
                onChange={(e) => handleQuoteChange(idx, e.target.value)}
                className="flex-1 rounded-xl border border-navy-700 bg-navy-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleRemoveQuote(idx)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                title="حذف هذا الاقتباس"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="text"
            placeholder="اكتب نص اقتباس جديد هنا..."
            value={newQuote}
            onChange={(e) => setNewQuote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddQuote();
              }
            }}
            className="flex-1 rounded-xl border border-navy-700 bg-navy-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none"
          />
          <Button variant="secondary" size="sm" onClick={handleAddQuote} disabled={!newQuote.trim()}>
            <Plus className="h-4 w-4" />
            إضافة اقتباس
          </Button>
        </div>
      </div>

      {/* 5. أرقام شريط المنصة (الإحصائيات الحية) */}
      <div className="space-y-4 rounded-2xl bg-navy-950/40 p-4 border border-navy-800/60">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gold-400" />
              5. أرقام شريط المنصة (الإحصائيات الحية)
            </label>
            <p className="text-xs text-slate-400 mt-0.5">
              أربعة أرقام يدخلها أ. يوسف. أي حقل فارغ يتم إخفاؤه تلقائياً من الصفحة الرئيسية بدون أرقام وهمية.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStats({ views: '', subscribers: '', students: '', lessons: '' })}
            className="text-xs text-gold-400 hover:underline flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            تفريغ الحقول (إخفاء الشريط)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="عدد المشاهدات (يوتيوب)"
            placeholder="مثال: +50,000 أو 50000"
            value={stats.views || ''}
            onChange={(e) => setStats({ ...stats, views: e.target.value })}
            hint="اتركه فارغاً لإخفاء بطاقة المشاهدات"
          />
          <Input
            label="عدد المشتركين (منصات التواصل)"
            placeholder="مثال: +12,000"
            value={stats.subscribers || ''}
            onChange={(e) => setStats({ ...stats, subscribers: e.target.value })}
            hint="اتركه فارغاً لإخفاء بطاقة المشتركين"
          />
          <Input
            label="عدد الطلاب المتفوقين"
            placeholder="مثال: +3,000"
            value={stats.students || ''}
            onChange={(e) => setStats({ ...stats, students: e.target.value })}
            hint="اتركه فارغاً لإخفاء بطاقة الطلاب"
          />
          <Input
            label="عدد الدروس والحصص / نسبة التغطية"
            placeholder="مثال: +250 أو 100%"
            value={stats.lessons || ''}
            onChange={(e) => setStats({ ...stats, lessons: e.target.value })}
            hint="اتركه فارغاً لإخفاء بطاقة الدروس"
          />
        </div>
      </div>

      <Button onClick={() => void handleSave()} disabled={saving} className="w-full sm:w-auto">
        {saving ? 'جارٍ الحفظ...' : 'حفظ الهوية البصرية والاقتباسات والأرقام'}
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
      <PlatformMediaSettingsCard />
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

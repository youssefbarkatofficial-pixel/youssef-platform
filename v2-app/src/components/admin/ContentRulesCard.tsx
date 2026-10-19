import { useEffect, useState } from 'react';
import { ShieldCheck, Lock, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Badge, Button, Card, Modal, Spinner, useToast } from '../ui';
import { getContentRules, saveContentRules } from '../../services/contentRules';
import { formatCairoDateTime, DEFAULT_CONTENT_RULES } from '../../lib/contentRules';
import type { ContentRulesSettings } from '../../lib/contentRules';

export default function ContentRulesCard() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<ContentRulesSettings>(DEFAULT_CONTENT_RULES);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void getContentRules().then((res) => {
      if (!active) return;
      setRules(res);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleToggle = async () => {
    setSaving(true);
    const willEnable = !rules.enabled;
    const newSettings: ContentRulesSettings = {
      enabled: willEnable,
      enabledAt: willEnable ? Date.now() : rules.enabledAt,
      watchThreshold: 0.95,
    };

    try {
      await saveContentRules(newSettings);
      setRules(newSettings);
      setConfirmModalOpen(false);
      showToast(
        willEnable
          ? 'تم تفعيل قواعد المحتوى والتسلسل بنجاح.'
          : 'تم تعطيل قواعد المحتوى والتسلسل.',
        'success'
      );
    } catch (err) {
      console.error(err);
      showToast('تعذر حفظ إعدادات قواعد المحتوى.', 'error');
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
    <>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-800 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-gold-400" />
            <h2 className="text-lg font-bold text-white">قواعد المحتوى والتسلسل الإلزامي</h2>
          </div>
          <Badge variant={rules.enabled ? 'success' : 'neutral'}>
            {rules.enabled ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                مفعلة
              </span>
            ) : (
              'معطلة'
            )}
          </Badge>
        </div>

        <p className="text-xs leading-relaxed text-slate-300">
          تتحكم هذه القواعد في إلزامية تسلسل المحاضرات ونسبة المشاهدة (≥95%) قبل فتح المحاضرة التالية والتدريبات والمذكرات.
        </p>

        <div className="rounded-xl border border-navy-800 bg-navy-950/60 p-4 space-y-2.5 text-xs">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <span className="text-slate-300">
              <strong className="text-emerald-400 font-bold">استثناء الطلاب القدامى:</strong> الطلاب المشتركون قبل تاريخ التفعيل معفيون تمامًا من التسلسل والمشاهدة الإلزامية لحماية مسارهم الدراسي.
            </span>
          </div>

          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <span className="text-slate-300">
              <strong className="text-amber-400 font-bold">الطلاب الجدد:</strong> ينطبق عليهم شرط مشاهدة 95% من المحاضرة وحل تدريباتها لتفتح المحاضرة التالية، وكذلك مشاهدة 95% لتحميل المذكرة أو دخول التدريب.
            </span>
          </div>

          {rules.enabled && rules.enabledAt && (
            <div className="flex items-center gap-2 pt-1 border-t border-navy-800 text-sky-400">
              <Clock className="h-4 w-4 shrink-0" />
              <span>مفعلة منذ: {formatCairoDateTime(rules.enabledAt)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            variant={rules.enabled ? 'secondary' : 'primary'}
            onClick={() => setConfirmModalOpen(true)}
            disabled={saving}
          >
            {rules.enabled ? 'تعطيل القواعد' : 'تفعيل القواعد الآن'}
          </Button>
        </div>
      </Card>

      {confirmModalOpen && (
        <Modal
          open={true}
          onClose={() => !saving && setConfirmModalOpen(false)}
          title={rules.enabled ? 'تأكيد تعطيل القواعد التسلسلية' : 'تأكيد تفعيل القواعد التسلسلية'}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setConfirmModalOpen(false)}
                disabled={saving}
              >
                إلغاء
              </Button>
              <Button
                variant={rules.enabled ? 'danger' : 'primary'}
                onClick={handleToggle}
                disabled={saving}
              >
                {saving ? 'جارٍ الحفظ...' : rules.enabled ? 'تأكيد التعطيل' : 'تأكيد التفعيل'}
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-slate-300">
            {rules.enabled ? (
              <p>
                هل أنت متأكد من تعطيل القواعد؟ ستفتح المحاضرات والملفات لجميع الطلاب دون اشتراط إكمال المحاضرات السابقة أو نسبة المشاهدة.
              </p>
            ) : (
              <div className="space-y-2">
                <p>
                  هل أنت متأكد من تفعيل قواعد التسلسل والمشاهدة؟
                </p>
                <p className="rounded-lg bg-gold-400/10 p-2.5 text-xs text-gold-300">
                  سيتم اعتماد اللحظة الحالية كتاريخ تفعيل. جميع الطلاب الحاليين المسجلين قبل هذه اللحظة سيكونون <strong>معفيين</strong> تلقائيًا ولن تتأثر دراستهم. فقط الطلاب الجدد هم من ستنطبق عليهم القواعد.
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

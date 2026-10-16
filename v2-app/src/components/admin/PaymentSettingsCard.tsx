import { useEffect, useState } from 'react';
import { Button, Card, Input, useToast } from '../ui';
import {
  getPaymentErrorMessage,
  getPaymentSettings,
  savePaymentSettings,
} from '../../services/payments';
import { toEnglishDigits } from '../../lib/phone';

// إعدادات الدفع: رقم فودافون كاش وتعليمات الدفع. تُحفظ في settings/paymentSettings (Firestore)
// فتصل كل الطلاب، بدل localStorage في المنصة القديمة.
export default function PaymentSettingsCard() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vCashNum, setVCashNum] = useState('');
  const [instructions, setInstructions] = useState('');
  const [enableFawry, setEnableFawry] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getPaymentSettings().then((value) => {
      if (!active) return;
      setVCashNum(value.vCashNum);
      setInstructions(value.paymentInstructions);
      setEnableFawry(value.enableFawry);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await savePaymentSettings({
        vCashNum: toEnglishDigits(vCashNum),
        paymentInstructions: instructions,
        enableFawry,
      });
      showToast('تم حفظ إعدادات الدفع.', 'success');
    } catch (err) {
      setError(getPaymentErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-6 space-y-4">
      <h2 className="text-lg font-bold text-white">إعدادات الدفع</h2>
      <p className="text-sm text-slate-400">
        هذا الرقم يظهر للطلاب في صفحة الدفع. لو تركته فارغًا يتوقف الدفع برسالة واضحة للطالب.
      </p>

      <Input
        label="رقم فودافون كاش"
        value={vCashNum}
        dir="ltr"
        disabled={loading || saving}
        error={error || undefined}
        onChange={(event) => setVCashNum(event.target.value)}
      />

      <div className="w-full">
        <label htmlFor="pay-instructions" className="mb-1.5 block text-sm font-medium text-slate-300">
          تعليمات الدفع
        </label>
        <textarea
          id="pay-instructions"
          rows={3}
          value={instructions}
          disabled={loading || saving}
          onChange={(event) => setInstructions(event.target.value)}
          className="w-full rounded-xl border border-navy-700 bg-navy-900 px-4 py-3 text-sm text-white outline-none focus:border-gold-500"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={enableFawry}
          disabled={loading || saving}
          onChange={(event) => setEnableFawry(event.target.checked)}
        />
        تفعيل الدفع عبر فوري
      </label>

      <Button loading={saving} disabled={loading} onClick={() => void handleSave()}>
        حفظ إعدادات الدفع
      </Button>
    </Card>
  );
}

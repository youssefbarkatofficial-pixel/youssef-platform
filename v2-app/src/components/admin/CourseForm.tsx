import { useState } from 'react';
import type { FormEvent } from 'react';
import { ImageIcon } from 'lucide-react';
import { Button, Input, Select } from '../ui';
import { GRADE_OPTIONS, isGradeCode } from '../../lib/grades';
import { COVER_OPTIONS, compressImage, getImageErrorMessage } from '../../lib/image';
import { toEnglishDigits } from '../../lib/phone';
import type { Course, CourseFormValues } from '../../services/courses';

interface CourseFormProps {
  initial?: Course | null;
  defaultOrder: number;
  submitting: boolean;
  submitLabel: string;
  // coverDataUrl: صورة الغلاف المضغوطة كنص، أو null لو لم يغيّرها الأدمن
  onSubmit: (values: CourseFormValues, coverDataUrl: string | null) => Promise<void>;
}

type FieldName = 'title' | 'grade' | 'price' | 'discountPrice' | 'order' | 'cover';
type FormErrors = Partial<Record<FieldName, string>>;

function toDateInput(milliseconds: number | null): string {
  if (milliseconds === null) return '';
  const date = new Date(milliseconds);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// أرقام وفاصلة عشرية فقط، مع تحويل الأرقام العربية.
function numberText(value: string): string {
  return toEnglishDigits(value).replace(/[^0-9.]/g, '');
}

const textareaClass =
  'w-full rounded-xl border border-navy-700 bg-navy-900 px-3 py-2.5 text-white placeholder:text-slate-500 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40';

const checkboxClass = 'h-5 w-5 rounded border-navy-600 bg-navy-900 accent-gold-500';

export default function CourseForm({
  initial = null,
  defaultOrder,
  submitting,
  submitLabel,
  onSubmit,
}: CourseFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [desc, setDesc] = useState(initial?.desc ?? '');
  const [grade, setGrade] = useState<string>(initial?.grade ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [isFree, setIsFree] = useState(initial?.isFree ?? false);
  const [hasDiscount, setHasDiscount] = useState(initial?.hasDiscount ?? false);
  const [discountPrice, setDiscountPrice] = useState(
    initial && initial.discountPrice > 0 ? String(initial.discountPrice) : '',
  );
  const [discountExpiry, setDiscountExpiry] = useState(toDateInput(initial?.discountExpiry ?? null));
  const [order, setOrder] = useState(String(initial?.order ?? defaultOrder));
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
  const [coverBytes, setCoverBytes] = useState(0);
  const [compressing, setCompressing] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const clearError = (field: FieldName) => {
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  // نضغط الصورة فور اختيارها، فيظهر الخطأ فورًا لو تعذر الوصول للحجم المسموح (60 كيلوبايت، 16:9).
  const handleCoverChange = async (file: File | null) => {
    clearError('cover');

    if (!file) {
      setCoverDataUrl(null);
      setCoverBytes(0);
      return;
    }

    setCompressing(true);
    try {
      const compressed = await compressImage(file, COVER_OPTIONS);
      setCoverDataUrl(compressed.dataUrl);
      setCoverBytes(compressed.bytes);
    } catch (error) {
      setCoverDataUrl(null);
      setCoverBytes(0);
      setErrors((previous) => ({ ...previous, cover: getImageErrorMessage(error) }));
    } finally {
      setCompressing(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const found: FormErrors = {};
    const priceNumber = price === '' ? 0 : Number(price);
    const discountNumber = discountPrice === '' ? 0 : Number(discountPrice);
    const orderNumber = order === '' ? NaN : Number(order);

    if (title.trim().length < 3) found.title = 'اكتب عنوان الكورس (3 أحرف على الأقل)';
    if (!isGradeCode(grade)) found.grade = 'اختر الصف الدراسي';
    if (!Number.isFinite(priceNumber) || priceNumber < 0) found.price = 'اكتب سعرًا صحيحًا';
    if (!isFree && priceNumber <= 0) found.price = 'اكتب سعر الكورس أو اجعله مجانيًا';
    if (hasDiscount && !isFree) {
      if (!Number.isFinite(discountNumber) || discountNumber <= 0 || discountNumber >= priceNumber) {
        found.discountPrice = 'سعر الخصم لازم يكون أكبر من صفر وأقل من السعر الأصلي';
      }
    }
    if (!Number.isFinite(orderNumber) || orderNumber < 0) found.order = 'اكتب رقم ترتيب صحيحًا';

    setErrors((previous) => ({ ...found, cover: previous.cover }));
    if (Object.keys(found).length > 0 || !isGradeCode(grade)) return;

    await onSubmit(
      {
        title,
        desc,
        grade,
        price: isFree ? 0 : priceNumber,
        isFree,
        hasDiscount: hasDiscount && !isFree,
        discountPrice: discountNumber,
        discountExpiry,
        order: orderNumber,
      },
      coverDataUrl,
    );
  };

  const shownImage = coverDataUrl || initial?.image || '';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Input
        label="عنوان الكورس"
        value={title}
        error={errors.title}
        onChange={(event) => {
          setTitle(event.target.value);
          clearError('title');
        }}
      />

      <div className="w-full">
        <label htmlFor="course-desc" className="mb-1.5 block text-sm font-medium text-slate-300">
          وصف الكورس
        </label>
        <textarea
          id="course-desc"
          rows={4}
          value={desc}
          onChange={(event) => setDesc(event.target.value)}
          className={textareaClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="الصف الدراسي"
          options={GRADE_OPTIONS}
          placeholder="اختر الصف"
          value={grade}
          error={errors.grade}
          onChange={(event) => {
            setGrade(event.target.value);
            clearError('grade');
          }}
        />
        <Input
          label="ترتيب الكورس"
          dir="ltr"
          inputMode="numeric"
          value={order}
          error={errors.order}
          onChange={(event) => {
            setOrder(numberText(event.target.value));
            clearError('order');
          }}
        />
      </div>

      <label className="flex items-center gap-3 text-slate-200">
        <input
          type="checkbox"
          checked={isFree}
          onChange={(event) => setIsFree(event.target.checked)}
          className={checkboxClass}
        />
        كورس مجاني
      </label>

      {!isFree && (
        <div className="space-y-4">
          <Input
            label="السعر (جنيه)"
            dir="ltr"
            inputMode="decimal"
            value={price}
            error={errors.price}
            onChange={(event) => {
              setPrice(numberText(event.target.value));
              clearError('price');
            }}
          />

          <label className="flex items-center gap-3 text-slate-200">
            <input
              type="checkbox"
              checked={hasDiscount}
              onChange={(event) => setHasDiscount(event.target.checked)}
              className={checkboxClass}
            />
            عليه خصم
          </label>

          {hasDiscount && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="السعر بعد الخصم (جنيه)"
                dir="ltr"
                inputMode="decimal"
                value={discountPrice}
                error={errors.discountPrice}
                onChange={(event) => {
                  setDiscountPrice(numberText(event.target.value));
                  clearError('discountPrice');
                }}
              />
              <Input
                label="آخر يوم للخصم (اختياري)"
                type="date"
                dir="ltr"
                value={discountExpiry}
                onChange={(event) => setDiscountExpiry(event.target.value)}
              />
            </div>
          )}
        </div>
      )}

      <div className="w-full">
        <label htmlFor="course-cover" className="mb-1.5 block text-sm font-medium text-slate-300">
          صورة الغلاف
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid aspect-video w-44 shrink-0 place-items-center overflow-hidden rounded-xl border border-navy-700 bg-navy-900 text-slate-500">
            {shownImage ? (
              <img src={shownImage} alt="معاينة الغلاف" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-8 w-8" />
            )}
          </div>
          <input
            id="course-cover"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={compressing}
            onChange={(event) => void handleCoverChange(event.target.files?.[0] ?? null)}
            className="max-w-full text-sm text-slate-300 file:me-3 file:rounded-lg file:border-0 file:bg-gold-500 file:px-4 file:py-2 file:font-bold file:text-navy-950"
          />
        </div>
        {errors.cover ? (
          <p className="mt-1.5 text-sm text-red-400">{errors.cover}</p>
        ) : compressing ? (
          <p className="mt-1.5 text-sm text-gold-300">جارٍ ضغط الصورة...</p>
        ) : coverBytes > 0 ? (
          <p className="mt-1.5 text-sm text-emerald-400">
            تم ضغط الصورة وقصها بنسبة 16:9. الحجم: {Math.round(coverBytes / 1024)} كيلوبايت.
          </p>
        ) : (
          <p className="mt-1.5 text-sm text-slate-500">
            تُضغط الصورة تلقائيًا (بنسبة 16:9 وحتى 60 كيلوبايت) وتُحفظ داخل بيانات الكورس.
          </p>
        )}
      </div>

      <Button type="submit" size="lg" loading={submitting} disabled={compressing}>
        {submitLabel}
      </Button>
    </form>
  );
}

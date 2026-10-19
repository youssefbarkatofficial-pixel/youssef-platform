/**
 * imageUpload.ts
 * معالجة وضغط وتجهيز صور المنصة في المتصفح قبل الرفع إلى Firestore
 * - ضغط إلى WebP بجودة >= 0.85 (تقليل الأبعاد أولاً قبل إنقاص الجودة)
 * - الحفاظ على شفافية صورة يوسف والشعار
 * - كشف حدود الجزء غير الشفاف (Bounding Box) وقص الفراغ مع الحفاظ على موضع الرأس
 * - سقف الأحجام: خلفية <= 200KB، يوسف <= 350KB، شعار <= 30KB
 */

export type MediaType = 'heroBg' | 'youssefCutout' | 'logo';

export interface ImageSpecs {
  maxBytes: number;
  maxDimension: number;
  preserveAlpha: boolean;
  trimTransparent: boolean;
  label: string;
  recommendedText: string;
}

export const MEDIA_SPECS: Record<MediaType, ImageSpecs> = {
  heroBg: {
    maxBytes: 200 * 1024,
    maxDimension: 1200,
    preserveAlpha: false,
    trimTransparent: false,
    label: 'خلفية الهيرو',
    recommendedText: 'الموصى به: أبعاد 1200×800 بكسل، حتى 200 كيلوبايت كحد أقصى.',
  },
  youssefCutout: {
    maxBytes: 350 * 1024,
    maxDimension: 1200,
    preserveAlpha: true,
    trimTransparent: false,
    label: 'صورة أ. يوسف بركات المفرغة',
    recommendedText: 'الموصى به: صورة مفرغة الخلفية (شفافة PNG أو WebP)، حتى 350 كيلوبايت كحد أقصى.',
  },
  logo: {
    maxBytes: 30 * 1024,
    maxDimension: 400,
    preserveAlpha: true,
    trimTransparent: false,
    label: 'شعار المنصة (الهيدر والفوتر)',
    recommendedText: 'الموصى به: شعار دائري أو مفرغ بأبعاد متساوية، حتى 30 كيلوبايت كحد أقصى.',
  },
};

export interface ProcessedImageResult {
  dataUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
  originalSizeBytes: number;
}

export function calculateBase64Bytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return dataUrl.length;
  const base64Str = dataUrl.slice(commaIndex + 1);
  return Math.round((base64Str.length * 3) / 4);
}

/**
 * كشف حدود الجزء غير الشفاف وقص الفراغ مع الحفاظ على موضع الرأس
 */
function cropTransparentMargins(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 12) {
        // بكسل مرئي غير شفاف
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // لو كانت الصورة فارغة أو بدون شفافية تامة
  if (maxX < minX || maxY < minY) {
    return canvas;
  }

  // إضافة هامش أمان بسيط (2 بكسل) دون تجاوز الحدود
  minX = Math.max(0, minX - 2);
  minY = Math.max(0, minY - 2);
  maxX = Math.min(width - 1, maxX + 2);
  maxY = Math.min(height - 1, maxY + 2);

  const croppedWidth = maxX - minX + 1;
  const croppedHeight = maxY - minY + 1;

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = croppedWidth;
  croppedCanvas.height = croppedHeight;
  const croppedCtx = croppedCanvas.getContext('2d');
  if (!croppedCtx) return canvas;

  croppedCtx.drawImage(
    canvas,
    minX,
    minY,
    croppedWidth,
    croppedHeight,
    0,
    0,
    croppedWidth,
    croppedHeight,
  );

  return croppedCanvas;
}

/**
 * معالجة وضغط الصورة إلى WebP مع الالتزام بحدود الحجم وجودة >= 0.85
 */
export async function processImageUpload(
  file: File,
  type: MediaType,
): Promise<ProcessedImageResult> {
  const spec = MEDIA_SPECS[type];
  const originalSizeBytes = file.size;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ملف الصورة تالف أو غير مدعوم.'));
      img.onload = () => {
        try {
          // 1. رسم الصورة الأولية على canvas
          let currentCanvas = document.createElement('canvas');
          currentCanvas.width = img.naturalWidth || img.width;
          currentCanvas.height = img.naturalHeight || img.height;
          const ctx = currentCanvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('تعذر إنشاء سياق الرسم في المتصفح.'));
          }

          if (!spec.preserveAlpha) {
            // لخلفية الهيرو: ملء الخلفية بلون بيس أولاً لمنع الشفافية غير المرغوبة
            ctx.fillStyle = '#071326';
            ctx.fillRect(0, 0, currentCanvas.width, currentCanvas.height);
          }

          ctx.drawImage(img, 0, 0);

          // 2. قص الفراغ الشفاف لصورة يوسف إذا طُلب ذلك
          if (spec.trimTransparent) {
            currentCanvas = cropTransparentMargins(currentCanvas);
          }

          // 3. تقليل الأبعاد لتناسب الحد الأقصى مع الحفاظ على نسبة العرض للارتفاع
          let targetWidth = currentCanvas.width;
          let targetHeight = currentCanvas.height;
          const maxDim = spec.maxDimension;

          if (targetWidth > maxDim || targetHeight > maxDim) {
            if (targetWidth > targetHeight) {
              targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
              targetWidth = maxDim;
            } else {
              targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
              targetHeight = maxDim;
            }
          }

          // إعادة الرسم بالأبعاد المستهدفة
          let scaledCanvas = document.createElement('canvas');
          scaledCanvas.width = targetWidth;
          scaledCanvas.height = targetHeight;
          let sCtx = scaledCanvas.getContext('2d');
          if (!sCtx) return reject(new Error('تعذر تجهيز الصورة بالأبعاد الجديدة.'));

          if (!spec.preserveAlpha) {
            sCtx.fillStyle = '#071326';
            sCtx.fillRect(0, 0, targetWidth, targetHeight);
          }
          sCtx.drawImage(currentCanvas, 0, 0, targetWidth, targetHeight);

          // 4. الضغط إلى WebP بجودة ثابتة >= 0.85 وتقليل الأبعاد قبل إنقاص الجودة
          const targetQuality = 0.88; // ثابته >= 0.85
          let dataUrl = scaledCanvas.toDataURL('image/webp', targetQuality);
          let sizeBytes = calculateBase64Bytes(dataUrl);

          // إذا تجاوز الحد الأقصى: نقلل الأبعاد تدريجياً أولاً دون النزول عن جودة 0.85
          let scaleFactor = 1.0;
          let attempts = 0;
          while (sizeBytes > spec.maxBytes && attempts < 8 && scaleFactor > 0.35) {
            attempts++;
            scaleFactor *= 0.88; // تقليل الأبعاد بنسبة 12%
            const nextW = Math.max(160, Math.round(targetWidth * scaleFactor));
            const nextH = Math.max(160, Math.round(targetHeight * scaleFactor));

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = nextW;
            tempCanvas.height = nextH;
            const tCtx = tempCanvas.getContext('2d');
            if (!tCtx) break;

            if (!spec.preserveAlpha) {
              tCtx.fillStyle = '#071326';
              tCtx.fillRect(0, 0, nextW, nextH);
            } else {
              tCtx.clearRect(0, 0, nextW, nextH);
            }
            tCtx.imageSmoothingEnabled = true;
            tCtx.imageSmoothingQuality = 'high';
            tCtx.drawImage(currentCanvas, 0, 0, nextW, nextH);

            dataUrl = tempCanvas.toDataURL('image/webp', 0.85); // لا تنزل تحت 0.85
            sizeBytes = calculateBase64Bytes(dataUrl);
            targetWidth = nextW;
            targetHeight = nextH;
          }

          // 5. فحص نهائي لسقف الحجم
          if (sizeBytes > spec.maxBytes) {
            const kbActual = Math.round(sizeBytes / 1024);
            const kbLimit = Math.round(spec.maxBytes / 1024);
            return reject(
              new Error(
                `حجم الصورة بعد الضغط (${kbActual} KB) يتجاوز الحد الأقصى المسموح (${kbLimit} KB). يُرجى اختيار صورة ذات أبعاد أو تفاصيل أصغر.`,
              ),
            );
          }

          resolve({
            dataUrl,
            sizeBytes,
            width: targetWidth,
            height: targetHeight,
            originalSizeBytes,
          });
        } catch (err: any) {
          reject(new Error(err?.message || 'حدث خطأ أثناء معالجة الصورة.'));
        }
      };
      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}

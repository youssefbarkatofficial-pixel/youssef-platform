// ضغط الصور داخل المتصفح وتحويلها إلى data URL، لتُخزَّن داخل مستندات Firestore
// (خطة Spark المجانية: بدون Cloud Storage).

// الحجم الأقصى المسموح للصورة الأصلية قبل الضغط.
export const MAX_SOURCE_SIZE = 10 * 1024 * 1024; // 10 ميجابايت

export interface CompressOptions {
  // أطول ضلع بالبكسل بعد الضغط
  maxSide: number;
  // الحجم الأقصى للصورة المضغوطة بالبايت
  maxBytes: number;
  // لو حُددت نسبة (عرض / ارتفاع) تُقص الصورة من المنتصف عليها
  aspect?: number;
  // أقل أطول ضلع مسموح عند التصغير التدريجي
  minSide?: number;
}

export interface CompressedImage {
  dataUrl: string;
  mime: 'image/jpeg' | 'image/webp';
  bytes: number;
  width: number;
  height: number;
}

// إيصال الدفع: أطول ضلع 1200 بكسل، والصورة حتى 117,000 بايت.
// (النص بعد تحويله Base64 يبقى أقل من 160,000 حرف، وهو حد قاعدة الأمان.)
export const PROOF_OPTIONS: CompressOptions = { maxSide: 1200, maxBytes: 117000, minSide: 500 };

// غلاف الكورس: نسبة 16:9، وعرض 960 بكسل، وحتى 60,000 بايت.
export const COVER_OPTIONS: CompressOptions = {
  maxSide: 960,
  maxBytes: 60000,
  aspect: 16 / 9,
  minSide: 320,
};

const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image-read-failed'));
    };

    image.src = url;
  });
}

function supportsWebp(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('image-read-failed'));
    reader.readAsDataURL(blob);
  });
}

// يصغّر الصورة ويخفض جودتها تدريجيًا حتى يصبح حجمها ضمن الحد المطلوب.
// لو لم ينجح (صورة معقدة جدًا) يرمي الخطأ image-too-detailed ولا يقبل صورة أكبر من الحد.
export async function compressImage(
  file: File,
  options: CompressOptions,
): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('invalid-image-type');
  }
  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error('image-source-too-large');
  }

  const image = await loadImage(file);

  // منطقة المصدر: الصورة كاملة، أو قص من المنتصف عند تحديد نسبة.
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.width;
  let sourceHeight = image.height;

  if (options.aspect) {
    const current = sourceWidth / sourceHeight;
    if (current > options.aspect) {
      sourceWidth = Math.round(sourceHeight * options.aspect);
      sourceX = Math.round((image.width - sourceWidth) / 2);
    } else {
      sourceHeight = Math.round(sourceWidth / options.aspect);
      sourceY = Math.round((image.height - sourceHeight) / 2);
    }
  }

  const mime: 'image/jpeg' | 'image/webp' = supportsWebp() ? 'image/webp' : 'image/jpeg';
  const minSide = options.minSide ?? 320;
  const longestSource = Math.max(sourceWidth, sourceHeight);

  // لا نكبّر الصورة أبدًا، فقط نصغّرها.
  let side = Math.min(options.maxSide, longestSource);

  while (side >= minSide) {
    const scale = side / longestSource;
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('image-compress-failed');
    }

    // خلفية بيضاء حتى لا تصبح الصور الشفافة سوداء بعد التحويل.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);

    for (const quality of QUALITIES) {
      const blob = await canvasToBlob(canvas, mime, quality);
      if (blob && blob.size <= options.maxBytes) {
        const dataUrl = await blobToDataUrl(blob);
        return { dataUrl, mime, bytes: blob.size, width, height };
      }
    }

    side = Math.floor(side * 0.85);
  }

  throw new Error('image-too-detailed');
}

export function getImageErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';

  switch (message) {
    case 'invalid-image-type':
      return 'اختر ملف صورة (JPG أو PNG أو WEBP).';
    case 'image-source-too-large':
      return 'حجم الصورة الأصلي أكبر من 10 ميجابايت. اختر صورة أصغر.';
    case 'image-read-failed':
      return 'تعذر قراءة الصورة. جرّب صورة أخرى بصيغة JPG أو PNG.';
    case 'image-too-detailed':
      return 'تعذر تصغير الصورة إلى الحجم المسموح. جرّب صورة أبسط أو أقل تفاصيل.';
    default:
      return 'تعذر معالجة الصورة. جرّب صورة أخرى.';
  }
}

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// settings/generalSettings = { allowRegistration, welcomeMessage, courseStatus } (نفس شكل المنصة القديمة).
export interface GeneralSettings {
  allowRegistration: boolean;
  welcomeMessage: string;
  courseStatus: string;
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  allowRegistration: true,
  welcomeMessage: '',
  courseStatus: '',
};

// لو المستند غير موجود أو فشلت القراءة: التسجيل مفتوح (لا نقفل الموقع بسبب خطأ شبكة).
export async function getGeneralSettings(): Promise<GeneralSettings> {
  try {
    const snapshot = await getDoc(doc(db, 'settings', 'generalSettings'));
    if (!snapshot.exists()) return DEFAULT_GENERAL_SETTINGS;

    const data = snapshot.data();
    return {
      allowRegistration: data.allowRegistration !== false,
      welcomeMessage: typeof data.welcomeMessage === 'string' ? data.welcomeMessage : '',
      courseStatus: typeof data.courseStatus === 'string' ? data.courseStatus : '',
    };
  } catch {
    return DEFAULT_GENERAL_SETTINGS;
  }
}

export async function saveGeneralSettings(values: GeneralSettings): Promise<void> {
  await setDoc(
    doc(db, 'settings', 'generalSettings'),
    {
      allowRegistration: values.allowRegistration,
      welcomeMessage: values.welcomeMessage.trim().slice(0, 500),
      courseStatus: values.courseStatus.trim().slice(0, 100),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// ---------- مهمة S: الهوية البصرية وشريط الاقتباسات (platform_settings/generalSettings + platform_media) ----------

export type MediaDocType = 'heroBg' | 'youssefCutout' | 'logo';

export interface MediaVersions {
  heroBg?: number;
  youssefCutout?: number;
  logo?: number;
}

export interface PlatformStats {
  views?: string;        // مشاهدات (يوتيوب)
  subscribers?: string;  // مشتركين
  students?: string;     // طلاب
  lessons?: string;      // دروس
}

export interface PlatformMediaSettings {
  heroBgUrl: string;
  youssefCutoutUrl: string;
  logoUrl: string;
  tickerQuotes: string[];
  mediaVersions?: MediaVersions;
  stats?: PlatformStats;
}

export const DEFAULT_PLATFORM_MEDIA: PlatformMediaSettings = {
  heroBgUrl: '',
  youssefCutoutUrl: '',
  logoUrl: '/icons/logo.svg',
  tickerQuotes: [
    'اعتنوا بأبنائكم فالعلم وُضع لأمثالهم — أ. يوسف بركات',
    'هدفنا ليس الوصول إلى المجد.. بل أن نصنع المجد بأنفسنا ونضع بصمة عريقة فى أبنائنا — أ. يوسف بركات',
    'منصتك الأولى لتعلم وفهم الجغرافيا والتاريخ بأسلوب بسيط وممتع',
    'العلم نور.. ونور الله لا يُهدى إلا للمتقين — فاتقِ الله',
  ],
  mediaVersions: {},
  stats: {
    views: '',
    subscribers: '',
    students: '',
    lessons: '',
  },
};

let cachedMedia: PlatformMediaSettings | null = null;

async function resolveMediaUrl(
  type: MediaDocType,
  serverVersion: number | undefined,
  fallbackUrl: string,
): Promise<string> {
  if (!serverVersion || serverVersion <= 0) {
    return fallbackUrl;
  }

  // 1. فحص الكاش المحلي في المتصفح أولاً
  try {
    const cachedVer = localStorage.getItem(`yb_media_${type}_v`);
    const cachedData = localStorage.getItem(`yb_media_${type}_data`);
    if (cachedVer === String(serverVersion) && cachedData) {
      return cachedData;
    }
  } catch {
    // localStorage not accessible
  }

  // 2. الجلب من Firestore عند وجود نسخة جديدة أو غياب الكاش
  try {
    const mediaSnap = await getDoc(doc(db, 'platform_media', type));
    if (mediaSnap.exists()) {
      const data = mediaSnap.data();
      if (typeof data.dataUrl === 'string' && data.dataUrl.length > 0) {
        try {
          localStorage.setItem(`yb_media_${type}_v`, String(serverVersion));
          localStorage.setItem(`yb_media_${type}_data`, data.dataUrl);
        } catch {
          // localStorage quota exceeded or disabled
        }
        return data.dataUrl;
      }
    }
  } catch {
    // شبكة أو أذونات
  }

  return fallbackUrl;
}

export async function getPlatformMediaSettings(forceRefresh = false): Promise<PlatformMediaSettings> {
  if (cachedMedia && !forceRefresh) return cachedMedia;

  try {
    const snap = await getDoc(doc(db, 'platform_settings', 'generalSettings'));
    if (!snap.exists()) {
      cachedMedia = DEFAULT_PLATFORM_MEDIA;
      return DEFAULT_PLATFORM_MEDIA;
    }

    const data = snap.data();
    const mediaVersions: MediaVersions = data.mediaVersions || {};

    const rawHeroBg =
      typeof data.heroBgUrl === 'string' && data.heroBgUrl.trim().length > 0
        ? data.heroBgUrl.trim()
        : DEFAULT_PLATFORM_MEDIA.heroBgUrl;

    const rawCutout =
      typeof data.youssefCutoutUrl === 'string' && data.youssefCutoutUrl.trim().length > 0
        ? data.youssefCutoutUrl.trim()
        : DEFAULT_PLATFORM_MEDIA.youssefCutoutUrl;

    const rawLogo =
      typeof data.logoUrl === 'string' && data.logoUrl.trim().length > 0
        ? data.logoUrl.trim()
        : DEFAULT_PLATFORM_MEDIA.logoUrl;

    // استرجاع الصورة من المستند إن وجدت نسخة مرفوعة أو استخدام الرابط/الافتراضي
    const [heroBgUrl, youssefCutoutUrl, logoUrl] = await Promise.all([
      resolveMediaUrl('heroBg', mediaVersions.heroBg, rawHeroBg),
      resolveMediaUrl('youssefCutout', mediaVersions.youssefCutout, rawCutout),
      resolveMediaUrl('logo', mediaVersions.logo, rawLogo),
    ]);

    const tickerQuotes =
      Array.isArray(data.tickerQuotes) && data.tickerQuotes.length > 0
        ? data.tickerQuotes
            .filter((q: unknown) => typeof q === 'string' && q.trim().length > 0)
            .map((q: string) => q.trim())
        : DEFAULT_PLATFORM_MEDIA.tickerQuotes;

    const rawStats = (data.stats && typeof data.stats === 'object') ? data.stats : {};
    const parseStatField = (v1: unknown, v2: unknown): string => {
      if (typeof v1 === 'string') return v1.trim();
      if (typeof v1 === 'number') return String(v1);
      if (typeof v2 === 'string') return v2.trim();
      if (typeof v2 === 'number') return String(v2);
      return '';
    };

    const stats: PlatformStats = {
      views: parseStatField(rawStats.views, data.statsViews),
      subscribers: parseStatField(rawStats.subscribers, data.statsSubscribers),
      students: parseStatField(rawStats.students, data.statsStudents),
      lessons: parseStatField(rawStats.lessons, data.statsLessons),
    };

    cachedMedia = { heroBgUrl, youssefCutoutUrl, logoUrl, tickerQuotes, mediaVersions, stats };
    return cachedMedia;
  } catch {
    cachedMedia = DEFAULT_PLATFORM_MEDIA;
    return DEFAULT_PLATFORM_MEDIA;
  }
}

export async function savePlatformMediaSettings(
  values: Partial<PlatformMediaSettings>,
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (values.heroBgUrl !== undefined) {
    payload.heroBgUrl = values.heroBgUrl.trim();
  }
  if (values.youssefCutoutUrl !== undefined) {
    payload.youssefCutoutUrl = values.youssefCutoutUrl.trim();
  }
  if (values.logoUrl !== undefined) {
    payload.logoUrl = values.logoUrl.trim();
  }
  if (values.tickerQuotes !== undefined) {
    payload.tickerQuotes = values.tickerQuotes
      .map((q) => q.trim())
      .filter((q) => q.length > 0)
      .slice(0, 50);
  }
  if (values.stats !== undefined) {
    payload.stats = {
      views: values.stats.views !== undefined ? String(values.stats.views).trim() : '',
      subscribers: values.stats.subscribers !== undefined ? String(values.stats.subscribers).trim() : '',
      students: values.stats.students !== undefined ? String(values.stats.students).trim() : '',
      lessons: values.stats.lessons !== undefined ? String(values.stats.lessons).trim() : '',
    };
  }

  await setDoc(doc(db, 'platform_settings', 'generalSettings'), payload, { merge: true });
  cachedMedia = null;
}

/**
 * حفظ صورة مرفوعة ومضغوطة في مستند Firestore الخاص بها وتحديث نسختها في الإعدادات
 */
export async function saveUploadedMediaDoc(
  type: MediaDocType,
  dataUrl: string,
  sizeBytes: number,
): Promise<number> {
  const newVersion = Date.now();

  // 1. حفظ مستند الصورة المنفصل في platform_media/{type}
  await setDoc(doc(db, 'platform_media', type), {
    dataUrl,
    version: newVersion,
    sizeBytes,
    updatedAt: serverTimestamp(),
  });

  // 2. تسجيل النسخة المصغرة في platform_settings/generalSettings
  await setDoc(
    doc(db, 'platform_settings', 'generalSettings'),
    {
      mediaVersions: {
        [type]: newVersion,
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  // 3. تخزين محلي فوري
  try {
    localStorage.setItem(`yb_media_${type}_v`, String(newVersion));
    localStorage.setItem(`yb_media_${type}_data`, dataUrl);
  } catch {
    // ignore
  }

  cachedMedia = null;
  return newVersion;
}

/**
 * استرجاع الصورة الافتراضية وحذف تخصيص مستند الصورة
 */
export async function resetUploadedMediaDoc(type: MediaDocType): Promise<void> {
  // إلغاء النسخة في الإعدادات
  await setDoc(
    doc(db, 'platform_settings', 'generalSettings'),
    {
      mediaVersions: {
        [type]: 0,
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  // مسح الكاش المحلي
  try {
    localStorage.removeItem(`yb_media_${type}_v`);
    localStorage.removeItem(`yb_media_${type}_data`);
  } catch {
    // ignore
  }

  cachedMedia = null;
}

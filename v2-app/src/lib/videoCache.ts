import type { VideoKind } from './media.ts';

export const VIDEO_CACHE_NAME = 'yb-video-offline-v1';
const META_KEY = 'yb_video_cache_meta_v1';
const MIN_COMPLETION_RATIO = 0.95;

export interface CachedVideoMeta {
  cacheKey: string;
  studentId: string;
  courseId: string;
  itemId: string;
  sourceUrl: string;
  cachedAt: number;
  expiresAt: number; // 0 = غير محدد (ترم كامل)
  byteLength: number;
}

export interface OfflineVideoGateInput {
  videoKind: VideoKind;
  completed: boolean;
  coverage: number;
  hasAccess: boolean;
  archived: boolean;
  isAdmin: boolean;
  expiresAt?: number;
  now?: number;
}

export interface OfflineVideoGateDecision {
  eligibleToCache: boolean;
  eligibleToPlay: boolean;
  shouldEvict: boolean;
  reason?: string;
}

/**
 * تحديد صلاحية حفظ وتشغيل الفيديو من الكاش الخاص بالمتصفح (CacheStorage فقط).
 * - يتطلب صلاحية اشتراك نشطة + اكتمال مشاهدة الحصة (>= 95% أو مكتملة).
 * - فيديوهات اليوتيوب/فيميو داخل iframe لا تُخزن محلياً بسبب قيود CORS/DRM للمتصفح.
 */
export function canUseOfflineVideoCache(input: OfflineVideoGateInput): OfflineVideoGateDecision {
  const now = input.now ?? Date.now();
  const expired = typeof input.expiresAt === 'number' && input.expiresAt > 0 && now >= input.expiresAt;

  if (input.archived || !input.hasAccess || expired) {
    return {
      eligibleToCache: false,
      eligibleToPlay: false,
      shouldEvict: true,
      reason: 'انتهت صلاحية الاشتراك أو الوصول للكورس',
    };
  }

  if (input.videoKind !== 'file') {
    return {
      eligibleToCache: false,
      eligibleToPlay: false,
      shouldEvict: false,
      reason: 'فيديوهات البث الخارجي (YouTube/Vimeo) تتطلب اتصالاً بالإنترنت',
    };
  }

  const isCompleted = input.completed || input.coverage >= MIN_COMPLETION_RATIO || input.isAdmin;
  if (!isCompleted) {
    return {
      eligibleToCache: false,
      eligibleToPlay: false,
      shouldEvict: false,
      reason: 'يُتاح الحفظ في كاش التطبيق بعد إتمام مشاهدة المحاضرة',
    };
  }

  return {
    eligibleToCache: true,
    eligibleToPlay: true,
    shouldEvict: false,
  };
}

export function buildScopedVideoCacheKey(studentId: string, courseId: string, itemId: string): string {
  const s = encodeURIComponent(studentId || 'guest');
  const c = encodeURIComponent(courseId || 'course');
  const i = encodeURIComponent(itemId || 'item');
  return `/__yb_offline_video__/${s}/${c}/${i}`;
}

export function isVideoCacheSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'caches' in window &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  );
}

function readMetaMap(): Record<string, CachedVideoMeta> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, CachedVideoMeta>)
      : {};
  } catch {
    return {};
  }
}

function writeMetaMap(map: Record<string, CachedVideoMeta>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(map));
  } catch {
    // تجاهل امتلاء localStorage بهدوء
  }
}

export function hasCachedVideoMeta(
  studentId: string,
  courseId: string,
  itemId: string,
  sourceUrl: string,
): boolean {
  if (!studentId || !courseId || !itemId || !sourceUrl) return false;
  const key = buildScopedVideoCacheKey(studentId, courseId, itemId);
  const entry = readMetaMap()[key];
  return Boolean(entry && entry.sourceUrl === sourceUrl);
}

/**
 * حذف كاش فيديوهات كورس معين لطالب معين (مثلاً عند انتهاء الشهر أو المحاضرة التجريبية أو سحب الاشتراك).
 */
export async function purgeCourseVideoCache(studentId: string, courseId: string): Promise<void> {
  if (!isVideoCacheSupported() || !courseId) return;
  const map = readMetaMap();
  const prefix = buildScopedVideoCacheKey(studentId, courseId, '');
  const cache = await caches.open(VIDEO_CACHE_NAME);

  let changed = false;
  for (const [key, meta] of Object.entries(map)) {
    if (key.startsWith(prefix) || (meta.studentId === studentId && meta.courseId === courseId)) {
      await cache.delete(key).catch(() => undefined);
      delete map[key];
      changed = true;
    }
  }
  if (changed) writeMetaMap(map);
}

/**
 * تنظيف الكاش عند تسجيل الخروج أو انتهاء مدة أي صلاحية.
 */
export async function purgeExpiredOrForeignVideoCaches(
  activeStudentId: string | null,
  now: number = Date.now(),
): Promise<void> {
  if (!isVideoCacheSupported()) return;
  const map = readMetaMap();
  const cache = await caches.open(VIDEO_CACHE_NAME);

  let changed = false;
  for (const [key, meta] of Object.entries(map)) {
    const wrongStudent = !activeStudentId || meta.studentId !== activeStudentId;
    const isExpired = meta.expiresAt > 0 && now >= meta.expiresAt;
    if (wrongStudent || isExpired) {
      await cache.delete(key).catch(() => undefined);
      delete map[key];
      changed = true;
    }
  }
  if (changed) writeMetaMap(map);
}

/**
 * حفظ ملف فيديو مباشر (.mp4/.webm) في CacheStorage بعد إتمام مشاهدته.
 * لا يُحمّل في مجلد التنزيلات أو المعرض إطلاقاً (معزول داخل أصل التطبيق فقط).
 */
export async function cacheWatchedVideo(params: {
  studentId: string;
  courseId: string;
  itemId: string;
  sourceUrl: string;
  expiresAt?: number;
}): Promise<boolean> {
  if (!isVideoCacheSupported()) return false;
  const { studentId, courseId, itemId, sourceUrl, expiresAt = 0 } = params;
  if (!studentId || !courseId || !itemId || !sourceUrl) return false;

  const cacheKey = buildScopedVideoCacheKey(studentId, courseId, itemId);
  const existing = readMetaMap()[cacheKey];
  if (existing && existing.sourceUrl === sourceUrl) {
    // تحديث تاريخ الانتهاء فقط لو تغير الاشتراك (مثلاً تمدد لترم كامل)
    if (existing.expiresAt !== expiresAt) {
      const map = readMetaMap();
      map[cacheKey] = { ...existing, expiresAt };
      writeMetaMap(map);
    }
    return true;
  }

  try {
    const response = await fetch(sourceUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok || response.type === 'opaque') {
      return false;
    }

    const contentLengthHeader = response.headers.get('content-length');
    const byteLength = contentLengthHeader ? Number(contentLengthHeader) || 0 : 0;

    const cache = await caches.open(VIDEO_CACHE_NAME);
    await cache.put(cacheKey, response);

    const map = readMetaMap();
    map[cacheKey] = {
      cacheKey,
      studentId,
      courseId,
      itemId,
      sourceUrl,
      cachedAt: Date.now(),
      expiresAt,
      byteLength,
    };
    writeMetaMap(map);
    return true;
  } catch {
    return false;
  }
}

/**
 * استرجاع رابط تشغيل مؤقت في الذاكرة (blob:) من CacheStorage إذا ما زال الاشتراك سارياً.
 */
export async function getCachedVideoObjectUrl(params: {
  studentId: string;
  courseId: string;
  itemId: string;
  sourceUrl: string;
  gate: OfflineVideoGateDecision;
}): Promise<string | null> {
  if (!isVideoCacheSupported()) return null;
  const { studentId, courseId, itemId, sourceUrl, gate } = params;

  if (gate.shouldEvict) {
    await purgeCourseVideoCache(studentId, courseId);
    return null;
  }

  if (!gate.eligibleToPlay) return null;

  const cacheKey = buildScopedVideoCacheKey(studentId, courseId, itemId);
  const meta = readMetaMap()[cacheKey];
  if (!meta || meta.sourceUrl !== sourceUrl) return null;

  try {
    const cache = await caches.open(VIDEO_CACHE_NAME);
    const cachedResponse = await cache.match(cacheKey);
    if (!cachedResponse) return null;

    const blob = await cachedResponse.blob();
    if (!blob || blob.size === 0) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

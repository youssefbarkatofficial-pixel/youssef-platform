export type VideoKind = 'youtube' | 'vimeo' | 'file' | 'unknown';

export interface VideoSource {
  kind: VideoKind;
  // رابط التضمين (iframe) لليوتيوب وفيميو، أو رابط الملف المباشر.
  src: string;
}

const FILE_PATTERN = /\.(mp4|webm|ogg|ogv|mov|m4v)$/i;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;
const VIMEO_ID = /^[0-9]{5,15}$/;

// يقبل روابط http و https فقط (يمنع روابط خطرة مثل javascript:).
export function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

export function isSafeHttpUrl(value: string): boolean {
  return parseHttpUrl(value) !== null;
}

function getYoutubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  let id: string | null = null;

  if (host === 'youtu.be') {
    id = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v');
    if (!id) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
        id = parts[1];
      }
    }
  }

  return id && YOUTUBE_ID.test(id) ? id : null;
}

function getVimeoEmbed(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null;

  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts.find((part) => VIMEO_ID.test(part));
  if (!id) return null;

  const nextPart = parts[parts.indexOf(id) + 1];
  const hash =
    url.searchParams.get('h') ?? (nextPart && /^[a-f0-9]{6,}$/i.test(nextPart) ? nextPart : null);

  return `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ''}`;
}

// يحدد نوع الفيديو (يوتيوب أو فيميو أو ملف مباشر) ويرجع رابط التشغيل المناسب.
export function getVideoSource(value: string): VideoSource {
  const url = parseHttpUrl(value);
  if (!url) return { kind: 'unknown', src: '' };

  const youtubeId = getYoutubeId(url);
  if (youtubeId) {
    return {
      kind: 'youtube',
      src: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1`,
    };
  }

  const vimeoEmbed = getVimeoEmbed(url);
  if (vimeoEmbed) return { kind: 'vimeo', src: vimeoEmbed };

  if (FILE_PATTERN.test(url.pathname)) return { kind: 'file', src: url.toString() };

  return { kind: 'unknown', src: '' };
}

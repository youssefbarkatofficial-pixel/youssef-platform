import { useEffect, useMemo, useRef, useState } from 'react';
import { EyeOff, VideoOff } from 'lucide-react';
import { getVideoSource } from '../../lib/media';

// تنبيه مهم: هذه الحماية ضعيفة ولا تمنع من يريد التسريب فعلًا
// (يمكن تصوير الشاشة، والعلامة المائية لا تظهر في وضع ملء الشاشة داخل يوتيوب وفيميو).
// الحماية الأقوى هي استضافة الفيديو بروابط موقّعة مؤقتة، وهي مرحلة مستقبلية.
// ما نفعله هنا: علامة مائية متحركة باسم الطالب ورقمه، ومنع الكليك اليمين،
// ومنع زر التحميل في مشغل الملفات، وتغبيش الشاشة عند ترك التبويب.

interface ProtectedVideoPlayerProps {
  title: string;
  url: string;
  watermarkText: string;
}

export default function ProtectedVideoPlayer({ title, url, watermarkText }: ProtectedVideoPlayerProps) {
  const source = useMemo(() => getVideoSource(url), [url]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [away, setAway] = useState(false);
  const [position, setPosition] = useState({ top: 12, left: 12 });

  // تغبيش الشاشة عند ترك التبويب.
  // حدث blur للنافذة لا نستخدمه مع يوتيوب وفيميو، لأن الضغط داخل المشغل نفسه يطلقه.
  useEffect(() => {
    const handleAway = () => {
      setAway(true);
      videoRef.current?.pause();
    };
    const handleBack = () => setAway(false);
    const handleVisibility = () => {
      if (document.hidden) handleAway();
      else handleBack();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    if (source.kind === 'file') {
      window.addEventListener('blur', handleAway);
      window.addEventListener('focus', handleBack);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleAway);
      window.removeEventListener('focus', handleBack);
    };
  }, [source.kind]);

  // تحريك العلامة المائية كل بضع ثوانٍ حتى يصعب قصها من الفيديو.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPosition({ top: 8 + Math.random() * 70, left: 5 + Math.random() * 55 });
    }, 7000);

    return () => window.clearInterval(timer);
  }, []);

  if (source.kind === 'unknown') {
    return (
      <div className="grid aspect-video w-full place-items-center rounded-2xl bg-navy-900 p-6 text-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <VideoOff className="h-10 w-10 text-gold-500" />
          <p className="text-sm">رابط هذا الفيديو غير مدعوم أو غير صحيح. أبلغ الإدارة.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative aspect-video w-full select-none overflow-hidden rounded-2xl bg-black"
      onContextMenu={(event) => event.preventDefault()}
    >
      {source.kind === 'file' ? (
        <video
          ref={videoRef}
          src={source.src}
          title={title}
          controls
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          playsInline
          onContextMenu={(event) => event.preventDefault()}
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <iframe
          src={source.src}
          title={title}
          allow="encrypted-media; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      )}

      <div
        className="pointer-events-none absolute z-10 select-none whitespace-nowrap rounded bg-black/25 px-2 py-1 text-xs font-bold text-white/50 transition-all duration-1000"
        style={{ top: `${position.top}%`, left: `${position.left}%` }}
      >
        {watermarkText}
      </div>

      {away && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-navy-950/90 backdrop-blur-2xl">
          <div className="flex flex-col items-center gap-3 px-4 text-center text-slate-300">
            <EyeOff className="h-10 w-10 text-gold-500" />
            <p className="text-sm font-bold">عُد إلى هذه الصفحة لمتابعة المشاهدة</p>
          </div>
        </div>
      )}
    </div>
  );
}

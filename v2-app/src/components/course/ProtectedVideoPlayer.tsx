import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { EyeOff, VideoOff, CheckCircle2 } from 'lucide-react';
import { getVideoSource } from '../../lib/media';
import {
  createWatchState,
  processPlaybackTick,
  updatePlayerStatus,
  WATCH_THRESHOLD
} from '../../lib/watchTracker.ts';
import type { WatchState } from '../../lib/watchTracker.ts';
import { getStoredWatchProgress, persistWatchProgress } from '../../services/watchProgress';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface ProtectedVideoPlayerProps {
  title: string;
  url: string;
  watermarkText: string;
  itemId?: string;
  studentId?: string;
  onProgressChange?: (coverage: number, completed: boolean) => void;
}

export default function ProtectedVideoPlayer({
  title,
  url,
  watermarkText,
  itemId,
  studentId,
  onProgressChange
}: ProtectedVideoPlayerProps) {
  const source = useMemo(() => getVideoSource(url), [url]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const containerId = useMemo(() => `yt-player-${Math.random().toString(36).slice(2, 9)}`, []);

  const [away, setAway] = useState(false);
  const [position, setPosition] = useState({ top: 12, left: 12 });
  const [watchState, setWatchState] = useState<WatchState>(() => createWatchState(itemId || 'video', 0));
  const watchStateRef = useRef<WatchState>(watchState);
  watchStateRef.current = watchState;

  const lastSaveTimeRef = useRef<number>(Date.now());

  // حفظ التقدم في Firestore
  const saveCurrentProgress = useCallback(async () => {
    if (!studentId || !itemId) return;
    const current = watchStateRef.current;
    if (current.totalDuration > 0) {
      await persistWatchProgress(studentId, current);
      lastSaveTimeRef.current = Date.now();
    }
  }, [studentId, itemId]);

  // إشعار الصفحة الخارجية بالتغير
  useEffect(() => {
    if (onProgressChange) {
      onProgressChange(watchState.coverage, watchState.completed);
    }
  }, [watchState.coverage, watchState.completed, onProgressChange]);

  // تحميل التقدم السابق من Firestore
  useEffect(() => {
    if (!studentId || !itemId) return;
    let active = true;

    void getStoredWatchProgress(studentId, itemId).then((saved) => {
      if (!active || !saved) return;
      setWatchState(saved);
      if (onProgressChange) {
        onProgressChange(saved.coverage, saved.completed);
      }
    });

    return () => {
      active = false;
    };
  }, [studentId, itemId, onProgressChange]);

  // استخراج YouTube Video ID
  const ytVideoId = useMemo(() => {
    if (source.kind !== 'youtube') return null;
    const match = source.src.match(/\/embed\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }, [source]);

  // تهيئة مشغل YouTube IFrame API
  useEffect(() => {
    if (source.kind !== 'youtube' || !ytVideoId) return;

    let destroyed = false;
    let pollTimer: number | null = null;

    const initPlayer = () => {
      if (destroyed || !window.YT || !window.YT.Player) return;

      try {
        ytPlayerRef.current = new window.YT.Player(containerId, {
          videoId: ytVideoId,
          playerVars: {
            enablejsapi: 1,
            origin: window.location.origin,
            rel: 0,
            modestbranding: 1
          },
          events: {
            onReady: (event: any) => {
              if (destroyed) return;
              const dur = event.target.getDuration();
              if (dur > 0) {
                setWatchState((prev) => updatePlayerStatus(prev, { totalDuration: dur }));
              }
            },
            onStateChange: (event: any) => {
              if (destroyed) return;
              const isPlaying = event.data === 1; // YT.PlayerState.PLAYING
              const isPaused = event.data === 2; // YT.PlayerState.PAUSED
              const isEnded = event.data === 0; // YT.PlayerState.ENDED

              if (isPlaying) {
                const dur = event.target.getDuration();
                const cur = event.target.getCurrentTime();
                const rate = event.target.getPlaybackRate();
                setWatchState((prev) =>
                  updatePlayerStatus(prev, {
                    isPlaying: true,
                    totalDuration: dur,
                    currentTime: cur,
                    playbackRate: rate,
                    isTabVisible: !document.hidden
                  })
                );
              } else if (isPaused || isEnded) {
                setWatchState((prev) => updatePlayerStatus(prev, { isPlaying: false }));
                void saveCurrentProgress();
              }
            }
          }
        });
      } catch (err) {
        console.warn('YouTube IFrame API init error:', err);
      }
    };

    // تحميل YouTube IFrame API script إن لم يكن موجودًا
    if (!window.YT) {
      const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        initPlayer();
      };
    } else {
      initPlayer();
    }

    // نبضة زمنية كل ثانية أثناء التشغيل
    pollTimer = window.setInterval(() => {
      if (destroyed || !ytPlayerRef.current) return;
      try {
        if (typeof ytPlayerRef.current.getPlayerState === 'function') {
          const state = ytPlayerRef.current.getPlayerState();
          if (state === 1) { // PLAYING
            const curTime = ytPlayerRef.current.getCurrentTime();
            const rate = ytPlayerRef.current.getPlaybackRate();
            const dur = ytPlayerRef.current.getDuration();

            setWatchState((prev) => {
              let updated = updatePlayerStatus(prev, {
                isPlaying: true,
                playbackRate: rate,
                totalDuration: dur,
                isTabVisible: !document.hidden
              });
              return processPlaybackTick(updated, curTime, Date.now());
            });

            // حفظ كل 15 ثانية
            if (Date.now() - lastSaveTimeRef.current >= 30000) {
              void saveCurrentProgress();
            }
          }
        }
      } catch {}
    }, 1000);

    return () => {
      destroyed = true;
      if (pollTimer) window.clearInterval(pollTimer);
      void saveCurrentProgress();
      try {
        ytPlayerRef.current?.destroy();
      } catch {}
    };
  }, [source.kind, ytVideoId, containerId, saveCurrentProgress]);

  // إدارة التبويب المخفي والصفحة المغلقة
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setAway(true);
        if (videoRef.current) videoRef.current.pause();
        if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
          ytPlayerRef.current.pauseVideo();
        }
        setWatchState((prev) => updatePlayerStatus(prev, { isTabVisible: false, isPlaying: false }));
        void saveCurrentProgress();
      } else {
        setAway(false);
        setWatchState((prev) => updatePlayerStatus(prev, { isTabVisible: true }));
      }
    };

    const handlePageHide = () => {
      void saveCurrentProgress();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      void saveCurrentProgress();
    };
  }, [saveCurrentProgress]);

  // تحريك العلامة المائية
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

  const coveragePercent = Math.min(100, Math.round(watchState.coverage * 100));

  return (
    <div className="space-y-2">
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
            onPlay={() => {
              const dur = videoRef.current?.duration || 0;
              const rate = videoRef.current?.playbackRate || 1.0;
              setWatchState((prev) =>
                updatePlayerStatus(prev, { isPlaying: true, totalDuration: dur, playbackRate: rate })
              );
            }}
            onPause={() => {
              setWatchState((prev) => updatePlayerStatus(prev, { isPlaying: false }));
              void saveCurrentProgress();
            }}
            onEnded={() => {
              setWatchState((prev) => updatePlayerStatus(prev, { isPlaying: false }));
              void saveCurrentProgress();
            }}
            onTimeUpdate={() => {
              if (!videoRef.current) return;
              const cur = videoRef.current.currentTime;
              const rate = videoRef.current.playbackRate;
              const dur = videoRef.current.duration;
              setWatchState((prev) => {
                let updated = updatePlayerStatus(prev, {
                  isPlaying: !videoRef.current?.paused,
                  playbackRate: rate,
                  totalDuration: dur,
                  isTabVisible: !document.hidden
                });
                return processPlaybackTick(updated, cur, Date.now());
              });

              if (Date.now() - lastSaveTimeRef.current >= 15000) {
                void saveCurrentProgress();
              }
            }}
            onContextMenu={(event) => event.preventDefault()}
            className="absolute inset-0 h-full w-full"
          />
        ) : source.kind === 'youtube' ? (
          <div className="absolute inset-0 h-full w-full">
            <div id={containerId} className="h-full w-full border-0" />
          </div>
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

      {/* شريط تقدم المشاهدة الصارم بالنسبة المئوية */}
      <div className="rounded-xl border border-navy-800 bg-navy-950/60 p-3">
        <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
          <span className="text-slate-400">نسبة مشاهدة المحاضرة</span>
          <span className="flex items-center gap-1.5 text-gold-400">
            {coveragePercent}%
            {watchState.completed && (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>(مكتملة)</span>
              </span>
            )}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-navy-800">
          <div
            className={`h-full transition-all duration-300 ${
              watchState.completed ? 'bg-emerald-500' : 'bg-gradient-to-r from-gold-600 to-gold-400'
            }`}
            style={{ width: `${coveragePercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

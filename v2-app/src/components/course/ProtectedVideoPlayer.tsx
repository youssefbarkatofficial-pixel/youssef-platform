import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  CheckCircle2,
  EyeOff,
  HardDriveDownload,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  VideoOff,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { getVideoSource } from '../../lib/media';
import {
  cacheWatchedVideo,
  canUseOfflineVideoCache,
  getCachedVideoObjectUrl,
  hasCachedVideoMeta,
  purgeCourseVideoCache,
} from '../../lib/videoCache';
import {
  createWatchState,
  processPlaybackTick,
  updatePlayerStatus,
  shouldFlush,
  WATCH_THRESHOLD,
  WATCH_MILESTONES,
} from '../../lib/watchTracker.ts';
import type { WatchState, FlushTrigger } from '../../lib/watchTracker.ts';
import {
  getStoredWatchProgress,
  persistWatchProgress,
  flushPendingWatchQueue,
} from '../../services/watchProgress';

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
  courseId?: string;
  hasAccess?: boolean;
  accessExpiresAt?: number;
  isAdmin?: boolean;
  onProgressChange?: (coverage: number, completed: boolean) => void;
}

type YtPlayStatus = 'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended';
const SPEED_OPTIONS = [1, 1.25, 1.5, 1.75, 2] as const;

function formatPlayerTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '00:00';
  const sec = Math.floor(totalSeconds);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remSec = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(remSec)}`;
  return `${pad(minutes)}:${pad(remSec)}`;
}

export default function ProtectedVideoPlayer({
  title,
  url,
  watermarkText,
  itemId,
  studentId,
  courseId,
  hasAccess = true,
  accessExpiresAt = 0,
  isAdmin = false,
  onProgressChange,
}: ProtectedVideoPlayerProps) {
  const source = useMemo(() => getVideoSource(url), [url]);
  const { isOnline } = useOnlineStatus();

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const containerId = useMemo(() => `yt-player-${Math.random().toString(36).slice(2, 9)}`, []);

  const [away, setAway] = useState(false);
  const [position, setPosition] = useState({ top: 14, left: 12 });
  const [watchState, setWatchState] = useState<WatchState>(() => createWatchState(itemId || 'video', 0));
  const watchStateRef = useRef<WatchState>(watchState);
  watchStateRef.current = watchState;

  // حالة مشغل يوتيوب المخصص لمنع علامة المشاركة والروابط نهائياً
  const [ytStatus, setYtStatus] = useState<YtPlayStatus>('unstarted');
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const [maskTopFlash, setMaskTopFlash] = useState(false);

  // حالة كاش الفيديو المباشر (.mp4/.webm) للتشغيل أوفلاين عند الاكتمال وسريان الاشتراك
  const [cachedObjectUrl, setCachedObjectUrl] = useState<string | null>(null);
  const [videoCached, setVideoCached] = useState(false);
  const [cachingNow, setCachingNow] = useState(false);

  const lastFlushTimeRef = useRef<number>(Date.now());
  const lastFlushedCoverageRef = useRef<number>(0);
  const passedMilestonesRef = useRef<number[]>([]);
  const hasUnlocked95Ref = useRef(false);

  // إشعار الصفحة الخارجية بالتغير لحظياً
  useEffect(() => {
    if (onProgressChange) {
      onProgressChange(watchState.coverage, watchState.completed);
    }
  }, [watchState.coverage, watchState.completed, onProgressChange]);

  // كتابة التقدم إلى Firestore بالأحداث المحددة فقط
  const triggerFlush = useCallback(
    async (trigger: FlushTrigger) => {
      if (!studentId || !itemId) return;
      const current = watchStateRef.current;
      if (current.totalDuration <= 0) return;

      const decision = shouldFlush({
        trigger,
        currentCoverage: current.coverage,
        lastFlushedCoverage: lastFlushedCoverageRef.current,
        lastFlushTimeMs: lastFlushTimeRef.current,
        nowMs: Date.now(),
        passedMilestones: passedMilestonesRef.current,
        isCompleted: current.completed,
      });

      if (decision.shouldFlush) {
        if (decision.milestoneCrossed && !passedMilestonesRef.current.includes(decision.milestoneCrossed)) {
          passedMilestonesRef.current.push(decision.milestoneCrossed);
        }
        lastFlushedCoverageRef.current = current.coverage;
        lastFlushTimeRef.current = Date.now();
        await persistWatchProgress(studentId, current);
      }
    },
    [studentId, itemId],
  );

  // إشعار فوري وتثبيت فوري عند الوصول إلى عتبة 95% لعدم فقدان أي دقة
  useEffect(() => {
    if (watchState.coverage >= WATCH_THRESHOLD && !hasUnlocked95Ref.current) {
      hasUnlocked95Ref.current = true;
      void triggerFlush('milestone');
    }
  }, [watchState.coverage, triggerFlush]);

  // تحميل التقدم المدمج (محلي + سحابي) ومزامنة أي معلقات
  useEffect(() => {
    if (!studentId || !itemId) return;
    let active = true;

    void flushPendingWatchQueue(studentId);

    void getStoredWatchProgress(studentId, itemId).then((saved) => {
      if (!active || !saved) return;
      setWatchState(saved);
      setCurrentTimeSec(saved.lastPosition || 0);
      setDurationSec(saved.totalDuration || 0);
      lastFlushedCoverageRef.current = saved.coverage;

      WATCH_MILESTONES.forEach((m) => {
        if (saved.coverage >= m && !passedMilestonesRef.current.includes(m)) {
          passedMilestonesRef.current.push(m);
        }
      });

      if (saved.coverage >= WATCH_THRESHOLD) {
        hasUnlocked95Ref.current = true;
      }

      if (onProgressChange) {
        onProgressChange(saved.coverage, saved.completed);
      }
    });

    return () => {
      active = false;
    };
  }, [studentId, itemId, onProgressChange]);

  // إدارة كاش الفيديوهات المباشرة (ملفات MP4/WebM فقط) المرتبطة بالاشتراك واكتمال المشاهدة
  useEffect(() => {
    if (source.kind !== 'file' || !studentId || !courseId || !itemId) return;
    let cancelled = false;
    let activeBlobUrl: string | null = null;

    const gate = canUseOfflineVideoCache({
      videoKind: source.kind,
      completed: watchState.completed,
      coverage: watchState.coverage,
      hasAccess,
      archived: false,
      isAdmin,
      expiresAt: accessExpiresAt,
    });

    if (gate.shouldEvict) {
      void purgeCourseVideoCache(studentId, courseId);
      setCachedObjectUrl(null);
      setVideoCached(false);
      return;
    }

    const alreadyHasMeta = hasCachedVideoMeta(studentId, courseId, itemId, source.src);
    setVideoCached(alreadyHasMeta);

    if (gate.eligibleToPlay && alreadyHasMeta) {
      void getCachedVideoObjectUrl({
        studentId,
        courseId,
        itemId,
        sourceUrl: source.src,
        gate,
      }).then((objUrl) => {
        if (cancelled) {
          if (objUrl) URL.revokeObjectURL(objUrl);
          return;
        }
        activeBlobUrl = objUrl;
        setCachedObjectUrl(objUrl);
      });
    } else if (gate.eligibleToCache && !alreadyHasMeta && isOnline) {
      // حفظ في كاش المتصفح بصمت في الخلفية فور اكتمال مشاهدة الحصة (بدون تحميل مباشر للجهاز)
      setCachingNow(true);
      void cacheWatchedVideo({
        studentId,
        courseId,
        itemId,
        sourceUrl: source.src,
        expiresAt: accessExpiresAt,
      }).then((saved) => {
        if (!cancelled) {
          setCachingNow(false);
          if (saved) setVideoCached(true);
        }
      });
    }

    return () => {
      cancelled = true;
      if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
    };
  }, [
    source.kind,
    source.src,
    studentId,
    courseId,
    itemId,
    watchState.completed,
    watchState.coverage,
    hasAccess,
    accessExpiresAt,
    isAdmin,
    isOnline,
  ]);

  // استخراج YouTube Video ID
  const ytVideoId = useMemo(() => {
    if (source.kind !== 'youtube') return null;
    const match = source.src.match(/\/embed\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }, [source]);

  // إخفاء شريط اسم الفيديو/المشاركة العلوي الذي قد يظهر لحظياً عند بدء تشغيل يوتيوب
  useEffect(() => {
    if (ytStatus !== 'playing') {
      setMaskTopFlash(false);
      return;
    }
    setMaskTopFlash(true);
    const t = window.setTimeout(() => setMaskTopFlash(false), 4000);
    return () => window.clearTimeout(t);
  }, [ytStatus]);

  // تهيئة مشغل YouTube IFrame API بدون شريط يوتيوب الأصلي لمنع زر الشير ونسخ الرابط
  useEffect(() => {
    if (source.kind !== 'youtube' || !ytVideoId) return;

    let destroyed = false;
    let pollTimer: number | null = null;
    setYtStatus('unstarted');

    const initPlayer = () => {
      if (destroyed || !window.YT || !window.YT.Player) return;

      try {
        ytPlayerRef.current = new window.YT.Player(containerId, {
          host: 'https://www.youtube-nocookie.com',
          videoId: ytVideoId,
          playerVars: {
            enablejsapi: 1,
            origin: window.location.origin,
            rel: 0,
            modestbranding: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            playsinline: 1,
          },
          events: {
            onReady: (event: any) => {
              if (destroyed) return;
              const dur = event.target.getDuration();
              if (dur > 0) {
                setDurationSec(dur);
                setWatchState((prev) => updatePlayerStatus(prev, { totalDuration: dur }));
              }
            },
            onStateChange: (event: any) => {
              if (destroyed) return;
              const isPlaying = event.data === 1;
              const isPaused = event.data === 2;
              const isEnded = event.data === 0;
              const isBuffering = event.data === 3;

              if (isPlaying) {
                setYtStatus('playing');
                const dur = event.target.getDuration();
                const cur = event.target.getCurrentTime();
                const rate = event.target.getPlaybackRate();
                if (dur > 0) setDurationSec(dur);
                setCurrentTimeSec(cur);
                setPlaybackRate(rate);
                setWatchState((prev) =>
                  updatePlayerStatus(prev, {
                    isPlaying: true,
                    totalDuration: dur,
                    currentTime: cur,
                    playbackRate: rate,
                    isTabVisible: !document.hidden,
                  }),
                );
              } else if (isPaused) {
                setYtStatus('paused');
                setWatchState((prev) => updatePlayerStatus(prev, { isPlaying: false }));
                void triggerFlush('pause');
              } else if (isEnded) {
                setYtStatus('ended');
                setWatchState((prev) => updatePlayerStatus(prev, { isPlaying: false }));
                void triggerFlush('ended');
              } else if (isBuffering) {
                setYtStatus('buffering');
              }
            },
          },
        });
      } catch (err) {
        console.warn('YouTube IFrame API init error:', err);
      }
    };

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

    // نبضة زمنية محلية كل ثانية أثناء التشغيل
    pollTimer = window.setInterval(() => {
      if (destroyed || !ytPlayerRef.current) return;
      try {
        if (typeof ytPlayerRef.current.getPlayerState === 'function') {
          const state = ytPlayerRef.current.getPlayerState();
          if (state === 1) {
            const curTime = ytPlayerRef.current.getCurrentTime();
            const rate = ytPlayerRef.current.getPlaybackRate();
            const dur = ytPlayerRef.current.getDuration();

            setCurrentTimeSec(curTime);
            if (dur > 0) setDurationSec(dur);

            setWatchState((prev) => {
              const updated = updatePlayerStatus(prev, {
                isPlaying: true,
                playbackRate: rate,
                totalDuration: dur,
                isTabVisible: !document.hidden,
              });
              const tickState = processPlaybackTick(updated, curTime, Date.now());

              const decision = shouldFlush({
                trigger: 'milestone',
                currentCoverage: tickState.coverage,
                lastFlushedCoverage: lastFlushedCoverageRef.current,
                lastFlushTimeMs: lastFlushTimeRef.current,
                nowMs: Date.now(),
                passedMilestones: passedMilestonesRef.current,
                isCompleted: tickState.completed,
              });

              if (decision.shouldFlush) {
                void triggerFlush('milestone');
              } else {
                const hb = shouldFlush({
                  trigger: 'fallback_heartbeat',
                  currentCoverage: tickState.coverage,
                  lastFlushedCoverage: lastFlushedCoverageRef.current,
                  lastFlushTimeMs: lastFlushTimeRef.current,
                  nowMs: Date.now(),
                  passedMilestones: passedMilestonesRef.current,
                  isCompleted: tickState.completed,
                });
                if (hb.shouldFlush) {
                  void triggerFlush('fallback_heartbeat');
                }
              }

              return tickState;
            });
          }
        }
      } catch {
        // تجاهل أخطاء قراءة الحالة المؤقتة أثناء تهيئة المشغل
      }
    }, 1000);

    return () => {
      destroyed = true;
      if (pollTimer) window.clearInterval(pollTimer);
      void triggerFlush('pagehide');
      try {
        ytPlayerRef.current?.destroy();
      } catch {
        // تجاهل
      }
    };
  }, [source.kind, ytVideoId, containerId, triggerFlush]);

  // تتبع حالة ملء الشاشة الخاصة بالحاوية للحفاظ على العلامة المائية
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

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
        void triggerFlush('visibility_hidden');
      } else {
        setAway(false);
        setWatchState((prev) => updatePlayerStatus(prev, { isTabVisible: true }));
      }
    };

    const handlePageHide = () => {
      void triggerFlush('pagehide');
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      void triggerFlush('pagehide');
    };
  }, [triggerFlush]);

  // تحريك العلامة المائية عشوائياً لمكافحة التسجيل
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPosition({ top: 14 + Math.random() * 64, left: 6 + Math.random() * 52 });
    }, 7000);

    return () => window.clearInterval(timer);
  }, []);

  // دوال التحكم المخصصة في مشغل يوتيوب المحمي
  const toggleYtPlay = () => {
    const player = ytPlayerRef.current;
    if (!player) return;
    try {
      if (ytStatus === 'playing') {
        player.pauseVideo?.();
      } else {
        if (ytStatus === 'ended') {
          player.seekTo?.(0, true);
        }
        player.playVideo?.();
      }
    } catch {
      // تجاهل
    }
  };

  const seekYtBy = (deltaSec: number) => {
    const player = ytPlayerRef.current;
    if (!player) return;
    try {
      const next = Math.max(0, Math.min(durationSec || 999999, currentTimeSec + deltaSec));
      player.seekTo?.(next, true);
      setCurrentTimeSec(next);
    } catch {
      // تجاهل
    }
  };

  const handleSliderSeek = (nextSec: number) => {
    const player = ytPlayerRef.current;
    if (!player) return;
    try {
      player.seekTo?.(nextSec, true);
      setCurrentTimeSec(nextSec);
    } catch {
      // تجاهل
    }
  };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate as (typeof SPEED_OPTIONS)[number]);
    const nextRate = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(nextRate);
    try {
      ytPlayerRef.current?.setPlaybackRate?.(nextRate);
    } catch {
      // تجاهل
    }
  };

  const toggleMute = () => {
    const player = ytPlayerRef.current;
    if (!player) return;
    try {
      if (isMuted) {
        player.unMute?.();
        setIsMuted(false);
      } else {
        player.mute?.();
        setIsMuted(true);
      }
    } catch {
      // تجاهل
    }
  };

  const toggleFullscreen = () => {
    const el = wrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => setPseudoFullscreen(false));
      return;
    }
    if (typeof el.requestFullscreen === 'function') {
      void el.requestFullscreen().catch(() => setPseudoFullscreen((v) => !v));
    } else {
      setPseudoFullscreen((v) => !v);
    }
  };

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
  const activeVideoSrc = source.kind === 'file' ? cachedObjectUrl || source.src : source.src;
  const youtubeOfflineBlocked = source.kind === 'youtube' && !isOnline && ytStatus === 'unstarted';

  return (
    <div className="space-y-2">
      <div
        ref={wrapperRef}
        className={`relative w-full select-none overflow-hidden bg-black ${
          pseudoFullscreen
            ? 'fixed inset-0 z-50 h-screen w-screen rounded-none'
            : 'aspect-video rounded-2xl'
        }`}
        onContextMenu={(event) => event.preventDefault()}
        onCopy={(event) => event.preventDefault()}
        onCut={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
      >
        {source.kind === 'file' ? (
          <video
            ref={videoRef}
            src={activeVideoSrc}
            title={title}
            controls
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            playsInline
            onPlay={() => {
              const dur = videoRef.current?.duration || 0;
              const rate = videoRef.current?.playbackRate || 1.0;
              setWatchState((prev) =>
                updatePlayerStatus(prev, { isPlaying: true, totalDuration: dur, playbackRate: rate }),
              );
            }}
            onPause={() => {
              setWatchState((prev) => updatePlayerStatus(prev, { isPlaying: false }));
              void triggerFlush('pause');
            }}
            onEnded={() => {
              setWatchState((prev) => updatePlayerStatus(prev, { isPlaying: false }));
              void triggerFlush('ended');
            }}
            onTimeUpdate={() => {
              if (!videoRef.current) return;
              const cur = videoRef.current.currentTime;
              const rate = videoRef.current.playbackRate;
              const dur = videoRef.current.duration;
              setWatchState((prev) => {
                const updated = updatePlayerStatus(prev, {
                  isPlaying: !videoRef.current?.paused,
                  playbackRate: rate,
                  totalDuration: dur,
                  isTabVisible: !document.hidden,
                });
                const tickState = processPlaybackTick(updated, cur, Date.now());

                const decision = shouldFlush({
                  trigger: 'milestone',
                  currentCoverage: tickState.coverage,
                  lastFlushedCoverage: lastFlushedCoverageRef.current,
                  lastFlushTimeMs: lastFlushTimeRef.current,
                  nowMs: Date.now(),
                  passedMilestones: passedMilestonesRef.current,
                  isCompleted: tickState.completed,
                });

                if (decision.shouldFlush) {
                  void triggerFlush('milestone');
                } else {
                  const hb = shouldFlush({
                    trigger: 'fallback_heartbeat',
                    currentCoverage: tickState.coverage,
                    lastFlushedCoverage: lastFlushedCoverageRef.current,
                    lastFlushTimeMs: lastFlushTimeRef.current,
                    nowMs: Date.now(),
                    passedMilestones: passedMilestonesRef.current,
                    isCompleted: tickState.completed,
                  });
                  if (hb.shouldFlush) {
                    void triggerFlush('fallback_heartbeat');
                  }
                }

                return tickState;
              });
            }}
            onContextMenu={(event) => event.preventDefault()}
            className="absolute inset-0 h-full w-full"
          />
        ) : source.kind === 'youtube' ? (
          <>
            {/* الإطار معزول تماماً بـ pointer-events-none لمنع الضغط على أي زر مشاركة أو نسخ رابط */}
            <div className="pointer-events-none absolute inset-0 h-full w-full select-none">
              <div id={containerId} className="h-full w-full border-0" />
            </div>

            {/* درع حماية علوي يخفي شريط العنوان وزر الشير ويمنع لمسه */}
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-2.5 transition-opacity duration-500 ${
                maskTopFlash || ytStatus !== 'playing'
                  ? 'bg-gradient-to-b from-black via-black/90 to-transparent opacity-100'
                  : 'bg-gradient-to-b from-black/80 via-black/30 to-transparent opacity-80'
              }`}
            >
              <span className="truncate text-xs font-bold text-white/90">{title}</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-navy-900/90 px-2 py-0.5 text-[10px] font-bold text-gold-400">
                <ShieldCheck className="h-3 w-3" />
                <span>محمي</span>
              </span>
            </div>

            {/* طبقة التفاعل الآمنة للتشغيل والإيقاف عند الضغط على الفيديو */}
            <button
              type="button"
              aria-label={ytStatus === 'playing' ? 'إيقاف مؤقت' : 'تشغيل الحصة'}
              onClick={toggleYtPlay}
              onDoubleClick={toggleFullscreen}
              className="absolute inset-0 z-10 cursor-pointer bg-transparent focus:outline-none"
            />

            {/* غطاء الحماية الكامل قبل التشغيل أو عند الإيقاف/النهاية لإخفاء شاشات يوتيوب والمشاركة */}
            {ytStatus !== 'playing' && ytStatus !== 'buffering' && (
              <div className="absolute inset-0 z-[15] flex flex-col items-center justify-center gap-2.5 bg-navy-950/90 px-4 pb-10 text-center backdrop-blur-sm">
                {youtubeOfflineBlocked ? (
                  <>
                    <WifiOff className="h-10 w-10 text-gold-400" />
                    <p className="max-w-sm text-sm font-bold text-white">
                      لا يوجد اتصال بالإنترنت حالياً
                    </p>
                    <p className="max-w-sm text-xs leading-relaxed text-slate-300">
                      فيديوهات يوتيوب تتطلب اتصالاً بالإنترنت للتشغيل، بينما يمكنك متابعة تصفح الكورسات والفهرس ودرجاتك من الكاش.
                    </p>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={toggleYtPlay}
                      className="grid h-16 w-16 place-items-center rounded-full bg-gold-500 text-navy-950 shadow-glow transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gold-300"
                      aria-label={ytStatus === 'ended' ? 'إعادة مشاهدة الحصة' : 'تشغيل الحصة'}
                    >
                      <Play className="ms-0.5 h-7 w-7 fill-current" />
                    </button>
                    <p className="max-w-md truncate text-sm font-bold text-white">{title}</p>
                    <span className="text-[11px] font-semibold text-slate-300">
                      {ytStatus === 'ended'
                        ? 'انتهت الحصة — اضغط لإعادة المشاهدة'
                        : ytStatus === 'paused'
                          ? 'إيقاف مؤقت — اضغط لاستئناف الشرح'
                          : 'اضغط لبدء المشاهدة الآمنة داخل المنصة'}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* شريط التحكم المخصص أسفل الفيديو (بدون أي زر شير أو روابط خارجية) */}
            <div
              dir="ltr"
              className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-2 bg-gradient-to-t from-black/95 via-black/85 to-transparent px-3 pb-2.5 pt-6 text-white"
            >
              <button
                type="button"
                onClick={toggleYtPlay}
                className="rounded-lg p-1.5 text-white hover:bg-white/15 focus:outline-none"
                aria-label={ytStatus === 'playing' ? 'إيقاف مؤقت' : 'تشغيل'}
              >
                {ytStatus === 'playing' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => seekYtBy(-10)}
                className="rounded-lg p-1.5 text-slate-200 hover:bg-white/15 focus:outline-none"
                aria-label="رجوع 10 ثواني"
                title="رجوع 10 ثواني"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => seekYtBy(10)}
                className="rounded-lg p-1.5 text-slate-200 hover:bg-white/15 focus:outline-none"
                aria-label="تقديم 10 ثواني"
                title="تقديم 10 ثواني"
              >
                <RotateCw className="h-4 w-4" />
              </button>

              <input
                type="range"
                min={0}
                max={durationSec > 0 ? Math.floor(durationSec) : 100}
                value={Math.min(durationSec > 0 ? Math.floor(durationSec) : 100, Math.floor(currentTimeSec))}
                onChange={(e) => handleSliderSeek(Number(e.target.value))}
                aria-label="شريط تقدم الفيديو"
                className="h-1.5 min-w-[70px] flex-1 cursor-pointer accent-gold-400"
              />

              <span className="font-num text-[11px] font-semibold tabular-nums text-slate-200">
                {formatPlayerTime(currentTimeSec)} / {formatPlayerTime(durationSec)}
              </span>

              <button
                type="button"
                onClick={cycleSpeed}
                className="rounded-md bg-white/15 px-2 py-0.5 font-num text-[11px] font-bold text-gold-300 hover:bg-white/25 focus:outline-none"
                aria-label="سرعة التشغيل"
                title="تغيير سرعة التشغيل"
              >
                {playbackRate}x
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className="rounded-lg p-1.5 text-slate-200 hover:bg-white/15 focus:outline-none"
                aria-label={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
              >
                {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="rounded-lg p-1.5 text-slate-200 hover:bg-white/15 focus:outline-none"
                aria-label={isFullscreen || pseudoFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
              >
                {isFullscreen || pseudoFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </>
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
          className="pointer-events-none absolute z-20 select-none whitespace-nowrap rounded bg-black/30 px-2 py-1 text-xs font-bold text-white/60 transition-all duration-1000"
          style={{ top: `${position.top}%`, left: `${position.left}%` }}
        >
          {watermarkText}
        </div>

        {away && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-navy-950/90 backdrop-blur-2xl">
            <div className="flex flex-col items-center gap-3 px-4 text-center text-slate-300">
              <EyeOff className="h-10 w-10 text-gold-500" />
              <p className="text-sm font-bold">عُد إلى هذه الصفحة لمتابعة المشاهدة</p>
            </div>
          </div>
        )}
      </div>

      {/* شريط تقدم المشاهدة الصارم + مؤشر حالة الكاش للوضع بدون نت */}
      <div className="rounded-xl border border-navy-800 bg-navy-950/60 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
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

        {source.kind === 'file' && (videoCached || cachingNow || cachedObjectUrl) && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
            <HardDriveDownload className="h-3.5 w-3.5 shrink-0" />
            <span>
              {cachedObjectUrl && !isOnline
                ? 'يعمل الآن من كاش التطبيق بدون استهلاك الإنترنت'
                : cachingNow
                  ? 'جاري تجهيز المحاضرة في كاش التطبيق للمشاهدة بدون نت لاحقاً...'
                  : 'محفوظة داخل كاش التطبيق — متاحة للمشاهدة بدون نت ما دام اشتراكك سارياً'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { EyeOff, VideoOff, CheckCircle2 } from 'lucide-react';
import { getVideoSource } from '../../lib/media';
import {
  createWatchState,
  processPlaybackTick,
  updatePlayerStatus,
  shouldFlush,
  WATCH_THRESHOLD,
  WATCH_MILESTONES,
} from '../../lib/watchTracker.ts';
import type { WatchState, FlushTrigger } from '../../lib/watchTracker.ts';
import { getStoredWatchProgress, persistWatchProgress, flushPendingWatchQueue } from '../../services/watchProgress';

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
  onProgressChange,
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

    // مزامنة أي مهام معلقة في الخلفية
    void flushPendingWatchQueue(studentId);

    void getStoredWatchProgress(studentId, itemId).then((saved) => {
      if (!active || !saved) return;
      setWatchState(saved);
      lastFlushedCoverageRef.current = saved.coverage;

      // تسجيل الفواصل التي سبق تجاوزها بالفعل حتى لا تتكرر
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
            modestbranding: 1,
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
                    isTabVisible: !document.hidden,
                  }),
                );
              } else if (isPaused) {
                setWatchState((prev) => updatePlayerStatus(prev, { isPlaying: false }));
                void triggerFlush('pause');
              } else if (isEnded) {
                setWatchState((prev) => updatePlayerStatus(prev, { isPlaying: false }));
                void triggerFlush('ended');
              }
            },
          },
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

    // نبضة زمنية محلية كل ثانية أثناء التشغيل (لحظية في الذاكرة + localStorage فقط بلا Firestore)
    pollTimer = window.setInterval(() => {
      if (destroyed || !ytPlayerRef.current) return;
      try {
        if (typeof ytPlayerRef.current.getPlayerState === 'function') {
          const state = ytPlayerRef.current.getPlayerState();
          if (state === 1) {
            // PLAYING
            const curTime = ytPlayerRef.current.getCurrentTime();
            const rate = ytPlayerRef.current.getPlaybackRate();
            const dur = ytPlayerRef.current.getDuration();

            setWatchState((prev) => {
              const updated = updatePlayerStatus(prev, {
                isPlaying: true,
                playbackRate: rate,
                totalDuration: dur,
                isTabVisible: !document.hidden,
              });
              const tickState = processPlaybackTick(updated, curTime, Date.now());

              // فحص عبور فواصل النسب المئوية 25% و50% و75% و95%
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
                // فحص النبضة الاحتياطية كل 5 دقائق لو شغال متواصل
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
      } catch {}
    }, 1000);

    return () => {
      destroyed = true;
      if (pollTimer) window.clearInterval(pollTimer);
      void triggerFlush('pagehide');
      try {
        ytPlayerRef.current?.destroy();
      } catch {}
    };
  }, [source.kind, ytVideoId, containerId, triggerFlush]);

  // إدارة التبويب المخفي والصفحة المغلقة (الأحداث الصريحة)
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

                // فحص عبور فواصل النسب المئوية
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
                  // فحص النبضة الاحتياطية (5 دقائق)
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

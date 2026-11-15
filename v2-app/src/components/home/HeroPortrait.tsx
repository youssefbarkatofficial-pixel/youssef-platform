import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoginModal from '../auth/LoginModal';

interface HeroPortraitProps {
  bgUrl?: string;
  meUrl?: string;
  bgVersion?: number;
  meVersion?: number;
  className?: string;
}

// Invalidate legacy unversioned cache keys
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('yb_cached_hero_bg');
    localStorage.removeItem('yb_cached_hero_me');
  } catch {}
}

function getVersionCachedUrl(type: 'bg' | 'me', version?: number, propUrl?: string): string {
  if (propUrl) return propUrl;
  if (!version || typeof window === 'undefined') return '';
  try {
    const key = `yb_hero_${type}_v${version}`;
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function setVersionCachedUrl(type: 'bg' | 'me', version: number | undefined, url: string) {
  if (!version || !url || typeof window === 'undefined') return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`yb_hero_${type}_v`) && k !== `yb_hero_${type}_v${version}`) {
        localStorage.removeItem(k);
      }
    }
    localStorage.setItem(`yb_hero_${type}_v${version}`, url);
  } catch {}
}

export default function HeroPortrait({
  bgUrl,
  meUrl,
  bgVersion,
  meVersion,
  className = '',
}: HeroPortraitProps) {
  const { firebaseUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  const [bgLoaded, setBgLoaded] = useState(false);
  const [meLoaded, setMeLoaded] = useState(false);

  const [activeBgUrl, setActiveBgUrl] = useState(() => getVersionCachedUrl('bg', bgVersion, bgUrl));
  const [activeMeUrl, setActiveMeUrl] = useState(() => getVersionCachedUrl('me', meVersion, meUrl));

  useEffect(() => {
    if (bgUrl && bgUrl !== activeBgUrl) {
      setActiveBgUrl(bgUrl);
      setVersionCachedUrl('bg', bgVersion, bgUrl);
    }
  }, [bgUrl, bgVersion, activeBgUrl]);

  useEffect(() => {
    if (meUrl && meUrl !== activeMeUrl) {
      setActiveMeUrl(meUrl);
      setVersionCachedUrl('me', meVersion, meUrl);
    }
  }, [meUrl, meVersion, activeMeUrl]);

  const containerRef = useRef<HTMLButtonElement>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => {
      mediaQuery.removeEventListener('change', listener);
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    };
  }, []);

  // Subtle mouse parallax (desktop only, disabled with reduced motion)
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (reducedMotion || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 24; // -12px to +12px
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 18; // -9px to +9px
      setMouseOffset({ x, y });
    },
    [reducedMotion],
  );

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
    setIsPressed(false);
    setMouseOffset({ x: 0, y: 0 });
  }, []);

  const handleClick = () => {
    setIsPressed(true);

    const executeAction = () => {
      setIsPressed(false);
      if (firebaseUser) {
        navigate(isAdmin ? '/admin' : '/student');
      } else {
        setLoginModalOpen(true);
      }
    };

    if (reducedMotion) {
      executeAction();
    } else {
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = setTimeout(executeAction, 300);
    }
  };

  const isActive = isHovered || isPressed;
  const buttonAriaLabel = firebaseUser ? 'الذهاب إلى لوحتي التعليمية' : 'تسجيل الدخول إلى المنصة';

  return (
    <>
      <button
        ref={containerRef}
        type="button"
        onClick={handleClick}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setIsHovered(true);
        }}
        onPointerLeave={handlePointerLeave}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') setIsPressed(true);
        }}
        onPointerUp={() => setIsPressed(false)}
        onMouseMove={handleMouseMove}
        aria-label={buttonAriaLabel}
        className={`hero-portrait-frame group relative mx-auto block cursor-pointer select-none bg-transparent p-0 text-start outline-none focus-visible:ring-4 focus-visible:ring-theme-gold/60 focus-visible:ring-offset-8 focus-visible:ring-offset-theme-base ${className}`}
        style={
          {
            width: 'var(--hero-size)',
            height: 'calc(var(--hero-size) * 1.34)',
          } as React.CSSProperties
        }
      >
        {/* Unified Portrait Ensemble: Aura + Circle + Cutout scale and float in 100% lockstep */}
        <div
          className="relative h-full w-full select-none"
          style={{
            transform: `translate(${mouseOffset.x * 0.3}px, ${mouseOffset.y * 0.2}px) scale(${
              isActive && !reducedMotion ? 1.03 : 1
            })`,
            transformOrigin: '50% 55%',
            transition: 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
            animation: reducedMotion ? 'none' : 'heroFloatVertical 5.5s ease-in-out infinite',
          }}
        >
          {/* Layer 1: Ambient Royal Gold Aura (soft pulsing glow — zero border rings) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 rounded-full transition-all duration-700 ease-out"
            style={{
              width: 'calc(var(--hero-size) * 1.0)',
              height: 'calc(var(--hero-size) * 1.0)',
              background: 'radial-gradient(circle, rgba(212,166,79,0.26) 0%, rgba(212,166,79,0.08) 55%, transparent 75%)',
              boxShadow: isActive
                ? '0 0 95px var(--brand-gold, #d4a64f), 0 0 50px rgba(212,166,79,0.55)'
                : '0 0 65px rgba(212,166,79,0.35), 0 0 25px rgba(212,166,79,0.18)',
              transform: 'translate(-50%, -50%)',
              opacity: isActive ? 1 : 0.85,
            }}
          />

          {/* Layer 2: Circular Background — NO border ring, deep cosmic galaxy */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 overflow-hidden rounded-full shadow-2xl transition-all duration-500"
            style={{
              width: 'calc(var(--hero-size) * 0.98)',
              height: 'calc(var(--hero-size) * 0.98)',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Shimmer skeleton before image loads */}
            <div
              className={`absolute inset-0 bg-theme-surface-subtle transition-opacity ${
                reducedMotion ? 'duration-0' : 'duration-500'
              } ${bgLoaded && activeBgUrl ? 'opacity-0 pointer-events-none' : 'opacity-100 animate-pulse'}`}
            />
            {activeBgUrl ? (
              <img
                src={activeBgUrl}
                onLoad={() => setBgLoaded(true)}
                onError={() => setBgLoaded(false)}
                alt=""
                loading="eager"
                decoding="async"
                className={`h-full w-full object-cover transition-all ${
                  reducedMotion ? 'duration-0' : 'duration-700'
                } ${bgLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
            ) : null}
          </div>

          {/* Layer 3: Cutout Portrait — perfectly aligned with circle, scales in lockstep with zero clipping */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 select-none"
            style={{
              width: 'calc(var(--hero-size) * 0.98)',
              height: 'calc(var(--hero-size) * 1.30)',
              bottom: 'calc(50% - var(--hero-size) * 0.49)',
              transform: 'translateX(-50%)',
              transformOrigin: 'bottom center',
              maskImage: 'linear-gradient(to bottom, black 88%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 88%, transparent 100%)',
            }}
          >
            <div className="h-full w-full">
              {!meLoaded && (
                <div
                  className={`h-full w-full bg-transparent transition-opacity ${
                    reducedMotion ? 'duration-0' : 'duration-500'
                  }`}
                />
              )}
              {activeMeUrl ? (
                <img
                  src={activeMeUrl}
                  onLoad={() => setMeLoaded(true)}
                  onError={() => setMeLoaded(false)}
                  alt="الأستاذ يوسف بركات"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  className={`h-full w-full object-contain object-bottom drop-shadow-2xl transition-opacity ${
                    reducedMotion ? 'duration-0' : 'duration-500'
                  } ${meLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
              ) : null}
            </div>
          </div>
        </div>
      </button>

      {/* Login Modal for unauthenticated clicks */}
      <LoginModal open={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
    </>
  );
}

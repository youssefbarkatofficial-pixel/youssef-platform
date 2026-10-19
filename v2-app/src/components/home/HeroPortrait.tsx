import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoginModal from '../auth/LoginModal';

interface HeroPortraitProps {
  bgUrl?: string;
  meUrl?: string;
  className?: string;
}

export default function HeroPortrait({
  bgUrl = '/assets/images/ownerBgImage-legacy.webp',
  meUrl = '/assets/images/youssef-hero.webp',
  className = '',
}: HeroPortraitProps) {
  const { firebaseUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

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
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 14; // -7px to +7px
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 10; // -5px to +5px
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
      {/* SVG ClipPath Definition: Top half open rectangle, bottom half smooth circular arc matching circle curvature */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
        <defs>
          <clipPath id="heroPopoutClip" clipPathUnits="objectBoundingBox">
            <path d="M 0 0 L 1 0 L 1 0.60 A 0.5 0.40 0 0 1 0 0.60 Z" />
          </clipPath>
        </defs>
      </svg>

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
        className={`hero-portrait-frame group relative mx-auto block cursor-pointer select-none bg-transparent p-0 text-start outline-none focus-visible:ring-4 focus-visible:ring-theme-gold/60 focus-visible:ring-offset-8 focus-visible:ring-offset-theme-base rounded-full ${className}`}
        style={
          {
            width: 'var(--hero-size)',
            height: 'calc(var(--hero-size) * 1.34)',
          } as React.CSSProperties
        }
      >
        {/* Layer 1: Ambient Decorative Glow Ring (Centered with Circle) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 rounded-full transition-all duration-700 ease-out"
          style={{
            width: 'calc(var(--hero-size) * 0.90)',
            height: 'calc(var(--hero-size) * 0.90)',
            background:
              'radial-gradient(circle, var(--brand-gold-subtle, rgba(212,166,79,0.25)) 0%, transparent 72%)',
            boxShadow: isActive
              ? '0 0 80px var(--brand-gold, #d4a64f), inset 0 0 40px var(--brand-gold, #d4a64f)'
              : '0 0 45px var(--brand-gold-subtle, rgba(212,166,79,0.3))',
            transform: `translate(-50%, -50%) scale(${isActive ? 1.05 : 1})`,
            opacity: isActive ? 0.95 : 0.75,
            animation: reducedMotion ? 'none' : 'heroRingBreathe 5s ease-in-out infinite',
          }}
        />

        {/* Layer 2: Circular Background (Centered vertically in container to align with text center) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 overflow-hidden rounded-full shadow-2xl transition-transform duration-500"
          style={{
            width: 'calc(var(--hero-size) * 0.88)',
            height: 'calc(var(--hero-size) * 0.88)',
            transform: `translate(-50%, -50%) scale(${isActive && !reducedMotion ? 0.92 : 1})`,
            transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          <img
            src={bgUrl}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/assets/images/hero-circle-bg.svg';
            }}
            alt=""
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700"
            style={{
              transform: `scale(${isActive && !reducedMotion ? 1.06 : 1})`,
            }}
          />
        </div>

        {/* Layer 3: Single Cutout Portrait (Anchored to circle bottom, head extends above circle top) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 select-none transition-transform duration-500"
          style={{
            width: 'calc(var(--hero-size) * 0.88)',
            height: 'calc(var(--hero-size) * 1.10)',
            bottom: 'calc(50% - var(--hero-size) * 0.44)',
            transformOrigin: 'bottom center',
            transform: `translateX(calc(-50% + ${mouseOffset.x}px)) translateY(${
              isActive && !reducedMotion ? '-12px' : '0px'
            }) scale(${isActive && !reducedMotion ? 1.08 : 1})`,
            transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            clipPath: 'url(#heroPopoutClip)',
            WebkitClipPath: 'url(#heroPopoutClip)',
            animation: reducedMotion ? 'none' : 'heroFloat 6s ease-in-out infinite',
          }}
        >
          <img
            src={meUrl || '/assets/images/youssef-hero.webp'}
            srcSet={
              !meUrl || meUrl === '/assets/images/youssef-hero.webp'
                ? '/assets/images/youssef-hero-sm.webp 460w, /assets/images/youssef-hero.webp 800w'
                : undefined
            }
            sizes={
              !meUrl || meUrl === '/assets/images/youssef-hero.webp'
                ? '(max-width: 640px) 320px, (max-width: 1024px) 440px, 530px'
                : undefined
            }
            alt="الأستاذ يوسف بركات"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-contain object-bottom drop-shadow-2xl"
          />
        </div>

        {/* Subtle Action Pill Indicator */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 z-20 flex items-center gap-1.5 rounded-full bg-theme-surface/90 px-4 py-1.5 text-xs font-bold text-theme-gold shadow-lg backdrop-blur-md transition-all duration-300"
          style={{
            bottom: 'calc(50% - var(--hero-size) * 0.44 + 14px)',
            transform: `translateX(-50%) translateY(${isActive ? '-4px' : '0'}) scale(${isActive ? 1.05 : 1})`,
            opacity: isActive ? 1 : 0.85,
          }}
        >
          <span>{firebaseUser ? 'لوحتي' : 'اضغط للدخول'}</span>
          <span className="inline-block transition-transform duration-300 group-hover:-translate-x-0.5">←</span>
        </div>
      </button>

      {/* Login Modal for unauthenticated clicks */}
      <LoginModal open={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
    </>
  );
}

import { useState, useEffect } from 'react';

interface Particle {
  id: number;
  top: number; // percentage
  left: number; // percentage
  size: number; // px
  duration: number; // s
  delay: number; // s
  opacity: number;
}

// 14 deterministic luxury embers for zero hydration mismatch
const PARTICLES: Particle[] = [
  { id: 1, top: 18, left: 12, size: 3, duration: 11, delay: 0, opacity: 0.5 },
  { id: 2, top: 35, left: 24, size: 2.5, duration: 14, delay: 1.5, opacity: 0.4 },
  { id: 3, top: 62, left: 18, size: 4, duration: 9, delay: 3, opacity: 0.6 },
  { id: 4, top: 25, left: 45, size: 2, duration: 13, delay: 0.8, opacity: 0.35 },
  { id: 5, top: 78, left: 38, size: 3.5, duration: 10, delay: 2.2, opacity: 0.5 },
  { id: 6, top: 15, left: 78, size: 3, duration: 12, delay: 4, opacity: 0.45 },
  { id: 7, top: 42, left: 88, size: 2.5, duration: 15, delay: 1.2, opacity: 0.4 },
  { id: 8, top: 68, left: 82, size: 4, duration: 8, delay: 2.8, opacity: 0.55 },
  { id: 9, top: 85, left: 65, size: 3, duration: 11, delay: 0.5, opacity: 0.45 },
  { id: 10, top: 50, left: 6, size: 2.5, duration: 13, delay: 3.5, opacity: 0.35 },
  { id: 11, top: 8, left: 32, size: 3.5, duration: 10, delay: 1.8, opacity: 0.5 },
  { id: 12, top: 82, left: 10, size: 2, duration: 14, delay: 4.5, opacity: 0.3 },
  { id: 13, top: 30, left: 68, size: 3, duration: 9, delay: 2.0, opacity: 0.45 },
  { id: 14, top: 58, left: 52, size: 2.5, duration: 12, delay: 1.0, opacity: 0.4 },
];

export default function AmbientLuxuryBackdrop() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 select-none overflow-hidden"
      aria-hidden="true"
    >
      {/* 1. Ambient Lighting Orbs */}
      <div className="absolute -top-32 end-0 h-[480px] w-[480px] rounded-full bg-theme-gold/15 blur-3xl transition-colors" />
      <div className="absolute start-0 top-36 h-[420px] w-[420px] rounded-full bg-theme-accent/10 blur-3xl transition-colors" />
      <div className="absolute -bottom-20 left-1/3 h-[380px] w-[380px] rounded-full bg-theme-gold/10 blur-3xl transition-colors" />

      {/* 2. Micro-Grain Texture Overlay (Haute Paper / Anodized Matte) */}
      <div
        className="absolute inset-0 opacity-[0.022] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* 3. Floating Golden Stardust Particles (Embers) */}
      {!reducedMotion &&
        PARTICLES.map((p) => (
          <span
            key={p.id}
            className="absolute rounded-full bg-theme-gold shadow-[0_0_8px_rgba(212,166,79,0.8)] motion-reduce:hidden"
            style={{
              top: `${p.top}%`,
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              animation: `ambientParticleFloat ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollProgressBar - Luxury golden indicator tracking scroll depth.
 * - Hardware accelerated & throttled via requestAnimationFrame.
 * - Strictly disabled in assessment/exam routes to guarantee zero student distraction.
 * - Respects prefers-reduced-motion.
 */
export default function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);
  const location = useLocation();

  // Strict Protection: Zero animation or distraction in exam/assessment views
  const isAssessmentRoute = location.pathname.startsWith('/student/assessment');

  useEffect(() => {
    if (isAssessmentRoute || typeof window === 'undefined') return;

    // Check prefers-reduced-motion
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
          if (totalHeight > 0) {
            const current = (window.scrollY / totalHeight) * 100;
            setProgress(Math.min(100, Math.max(0, current)));
          } else {
            setProgress(0);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [isAssessmentRoute, location.pathname]);

  if (isAssessmentRoute || progress <= 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 inset-x-0 z-50 h-[2.5px] pointer-events-none bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-theme-gold via-amber-300 to-amber-500 shadow-[0_0_12px_rgba(212,166,79,0.6)] transition-all duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

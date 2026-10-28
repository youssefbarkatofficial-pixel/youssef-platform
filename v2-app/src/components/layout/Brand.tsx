import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

interface BrandProps {
  to?: string;
  logoUrl?: string;
  className?: string;
}

export default function Brand({ to = '/', logoUrl, className }: BrandProps) {
  const [imageError, setImageError] = useState(false);
  const src = logoUrl || '/icons/logo.svg';

  return (
    <Link to={to} className={`flex items-center gap-2.5 transition-transform active:scale-95 ${className || ''}`}>
      {!imageError ? (
        <img
          src={src}
          alt="منصة يوسف بركات"
          onError={() => setImageError(true)}
          className="h-10 w-10 rounded-xl object-contain shadow-soft"
          loading="eager"
        />
      ) : (
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-theme-gold to-amber-600 text-slate-950 shadow-soft">
          <Compass className="h-5 w-5 animate-[spin_30s_linear_infinite]" />
        </span>
      )}
      <span className="leading-tight">
        <span className="block text-sm sm:text-base font-extrabold text-theme-text">يوسف بركات</span>
        <span className="block text-[11px] sm:text-xs font-semibold text-theme-gold">أستاذ التاريخ والجغرافيا</span>
      </span>
    </Link>
  );
}

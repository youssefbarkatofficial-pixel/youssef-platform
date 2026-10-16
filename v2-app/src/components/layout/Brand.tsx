import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

interface BrandProps {
  to?: string;
}

export default function Brand({ to = '/' }: BrandProps) {
  return (
    <Link to={to} className="flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold-500 text-navy-950">
        <Compass className="h-6 w-6" />
      </span>
      <span className="leading-tight">
        <span className="block text-base font-extrabold text-white">يوسف بركات</span>
        <span className="block text-xs text-gold-400">أستاذ التاريخ والجغرافيا</span>
      </span>
    </Link>
  );
}

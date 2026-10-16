import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Card, buttonClasses } from '../ui';

interface ClosedFeaturePageProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

// صفحة لميزة مغلقة حاليًا (تحت الإنشاء). تظهر للطالب بدل صفحة فارغة.
export default function ClosedFeaturePage({
  title,
  description,
  icon: Icon = Lock,
}: ClosedFeaturePageProps) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card className="space-y-4 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gold-500/15 text-gold-400">
          <Icon className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">{title}</h1>
        <div>
          <Badge variant="gold">مغلقة حاليًا (تحت الإنشاء)</Badge>
        </div>
        <p className="mx-auto max-w-md leading-relaxed text-slate-300">{description}</p>
        <Link to="/student" className={buttonClasses({ variant: 'secondary' })}>
          العودة للوحتي
        </Link>
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Badge } from '../ui';
import { cn } from '../ui/cn';
import { getPriceInfo } from '../../services/courses';
import type { Course } from '../../services/courses';

interface CoursePriceProps {
  course: Course;
  className?: string;
}

function formatPrice(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function formatLeft(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return days > 0 ? `${days} يوم و${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// عدّاد حقيقي لانتهاء الخصم (من تاريخ الانتهاء المسجل في الكورس فقط، بدون أرقام وهمية).
function DiscountCountdown({ expiry }: { expiry: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const left = expiry - now;
  if (left <= 0) return null;
  return <span className="text-xs font-bold text-rose-300">ينتهي الخصم بعد {formatLeft(left)}</span>;
}

export default function CoursePrice({ course, className }: CoursePriceProps) {
  if (course.isFree) {
    return (
      <Badge variant="success" className={className}>
        مجاني
      </Badge>
    );
  }

  const info = getPriceInfo(course);

  return (
    <div className={cn('flex flex-wrap items-baseline gap-2', className)}>
      <span className="text-xl font-extrabold text-gold-400">{formatPrice(info.price)} جنيه</span>
      {info.original !== null && (
        <span className="text-sm text-slate-500 line-through">{formatPrice(info.original)} جنيه</span>
      )}
      {info.discounted && <Badge variant="gold">خصم</Badge>}
      {info.discounted && course.discountExpiry !== null && <DiscountCountdown expiry={course.discountExpiry} />}
    </div>
  );
}

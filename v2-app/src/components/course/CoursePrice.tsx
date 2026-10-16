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
    </div>
  );
}

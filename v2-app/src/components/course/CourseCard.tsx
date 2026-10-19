import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { Badge, Card, buttonClasses } from '../ui';
import { getGradeLabel } from '../../lib/grades';
import type { Course } from '../../services/courses';
import CoursePrice from './CoursePrice';

interface CourseCardProps {
  course: Course;
  actionLabel?: string;
  showPrice?: boolean;
  footer?: ReactNode;
}

export default function CourseCard({
  course,
  actionLabel = 'تفاصيل الكورس',
  showPrice = true,
  footer,
}: CourseCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const gradeLabel = course.grade ? getGradeLabel(course.grade) : course.rawGrade;

  return (
    <Card padded={false} hoverable className="flex h-full flex-col overflow-hidden">
      <div className="relative aspect-video w-full bg-theme-surface-hover/80">
        {course.image && !imageFailed ? (
          <img
            src={course.image}
            alt={course.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-theme-gold/60">
            <BookOpen className="h-12 w-12" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        {gradeLabel && (
          <div>
            <Badge variant="info">{gradeLabel}</Badge>
          </div>
        )}

        <h3 className="line-clamp-2 text-lg font-bold leading-snug text-theme-text">
          {course.title || 'كورس بدون عنوان'}
        </h3>

        {showPrice && <CoursePrice course={course} />}

        {footer}

        <div className="mt-auto pt-3">
          <Link
            to={`/courses/${course.id}`}
            className={buttonClasses({ variant: 'primary', fullWidth: true })}
          >
            {actionLabel}
          </Link>
        </div>
      </div>
    </Card>
  );
}

import { Link, useParams } from 'react-router-dom';
import { ClipboardList, Circle, ExternalLink, FileText, Lock, PlayCircle } from 'lucide-react';
import { Badge, Card, EmptyState } from '../ui';
import { cn } from '../ui/cn';
import { KIND_LABELS } from '../../lib/grading';
import { isSafeHttpUrl } from '../../lib/media';
import { formatDateTime, getAssessmentPath } from '../../services/assessments';
import { getItemAvailability } from '../../services/courses';
import type { CourseItem, CourseSection } from '../../services/courses';

interface SectionListProps {
  sections: CourseSection[];
  // هل يستطيع المستخدم فتح المحتوى؟ (مشترك أو أدمن)
  unlocked: boolean;
  // الأدمن يتجاوز مواعيد الإتاحة، ويفتح الاختبارات في مسار المعاينة الخاص به.
  isAdmin?: boolean;
  activeItemId?: string | null;
  onSelectItem?: (item: CourseItem) => void;
}

interface ItemRowProps {
  item: CourseItem;
  courseId: string;
  unlocked: boolean;
  isAdmin: boolean;
  activeItemId: string | null;
  depth: number;
  onSelectItem?: (item: CourseItem) => void;
}

const rowClass =
  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition-colors';

// مسار الاختبار: الطالب في منطقته، والأدمن في مسار المعاينة (لأن حراسة الطالب تمنع الأدمن).
function getAssessmentLink(courseId: string, itemId: string, isAdmin: boolean): string {
  if (isAdmin) {
    return `/admin/preview/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(itemId)}`;
  }
  return getAssessmentPath(courseId, itemId);
}

function ItemRow({
  item,
  courseId,
  unlocked,
  isAdmin,
  activeItemId,
  depth,
  onSelectItem,
}: ItemRowProps) {
  const title = item.title || 'بدون عنوان';
  const availability = isAdmin ? { available: true, message: '' } : getItemAvailability(item);
  const indent = depth > 0 ? 'ms-6' : '';

  let row: JSX.Element;

  if (item.type === 'header') {
    row = <p className="px-3 pt-3 text-sm font-extrabold text-gold-400">{title}</p>;
  } else if ((item.type === 'task' || item.type === 'quiz') && item.assessmentKind !== null) {
    // امتحان أو تدريب أو واجب: يُفتح في صفحة الاختبار.
    const kindLabel = KIND_LABELS[item.assessmentKind];
    const now = Date.now();
    const notYet = !isAdmin && item.availableFrom !== null && item.availableFrom > now;
    const late = !isAdmin && item.availableUntil !== null && item.availableUntil < now;

    if (!unlocked || notYet || !courseId) {
      row = (
        <div className={cn(rowClass, 'text-slate-400')}>
          <Lock className="h-5 w-5 shrink-0 text-slate-500" />
          <span className="flex-1">{title}</span>
          <Badge variant="neutral">{kindLabel}</Badge>
          {unlocked && notYet && item.availableFrom !== null && (
            <Badge variant="gold">يتاح في {formatDateTime(item.availableFrom)}</Badge>
          )}
        </div>
      );
    } else {
      row = (
        <Link
          to={getAssessmentLink(courseId, item.id, isAdmin)}
          className={cn(rowClass, 'text-slate-200 hover:bg-navy-800 hover:text-white')}
        >
          <ClipboardList className="h-5 w-5 shrink-0 text-gold-400" />
          <span className="flex-1">{title}</span>
          {late && <Badge variant="danger">متأخر</Badge>}
          <Badge variant="gold">{kindLabel}</Badge>
        </Link>
      );
    }
  } else if (item.type === 'task' || item.type === 'quiz') {
    row = (
      <div className={cn(rowClass, 'text-slate-400')}>
        <ClipboardList className="h-5 w-5 shrink-0 text-slate-500" />
        <span className="flex-1">{title}</span>
      </div>
    );
  } else if (item.type === 'video' || item.type === 'pdf') {
    const Icon = item.type === 'video' ? PlayCircle : FileText;
    const canOpen = unlocked && availability.available;

    if (!canOpen) {
      row = (
        <div className={cn(rowClass, 'text-slate-400')}>
          <Lock className="h-5 w-5 shrink-0 text-slate-500" />
          <span className="flex-1">{title}</span>
          {unlocked && !availability.available && (
            <Badge variant="gold">{availability.message}</Badge>
          )}
        </div>
      );
    } else if (item.type === 'video') {
      const active = activeItemId === item.id;
      row = (
        <button
          type="button"
          onClick={() => onSelectItem?.(item)}
          className={cn(
            rowClass,
            active
              ? 'bg-gold-500/15 text-gold-300'
              : 'text-slate-200 hover:bg-navy-800 hover:text-white',
          )}
        >
          <Icon className="h-5 w-5 shrink-0 text-gold-400" />
          <span className="flex-1">{title}</span>
          {item.duration && <Badge variant="neutral">{item.duration}</Badge>}
        </button>
      );
    } else if (isSafeHttpUrl(item.pdfUrl)) {
      row = (
        <a
          href={item.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(rowClass, 'text-slate-200 hover:bg-navy-800 hover:text-white')}
        >
          <Icon className="h-5 w-5 shrink-0 text-gold-400" />
          <span className="flex-1">{title}</span>
          <ExternalLink className="h-4 w-4 text-slate-400" />
        </a>
      );
    } else {
      row = (
        <div className={cn(rowClass, 'text-slate-400')}>
          <Icon className="h-5 w-5 shrink-0 text-slate-500" />
          <span className="flex-1">{title}</span>
          <Badge variant="danger">رابط الملف غير صحيح</Badge>
        </div>
      );
    }
  } else {
    row = (
      <div className={cn(rowClass, 'text-slate-400')}>
        <Circle className="h-4 w-4 shrink-0 text-slate-600" />
        <span className="flex-1">{title}</span>
      </div>
    );
  }

  return (
    <li className={indent}>
      {row}
      {item.children.length > 0 && (
        <ul className="space-y-0.5">
          {item.children.map((child) => (
            <ItemRow
              key={child.id}
              item={child}
              courseId={courseId}
              unlocked={unlocked}
              isAdmin={isAdmin}
              activeItemId={activeItemId}
              depth={depth + 1}
              onSelectItem={onSelectItem}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function SectionList({
  sections,
  unlocked,
  isAdmin = false,
  activeItemId = null,
  onSelectItem,
}: SectionListProps) {
  // رقم الكورس من رابط الصفحة (/courses/:courseId)، ويُستخدم لبناء روابط الاختبارات.
  const { courseId = '' } = useParams();

  if (sections.length === 0) {
    return (
      <Card>
        <EmptyState title="لا يوجد محتوى بعد" description="لم تتم إضافة أقسام لهذا الكورس حتى الآن." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <Card key={section.id} padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-navy-800 bg-navy-800/50 px-4 py-3">
            <h3 className="font-bold text-white">{section.title}</h3>
            <Badge variant="neutral">{section.items.length} عنصر</Badge>
          </div>

          {section.items.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-500">لا توجد عناصر في هذا القسم.</p>
          ) : (
            <ul className="space-y-0.5 p-2">
              {section.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  courseId={courseId}
                  unlocked={unlocked}
                  isAdmin={isAdmin}
                  activeItemId={activeItemId}
                  depth={0}
                  onSelectItem={onSelectItem}
                />
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}

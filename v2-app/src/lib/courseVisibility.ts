// قواعد ظهور عناصر الكورس للطالب: المؤرشف والمسودة لا يظهران، والأدمن يرى كل شيء.
// (دوال نقية بلا أي اتصال بـ Firebase حتى يمكن اختبارها مباشرة)
import type { CourseItem, CourseSection } from './courseNormalize.ts';

// العنصر مسودة أو مخفي؟ (المسودة تُحفظ للإدارة ولا تُعرض للطالب حتى النشر)
export function isHiddenItem(item: Pick<CourseItem, 'raw'>): boolean {
  const raw = item.raw || {};
  return raw.isDraft === true || raw.hidden === true;
}

export interface VisibleSectionsOptions {
  // للأدمن فقط: عرض المسودات التي لم تُنشر بعد
  includeHidden?: boolean;
}

export function getVisibleSections(
  sections: CourseSection[],
  options: VisibleSectionsOptions = {},
): CourseSection[] {
  const includeHidden = options.includeHidden === true;

  return sections
    .filter((section) => !section.archived)
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => !item.archived && (includeHidden || !isHiddenItem(item)))
        .map((item) => ({
          ...item,
          children: item.children.filter(
            (child) => !child.archived && (includeHidden || !isHiddenItem(child)),
          ),
        })),
    }));
}

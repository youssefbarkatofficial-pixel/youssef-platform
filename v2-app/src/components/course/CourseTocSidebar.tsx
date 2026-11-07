/**
 * CourseTocSidebar – فهرس الكورس الجانبي (accordion متداخل)
 *
 * الهيكل:
 *   فهرس الكورس
 *   └─ [وحدة 1] ◂ accordion
 *       └─ [درس 1] ◂ accordion
 *           ├─ محاضرة الشرح
 *           ├─ ملف الشرح
 *           ├─ تدريب 1، تدريب 2 …
 *           └─ واجب 1، واجب 2 …
 *   └─ [وحدة 2] …
 *   ─────────────────
 *   └─ [الواجبات]  ◂ accordion (اختصار سريع)
 *       └─ واجب 1، واجب 2 …
 *   └─ [الامتحانات] ◂ accordion (اختصار سريع)
 *       └─ امتحان 1 …
 *
 * القواعد:
 * - قراءة فقط. لا يغيّر أي بيانات.
 * - يعمل بدون وحدات (يعامل كل المحاضرات كوحدة واحدة).
 * - يخفي أي محتوى مش موجود (مثلاً: لو مفيش تدريبات مش بيعرض قسم التدريبات).
 * - يدعم dark/light mode و RTL.
 */

import { useState, useCallback } from 'react';
import {
  BookOpen,
  ChevronDown,
  ClipboardList,
  FileText,
  Layers,
  Lock,
  PlayCircle,
  Award,
  PenTool,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../ui/cn';
import type { NormalizedLecture, NormalizedAssessment } from '../../lib/courseNormalize';
import { checkLectureLock, checkInLectureItemLock } from '../../lib/contentRules';
import type { ContentRulesSettings } from '../../lib/contentRules';
import type { CourseSection } from '../../lib/courseNormalize';
import { buttonClasses } from '../ui';

// ─── types ───────────────────────────────────────────────────────────────────

interface TocUnit {
  id: string;
  title: string;
  lectures: NormalizedLecture[];
}

interface CourseTocSidebarProps {
  courseId: string;
  courseTitle: string;
  /** وحدات الكورس (CourseSection[]) لو موجودة */
  sections: CourseSection[];
  /** كل المحاضرات الـ normalized */
  lectures: NormalizedLecture[];
  /** الواجبات على مستوى الكورس */
  homeworks: NormalizedAssessment[];
  /** الامتحانات على مستوى الكورس */
  exams: NormalizedAssessment[];
  /** نسب المشاهدة */
  effectiveWatch: Record<string, number>;
  /** هل الطالب مسجّل ومتاح له المحتوى */
  canAccess: boolean;
  /** هل المستخدم أدمن */
  isAdmin: boolean;
  /** بيانات الطالب لفحص القفل */
  student: { id: string; examResults?: unknown[] } | null;
  contentRules: ContentRulesSettings;
  /** callback لما يضغط على محاضرة */
  onPlayLecture?: (lec: NormalizedLecture) => void;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function AccordionItem({
  label,
  icon,
  defaultOpen = false,
  children,
  badge,
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string | number;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn('border-b border-navy-800/60 last:border-0', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm font-semibold text-slate-200 transition-colors hover:bg-navy-800/50"
      >
        {icon && <span className="shrink-0 text-gold-400">{icon}</span>}
        <span className="flex-1 leading-snug">{label}</span>
        {badge !== undefined && (
          <span className="rounded-full bg-navy-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
            {badge}
          </span>
        )}
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

function LockBadge({ message }: { message?: string }) {
  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300"
      title={message}
    >
      <Lock className="h-2.5 w-2.5" />
      مقفول
    </span>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function CourseTocSidebar({
  courseId,
  lectures,
  sections,
  homeworks,
  exams,
  effectiveWatch,
  canAccess,
  isAdmin,
  student,
  contentRules,
  onPlayLecture,
}: CourseTocSidebarProps) {
  // ── بناء الوحدات ──────────────────────────────────────────────────────────
  // إذا الكورس فيه sections حقيقية (غير مشتقة) نستخدمها
  // كل section عنوانها يكون "الوحدة X"، وكل item فيها lecture

  const units: TocUnit[] = (() => {
    // sections[0].id === 'sec_lectures' يعني مشتقة ومش حقيقية
    const hasRealSections =
      sections.length > 0 &&
      !sections.every((s) => ['sec_lectures', 'sec_homeworks', 'sec_exams'].includes(s.id));

    if (hasRealSections) {
      // استخدم الوحدات الحقيقية
      return sections
        .filter((s) => !['sec_homeworks', 'sec_exams'].includes(s.id))
        .map((sec) => {
          const secLecIds = new Set(sec.items.map((it) => it.id));
          const secLectures = lectures.filter((l) => secLecIds.has(l.id));
          return {
            id: sec.id,
            title: sec.title,
            lectures: secLectures.length > 0 ? secLectures : [],
          };
        })
        .filter((u) => u.lectures.length > 0);
    }

    // لو مفيش وحدات حقيقية، كل المحاضرات في وحدة واحدة بعنوان "المحاضرات"
    if (lectures.length > 0) {
      return [{ id: 'unit_all', title: 'المحاضرات', lectures }];
    }
    return [];
  })();

  // ── لا تعرض sidebar لو مفيش محتوى ────────────────────────────────────────
  if (units.length === 0 && homeworks.length === 0 && exams.length === 0) return null;

  const now = Date.now();

  return (
    <nav
      aria-label="فهرس الكورس"
      className="rounded-xl border border-navy-800 bg-navy-900/80 text-sm"
    >
      {/* ── عنوان الفهرس ── */}
      <div className="flex items-center gap-2 border-b border-navy-800 px-3 py-3">
        <BookOpen className="h-4 w-4 shrink-0 text-gold-400" />
        <h2 className="font-extrabold text-white">فهرس الكورس</h2>
      </div>

      {/* ── الوحدات ── */}
      {units.map((unit, unitIdx) => {
        const unitLecCount = unit.lectures.length;
        return (
          <AccordionItem
            key={unit.id}
            label={unit.title}
            icon={<Layers className="h-3.5 w-3.5" />}
            badge={unitLecCount}
            defaultOpen={unitIdx === 0}
          >
            {/* الدروس داخل الوحدة */}
            <div className="space-y-0 ps-3">
              {unit.lectures.map((lec, lecIdx) => {
                const lectureLock = checkLectureLock(
                  // نحتاج course object — نمرر minimal shape
                  { content: { lectures } } as unknown as Parameters<typeof checkLectureLock>[0],
                  lectures.indexOf(lec),
                  student,
                  effectiveWatch,
                  (student as any)?.examResults || [],
                  contentRules,
                  now,
                  isAdmin,
                );
                const watchPct = effectiveWatch[lec.id] ?? 0;
                const isWatched = watchPct >= 95;
                const hasVideo = Boolean(lec.youtubeUrl);
                const hasPdf = Boolean(lec.pdfUrl) || (lec.files && lec.files.length > 0);
                const hasTrainings = lec.trainings && lec.trainings.length > 0;
                const hasHomeworks = lec.homeworks && lec.homeworks.length > 0;
                const contentCount = (hasVideo ? 1 : 0) + (hasPdf ? 1 : 0) + (hasTrainings ? lec.trainings.length : 0) + (hasHomeworks ? (lec.homeworks?.length ?? 0) : 0);

                return (
                  <AccordionItem
                    key={lec.id}
                    label={`درس ${lec.order}: ${lec.title}`}
                    icon={
                      isWatched ? (
                        <span className="h-3.5 w-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        </span>
                      ) : (
                        <PlayCircle className="h-3.5 w-3.5" />
                      )
                    }
                    badge={contentCount}
                    defaultOpen={unitIdx === 0 && lecIdx === 0}
                    className="border-navy-800/40 ms-1"
                  >
                    <div className="space-y-0.5 ps-5 pb-1">
                      {/* محاضرة الشرح */}
                      {hasVideo && (
                        <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-navy-800/60">
                          <div className="flex items-center gap-1.5 text-xs">
                            <PlayCircle className="h-3 w-3 text-sky-400 shrink-0" />
                            <span className="text-slate-300">محاضرة الشرح</span>
                          </div>
                          {canAccess ? (
                            lectureLock.locked ? (
                              <LockBadge message={lectureLock.message} />
                            ) : (
                              <button
                                type="button"
                                onClick={() => onPlayLecture?.(lec)}
                                className="rounded bg-gold-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-gold-400 hover:bg-gold-500/20 transition-colors"
                              >
                                شاهد
                              </button>
                            )
                          ) : (
                            <Lock className="h-3 w-3 text-slate-500 shrink-0" />
                          )}
                        </div>
                      )}

                      {/* ملف الشرح */}
                      {hasPdf && (() => {
                        const files = lec.files && lec.files.length > 0
                          ? lec.files
                          : lec.pdfUrl
                          ? [{ id: `f_${lec.id}`, title: 'المذكرة', url: lec.pdfUrl }]
                          : [];
                        return files.map((file) => {
                          const fileLock = canAccess
                            ? checkInLectureItemLock(lec, file, 'file', student, effectiveWatch, contentRules, courseId, now, isAdmin)
                            : { locked: true, message: 'يلزم الاشتراك' };
                          return (
                            <div
                              key={file.id}
                              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-navy-800/60"
                            >
                              <div className="flex items-center gap-1.5 text-xs">
                                <FileText className="h-3 w-3 text-gold-400 shrink-0" />
                                <span className="text-slate-300 truncate max-w-[120px]">{file.title || 'ملف الشرح'}</span>
                              </div>
                              {!fileLock.locked ? (
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded bg-gold-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-gold-400 hover:bg-gold-500/20 transition-colors"
                                >
                                  تحميل
                                </a>
                              ) : (
                                <LockBadge message={fileLock.message} />
                              )}
                            </div>
                          );
                        });
                      })()}

                      {/* التدريبات */}
                      {hasTrainings && lec.trainings.map((tr) => {
                        const trLock = canAccess
                          ? checkInLectureItemLock(lec, tr, 'training', student, effectiveWatch, contentRules, courseId, now, isAdmin)
                          : { locked: true, message: 'يلزم الاشتراك' };
                        const trLink = isAdmin
                          ? `/admin/preview/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(tr.id)}`
                          : `/student/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(tr.id)}`;
                        return (
                          <div
                            key={tr.id}
                            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-navy-800/60"
                          >
                            <div className="flex items-center gap-1.5 text-xs">
                              <ClipboardList className="h-3 w-3 text-emerald-400 shrink-0" />
                              <span className="text-slate-300 truncate max-w-[120px]">{tr.title}</span>
                            </div>
                            {!trLock.locked ? (
                              <Link
                                to={trLink}
                                className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                              >
                                ابدأ
                              </Link>
                            ) : (
                              <LockBadge message={trLock.message} />
                            )}
                          </div>
                        );
                      })}

                      {/* الواجبات المرتبطة بالدرس */}
                      {hasHomeworks && lec.homeworks!.map((hw) => {
                        const hwLock = canAccess
                          ? checkInLectureItemLock(lec, hw, 'homework', student, effectiveWatch, contentRules, courseId, now, isAdmin)
                          : { locked: true, message: 'يلزم الاشتراك' };
                        const hwLink = isAdmin
                          ? `/admin/preview/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(hw.id)}`
                          : `/student/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(hw.id)}`;
                        return (
                          <div
                            key={hw.id}
                            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-navy-800/60"
                          >
                            <div className="flex items-center gap-1.5 text-xs">
                              <PenTool className="h-3 w-3 text-amber-400 shrink-0" />
                              <span className="text-slate-300 truncate max-w-[120px]">{hw.title}</span>
                            </div>
                            {!hwLock.locked ? (
                              <Link
                                to={hwLink}
                                className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
                              >
                                أدِّ
                              </Link>
                            ) : (
                              <LockBadge message={hwLock.message} />
                            )}
                          </div>
                        );
                      })}

                      {/* لو الدرس مقفول بالكامل ومفيش محتوى */}
                      {!hasVideo && !hasPdf && !hasTrainings && !hasHomeworks && (
                        <p className="px-2 py-1 text-xs text-slate-500">لا يوجد محتوى بعد</p>
                      )}
                    </div>
                  </AccordionItem>
                );
              })}
            </div>
          </AccordionItem>
        );
      })}

      {/* ── الواجبات (اختصار سريع) ── */}
      {homeworks.length > 0 && (
        <AccordionItem
          key="quick-hw"
          label="الواجبات"
          icon={<PenTool className="h-3.5 w-3.5" />}
          badge={homeworks.length}
        >
          <div className="space-y-0.5 px-3 pb-1">
            {homeworks.map((hw) => {
              const hwLink = isAdmin
                ? `/admin/preview/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(hw.id)}`
                : `/student/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(hw.id)}`;
              const isLocked = !isAdmin && typeof hw.openAt === 'number' && hw.openAt > now;
              return (
                <div
                  key={hw.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-navy-800/60"
                >
                  <span className="text-xs text-slate-300 truncate max-w-[140px]">{hw.title}</span>
                  {canAccess && !isLocked ? (
                    <Link
                      to={hwLink}
                      className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors shrink-0"
                    >
                      أدِّ
                    </Link>
                  ) : (
                    <Lock className="h-3 w-3 text-slate-500 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </AccordionItem>
      )}

      {/* ── الامتحانات (اختصار سريع) ── */}
      {exams.length > 0 && (
        <AccordionItem
          key="quick-exam"
          label="الامتحانات"
          icon={<Award className="h-3.5 w-3.5" />}
          badge={exams.length}
        >
          <div className="space-y-0.5 px-3 pb-1">
            {exams.map((ex) => {
              const exLink = isAdmin
                ? `/admin/preview/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(ex.id)}`
                : `/student/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(ex.id)}`;
              const isLocked = !isAdmin && typeof ex.openAt === 'number' && ex.openAt > now;
              return (
                <div
                  key={ex.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-navy-800/60"
                >
                  <span className="text-xs text-slate-300 truncate max-w-[140px]">{ex.title}</span>
                  {canAccess && !isLocked ? (
                    <Link
                      to={exLink}
                      className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400 hover:bg-sky-500/20 transition-colors shrink-0"
                    >
                      ابدأ
                    </Link>
                  ) : (
                    <Lock className="h-3 w-3 text-slate-500 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </AccordionItem>
      )}
    </nav>
  );
}

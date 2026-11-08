/**
 * CourseTocSidebar – فهرس الكورس (accordion متداخل)
 *
 * يعمل في وضعين:
 *   fullWidth={false}  → شريط جانبي ضيق (الوضع القديم)
 *   fullWidth={true}   → يملأ العمود الرئيسي (الوضع الجديد المطلوب)
 *
 * الهيكل:
 *   فهرس الكورس
 *   └─ [وحدة 1] ◂ accordion
 *       └─ [درس 1] ◂ accordion
 *           ├─ محاضرة الشرح
 *           ├─ ملف الشرح
 *           ├─ تدريب 1، تدريب 2 …
 *           └─ واجب 1، واجب 2 …
 *   ─────────────────────────
 *   └─ الواجبات  ◂ accordion (اختصار سريع)
 *   └─ الامتحانات ◂ accordion (اختصار سريع)
 */

import { useState } from 'react';
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
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../ui/cn';
import type { NormalizedLecture, NormalizedAssessment } from '../../lib/courseNormalize';
import { checkLectureLock, checkInLectureItemLock } from '../../lib/contentRules';
import type { ContentRulesSettings } from '../../lib/contentRules';
import type { CourseSection } from '../../lib/courseNormalize';

// ─── types ───────────────────────────────────────────────────────────────────

interface TocUnit {
  id: string;
  title: string;
  lectures: NormalizedLecture[];
}

interface CourseTocSidebarProps {
  courseId: string;
  courseTitle: string;
  sections: CourseSection[];
  lectures: NormalizedLecture[];
  homeworks: NormalizedAssessment[];
  exams: NormalizedAssessment[];
  effectiveWatch: Record<string, number>;
  canAccess: boolean;
  isAdmin: boolean;
  student: { id: string; examResults?: unknown[] } | null;
  contentRules: ContentRulesSettings;
  /** لو true: يملأ عرض الصفحة بدل الشريط الجانبي */
  fullWidth?: boolean;
  onPlayLecture?: (lec: NormalizedLecture) => void;
}

// ─── Accordion item ───────────────────────────────────────────────────────────

function AccordionItem({
  label,
  icon,
  defaultOpen = false,
  children,
  badge,
  level = 1,
  statusDot,
}: {
  label: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string | number;
  level?: 1 | 2;
  statusDot?: 'watched' | 'partial' | 'none';
}) {
  const [open, setOpen] = useState(defaultOpen);

  const headerBase =
    level === 1
      ? 'flex w-full items-center gap-2.5 px-4 py-3 text-start font-bold text-white transition-colors hover:bg-navy-800/60 border-b border-navy-800/50'
      : 'flex w-full items-center gap-2 px-4 py-2.5 text-start text-sm font-semibold text-slate-200 transition-colors hover:bg-navy-800/40';

  return (
    <div className={cn(level === 1 ? 'border-b border-navy-800 last:border-0' : '')}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={headerBase}>
        {/* status dot for lectures */}
        {statusDot && (
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              statusDot === 'watched'
                ? 'bg-emerald-400'
                : statusDot === 'partial'
                  ? 'bg-amber-400'
                  : 'bg-navy-600',
            )}
          />
        )}
        {icon && <span className="shrink-0 text-gold-400">{icon}</span>}
        <span className="flex-1 leading-snug">{label}</span>
        {badge !== undefined && (
          <span className="rounded-full bg-navy-700 px-2 py-0.5 text-[11px] font-bold text-slate-400">
            {badge}
          </span>
        )}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function LockBadge({ message }: { message?: string }) {
  return (
    <span
      title={message}
      className="flex shrink-0 items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300"
    >
      <Lock className="h-2.5 w-2.5" />
      مقفول
    </span>
  );
}

// ─── content row (video / file / training / homework) ────────────────────────

function ContentRow({
  icon,
  label,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-4 py-2 hover:bg-navy-800/40 transition-colors">
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <span className="shrink-0">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
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
  fullWidth = false,
  onPlayLecture,
}: CourseTocSidebarProps) {

  // ── بناء الوحدات ──────────────────────────────────────────────────────────
  const units: TocUnit[] = (() => {
    const hasRealSections =
      sections.length > 0 &&
      !sections.every((s) => ['sec_lectures', 'sec_homeworks', 'sec_exams'].includes(s.id));

    if (hasRealSections) {
      return sections
        .filter((s) => !['sec_homeworks', 'sec_exams'].includes(s.id))
        .map((sec) => {
          const secLecIds = new Set(sec.items.map((it) => it.id));
          const secLectures = lectures.filter((l) => secLecIds.has(l.id));
          return { id: sec.id, title: sec.title, lectures: secLectures };
        })
        .filter((u) => u.lectures.length > 0);
    }

    if (lectures.length > 0) {
      return [{ id: 'unit_all', title: 'المحاضرات', lectures }];
    }
    return [];
  })();

  if (units.length === 0 && homeworks.length === 0 && exams.length === 0) return null;

  const now = Date.now();

  // ── action button styles ──────────────────────────────────────────────────
  const btnPlay =
    'rounded-lg bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-400 hover:bg-gold-500/20 transition-colors';
  const btnDl =
    'rounded-lg bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-400 hover:bg-gold-500/20 transition-colors';
  const btnTr =
    'rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors';
  const btnHw =
    'rounded-lg bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors';
  const btnEx =
    'rounded-lg bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition-colors';

  return (
    <nav
      aria-label="فهرس الكورس"
      className={cn(
        'rounded-xl border border-navy-800 bg-navy-900/80 overflow-hidden',
        fullWidth ? 'w-full' : 'text-sm',
      )}
    >
      {/* ── header ── */}
      <div className="flex items-center gap-2.5 border-b border-navy-800 bg-navy-950/60 px-4 py-3.5">
        <BookOpen className="h-5 w-5 shrink-0 text-gold-400" />
        <h2 className="text-base font-extrabold text-white">فهرس الكورس</h2>
        <span className="ms-auto rounded-full bg-navy-800 px-2 py-0.5 text-xs font-bold text-slate-400">
          {lectures.length} درس
        </span>
      </div>

      {/* ── الوحدات ── */}
      {units.map((unit, unitIdx) => (
        <AccordionItem
          key={unit.id}
          label={unit.title}
          icon={<Layers className="h-4 w-4" />}
          badge={unit.lectures.length}
          defaultOpen={unitIdx === 0}
          level={1}
        >
          {unit.lectures.map((lec, lecIdx) => {
            const lectureLock = checkLectureLock(
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
            const hasPdf = Boolean(lec.pdfUrl) || Boolean(lec.files?.length);
            const hasTrainings = Boolean(lec.trainings?.length);
            const hasHomeworks = Boolean(lec.homeworks?.length);
            const contentCount =
              (hasVideo ? 1 : 0) +
              (hasPdf ? (lec.files?.length || 1) : 0) +
              (lec.trainings?.length || 0) +
              (lec.homeworks?.length || 0);

            const dot: 'watched' | 'partial' | 'none' = isWatched
              ? 'watched'
              : watchPct > 0
                ? 'partial'
                : 'none';

            return (
              <AccordionItem
                key={lec.id}
                label={`الدرس ${lec.order}: ${lec.title}`}
                icon={
                  isWatched ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <PlayCircle className="h-4 w-4" />
                  )
                }
                badge={contentCount}
                defaultOpen={unitIdx === 0 && lecIdx === 0}
                level={2}
                statusDot={dot}
              >
                <div className="bg-navy-950/40 py-1">
                  {/* محاضرة الشرح */}
                  {hasVideo && (
                    <ContentRow
                      icon={<PlayCircle className="h-4 w-4 text-sky-400" />}
                      label="محاضرة الشرح"
                      action={
                        canAccess ? (
                          lectureLock.locked ? (
                            <LockBadge message={lectureLock.message} />
                          ) : (
                            <button type="button" onClick={() => onPlayLecture?.(lec)} className={btnPlay}>
                              شاهد
                            </button>
                          )
                        ) : (
                          <Lock className="h-3.5 w-3.5 text-slate-500" />
                        )
                      }
                    />
                  )}

                  {/* ملف/ملفات الشرح */}
                  {hasPdf && (() => {
                    const files =
                      lec.files && lec.files.length > 0
                        ? lec.files
                        : lec.pdfUrl
                          ? [{ id: `f_${lec.id}`, title: 'ملف الشرح', url: lec.pdfUrl }]
                          : [];
                    return files.map((file) => {
                      const fileLock = canAccess
                        ? checkInLectureItemLock(lec, file, 'file', student, effectiveWatch, contentRules, courseId, now, isAdmin)
                        : { locked: true, message: 'يلزم الاشتراك' };
                      return (
                        <ContentRow
                          key={file.id}
                          icon={<FileText className="h-4 w-4 text-gold-400" />}
                          label={file.title || 'ملف الشرح'}
                          action={
                            !fileLock.locked ? (
                              <a href={file.url} target="_blank" rel="noopener noreferrer" className={btnDl}>
                                تحميل
                              </a>
                            ) : (
                              <LockBadge message={fileLock.message} />
                            )
                          }
                        />
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
                      <ContentRow
                        key={tr.id}
                        icon={<ClipboardList className="h-4 w-4 text-emerald-400" />}
                        label={tr.title}
                        action={
                          !trLock.locked ? (
                            <Link to={trLink} className={btnTr}>ابدأ التدريب</Link>
                          ) : (
                            <LockBadge message={trLock.message} />
                          )
                        }
                      />
                    );
                  })}

                  {/* الواجبات المرتبطة */}
                  {hasHomeworks && lec.homeworks!.map((hw) => {
                    const hwLock = canAccess
                      ? checkInLectureItemLock(lec, hw, 'homework', student, effectiveWatch, contentRules, courseId, now, isAdmin)
                      : { locked: true, message: 'يلزم الاشتراك' };
                    const hwLink = isAdmin
                      ? `/admin/preview/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(hw.id)}`
                      : `/student/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(hw.id)}`;
                    return (
                      <ContentRow
                        key={hw.id}
                        icon={<PenTool className="h-4 w-4 text-amber-400" />}
                        label={hw.title}
                        action={
                          !hwLock.locked ? (
                            <Link to={hwLink} className={btnHw}>حل الواجب</Link>
                          ) : (
                            <LockBadge message={hwLock.message} />
                          )
                        }
                      />
                    );
                  })}

                  {!hasVideo && !hasPdf && !hasTrainings && !hasHomeworks && (
                    <p className="px-4 py-2 text-xs text-slate-500">لا يوجد محتوى بعد</p>
                  )}
                </div>
              </AccordionItem>
            );
          })}
        </AccordionItem>
      ))}

      {/* ── الواجبات (وصول سريع) ── */}
      {homeworks.length > 0 && (
        <AccordionItem
          key="quick-hw"
          label="الواجبات"
          icon={<PenTool className="h-4 w-4" />}
          badge={homeworks.length}
          level={1}
        >
          <div className="bg-navy-950/40 py-1">
            {homeworks.map((hw) => {
              const hwLink = isAdmin
                ? `/admin/preview/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(hw.id)}`
                : `/student/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(hw.id)}`;
              const isLocked = !isAdmin && typeof hw.openAt === 'number' && hw.openAt > now;
              return (
                <ContentRow
                  key={hw.id}
                  icon={<PenTool className="h-4 w-4 text-amber-400" />}
                  label={hw.title}
                  action={
                    canAccess && !isLocked ? (
                      <Link to={hwLink} className={btnHw}>حل الواجب</Link>
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-slate-500" />
                    )
                  }
                />
              );
            })}
          </div>
        </AccordionItem>
      )}

      {/* ── الامتحانات (وصول سريع) ── */}
      {exams.length > 0 && (
        <AccordionItem
          key="quick-exam"
          label="الامتحانات"
          icon={<Award className="h-4 w-4" />}
          badge={exams.length}
          level={1}
        >
          <div className="bg-navy-950/40 py-1">
            {exams.map((ex) => {
              const exLink = isAdmin
                ? `/admin/preview/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(ex.id)}`
                : `/student/assessment/${encodeURIComponent(courseId)}/${encodeURIComponent(ex.id)}`;
              const isLocked = !isAdmin && typeof ex.openAt === 'number' && ex.openAt > now;
              return (
                <ContentRow
                  key={ex.id}
                  icon={<Award className="h-4 w-4 text-sky-400" />}
                  label={ex.title}
                  action={
                    canAccess && !isLocked ? (
                      <Link to={exLink} className={btnEx}>ابدأ الامتحان</Link>
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-slate-500" />
                    )
                  }
                />
              );
            })}
          </div>
        </AccordionItem>
      )}
    </nav>
  );
}

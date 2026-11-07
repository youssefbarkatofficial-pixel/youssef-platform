/**
 * LectureStationBadges
 * --------------------
 * يعرض 4 دوائر صغيرة بجانب عنوان المحاضرة تعكس حالة كل محطة:
 *   🎬 الشرح  |  ✍️ التدريب  |  📝 الواجب  |  🎯 الامتحان
 *
 * - مكوّن عرض بحت (read-only) — لا يغيّر أي بيانات.
 * - يشتغل في الوضعين (نهاري/ليلي) ومع RTL.
 * - يستخدم الألوان الموجودة في الثيم (navy/gold/emerald/amber) فقط.
 * - إضافة خالصة: لا يلمس أي منطق موجود.
 */
import { CheckCircle2, ClipboardList, FileText, Lock, PlayCircle } from 'lucide-react';
import type { NormalizedLecture } from '../../lib/courseNormalize';

interface LectureStationBadgesProps {
  lecture: NormalizedLecture;
  watchPct: number;        // نسبة المشاهدة 0-100
  canAccess: boolean;
  isLectureLocked: boolean;
}

interface StationDef {
  key: string;
  label: string;
  Icon: typeof PlayCircle;
  done: boolean;
  available: boolean; // هل الستيشن موجود أصلاً في المحاضرة؟
}

export default function LectureStationBadges({
  lecture,
  watchPct,
  canAccess,
  isLectureLocked,
}: LectureStationBadgesProps) {
  const hasVideo = Boolean(lecture.youtubeUrl);
  const hasTraining = (lecture.trainings ?? []).length > 0;
  const hasHomework = (lecture.homeworks ?? []).length > 0;

  // المحاضرة مش فيها أي تنويع → ما نعرضش الشريط (مفيش قيمة)
  if (!hasVideo && !hasTraining && !hasHomework) return null;

  const videoWatched = watchPct >= 95;

  const stations: StationDef[] = [
    {
      key: 'video',
      label: 'الشرح',
      Icon: PlayCircle,
      done: videoWatched,
      available: hasVideo,
    },
    {
      key: 'training',
      label: 'التدريب',
      Icon: ClipboardList,
      done: false, // لا يوجد تتبع لإنهاء التدريب في الـ state الحالي — نعرضه دائمًا كـ "متاح"
      available: hasTraining,
    },
    {
      key: 'homework',
      label: 'الواجب',
      Icon: FileText,
      done: false, // نفس التعليق أعلاه
      available: hasHomework,
    },
    {
      key: 'exam',
      label: 'الامتحان',
      Icon: FileText,
      done: false,
      available: false, // الامتحانات في المنصة مفصولة على مستوى الكورس، مش المحاضرة حاليًا
    },
  ].filter((s) => s.available);

  if (stations.length === 0) return null;

  return (
    <div
      className="mt-1 flex flex-wrap items-center gap-1.5"
      aria-label="محطات المحاضرة"
      role="list"
    >
      {stations.map((station) => {
        const locked = isLectureLocked || !canAccess;

        let dotClass: string;
        let iconClass: string;
        let titleText: string;

        if (locked) {
          dotClass =
            'flex items-center gap-1 rounded-full border border-navy-700 bg-navy-800 px-2 py-0.5 text-[10px] text-slate-500';
          iconClass = 'h-3 w-3 shrink-0 text-slate-600';
          titleText = `${station.label} — مقفول`;
        } else if (station.done) {
          dotClass =
            'flex items-center gap-1 rounded-full border border-emerald-700/60 bg-emerald-900/30 px-2 py-0.5 text-[10px] text-emerald-300';
          iconClass = 'h-3 w-3 shrink-0 text-emerald-400';
          titleText = `${station.label} — مكتمل`;
        } else {
          dotClass =
            'flex items-center gap-1 rounded-full border border-navy-700 bg-navy-800/60 px-2 py-0.5 text-[10px] text-slate-300';
          iconClass = 'h-3 w-3 shrink-0 text-gold-400';
          titleText = `${station.label} — متاح`;
        }

        const StationIcon = locked ? Lock : station.done ? CheckCircle2 : station.Icon;

        return (
          <span key={station.key} className={dotClass} role="listitem" title={titleText}>
            <StationIcon className={iconClass} aria-hidden="true" />
            <span>{station.label}</span>
          </span>
        );
      })}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Radar, RefreshCw } from 'lucide-react';
import { Badge, Card, EmptyState, Spinner, StatCard } from '../../components/ui';
import { useCourses } from '../../hooks/useCourses';
import { calcWatchPercent, getOfficialScores, videoIdsForStudent } from '../../lib/stats';
import {
  SEGMENT_LABELS,
  buildRadar,
  messageFor,
  weakAssessments,
  whatsappLink,
} from '../../lib/radar';
import type { LessonScoreInput, RadarRow, RadarSegment, RadarStudentInput } from '../../lib/radar';
import { parseExamResults } from '../../services/assessments';
import { listStudents } from '../../services/students';
import type { Student } from '../../services/students';

const SEGMENTS: RadarSegment[] = ['stopped', 'weak', 'lagging', 'star', 'ok'];
const SEGMENT_BADGE: Record<RadarSegment, 'danger' | 'gold' | 'info' | 'success' | 'neutral'> = {
  stopped: 'danger',
  weak: 'gold',
  lagging: 'info',
  star: 'success',
  ok: 'neutral',
};

export default function RadarPage() {
  const { courses, loading: loadingCourses } = useCourses();
  const [students, setStudents] = useState<Student[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<RadarSegment | 'all'>('stopped');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    listStudents({ forceRefresh: reloadKey > 0 })
      .then((result) => {
        if (!active) return;
        setStudents(result.students);
        setTruncated(result.truncated);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const { rows, lessons } = useMemo(() => {
    const inputs: RadarStudentInput[] = [];
    const scoreInputs: LessonScoreInput[] = [];

    students.forEach((student) => {
      const official = getOfficialScores(parseExamResults(student.examResults));
      official.forEach((item) =>
        scoreInputs.push({ key: item.key, title: item.title, courseId: item.courseId, score: item.score }),
      );
      const avg = official.length > 0 ? official.reduce((sum, item) => sum + item.score, 0) / official.length : null;
      inputs.push({
        id: student.id,
        name: student.name,
        phone: student.phone,
        parentPhone: student.parentPhone,
        courseCount: student.courses.length,
        lastActiveMs: student.lastActiveMs,
        createdAtMs: student.createdAtMs,
        watchPercent: calcWatchPercent(student.watchProgress, videoIdsForStudent(courses, student.courses)),
        avgScore: avg,
        examCount: official.length,
        archived: student.archived,
      });
    });

    return { rows: buildRadar(inputs, Date.now()), lessons: weakAssessments(scoreInputs) };
  }, [students, courses]);

  const counts = useMemo(() => {
    const result: Record<RadarSegment, number> = { stopped: 0, weak: 0, lagging: 0, star: 0, ok: 0 };
    rows.forEach((row) => {
      result[row.segment] += 1;
    });
    return result;
  }, [rows]);

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((row) => row.segment === filter)).slice(0, 200),
    [rows, filter],
  );

  const courseTitle = (id: string) => courses.find((course) => course.id === id)?.title ?? '';

  const waButton = (row: RadarRow, forParent: boolean) => {
    const phone = forParent ? row.parentPhone : row.phone;
    const href = whatsappLink(phone, messageFor(row.segment, row.name, forParent));
    if (!href) return <span className="text-[11px] text-slate-600">—</span>;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/20 px-2 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/30"
      >
        <MessageCircle className="h-3 w-3" /> {forParent ? 'ولي الأمر' : 'الطالب'}
      </a>
    );
  };

  if (loading || loadingCourses) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (failed) {
    return <EmptyState title="تعذر تحميل الطلاب" description="جرّب تاني بعد شوية." />;
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white">
            <Radar className="h-6 w-6 text-gold-400" /> رادار الطلاب
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            مين وقف؟ مين مستواه نازل؟ أنهي درس الطلبة بترسب فيه؟ ورسالة واتساب جاهزة بضغطة.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          className="flex items-center gap-1.5 rounded-xl bg-navy-900 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-navy-800"
        >
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </button>
      </div>

      {truncated && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          عدد الطلاب أكبر من الحد المعروض، فالأرقام دي جزئية.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {SEGMENTS.map((segment) => (
          <button key={segment} type="button" onClick={() => setFilter(segment)} className="text-start">
            <StatCard label={SEGMENT_LABELS[segment]} value={String(counts[segment])} />
          </button>
        ))}
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(['all', ...SEGMENTS] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-1.5 font-bold ${filter === key ? 'bg-gold-400 text-navy-950' : 'bg-navy-900 text-slate-300'}`}
            >
              {key === 'all' ? `الكل (${rows.length})` : `${SEGMENT_LABELS[key]} (${counts[key]})`}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState title="مفيش طلاب في الشريحة دي" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs text-slate-200">
              <thead>
                <tr className="text-slate-400">
                  <th className="p-2 text-start">الطالب</th>
                  <th className="p-2 text-start">آخر دخول</th>
                  <th className="p-2 text-start">المشاهدة</th>
                  <th className="p-2 text-start">متوسط الدرجات</th>
                  <th className="p-2 text-start">الخطر</th>
                  <th className="p-2 text-start">رسالة</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-t border-navy-800">
                    <td className="p-2">
                      <Link to={`/admin/students/${encodeURIComponent(row.id)}`} className="font-bold text-gold-400 hover:underline">
                        {row.name || 'بدون اسم'}
                      </Link>
                      <div className="mt-0.5">
                        <Badge variant={SEGMENT_BADGE[row.segment]}>{SEGMENT_LABELS[row.segment]}</Badge>
                      </div>
                    </td>
                    <td className="p-2">{row.daysInactive === null ? '—' : `من ${row.daysInactive} يوم`}</td>
                    <td className="p-2">{row.watchPercent === null ? '—' : `${Math.round(row.watchPercent)}%`}</td>
                    <td className="p-2">{row.avgScore === null ? '—' : `${Math.round(row.avgScore)}%`}</td>
                    <td className="p-2 font-bold">{row.risk}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {waButton(row, false)}
                        {waButton(row, true)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {visible.length === 200 && <p className="text-[11px] text-slate-500">معروض أول 200 فقط.</p>}
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-lg font-bold text-white">أضعف الامتحانات والتدريبات (أعد شرح دروسها)</h2>
        {lessons.length === 0 ? (
          <p className="text-sm text-slate-400">لسه مفيش بيانات كفاية (محتاج 3 طلاب على الأقل سلّموا نفس العنصر).</p>
        ) : (
          <div className="space-y-2">
            {lessons.map((lesson) => (
              <div key={lesson.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-navy-950/60 p-3 text-xs">
                <div>
                  <div className="font-bold text-slate-100">{lesson.title}</div>
                  <div className="text-slate-500">{courseTitle(lesson.courseId)} • {lesson.count} طالب</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="gold">متوسط {lesson.avg}%</Badge>
                  <Badge variant="danger">رسوب {lesson.failRate}%</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

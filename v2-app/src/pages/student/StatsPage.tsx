import { useMemo } from 'react';
import { BarChart3, Clapperboard, Flame, Trophy } from 'lucide-react';
import { Badge, Card, EmptyState, ProgressBar, Spinner, StatCard } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCourses } from '../../hooks/useCourses';
import {
  GROUP_LABELS,
  LEVEL_LABELS,
  averageOf,
  calcCommitment,
  calcOverallLevel,
  calcWatchPercent,
  getOfficialScores,
  videoIdsForStudent,
} from '../../lib/stats';
import type { AssessmentGroup } from '../../lib/stats';
import { parseExamResults } from '../../services/assessments';

const GROUPS: AssessmentGroup[] = ['exam', 'homework', 'training'];

export default function StatsPage() {
  const { student } = useAuth();
  const { courses, loading } = useCourses();

  const attempts = useMemo(() => parseExamResults(student?.examResults), [student]);
  const scores = useMemo(() => getOfficialScores(attempts), [attempts]);

  const watchPercent = useMemo(() => {
    if (!student) return null;
    const ids = videoIdsForStudent(courses, student.courses);
    return calcWatchPercent(student.watchProgress, ids);
  }, [courses, student]);

  if (!student) return null;
  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-gold-400">
        <Spinner />
      </div>
    );
  }

  const commitment = calcCommitment(scores);
  const level = calcOverallLevel(scores, watchPercent);

  const perCourse = student.courses.map((courseId) => {
    const course = courses.find((item) => item.id === courseId);
    const own = scores.filter((item) => item.courseId === courseId);
    const mean = own.length === 0 ? null : Math.round(own.reduce((sum, item) => sum + item.score, 0) / own.length);
    return { courseId, title: course?.title ?? 'كورس', count: own.length, mean };
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <h1 className="text-2xl font-extrabold text-white md:text-3xl">إحصائياتي</h1>

      {scores.length === 0 && watchPercent === null ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="لا توجد بيانات بعد"
            description="ابدأ بمشاهدة المحاضرات وتسليم الامتحانات وستظهر إحصائياتك هنا."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 items-stretch">
            <StatCard
              label="معدل الالتزام"
              value={commitment === null ? '-' : `${commitment}%`}
              hint="متوسط الدرجات الرسمية (المحاولة الأولى)"
              icon={Flame}
            />
            <StatCard
              label="مستواك العام"
              value={level.level ? LEVEL_LABELS[level.level] : '-'}
              hint={level.overall === null ? undefined : `${level.overall}%`}
              icon={Trophy}
            />
            <StatCard
              label="نسبة المشاهدة"
              value={watchPercent === null ? '-' : `${Math.round(watchPercent)}%`}
              icon={Clapperboard}
            />
            <StatCard label="امتحانات مسلّمة" value={scores.length} icon={BarChart3} />
          </div>

          <Card>
            <h2 className="mb-4 text-lg font-bold text-white">متوسطاتك حسب النوع</h2>
            <div className="space-y-4">
              {GROUPS.map((group) => {
                const value = averageOf(scores, group);
                return (
                  <div key={group}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-200">{GROUP_LABELS[group]}</span>
                      <span className="text-slate-400">{value === null ? 'لا يوجد' : `${value}%`}</span>
                    </div>
                    <ProgressBar value={value ?? 0} />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-bold text-white">أداؤك في كل كورس</h2>
            {perCourse.length === 0 ? (
              <p className="text-sm text-slate-400">لم تشترك في أي كورس بعد.</p>
            ) : (
              <ul className="space-y-2">
                {perCourse.map((row) => (
                  <li
                    key={row.courseId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-navy-800 bg-navy-950/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white">{row.title}</p>
                      <p className="text-xs text-slate-500">{row.count} تقييم مسلّم</p>
                    </div>
                    <Badge variant={row.mean === null ? 'neutral' : row.mean >= 50 ? 'success' : 'danger'}>
                      {row.mean === null ? '-' : `${row.mean}%`}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

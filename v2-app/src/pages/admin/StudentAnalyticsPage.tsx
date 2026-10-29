import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BarChart3, Clapperboard, Flame, ServerCrash, Trophy } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ProgressBar, Spinner, StatCard, Table, buttonClasses, useToast } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { useCourses } from '../../hooks/useCourses';
import { getGradeLabel } from '../../lib/grades';
import {
  GROUP_LABELS,
  LEVEL_LABELS,
  calcCommitment,
  calcOverallLevel,
  calcWatchPercent,
  getOfficialScores,
  groupOf,
  videoIdsForStudent,
} from '../../lib/stats';
import type { AssessmentGroup } from '../../lib/stats';
import { parseExamResults } from '../../services/assessments';
import type { AttemptSummary } from '../../services/assessments';
import { getStudent } from '../../services/students';
import type { Student } from '../../services/students';

const GROUPS: AssessmentGroup[] = ['exam', 'homework', 'training'];
const WEIGHT_LABELS: Record<AssessmentGroup, string> = { exam: '40%', homework: '30%', training: '20%' };

function formatDateTime(ms: number | null): string {
  if (ms === null) return '-';
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function StudentAnalyticsPage() {
  const { studentId } = useParams();
  const { courses } = useCourses();

  const { showToast } = useToast();
  const [student, setStudent] = useState<Student | null>(null);
  const [showPlainPwd, setShowPlainPwd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!studentId) return;
    let active = true;
    setLoading(true);
    setFailed(false);

    getStudent(studentId)
      .then((value) => {
        if (active) setStudent(value);
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
  }, [studentId, reloadKey]);

  const attempts = useMemo(() => parseExamResults(student?.examResults), [student]);
  const scores = useMemo(() => getOfficialScores(attempts), [attempts]);

  const watchPercent = useMemo(() => {
    if (!student) return null;
    return calcWatchPercent(student.watchProgress, videoIdsForStudent(courses, student.courses));
  }, [student, courses]);

  const titleOf = (courseId: string) => courses.find((course) => course.id === courseId)?.title ?? courseId;

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-gold-400">
        <Spinner size="lg" />
      </div>
    );
  }

  if (failed) {
    return (
      <Card className="mx-auto max-w-2xl">
        <EmptyState
          icon={ServerCrash}
          title="تعذر تحميل بيانات الطالب"
          action={<Button onClick={() => setReloadKey((value) => value + 1)}>إعادة المحاولة</Button>}
        />
      </Card>
    );
  }

  if (!student) {
    return (
      <Card className="mx-auto max-w-2xl">
        <EmptyState
          icon={BarChart3}
          title="الطالب غير موجود"
          action={
            <Link to="/admin/students" className={buttonClasses({ variant: 'primary' })}>
              قائمة الطلاب
            </Link>
          }
        />
      </Card>
    );
  }

  const commitment = calcCommitment(scores);
  const level = calcOverallLevel(scores, watchPercent);

  const columns: TableColumn<AttemptSummary>[] = [
    { key: 'examTitle', header: 'التقييم', render: (row) => row.examTitle || row.examId || '-' },
    { key: 'course', header: 'الكورس', render: (row) => titleOf(row.courseId) },
    { key: 'type', header: 'النوع', render: (row) => GROUP_LABELS[groupOf(row)] },
    { key: 'attempt', header: 'المحاولة', render: (row) => (row.isOfficial ? `${row.attemptNumber} (رسمية)` : row.attemptNumber) },
    {
      key: 'percent',
      header: 'الدرجة',
      render: (row) => (
        <Badge variant={row.effectivePercent >= 50 ? 'success' : 'danger'}>{Math.round(row.effectivePercent)}%</Badge>
      ),
    },
    { key: 'ts', header: 'التاريخ', render: (row) => formatDateTime(row.ts) },
  ];

  const sorted = [...attempts].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Link to="/admin/students" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-gold-400">
        <ArrowRight className="h-4 w-4" />
        قائمة الطلاب
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold text-white md:text-3xl">{student.name || 'بدون اسم'}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="info">{getGradeLabel(student.grade, student.track)}</Badge>
          {student.studentCode && <Badge variant="neutral">{student.studentCode}</Badge>}
          {student.archived && <Badge variant="danger">مجمّد</Badge>}
        </div>
        <p className="mt-2 text-sm text-slate-400">
          موبايل الطالب: <span dir="ltr">{student.phone || '-'}</span> - ولي الأمر:{' '}
          <span dir="ltr">{student.parentPhone || '-'}</span>
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-400">كلمة المرور المسجلة:</span>
          {student.plainPassword ? (
            <>
              <span
                dir="ltr"
                className="font-mono rounded-lg bg-slate-800/90 px-3 py-1 text-gold-400 select-all border border-slate-700 font-bold"
              >
                {showPlainPwd ? student.plainPassword : '••••••••'}
              </span>
              <button
                type="button"
                onClick={() => setShowPlainPwd((p) => !p)}
                className="rounded-md px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 border border-slate-700 transition-colors"
              >
                {showPlainPwd ? 'إخفاء' : 'إظهار'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(student.plainPassword || '');
                  showToast('تم نسخ كلمة المرور بنجاح', 'success');
                }}
                className="rounded-md px-2.5 py-1 text-xs font-bold text-gold-400 hover:text-gold-300 bg-gold-500/10 border border-gold-400/30 transition-colors"
              >
                نسخ
              </button>
            </>
          ) : (
            <span className="rounded-md bg-slate-800/80 px-2.5 py-1 text-xs text-slate-400 border border-slate-700">
              مشفرة بحساب الطالب في Firebase Auth (يتم تجديدها برقم ولي الأمر من صفحة الدخول)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="معدل الالتزام" value={commitment === null ? '-' : `${commitment}%`} icon={Flame} />
        <StatCard
          label="المستوى العام"
          value={level.level ? LEVEL_LABELS[level.level] : '-'}
          hint={level.overall === null ? undefined : `${level.overall}%`}
          icon={Trophy}
        />
        <StatCard label="نسبة المشاهدة" value={watchPercent === null ? '-' : `${Math.round(watchPercent)}%`} icon={Clapperboard} />
        <StatCard label="كورسات مفعّلة" value={student.courses.length} icon={BarChart3} />
      </div>

      <Card>
        <h2 className="mb-1 text-lg font-bold text-white">مكونات المستوى العام</h2>
        <p className="mb-4 text-xs text-slate-500">
          الأوزان: امتحانات 40% وواجبات 30% وتدريبات 20% ومشاهدة 10%. المكوّن الذي لا توجد له بيانات يُستبعد وتُعاد
          توزيع الأوزان على الباقي.
        </p>
        <div className="space-y-4">
          {GROUPS.map((group) => {
            const value = level[group];
            return (
              <div key={group}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-200">
                    {GROUP_LABELS[group]} <span className="text-slate-500">({WEIGHT_LABELS[group]})</span>
                  </span>
                  <span className="text-slate-400">{value === null ? 'لا يوجد' : `${value}%`}</span>
                </div>
                <ProgressBar value={value ?? 0} />
              </div>
            );
          })}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-bold text-slate-200">
                المشاهدة <span className="text-slate-500">(10%)</span>
              </span>
              <span className="text-slate-400">{level.watch === null ? 'لا يوجد' : `${level.watch}%`}</span>
            </div>
            <ProgressBar value={level.watch ?? 0} />
          </div>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-bold text-white">سجل المحاولات</h2>
        <Table
          columns={columns}
          rows={sorted}
          rowKey={(row) => `${row.courseId}|${row.examId}|${row.attemptNumber}|${row.ts ?? 0}`}
          emptyMessage="لا توجد محاولات بعد"
        />
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, Coins, ServerCrash, Users } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Spinner, StatCard, buttonClasses } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCourses } from '../../hooks/useCourses';
import {
  LEVEL_LABELS,
  calcOverallLevel,
  calcWatchPercent,
  formatMoney,
  getOfficialScores,
  isCountedRevenue,
  revenueOf,
  totalRevenue,
  videoIdsForStudent,
} from '../../lib/stats';
import type { LevelKey } from '../../lib/stats';
import { parseExamResults } from '../../services/assessments';
import { formatRequestDate, getStatusInfo, listPaymentRequests } from '../../services/payments';
import type { PaymentRequest } from '../../services/payments';
import type { Course } from '../../services/courses';
import { listStudents } from '../../services/students';
import type { Student } from '../../services/students';

// الإيرادات تُحسب من أحدث هذه الأعداد من الطلبات (قراءة واحدة). لو وصلنا للحد نعرض تنبيهًا.
const REQUESTS_LIMIT = 500;

export default function AdminDashboardPage() {
  const { adminRole } = useAuth();
  const { courses, loading: coursesLoading } = useCourses();

  const [students, setStudents] = useState<Student[]>([]);
  const [studentsTruncated, setStudentsTruncated] = useState(false);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);

    Promise.all([listStudents(), listPaymentRequests(REQUESTS_LIMIT)])
      .then(([studentResult, requestList]) => {
        if (!active) return;
        setStudents(studentResult.students);
        setStudentsTruncated(studentResult.truncated);
        setRequests(requestList);
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

  const stats = useMemo(() => {
    const pending = requests.filter((item) => item.status === 'pending').length;
    const revenue = totalRevenue(requests, courses);

    const distribution: Record<LevelKey, number> = { top: 0, mid: 0, low: 0 };
    students.forEach((student) => {
      const scores = getOfficialScores(parseExamResults(student.examResults));
      if (scores.length === 0) return;
      const watch = calcWatchPercent(student.watchProgress, videoIdsForStudent(courses, student.courses));
      const result = calcOverallLevel(scores, watch);
      if (result.level) distribution[result.level] += 1;
    });

    const perCourse = new Map<string, { title: string; count: number; revenue: number }>();
    const byId = new Map<string, Course>(courses.map((course): [string, Course] => [course.id, course]));
    requests.filter(isCountedRevenue).forEach((request) => {
      const course = byId.get(request.courseId);
      const entry: { title: string; count: number; revenue: number } = perCourse.get(request.courseId) ?? {
        title: course?.title ?? (request.courseName || 'كورس'),
        count: 0,
        revenue: 0,
      };
      entry.count += 1;
      entry.revenue += revenueOf(request, course);
      perCourse.set(request.courseId, entry);
    });
    const topCourses = Array.from(perCourse.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return { pending, revenue, distribution, topCourses };
  }, [requests, students, courses]);

  if (loading || coursesLoading) {
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
          title="تعذر تحميل اللوحة"
          description="تأكد من الاتصال وصلاحيات حسابك ثم حاول مرة أخرى."
          action={<Button onClick={() => setReloadKey((value) => value + 1)}>إعادة المحاولة</Button>}
        />
      </Card>
    );
  }

  const recent = requests.slice(0, 6);
  const levelTotal = stats.distribution.top + stats.distribution.mid + stats.distribution.low;
  const revenueLimited = requests.length >= REQUESTS_LIMIT;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-white md:text-3xl">لوحة الإدارة</h1>
        {adminRole === 'assistant' && <Badge variant="info">مساعد</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="الطلاب" value={students.length} icon={Users} hint={studentsTruncated ? 'أول 1500 فقط' : undefined} />
        <StatCard label="الكورسات" value={courses.length} icon={BookOpen} />
        <StatCard label="طلبات دفع معلّقة" value={stats.pending} icon={Clock} />
        <StatCard
          label="إجمالي الدخل"
          value={formatMoney(stats.revenue)}
          icon={Coins}
          hint={revenueLimited ? `محسوب على آخر ${REQUESTS_LIMIT} طلب` : 'الطلبات الموافق عليها غير المصفّرة'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-bold text-white">مستويات الطلاب</h2>
          {levelTotal === 0 ? (
            <p className="text-sm text-slate-400">لا توجد درجات كافية بعد.</p>
          ) : (
            <ul className="space-y-3">
              {(['top', 'mid', 'low'] as LevelKey[]).map((key) => (
                <li key={key} className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-200">{LEVEL_LABELS[key]}</span>
                  <Badge variant={key === 'top' ? 'success' : key === 'mid' ? 'gold' : 'danger'}>
                    {stats.distribution[key]} طالب
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold text-white">أعلى الكورسات دخلًا</h2>
          {stats.topCourses.length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد مبيعات محسوبة بعد.</p>
          ) : (
            <ul className="space-y-2">
              {stats.topCourses.map((row) => (
                <li
                  key={row.title}
                  className="flex items-center justify-between gap-3 rounded-xl border border-navy-800 bg-navy-950/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">{row.title}</p>
                    <p className="text-xs text-slate-500">{row.count} اشتراك</p>
                  </div>
                  <span className="shrink-0 font-bold text-gold-400">{formatMoney(row.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">آخر طلبات الدفع</h2>
          <Link to="/admin/payments" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
            كل الطلبات
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-400">لا توجد طلبات.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((request) => {
              const info = getStatusInfo(request.status);
              return (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-800 bg-navy-950/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">{request.userName || request.userPhone}</p>
                    <p className="truncate text-xs text-slate-500">
                      {request.courseName} - {formatRequestDate(request)}
                    </p>
                  </div>
                  <Badge variant={info.variant}>{info.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

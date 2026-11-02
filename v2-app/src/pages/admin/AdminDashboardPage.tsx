import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, Coins, KeyRound, ServerCrash, Users } from 'lucide-react';
import { Badge, Button, Card, Input, EmptyState, StatCard, buttonClasses, useToast } from '../../components/ui';
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
import {
  getPendingPasswordResets,
  setStoredAdminPassword,
  updatePasswordResetStatus,
} from '../../lib/studentPasswords';
import type { PasswordResetRequest } from '../../lib/studentPasswords';
import type { Student } from '../../services/students';

// الإيرادات تُحسب من أحدث هذه الأعداد من الطلبات (قراءة واحدة). لو وصلنا للحد نعرض تنبيهًا.
const REQUESTS_LIMIT = 500;

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-pulse" aria-hidden="true">
      <div className="h-8 w-48 rounded-lg bg-navy-800" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-navy-900 border border-navy-800" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-56 rounded-2xl bg-navy-900 border border-navy-800" />
        <div className="h-56 rounded-2xl bg-navy-900 border border-navy-800" />
      </div>
      <div className="h-72 rounded-2xl bg-navy-900 border border-navy-800" />
    </div>
  );
}

export default function AdminDashboardPage() {
  const { adminRole } = useAuth();
  const { courses, loading: coursesLoading } = useCourses();

  const [students, setStudents] = useState<Student[]>([]);
  const [studentsTruncated, setStudentsTruncated] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(true);

  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { showToast } = useToast();
  const [pwdRequests, setPwdRequests] = useState<PasswordResetRequest[]>([]);

  useEffect(() => {
    setPwdRequests(getPendingPasswordResets());
  }, [reloadKey]);

  const pendingPwdRequests = useMemo(
    () => pwdRequests.filter((r) => r.status === 'pending'),
    [pwdRequests]
  );

  const handleApprovePwd = (req: PasswordResetRequest) => {
    updatePasswordResetStatus(req.id, 'approved');
    setPwdRequests(getPendingPasswordResets());
    showToast(`تم اعتماد وتفعيل كلمة المرور للطالب (${req.studentPhone}) بنجاح`, 'success');
  };

  const handleRejectPwd = (req: PasswordResetRequest) => {
    updatePasswordResetStatus(req.id, 'rejected');
    setPwdRequests(getPendingPasswordResets());
    showToast(`تم رفض طلب التجديد للطالب (${req.studentPhone})`, 'info');
  };

  const [quickPhone, setQuickPhone] = useState('');

  const handleQuickApprove = () => {
    const clean = quickPhone.trim();
    if (!clean) return;
    const req = pwdRequests.find((r) => r.studentPhone === clean && r.status === 'pending');
    if (req) {
      handleApprovePwd(req);
    } else {
      setStoredAdminPassword(clean, '12345678');
      showToast(`تم اعتماد وتفعيل كلمة المرور للطالب (${clean}) بنجاح`, 'success');
    }
    setQuickPhone('');
  };


  // تحميل متدرج سريع: جلب الطلبات أولاً للرسم الفوري، والطلاب في الخلفية
  useEffect(() => {
    let active = true;
    setRequestsLoading(true);
    setStudentsLoading(true);
    setFailed(false);

    // 1. مسار الطلبات السريع لرسم الأرقام الرئيسية فوراً
    listPaymentRequests(REQUESTS_LIMIT)
      .then((requestList) => {
        if (!active) return;
        setRequests(requestList);
        setRequestsLoading(false);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    // 2. مسار الطلاب الثقيل تدريجياً في الخلفية بدون حجب الشاشة
    listStudents()
      .then((studentResult) => {
        if (!active) return;
        setStudents(studentResult.students);
        setStudentsTruncated(studentResult.truncated);
        setStudentsLoading(false);
      })
      .catch(() => {
        if (active) setStudentsLoading(false);
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

  if (requestsLoading && coursesLoading) {
    return <DashboardSkeleton />;
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
    <div className="mx-auto w-full max-w-6xl space-y-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-white md:text-3xl">لوحة الإدارة</h1>
        {adminRole === 'assistant' && <Badge variant="info">مساعد</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="الطلاب"
          value={studentsLoading ? '...' : students.length}
          icon={Users}
          hint={studentsTruncated ? 'أول 1500 فقط' : undefined}
        />
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
        <Card className="min-w-0">
          <h2 className="mb-4 text-lg font-bold text-white">مستويات الطلاب</h2>
          {studentsLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-8 rounded-lg bg-navy-800" />
              <div className="h-8 rounded-lg bg-navy-800" />
              <div className="h-8 rounded-lg bg-navy-800" />
            </div>
          ) : levelTotal === 0 ? (
            <p className="text-sm text-slate-400">لا توجد درجات كافية بعد.</p>
          ) : (
            <ul className="space-y-3">
              {(['top', 'mid', 'low'] as LevelKey[]).map((key) => (
                <li key={key} className="flex items-center justify-between gap-2 min-w-0">
                  <span className="font-bold text-slate-200 truncate">{LEVEL_LABELS[key]}</span>
                  <Badge className="shrink-0" variant={key === 'top' ? 'success' : key === 'mid' ? 'gold' : 'danger'}>
                    {stats.distribution[key]} طالب
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="min-w-0">
          <h2 className="mb-4 text-lg font-bold text-white">أعلى الكورسات دخلًا</h2>
          {stats.topCourses.length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد مبيعات محسوبة بعد.</p>
          ) : (
            <ul className="space-y-2">
              {stats.topCourses.map((row) => (
                <li
                  key={row.title}
                  className="flex items-center justify-between gap-2 rounded-xl border border-navy-800 bg-navy-950/40 p-3 min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-white text-sm sm:text-base">{row.title}</p>
                    <p className="text-xs text-slate-500">{row.count} اشتراك</p>
                  </div>
                  <span className="shrink-0 font-bold text-gold-400 text-sm sm:text-base">{formatMoney(row.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* بطاقة طلبات تجديد كلمة المرور المعلقة */}
      <Card className="min-w-0 border-gold-500/30">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-gold-400" />
            <h2 className="text-lg font-bold text-white">طلبات تجديد كلمة المرور</h2>
            {pendingPwdRequests.length > 0 && (
              <Badge variant="gold">{pendingPwdRequests.length} بانتظار الاعتماد</Badge>
            )}
          </div>
        </div>
        {pendingPwdRequests.length === 0 ? (
          <p className="text-sm text-slate-400">لا توجد طلبات تجديد معلقة حالياً في الانتظار.</p>
        ) : (
          <div className="space-y-3">
            {pendingPwdRequests.map((req) => {
              const studentObj = students.find((s) => s.phone === req.studentPhone);
              const waReply = encodeURIComponent('أهلاً يا بطل، تم اعتماد وتفعيل كلمة المرور لحسابك بنجاح من مستر يوسف بركات! يمكنك الآن تسجيل الدخول والمتابعة.');
              return (
                <div
                  key={req.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-navy-800 bg-navy-950/60 p-3.5"
                >
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{studentObj?.name || 'طالب'}</span>
                      <span className="font-mono text-gold-400 font-bold" dir="ltr">({req.studentPhone})</span>
                      <span className="text-xs text-slate-400 font-mono" dir="ltr">
                        {new Date(req.createdAt).toLocaleTimeString('ar-EG')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                      <span>كود الطالب: <strong className="font-mono text-gold-300">{studentObj?.studentCode || '—'}</strong></span>
                      <span>رقم ولي الأمر: <strong className="font-mono text-emerald-400" dir="ltr">{req.parentPhone}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`https://wa.me/20${req.studentPhone.replace(/^0/, '')}?text=${waReply}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 px-3 py-1.5 text-xs font-bold border border-emerald-500/30 transition inline-flex items-center gap-1"
                    >
                      واتساب الطالب
                    </a>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleApprovePwd(req)}
                    >
                      موافقة واعتماد
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRejectPwd(req)}
                    >
                      رفض
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-navy-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Input
            placeholder="اعتماد فوري لطالب راسلك على واتساب (أدخل رقم هاتفه 01xxxxxxxxx)"
            value={quickPhone}
            onChange={(e) => setQuickPhone(e.target.value)}
            dir="ltr"
            className="flex-1 text-sm"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={handleQuickApprove}
            disabled={!quickPhone.trim()}
          >
            اعتماد فوري
          </Button>
        </div>
      </Card>

      <Card className="min-w-0">
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
                  className="flex items-center justify-between gap-2 rounded-xl border border-navy-800 bg-navy-950/40 p-3 min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-white text-sm sm:text-base">{request.userName || request.userPhone}</p>
                    <p className="truncate text-xs text-slate-500">
                      {request.courseName} - {formatRequestDate(request)}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <Badge variant={info.variant}>{info.label}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

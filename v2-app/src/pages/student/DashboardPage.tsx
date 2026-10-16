import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BookOpen, CheckCheck, ClipboardCheck, Flame, Trash2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, StatCard, buttonClasses, useToast } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { getGradeLabel } from '../../lib/grades';
import { GROUP_LABELS, calcCommitment, getOfficialScores } from '../../lib/stats';
import { parseExamResults } from '../../services/assessments';
import { deleteNotification, markAllNotificationsRead, parseNotifications } from '../../services/notifications';
import { getGeneralSettings } from '../../services/settings';

function formatDate(ms: number | null): string {
  if (ms === null) return '';
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function DashboardPage() {
  const { student, refresh } = useAuth();
  const { showToast } = useToast();
  const [welcome, setWelcome] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getGeneralSettings().then((settings) => {
      if (active) setWelcome(settings.welcomeMessage);
    });
    return () => {
      active = false;
    };
  }, []);

  const notifications = useMemo(() => parseNotifications(student?.notifications ?? []), [student]);
  const scores = useMemo(() => getOfficialScores(parseExamResults(student?.examResults)), [student]);

  if (!student) return null;

  const commitment = calcCommitment(scores);
  const unread = notifications.filter((item) => !item.read).length;
  const recent = [...scores].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)).slice(0, 5);

  const handleReadAll = async () => {
    setBusy(true);
    try {
      await markAllNotificationsRead(student.id);
      await refresh();
    } catch {
      showToast('تعذر تحديث الإشعارات. حاول مرة أخرى.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await deleteNotification(student.id, id);
      await refresh();
    } catch {
      showToast('تعذر حذف الإشعار. حاول مرة أخرى.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white md:text-3xl">أهلًا {student.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="info">{getGradeLabel(student.grade, student.track)}</Badge>
          {student.studentCode && <Badge variant="neutral">كود الطالب: {student.studentCode}</Badge>}
        </div>
        {welcome && <p className="mt-3 whitespace-pre-line text-slate-300">{welcome}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="كورساتي" value={student.courses.length} icon={BookOpen} />
        <StatCard
          label="معدل الالتزام"
          value={commitment === null ? '-' : `${commitment}%`}
          hint={commitment === null ? 'يظهر بعد أول امتحان' : 'متوسط درجاتك الرسمية'}
          icon={Flame}
        />
        <StatCard label="امتحانات مسلّمة" value={scores.length} icon={ClipboardCheck} />
        <StatCard label="إشعارات جديدة" value={unread} icon={Bell} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-white">الإشعارات</h2>
            {unread > 0 && (
              <Button size="sm" variant="secondary" onClick={handleReadAll} disabled={busy}>
                <CheckCheck className="h-4 w-4" />
                تعليم الكل كمقروء
              </Button>
            )}
          </div>

          {notifications.length === 0 ? (
            <EmptyState icon={Bell} title="لا توجد إشعارات" description="ستظهر هنا رسائل الإدارة وتفعيل الكورسات." />
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto">
              {notifications.slice(0, 20).map((item) => (
                <li
                  key={item.id}
                  className={
                    item.read
                      ? 'rounded-xl border border-navy-800 bg-navy-950/40 p-3'
                      : 'rounded-xl border border-gold-500/40 bg-gold-500/10 p-3'
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-white">{item.title || 'إشعار'}</p>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      disabled={busy}
                      aria-label="حذف الإشعار"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-navy-800 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {item.message && <p className="mt-1 whitespace-pre-line text-sm text-slate-300">{item.message}</p>}
                  <p className="mt-2 text-xs text-slate-500">{formatDate(item.timestampMs)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold text-white">آخر درجاتك</h2>
          {recent.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="لم تسلّم أي امتحان بعد"
              action={
                <Link to="/student/exams" className={buttonClasses({ variant: 'primary', size: 'sm' })}>
                  الامتحانات والواجبات
                </Link>
              }
            />
          ) : (
            <ul className="space-y-2">
              {recent.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-navy-800 bg-navy-950/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">{item.title || 'بدون عنوان'}</p>
                    <p className="text-xs text-slate-500">{GROUP_LABELS[item.group]}</p>
                  </div>
                  <Badge variant={item.score >= 50 ? 'success' : 'danger'}>{Math.round(item.score)}%</Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/student/stats" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              الإحصائيات الكاملة
            </Link>
            <Link to="/student/support" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
              الدعم الفني
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

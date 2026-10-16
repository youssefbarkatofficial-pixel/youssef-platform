import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Send } from 'lucide-react';
import { Button, Card, Input, Select, Table, useToast } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCourses } from '../../hooks/useCourses';
import { GRADES, isGradeCode } from '../../lib/grades';
import { listSentNotifications, sendNotification } from '../../services/notifications';
import type { NotificationTarget, SentNotification } from '../../services/notifications';

const textareaClass =
  'w-full rounded-xl border border-navy-700 bg-navy-900 px-3 py-2.5 text-white placeholder:text-slate-500 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40';

function formatDateTime(ms: number | null): string {
  if (ms === null) return '-';
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function NotificationsPage() {
  const { firebaseUser } = useAuth();
  const { courses } = useCourses();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'grade' | 'course'>('all');
  const [grade, setGrade] = useState('');
  const [courseId, setCourseId] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<SentNotification[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await listSentNotifications(20));
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const describeTarget = (value: string): string => {
    if (value === 'all') return 'كل الطلاب';
    if (value.startsWith('grade:')) {
      const code = value.slice(6);
      return GRADES.find((item) => item.code === code)?.label ?? code;
    }
    if (value.startsWith('course:')) {
      const id = value.slice(7);
      return courses.find((course) => course.id === id)?.title ?? id;
    }
    return value;
  };

  const buildTarget = (): NotificationTarget | null => {
    if (targetType === 'all') return { type: 'all' };
    if (targetType === 'grade') return isGradeCode(grade) ? { type: 'grade', grade } : null;
    return courseId ? { type: 'course', courseId } : null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const target = buildTarget();
    if (!target) {
      showToast('اختر الصف أو الكورس المستهدف.', 'error');
      return;
    }
    if (title.trim() === '' || message.trim() === '') {
      showToast('اكتب العنوان والرسالة.', 'error');
      return;
    }

    const where = targetType === 'all' ? 'كل الطلاب' : targetType === 'grade' ? 'طلاب هذا الصف' : 'المشتركين في هذا الكورس';
    if (!window.confirm(`سيتم إرسال الإشعار إلى ${where}. متابعة؟`)) return;

    setSending(true);
    try {
      const count = await sendNotification({
        title,
        message,
        target,
        sentBy: firebaseUser?.email ?? '',
      });
      showToast(`تم الإرسال إلى ${count} طالب.`, 'success');
      setTitle('');
      setMessage('');
      await loadHistory();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      showToast(code === 'no-recipients' ? 'لا يوجد طلاب مطابقون.' : 'تعذر الإرسال. حاول مرة أخرى.', 'error');
    } finally {
      setSending(false);
    }
  };

  const columns: TableColumn<SentNotification>[] = [
    { key: 'title', header: 'العنوان' },
    { key: 'target', header: 'المستهدف', render: (row) => describeTarget(row.target) },
    { key: 'recipients', header: 'المستلمون' },
    { key: 'sentAt', header: 'الوقت', render: (row) => formatDateTime(row.sentAtMs) },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white md:text-3xl">الإشعارات</h1>
        <p className="mt-1 text-sm text-slate-400">
          تظهر داخل منصة الطالب في لوحته (بدون إشعارات خارج الموقع حاليًا).
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="إلى"
              value={targetType}
              options={[
                { value: 'all', label: 'كل الطلاب' },
                { value: 'grade', label: 'صف دراسي' },
                { value: 'course', label: 'مشتركو كورس' },
              ]}
              onChange={(event) => {
                const value = event.target.value;
                setTargetType(value === 'grade' ? 'grade' : value === 'course' ? 'course' : 'all');
              }}
            />
            {targetType === 'grade' && (
              <Select
                label="الصف"
                value={grade}
                placeholder="اختر الصف"
                options={GRADES.map((item) => ({ value: item.code, label: item.label }))}
                onChange={(event) => setGrade(event.target.value)}
              />
            )}
            {targetType === 'course' && (
              <Select
                label="الكورس"
                value={courseId}
                placeholder="اختر الكورس"
                options={courses.map((course) => ({ value: course.id, label: course.title }))}
                onChange={(event) => setCourseId(event.target.value)}
              />
            )}
          </div>

          <Input label="العنوان" value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} />

          <div>
            <label htmlFor="notification-message" className="mb-1.5 block text-sm font-medium text-slate-300">
              الرسالة
            </label>
            <textarea
              id="notification-message"
              rows={4}
              maxLength={500}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className={textareaClass}
            />
          </div>

          <Button type="submit" disabled={sending}>
            <Send className="h-4 w-4" />
            {sending ? 'جارٍ الإرسال...' : 'إرسال'}
          </Button>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-bold text-white">آخر ما أُرسل</h2>
        <Table
          columns={columns}
          rows={history}
          rowKey={(row) => row.id}
          loading={historyLoading}
          emptyMessage="لم يُرسل شيء بعد"
        />
      </div>
    </div>
  );
}

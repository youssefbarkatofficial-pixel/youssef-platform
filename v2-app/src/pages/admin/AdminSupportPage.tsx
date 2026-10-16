import { useCallback, useEffect, useMemo, useState } from 'react';
import { LifeBuoy, MessageSquare, ServerCrash } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Spinner, Tabs, useToast } from '../../components/ui';
import {
  MAX_TICKET_TEXT,
  STATUS_LABELS,
  listAllTickets,
  replyAsAdmin,
  setTicketStatus,
} from '../../services/support';
import type { Ticket, TicketStatus } from '../../services/support';

const STATUS_VARIANT: Record<TicketStatus, 'gold' | 'success' | 'neutral'> = {
  open: 'gold',
  answered: 'success',
  closed: 'neutral',
};

const textareaClass =
  'w-full rounded-xl border border-navy-700 bg-navy-900 px-3 py-2.5 text-white placeholder:text-slate-500 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40';

function formatDateTime(ms: number | null): string {
  if (ms === null) return '';
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// صفحة المالك والأدمن الكامل فقط (المساعد محجوب عنها في الواجهة والقواعد).
export default function AdminSupportPage() {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState('open');
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setTickets(await listAllTickets(200));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      open: tickets.filter((ticket) => ticket.status === 'open').length,
      answered: tickets.filter((ticket) => ticket.status === 'answered').length,
      closed: tickets.filter((ticket) => ticket.status === 'closed').length,
    }),
    [tickets],
  );

  const visible = tickets.filter((ticket) => filter === 'all' || ticket.status === filter);

  const tabs = [
    { id: 'open', label: `مفتوحة (${counts.open})` },
    { id: 'answered', label: `تم الرد (${counts.answered})` },
    { id: 'closed', label: `مغلقة (${counts.closed})` },
    { id: 'all', label: `الكل (${tickets.length})` },
  ];

  const handleReply = async (ticket: Ticket) => {
    const text = replyText[ticket.id] ?? '';
    if (text.trim() === '') return;
    setBusyId(ticket.id);
    try {
      await replyAsAdmin(ticket.id, text);
      setReplyText((previous) => ({ ...previous, [ticket.id]: '' }));
      showToast('تم إرسال الرد.', 'success');
      await load();
    } catch {
      showToast('تعذر إرسال الرد.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleStatus = async (ticket: Ticket, status: TicketStatus) => {
    setBusyId(ticket.id);
    try {
      await setTicketStatus(ticket.id, status);
      setTickets((previous) => previous.map((item) => (item.id === ticket.id ? { ...item, status } : item)));
    } catch {
      showToast('تعذر تغيير الحالة.', 'error');
    } finally {
      setBusyId(null);
    }
  };

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
          title="تعذر تحميل رسائل الدعم"
          action={<Button onClick={() => void load()}>إعادة المحاولة</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <h1 className="text-2xl font-extrabold text-white md:text-3xl">الدعم الفني</h1>
      <Tabs tabs={tabs} value={filter} onChange={setFilter} />

      {visible.length === 0 ? (
        <Card>
          <EmptyState icon={LifeBuoy} title="لا توجد رسائل في هذا القسم" />
        </Card>
      ) : (
        visible.map((ticket) => (
          <Card key={ticket.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-white">{ticket.user || 'طالب'}</p>
                {ticket.userPhone && (
                  <span dir="ltr" className="text-xs text-slate-500">
                    {ticket.userPhone}
                  </span>
                )}
                {ticket.category === 'complaint' && <Badge variant="danger">شكوى أو اقتراح</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
                <span className="text-xs text-slate-500">{formatDateTime(ticket.ts)}</span>
              </div>
            </div>

            <p className="whitespace-pre-line text-slate-200">{ticket.message}</p>

            {ticket.replies.length > 0 && (
              <ul className="space-y-2">
                {ticket.replies.map((reply, index) => (
                  <li
                    key={`${ticket.id}-${index}`}
                    className={
                      reply.from === 'admin'
                        ? 'rounded-xl border border-gold-500/30 bg-gold-500/10 p-3'
                        : 'rounded-xl border border-navy-800 bg-navy-950/40 p-3'
                    }
                  >
                    <p className="mb-1 text-xs font-bold text-gold-400">
                      {reply.from === 'admin' ? 'الإدارة' : 'الطالب'}
                    </p>
                    <p className="whitespace-pre-line text-sm text-slate-200">{reply.text}</p>
                  </li>
                ))}
              </ul>
            )}

            {ticket.status !== 'closed' ? (
              <div className="space-y-2">
                <textarea
                  rows={2}
                  maxLength={MAX_TICKET_TEXT}
                  value={replyText[ticket.id] ?? ''}
                  onChange={(event) => setReplyText((previous) => ({ ...previous, [ticket.id]: event.target.value }))}
                  className={textareaClass}
                  placeholder="اكتب الرد"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busyId === ticket.id || (replyText[ticket.id] ?? '').trim() === ''}
                    onClick={() => void handleReply(ticket)}
                  >
                    <MessageSquare className="h-4 w-4" />
                    إرسال الرد
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busyId === ticket.id}
                    onClick={() => void handleStatus(ticket, 'closed')}
                  >
                    إغلاق التذكرة
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={busyId === ticket.id}
                onClick={() => void handleStatus(ticket, 'open')}
              >
                إعادة فتح
              </Button>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

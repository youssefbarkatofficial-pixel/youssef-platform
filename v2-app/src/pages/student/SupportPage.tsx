import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { LifeBuoy, MessageSquare, Send } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Select, Spinner, useToast } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import {
  MAX_TICKET_TEXT,
  STATUS_LABELS,
  createTicket,
  listMyTickets,
  replyAsStudent,
} from '../../services/support';
import type { Ticket, TicketCategory, TicketStatus } from '../../services/support';

const STATUS_VARIANT: Record<TicketStatus, 'gold' | 'success' | 'neutral'> = {
  open: 'gold',
  answered: 'success',
  closed: 'neutral',
};

const CATEGORY_OPTIONS = [
  { value: 'question', label: 'سؤال أو مشكلة تقنية' },
  { value: 'complaint', label: 'شكوى أو اقتراح' },
];

const textareaClass =
  'w-full rounded-xl border border-navy-700 bg-navy-900 px-3 py-2.5 text-white placeholder:text-slate-500 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40';

function formatDateTime(ms: number | null): string {
  if (ms === null) return '';
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function SupportPage() {
  const { student } = useAuth();
  const { showToast } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<TicketCategory>('question');
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyBusy, setReplyBusy] = useState<string | null>(null);

  const studentId = student?.id;

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setFailed(false);
    try {
      setTickets(await listMyTickets(studentId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!student) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (message.trim().length < 3) {
      showToast('اكتب رسالتك بوضوح (3 أحرف على الأقل).', 'error');
      return;
    }
    setSending(true);
    try {
      await createTicket(student, message, category);
      setMessage('');
      showToast('وصلت رسالتك، وسنرد عليك في أقرب وقت.', 'success');
      await load();
    } catch {
      showToast('تعذر إرسال الرسالة. حاول مرة أخرى.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (ticket: Ticket) => {
    const text = replyText[ticket.id] ?? '';
    if (text.trim() === '') return;
    setReplyBusy(ticket.id);
    try {
      await replyAsStudent(ticket.id, text);
      setReplyText((previous) => ({ ...previous, [ticket.id]: '' }));
      await load();
    } catch {
      showToast('تعذر إرسال الرد. حاول مرة أخرى.', 'error');
    } finally {
      setReplyBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <h1 className="text-2xl font-extrabold text-white md:text-3xl">الدعم الفني</h1>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="نوع الرسالة"
            value={category}
            options={CATEGORY_OPTIONS}
            onChange={(event) => setCategory(event.target.value === 'complaint' ? 'complaint' : 'question')}
          />
          <div>
            <label htmlFor="ticket-message" className="mb-1.5 block text-sm font-medium text-slate-300">
              رسالتك
            </label>
            <textarea
              id="ticket-message"
              rows={4}
              maxLength={MAX_TICKET_TEXT}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className={textareaClass}
              placeholder="اشرح مشكلتك أو سؤالك بالتفصيل"
            />
          </div>
          <Button type="submit" disabled={sending}>
            <Send className="h-4 w-4" />
            {sending ? 'جارٍ الإرسال...' : 'إرسال'}
          </Button>
        </form>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">رسائلك السابقة</h2>

        {loading ? (
          <div className="grid min-h-[20vh] place-items-center text-gold-400">
            <Spinner />
          </div>
        ) : failed ? (
          <Card>
            <EmptyState
              icon={LifeBuoy}
              title="تعذر تحميل رسائلك"
              action={<Button onClick={() => void load()}>إعادة المحاولة</Button>}
            />
          </Card>
        ) : tickets.length === 0 ? (
          <Card>
            <EmptyState icon={MessageSquare} title="لا توجد رسائل بعد" />
          </Card>
        ) : (
          tickets.map((ticket) => (
            <Card key={ticket.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant={STATUS_VARIANT[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
                <span className="text-xs text-slate-500">{formatDateTime(ticket.ts)}</span>
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
                        {reply.from === 'admin' ? 'الدعم الفني' : 'أنت'}
                      </p>
                      <p className="whitespace-pre-line text-sm text-slate-200">{reply.text}</p>
                    </li>
                  ))}
                </ul>
              )}

              {ticket.status !== 'closed' && (
                <div className="flex gap-2">
                  <input
                    value={replyText[ticket.id] ?? ''}
                    maxLength={MAX_TICKET_TEXT}
                    onChange={(event) =>
                      setReplyText((previous) => ({ ...previous, [ticket.id]: event.target.value }))
                    }
                    placeholder="اكتب ردًا"
                    className={textareaClass}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={replyBusy === ticket.id || (replyText[ticket.id] ?? '').trim() === ''}
                    onClick={() => void handleReply(ticket)}
                  >
                    رد
                  </Button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

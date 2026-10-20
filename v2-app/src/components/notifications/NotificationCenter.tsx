import { useEffect, useState, useRef } from 'react';
import { Bell, Check, Clock, Info, BookOpen, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  listNotificationsForStudent,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../services/notifications';
import type { AppNotification, NotificationCategory } from '../../services/notifications';
import { cn } from '../ui/cn';
import { formatCairoDateTime } from '../../lib/contentRules';

const CATEGORY_ICONS: Record<NotificationCategory, typeof Bell> = {
  platformUpdates: Info,
  curriculumUpdates: BookOpen,
  laggingWarnings: AlertTriangle,
};

const CATEGORY_COLORS: Record<NotificationCategory, { bg: string; text: string; badge: string }> = {
  platformUpdates: { bg: 'bg-blue-500/10', text: 'text-blue-400', badge: 'تحديث المنصة' },
  curriculumUpdates: { bg: 'bg-gold-500/10', text: 'text-gold-400', badge: 'المنهج الدراسي' },
  laggingWarnings: { bg: 'bg-red-500/10', text: 'text-red-400', badge: 'تنبيه مذاكرة' },
};

export default function NotificationCenter() {
  const { student, firebaseUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | NotificationCategory>('all');
  const panelRef = useRef<HTMLDivElement | null>(null);

  const uid = student?.id || firebaseUser?.uid || '';

  const loadNotifs = async () => {
    const list = await listNotificationsForStudent(student);
    setNotifications(list);
  };

  useEffect(() => {
    void loadNotifs();
    // Re-check periodically
    const timer = setInterval(() => void loadNotifs(), 60000);
    return () => clearInterval(timer);
  }, [student]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = (id: string) => {
    markNotificationAsRead(uid, id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    markAllNotificationsAsRead(uid, allIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const filteredNotifs =
    activeTab === 'all'
      ? notifications
      : notifications.filter((n) => n.category === activeTab);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block" ref={panelRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="مركز الإشعارات"
        className="relative rounded-xl p-2 text-theme-text-muted hover:bg-theme-surface-hover hover:text-theme-text transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-md animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Slide-over / Dropdown Drawer */}
      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-2xl border border-navy-700 bg-navy-900/95 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-navy-800 pb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gold-400" />
              <h3 className="text-sm font-bold text-white">مركز الإشعارات</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-gold-500/20 px-2 py-0.5 text-[10px] font-bold text-gold-300">
                  {unreadCount} غير مقروء
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-medium text-gold-400 hover:text-gold-300 transition-colors"
                >
                  قراءة الكل
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-navy-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                'rounded-lg px-2.5 py-1 font-medium transition-colors shrink-0',
                activeTab === 'all'
                  ? 'bg-gold-500 text-navy-950 font-bold'
                  : 'bg-navy-800 text-slate-300 hover:bg-navy-700'
              )}
            >
              الكل ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('curriculumUpdates')}
              className={cn(
                'rounded-lg px-2.5 py-1 font-medium transition-colors shrink-0',
                activeTab === 'curriculumUpdates'
                  ? 'bg-gold-500 text-navy-950 font-bold'
                  : 'bg-navy-800 text-slate-300 hover:bg-navy-700'
              )}
            >
              المناهج
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('laggingWarnings')}
              className={cn(
                'rounded-lg px-2.5 py-1 font-medium transition-colors shrink-0',
                activeTab === 'laggingWarnings'
                  ? 'bg-gold-500 text-navy-950 font-bold'
                  : 'bg-navy-800 text-slate-300 hover:bg-navy-700'
              )}
            >
              التنبيهات
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('platformUpdates')}
              className={cn(
                'rounded-lg px-2.5 py-1 font-medium transition-colors shrink-0',
                activeTab === 'platformUpdates'
                  ? 'bg-gold-500 text-navy-950 font-bold'
                  : 'bg-navy-800 text-slate-300 hover:bg-navy-700'
              )}
            >
              المنصة
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 space-y-2 overflow-y-auto pe-1">
            {filteredNotifs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                لا توجد إشعارات حالياً
              </div>
            ) : (
              filteredNotifs.map((n) => {
                const Icon = CATEGORY_ICONS[n.category] || Bell;
                const colors = CATEGORY_COLORS[n.category] || CATEGORY_COLORS.platformUpdates;

                return (
                  <div
                    key={n.id}
                    onClick={() => !n.read && handleMarkRead(n.id)}
                    className={cn(
                      'group relative rounded-xl border p-3 transition-all cursor-pointer',
                      n.read
                        ? 'border-navy-800/60 bg-navy-950/40 opacity-70'
                        : 'border-gold-500/30 bg-navy-900 shadow-sm hover:border-gold-500/50'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn('rounded-lg p-1.5 shrink-0', colors.bg)}>
                        <Icon className={cn('h-4 w-4', colors.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-white truncate">{n.title}</p>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {colors.badge}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                          {n.message}
                        </p>
                        {n.openAt && (
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-gold-300">
                            <Clock className="h-3 w-3" />
                            <span>ميعاد الفتح: {formatCairoDateTime(n.openAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

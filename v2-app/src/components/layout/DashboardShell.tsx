import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Home, LogOut, Menu, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../ui/cn';
import { logout } from '../../services/auth';
import Brand from './Brand';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

interface DashboardShellProps {
  items: NavItem[];
  areaLabel: string;
}

export default function DashboardShell({ items, areaLabel }: DashboardShellProps) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen md:flex">
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-navy-800 bg-navy-900 transition-transform duration-200',
          'md:sticky md:top-0 md:z-auto md:h-screen md:shrink-0 md:translate-x-0',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-navy-800 px-4">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="إغلاق القائمة"
            className="rounded-lg p-2 text-slate-300 hover:bg-navy-800 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="px-4 pt-4 text-xs font-bold text-gold-500">{areaLabel}</p>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors',
                  isActive
                    ? 'bg-gold-500 text-navy-950'
                    : 'text-slate-300 hover:bg-navy-800 hover:text-white',
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-navy-800 p-3">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-400 transition-colors hover:bg-navy-800 hover:text-white"
          >
            <Home className="h-5 w-5" />
            العودة للموقع
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-60"
          >
            <LogOut className="h-5 w-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-navy-800 bg-navy-900/90 px-4 backdrop-blur md:hidden">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="فتح القائمة"
            className="rounded-lg p-2 text-slate-200 hover:bg-navy-800"
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

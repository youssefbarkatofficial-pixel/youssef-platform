import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, LogOut, Menu, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../ui/cn';
import { logout } from '../../services/auth';
import Brand from './Brand';
import ThemeSwitcher from '../ui/ThemeSwitcher';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: string;
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
    <div className="min-h-screen md:flex bg-theme-base text-theme-text transition-colors">
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-in fade-in"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar with dedicated high-contrast tokens (AAA >= 7:1) */}
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-theme-border/15 transition-all duration-300 shadow-xl',
          'bg-[var(--sidebar-bg)] text-[var(--sidebar-text)]',
          'md:sticky md:top-0 md:z-auto md:h-screen md:shrink-0 md:translate-x-0',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-theme-border/15 px-4">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeSwitcher compact />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق القائمة"
              className="rounded-lg p-2 text-theme-text-muted hover:bg-theme-surface-hover hover:text-theme-text md:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pt-4">
          <p className="text-xs font-extrabold text-theme-gold">{areaLabel}</p>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold transition-all',
                  isActive
                    ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)] shadow-sm'
                    : 'text-[var(--sidebar-text-muted)] hover:bg-theme-surface-hover hover:text-[var(--sidebar-text)]',
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0 text-[var(--sidebar-icon)]" />
              <span>{item.label}</span>
              {item.badge && (
                <span className="ms-auto rounded-md bg-theme-gold/15 px-2 py-0.5 text-[10px] font-black text-theme-gold border border-theme-gold/30">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1.5 border-t border-theme-border/15 p-3">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-[var(--sidebar-text-muted)] transition-colors hover:bg-theme-surface-hover hover:text-[var(--sidebar-text)]"
          >
            <Home className="h-5 w-5 text-[var(--sidebar-icon)]" />
            <span>العودة للرئيسية</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-60"
          >
            <LogOut className="h-5 w-5 text-red-400" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-theme-border/15 bg-[var(--sidebar-bg)]/90 px-4 backdrop-blur-md md:hidden">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeSwitcher compact />
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="فتح القائمة"
              className="rounded-lg p-2 text-theme-text hover:bg-theme-surface-hover"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-8">
          {location.pathname.includes('/assessment/') ? (
            <Outlet />
          ) : (
            <div className="animate-in fade-in duration-300">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

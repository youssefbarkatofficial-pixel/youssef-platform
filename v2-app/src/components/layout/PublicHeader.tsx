import NotificationCenter from '../notifications/NotificationCenter';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { buttonClasses } from '../ui';
import { cn } from '../ui/cn';
import Brand from './Brand';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { logout } from '../../services/auth';

const links = [
  { to: '/', label: 'الرئيسية', end: true },
  { to: '/courses', label: 'الكورسات', end: false },
  { to: '/#about', label: 'عن المعلم', end: false },
];

interface PublicHeaderProps {
  logoUrl?: string;
}

export default function PublicHeader({ logoUrl }: PublicHeaderProps) {
  const [open, setOpen] = useState(false);
  const { firebaseUser, isAdmin, loading } = useAuth();
  const { mode, toggleMode } = useTheme();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-theme-surface/85 backdrop-blur-md shadow-soft transition-colors">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Brand logoUrl={logoUrl} />

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'rounded-full px-4 py-1.5 text-sm font-bold transition-all',
                  isActive
                    ? 'bg-theme-gold/15 text-theme-gold'
                    : 'text-theme-text-secondary hover:bg-theme-surface-hover hover:text-theme-text',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Right Controls: Theme + Auth */}
        <div className="flex items-center gap-2">
          {firebaseUser && <NotificationCenter />}
          {/* Day / Night Toggle - Always visible on desktop & mobile */}
          <button
            type="button"
            onClick={toggleMode}
            title={mode === 'dark' ? 'التحويل إلى الوضع النهاري' : 'التحويل إلى الوضع الليلي'}
            aria-label={mode === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
            className="grid h-9 w-9 place-items-center rounded-full bg-theme-surface-hover/80 text-theme-text-secondary transition-all hover:bg-theme-gold/20 hover:text-theme-gold active:scale-95"
          >
            {mode === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-500" />}
          </button>

          {/* Desktop Auth Buttons */}
          {loading ? (
            <div className="hidden h-9 w-32 md:block" aria-hidden="true" />
          ) : firebaseUser ? (
            <div className="hidden items-center gap-2.5 md:flex">
              {isAdmin ? (
                /* Admin Buttons: Golden "لوحة الإدارة" without duplication */
                <>
                  <Link to="/admin" className={buttonClasses({ variant: 'primary', size: 'sm' })}>
                    لوحة الإدارة
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className={buttonClasses({ variant: 'ghost', size: 'sm' })}
                  >
                    تسجيل الخروج
                  </button>
                </>
              ) : (
                /* Student Buttons: "كورساتي" + Prominent "لوحتي" Badge */
                <>
                  <Link
                    to="/student/my-courses"
                    className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                  >
                    كورساتي
                  </Link>
                  <Link
                    to="/student"
                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-theme-gold via-amber-400 to-theme-gold px-4 py-1.5 text-xs font-black text-navy-950 shadow-md shadow-theme-gold/25 transition-all hover:scale-105 active:scale-95"
                  >
                    <span>لوحتي</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-navy-950 animate-pulse" />
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className={buttonClasses({ variant: 'ghost', size: 'sm' })}
                  >
                    خروج
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link to="/login" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
                تسجيل الدخول
              </Link>
              <Link to="/register" className={buttonClasses({ variant: 'primary', size: 'sm' })}>
                إنشاء حساب
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
            className="grid h-9 w-9 place-items-center rounded-full bg-theme-surface-hover/80 text-theme-text md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {open && (
        <div className="bg-theme-surface/95 px-4 pb-5 pt-2 shadow-2xl backdrop-blur-xl md:hidden animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col gap-1 py-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-xl px-3 py-2.5 font-bold transition-all',
                    isActive
                      ? 'bg-theme-gold/15 text-theme-gold'
                      : 'text-theme-text-secondary hover:bg-theme-surface-hover hover:text-theme-text',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile Auth Actions */}
          {loading ? (
            <div className="h-10 w-full" aria-hidden="true" />
          ) : firebaseUser ? (
            <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
              {isAdmin ? (
                <>
                  <Link
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className={buttonClasses({ variant: 'primary', fullWidth: true })}
                  >
                    لوحة الإدارة
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      handleLogout();
                    }}
                    className={buttonClasses({ variant: 'ghost', fullWidth: true })}
                  >
                    تسجيل الخروج
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/student/my-courses"
                    onClick={() => setOpen(false)}
                    className={buttonClasses({ variant: 'secondary', fullWidth: true })}
                  >
                    كورساتي
                  </Link>
                  <Link
                    to="/student"
                    onClick={() => setOpen(false)}
                    className={buttonClasses({ variant: 'primary', fullWidth: true })}
                  >
                    لوحتي التعليمية
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      handleLogout();
                    }}
                    className={buttonClasses({ variant: 'ghost', fullWidth: true })}
                  >
                    تسجيل الخروج
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className={buttonClasses({ variant: 'secondary', fullWidth: true })}
              >
                تسجيل الدخول
              </Link>
              <Link
                to="/register"
                onClick={() => setOpen(false)}
                className={buttonClasses({ variant: 'primary', fullWidth: true })}
              >
                إنشاء حساب
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

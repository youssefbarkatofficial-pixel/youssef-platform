import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { buttonClasses } from '../ui';
import { cn } from '../ui/cn';
import Brand from './Brand';
import { useAuth } from '../../hooks/useAuth';
import { logout } from '../../services/auth';

const links = [
  { to: '/', label: 'الرئيسية', end: true },
  { to: '/courses', label: 'الكورسات', end: false },
];

export default function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { firebaseUser, student, isAdmin, loading } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
  };

  const firstName =
    student?.name?.trim().split(' ')[0] ||
    firebaseUser?.displayName?.trim().split(' ')[0] ||
    'بك';

  const userDashboard = isAdmin ? '/admin' : '/student/my-courses';

  return (
    <header className="sticky top-0 z-40 border-b border-navy-800 bg-navy-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Brand />

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-4 py-2 text-sm font-bold transition-colors',
                  isActive ? 'text-gold-400' : 'text-slate-300 hover:text-white',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {loading ? (
          <div className="hidden h-9 w-44 md:block" aria-hidden="true" />
        ) : firebaseUser ? (
          <div className="hidden items-center gap-2 md:flex">
            <Link to={userDashboard} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              أهلًا {firstName}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className={buttonClasses({ variant: 'ghost', size: 'sm' })}
            >
              تسجيل الخروج
            </button>
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

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          className="rounded-lg p-2 text-slate-200 hover:bg-navy-800 md:hidden"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-navy-800 bg-navy-950 px-4 pb-4 md:hidden">
          <nav className="flex flex-col py-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-3 font-bold',
                    isActive ? 'text-gold-400' : 'text-slate-200',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          {loading ? (
            <div className="h-10 w-full" aria-hidden="true" />
          ) : firebaseUser ? (
            <div className="flex gap-2">
              <Link
                to={userDashboard}
                onClick={() => setOpen(false)}
                className={buttonClasses({ variant: 'secondary', fullWidth: true })}
              >
                أهلًا {firstName}
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
            </div>
          ) : (
            <div className="flex gap-2">
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

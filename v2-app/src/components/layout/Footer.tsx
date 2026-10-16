import { Link } from 'react-router-dom';
import Brand from './Brand';
import { useAuth } from '../../hooks/useAuth';

export default function Footer() {
  const { firebaseUser, isAdmin } = useAuth();

  const links = firebaseUser
    ? [
        { to: '/courses', label: 'الكورسات' },
        { to: isAdmin ? '/admin' : '/student/my-courses', label: 'كورساتي' },
        { to: '/student', label: 'لوحة الطالب' },
        { to: '/student/profile', label: 'الملف الشخصي' },
      ]
    : [
        { to: '/courses', label: 'الكورسات' },
        { to: '/login', label: 'تسجيل الدخول' },
        { to: '/register', label: 'إنشاء حساب' },
        { to: '/student', label: 'لوحة الطالب' },
        { to: '/admin/login', label: 'دخول الإدارة' },
      ];

  return (
    <footer className="mt-16 border-t border-navy-800 bg-navy-900">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <Brand />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
            منصة تعليمية متخصصة في التاريخ والجغرافيا للمراحل الابتدائية والإعدادية والثانوية.
          </p>
        </div>

        <div>
          <h3 className="mb-3 font-bold text-white">روابط سريعة</h3>
          <ul className="space-y-2 text-sm">
            {links.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-slate-400 transition-colors hover:text-gold-400">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 font-bold text-white">الصفوف الدراسية</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>المرحلة الابتدائية</li>
            <li>المرحلة الإعدادية</li>
            <li>المرحلة الثانوية</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-800 py-4 text-center text-xs text-slate-500">
        جميع الحقوق محفوظة، منصة يوسف بركات التعليمية {new Date().getFullYear()}
      </div>
    </footer>
  );
}

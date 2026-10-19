import { Link } from 'react-router-dom';
import Brand from './Brand';
import { useAuth } from '../../hooks/useAuth';

interface FooterProps {
  logoUrl?: string;
}

export default function Footer({ logoUrl }: FooterProps) {
  const { firebaseUser, isAdmin } = useAuth();

  return (
    <footer className="relative mt-20 border-t border-theme-border/20 bg-theme-surface/60 backdrop-blur-md transition-colors">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          {/* Col 1: Brand & Social */}
          <div className="md:col-span-2 space-y-4">
            <Brand logoUrl={logoUrl} />
            <p className="max-w-md text-sm leading-relaxed text-theme-text-muted">
              منصتك الأولى لتعلم وفهم الجغرافيا والتاريخ بأسلوب بسيط وممتع للمراحل الإعدادية والثانوية والابتدائية.
            </p>

            {/* Circular Social Icons with colored glow on hover */}
            <div className="flex items-center gap-2.5 pt-2">
              {/* WhatsApp */}
              <a
                href="https://wa.me/201023675235"
                target="_blank"
                rel="noopener noreferrer"
                title="واتساب"
                aria-label="تواصل عبر واتساب"
                className="grid h-10 w-10 place-items-center rounded-full bg-theme-surface-hover/80 text-theme-text-secondary transition-all hover:scale-110 hover:bg-emerald-500 hover:text-white hover:shadow-lg hover:shadow-emerald-500/30"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>

              {/* Facebook */}
              <a
                href="https://www.facebook.com/youssefbarakatofficial?locale=ar_AR"
                target="_blank"
                rel="noopener noreferrer"
                title="فيسبوك"
                aria-label="صفحة فيسبوك"
                className="grid h-10 w-10 place-items-center rounded-full bg-theme-surface-hover/80 text-theme-text-secondary transition-all hover:scale-110 hover:bg-blue-600 hover:text-white hover:shadow-lg hover:shadow-blue-600/30"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>

              {/* TikTok */}
              <a
                href="https://www.tiktok.com/@youssefbarakatofficial"
                target="_blank"
                rel="noopener noreferrer"
                title="تيك توك"
                aria-label="قناة تيك توك"
                className="grid h-10 w-10 place-items-center rounded-full bg-theme-surface-hover/80 text-theme-text-secondary transition-all hover:scale-110 hover:bg-cyan-500 hover:text-black hover:shadow-lg hover:shadow-cyan-500/30"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                </svg>
              </a>

              {/* YouTube */}
              <a
                href="https://www.youtube.com/@youssefstudies"
                target="_blank"
                rel="noopener noreferrer"
                title="يوتيوب"
                aria-label="قناة يوتيوب الرسمية"
                className="grid h-10 w-10 place-items-center rounded-full bg-theme-surface-hover/80 text-theme-text-secondary transition-all hover:scale-110 hover:bg-red-600 hover:text-white hover:shadow-lg hover:shadow-red-600/30"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>

              {/* Instagram */}
              <a
                href="https://www.instagram.com/youssefbarakatofficial/"
                target="_blank"
                rel="noopener noreferrer"
                title="انستجرام"
                aria-label="صفحة انستجرام"
                className="grid h-10 w-10 place-items-center rounded-full bg-theme-surface-hover/80 text-theme-text-secondary transition-all hover:scale-110 hover:bg-gradient-to-tr hover:from-amber-500 hover:via-pink-500 hover:to-purple-600 hover:text-white hover:shadow-lg hover:shadow-pink-500/30"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Col 2: Important Links */}
          <div>
            <h3 className="mb-4 text-sm font-extrabold text-theme-text">روابط هامة</h3>
            <ul className="space-y-2.5 text-sm text-theme-text-secondary">
              <li>
                <Link to="/" className="hover:text-theme-gold transition-colors">
                  الرئيسية
                </Link>
              </li>
              <li>
                <Link to="/courses" className="hover:text-theme-gold transition-colors">
                  الكورسات المتاحة
                </Link>
              </li>
              <li>
                <a href="/#about" className="hover:text-theme-gold transition-colors">
                  عن مستر يوسف بركات
                </a>
              </li>
              <li>
                <Link to="/support" className="hover:text-theme-gold transition-colors">
                  الدعم الفني والمساعدة
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: My Account */}
          <div>
            <h3 className="mb-4 text-sm font-extrabold text-theme-text">حسابي</h3>
            <ul className="space-y-2.5 text-sm text-theme-text-secondary">
              {firebaseUser ? (
                <>
                  <li>
                    <Link
                      to={isAdmin ? '/admin' : '/student'}
                      className="hover:text-theme-gold transition-colors"
                    >
                      {isAdmin ? 'لوحة الإدارة' : 'لوحتي التعليمية'}
                    </Link>
                  </li>
                  {!isAdmin && (
                    <li>
                      <Link
                        to="/student/my-courses"
                        className="hover:text-theme-gold transition-colors"
                      >
                        متابعة كورساتي
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link
                      to="/student/profile"
                      className="hover:text-theme-gold transition-colors"
                    >
                      الملف الشخصي
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link to="/login" className="hover:text-theme-gold transition-colors">
                      تسجيل الدخول
                    </Link>
                  </li>
                  <li>
                    <Link to="/register" className="hover:text-theme-gold transition-colors">
                      إنشاء حساب جديد
                    </Link>
                  </li>
                  <li>
                    <Link to="/courses" className="hover:text-theme-gold transition-colors">
                      تصفح الحصص
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright and Credit */}
        <div className="mt-12 pt-6 border-t border-theme-border/20 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-theme-text-muted text-center md:text-start">
          <p>جميع الحقوق محفوظة © 2026 | منصة يوسف بركات التعليمية</p>
          <p className="opacity-80">
            تمت برمجة المنصة والذكاء الاصطناعي المساعد للطلبة (البوصلة) بواسطة الأستاذ يوسف بركات.
          </p>
        </div>
      </div>
    </footer>
  );
}

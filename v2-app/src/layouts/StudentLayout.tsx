import {
  BarChart3,
  BookOpen,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  User,
} from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { touchLastActive } from '../services/students';
import DashboardShell from '../components/layout/DashboardShell';
import type { NavItem } from '../components/layout/DashboardShell';
import AnnualGradeModal from '../components/student/AnnualGradeModal';
import BousalaChatDrawer from '../components/student/BousalaChatDrawer';

const items: NavItem[] = [
  { to: '/student', label: 'لوحتي', icon: LayoutDashboard, end: true },
  { to: '/student/my-courses', label: 'كورساتي', icon: BookOpen },
  { to: '/student/payments', label: 'طلبات الدفع', icon: CreditCard },
  { to: '/student/exams', label: 'الامتحانات والواجبات', icon: ClipboardList },
  { to: '/student/stats', label: 'الإحصائيات', icon: BarChart3 },
  { to: '/student/profile', label: 'الملف الشخصي', icon: User },
  { to: '/student/support', label: 'الدعم الفني', icon: LifeBuoy },
];

// كتابة "آخر ظهور" مرة واحدة في الجلسة. فشلها (حساب مجمّد مثلًا) لا يظهر للطالب.
const ACTIVE_KEY = 'yb_last_active_stamp';

export default function StudentLayout() {
  const { student } = useAuth();
  const studentId = student?.id;

  useEffect(() => {
    if (!studentId) return;
    try {
      if (sessionStorage.getItem(ACTIVE_KEY) === studentId) return;
      sessionStorage.setItem(ACTIVE_KEY, studentId);
    } catch {
      // التخزين غير متاح: نكتب بدون حارس.
    }
    void touchLastActive(studentId).catch(() => undefined);
  }, [studentId]);

  return (
    <>
      <DashboardShell items={items} areaLabel="منطقة الطالب" />
      <AnnualGradeModal />
      <BousalaChatDrawer />
    </>
  );
}

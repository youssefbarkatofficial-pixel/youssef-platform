import {
  BarChart3,
  BookOpen,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Sparkles,
  User,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { touchLastActive } from '../services/students';
import { listEnrolledCourses } from '../services/courses';
import { extractPracticeQuestionsFromCourses } from '../lib/revision/adapter';
import DashboardShell from '../components/layout/DashboardShell';
import type { NavItem } from '../components/layout/DashboardShell';
import AnnualGradeModal from '../components/student/AnnualGradeModal';
import MandatoryPasswordResetModal from '../components/student/MandatoryPasswordResetModal';
import BousalaChatDrawer from '../components/student/BousalaChatDrawer';

const baseItems: NavItem[] = [
  { to: '/student', label: 'لوحتي', icon: LayoutDashboard, end: true },
  { to: '/student/my-courses', label: 'كورساتي', icon: BookOpen },
  { to: '/student/payments', label: 'طلبات الدفع', icon: CreditCard },
  { to: '/student/exams', label: 'الامتحانات والواجبات', icon: ClipboardList },
  { to: '/student/stats', label: 'الإحصائيات', icon: BarChart3 },
  { to: '/student/profile', label: 'الملف الشخصي', icon: User },
  { to: '/student/support', label: 'الدعم الفني', icon: LifeBuoy },
];

const revisionItem: NavItem = {
  to: '/student/revision',
  label: 'المراجعة الذكية',
  icon: Sparkles,
};

// كتابة "آخر ظهور" مرة واحدة في الجلسة. فشلها (حساب مجمّد مثلًا) لا يظهر للطالب.
const ACTIVE_KEY = 'yb_last_active_stamp';

export default function StudentLayout() {
  const { student } = useAuth();
  const studentId = student?.id;
  const [hasRevisionQuestions, setHasRevisionQuestions] = useState(false);

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

  // فحص توفر أسئلة مراجعة للكورسات المشترك بها الطالب ("فاضي = مخفي")
  useEffect(() => {
    if (!student) {
      setHasRevisionQuestions(false);
      return;
    }

    let active = true;
    listEnrolledCourses(student)
      .then((courses) => {
        if (!active) return;
        const { practiceQuestions } = extractPracticeQuestionsFromCourses(courses);
        setHasRevisionQuestions(practiceQuestions.length > 0);
      })
      .catch(() => {
        if (active) setHasRevisionQuestions(false);
      });

    return () => {
      active = false;
    };
  }, [student]);

  const navItems = useMemo(() => {
    if (!hasRevisionQuestions) return baseItems;
    const idx = baseItems.findIndex((i) => i.to === '/student/exams');
    const items = [...baseItems];
    items.splice(idx + 1, 0, revisionItem);
    return items;
  }, [hasRevisionQuestions]);

  return (
    <>
      <DashboardShell items={navItems} areaLabel="منطقة الطالب" />
      <AnnualGradeModal />
      <MandatoryPasswordResetModal />
      <BousalaChatDrawer />
    </>
  );
}

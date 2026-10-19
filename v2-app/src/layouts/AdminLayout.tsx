import {
  Bell,
  BookOpen,
  Bot,
  CreditCard,
  Gamepad2,
  HelpCircle,
  LifeBuoy,
  LayoutDashboard,
  Settings,
  Upload,
  Users,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import DashboardShell from '../components/layout/DashboardShell';
import type { NavItem } from '../components/layout/DashboardShell';

const items: NavItem[] = [
  { to: '/admin', label: 'الرئيسية', icon: LayoutDashboard, end: true },
  { to: '/admin/courses', label: 'الكورسات', icon: BookOpen },
  { to: '/admin/question-bank', label: 'بنك الأسئلة', icon: HelpCircle },
  { to: '/admin/quick-upload', label: 'الرفع السريع', icon: Upload, badge: 'قريبًا' },
  { to: '/admin/students', label: 'الطلاب', icon: Users },
  { to: '/admin/payments', label: 'المدفوعات', icon: CreditCard },
  { to: '/admin/notifications', label: 'الإشعارات', icon: Bell },
  { to: '/admin/settings', label: 'الإعدادات', icon: Settings },
];

// عناصر المالك والأدمن الكامل فقط (المساعد لا يراها).
const seniorItems: NavItem[] = [
  { to: '/admin/support', label: 'الدعم الفني', icon: LifeBuoy },
  { to: '/admin/bot', label: 'مراقبة البوصلة', icon: Bot },
  { to: '/admin/game', label: 'إدارة اللعبة', icon: Gamepad2, badge: 'قريبًا' },
];

export default function AdminLayout() {
  const { isSeniorAdmin, adminRole } = useAuth();

  // الإعدادات تبقى آخر عنصر.
  const settings = items[items.length - 1];
  const visible = isSeniorAdmin
    ? [...items.slice(0, -1), ...seniorItems, settings]
    : items;

  const areaLabel = adminRole === 'assistant' ? 'لوحة الإدارة (مساعد)' : 'لوحة الإدارة';

  return <DashboardShell items={visible} areaLabel={areaLabel} />;
}

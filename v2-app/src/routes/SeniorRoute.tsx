import { Navigate, Outlet } from 'react-router-dom';
import FullScreenLoader from '../components/layout/FullScreenLoader';
import { useAuth } from '../hooks/useAuth';

// صفحات المالك والأدمن الكامل فقط (المساعد يرجع للوحة الإدارة).
// الحماية الحقيقية في القواعد، وهذا لإخفاء الواجهة فقط.
export default function SeniorRoute() {
  const { isSeniorAdmin, loading } = useAuth();

  if (loading) return <FullScreenLoader />;
  if (!isSeniorAdmin) return <Navigate to="/admin" replace />;

  return <Outlet />;
}

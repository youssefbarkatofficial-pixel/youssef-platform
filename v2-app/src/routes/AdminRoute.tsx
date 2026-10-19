import { Navigate, Outlet } from 'react-router-dom';
import FullScreenLoader from '../components/layout/FullScreenLoader';
import { useAuth } from '../hooks/useAuth';

// حراسة صفحات الأدمن: لازم يكون مسجّلًا وإيميله أدمن (المالك أو في platformAdmins).
export default function AdminRoute() {
  const { firebaseUser, isAdmin, loading } = useAuth();
  const isDevPreview = import.meta.env.DEV && typeof window !== 'undefined' && window.location.search.includes('dev_admin=true');

  if (isDevPreview) return <Outlet />;

  if (loading) return <FullScreenLoader />;

  if (!firebaseUser) return <Navigate to="/admin/login" replace />;

  if (isAdmin) return <Outlet />;

  return <Navigate to="/" replace />;
}

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import AccountProblemScreen from '../components/auth/AccountProblemScreen';
import FullScreenLoader from '../components/layout/FullScreenLoader';
import { useAuth } from '../hooks/useAuth';

// حراسة صفحات الطالب: لازم يكون مسجّلًا وله مستند طالب غير موقوف.
export default function ProtectedRoute() {
  const { firebaseUser, student, isAdmin, loading, profileError } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!firebaseUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (profileError) return <AccountProblemScreen reason="load-error" />;

  if (student) {
    return student.archived ? <AccountProblemScreen reason="archived" /> : <Outlet />;
  }

  if (isAdmin) return <Navigate to="/admin" replace />;

  return <AccountProblemScreen reason="incomplete" />;
}

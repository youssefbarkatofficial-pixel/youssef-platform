import { Navigate, useSearchParams } from 'react-router-dom';

// الرابط القديم course-details.html?id=رقم_الكورس يتحول للرابط الجديد /courses/رقم_الكورس.
export default function LegacyCourseRedirect() {
  const [params] = useSearchParams();
  const id = (params.get('id') ?? params.get('courseId') ?? '').trim();
  const safeId = /^[A-Za-z0-9_-]{1,80}$/.test(id) ? id : '';
  return <Navigate to={safeId ? `/courses/${safeId}` : '/courses'} replace />;
}

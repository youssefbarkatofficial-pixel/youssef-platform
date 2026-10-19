import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import StudentLayout from '../layouts/StudentLayout';
import AdminLayout from '../layouts/AdminLayout';
import FullScreenLoader from '../components/layout/FullScreenLoader';
import ProtectedRoute from './ProtectedRoute';
import AdminRoute from './AdminRoute';
import SeniorRoute from './SeniorRoute';
import LegacyCourseRedirect from './LegacyCourseRedirect';

// كل صفحة تُحمَّل عند الحاجة فقط، حتى يفتح الموقع بسرعة على الموبايل.
const HomePage = lazy(() => import('../pages/public/HomePage'));
const CoursesPage = lazy(() => import('../pages/public/CoursesPage'));
const CourseDetailsPage = lazy(() => import('../pages/public/CourseDetailsPage'));
const LoginPage = lazy(() => import('../pages/public/LoginPage'));
const RegisterPage = lazy(() => import('../pages/public/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../pages/public/ForgotPasswordPage'));
const NotFoundPage = lazy(() => import('../pages/public/NotFoundPage'));

const DashboardPage = lazy(() => import('../pages/student/DashboardPage'));
const MyCoursesPage = lazy(() => import('../pages/student/MyCoursesPage'));
const CheckoutPage = lazy(() => import('../pages/student/CheckoutPage'));
const PaymentRequestsPage = lazy(() => import('../pages/student/PaymentRequestsPage'));
const ExamsPage = lazy(() => import('../pages/student/ExamsPage'));
const AssessmentPage = lazy(() => import('../pages/student/AssessmentPage'));
const StatsPage = lazy(() => import('../pages/student/StatsPage'));
const RevisionPage = lazy(() => import('../pages/student/RevisionPage'));
const LeaderboardPage = lazy(() => import('../pages/student/LeaderboardPage'));
const GamePage = lazy(() => import('../pages/student/GamePage'));
const ProfilePage = lazy(() => import('../pages/student/ProfilePage'));
const SupportPage = lazy(() => import('../pages/student/SupportPage'));

const AdminLoginPage = lazy(() => import('../pages/admin/AdminLoginPage'));
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'));
const AdminCoursesPage = lazy(() => import('../pages/admin/AdminCoursesPage'));
const AdminCourseEditPage = lazy(() => import('../pages/admin/AdminCourseEditPage'));
const AdminAssessmentEditPage = lazy(() => import('../pages/admin/AdminAssessmentEditPage'));
const AssessmentResultsPage = lazy(() => import('../pages/admin/AssessmentResultsPage'));
const AdoptCoursesPage = lazy(() => import('../pages/admin/AdoptCoursesPage'));
const QuestionBankPage = lazy(() => import('../pages/admin/QuestionBankPage'));
const QuickUploadPage = lazy(() => import('../pages/admin/QuickUploadPage'));
const AdminStudentsPage = lazy(() => import('../pages/admin/AdminStudentsPage'));
const StudentAnalyticsPage = lazy(() => import('../pages/admin/StudentAnalyticsPage'));
const PaymentsPage = lazy(() => import('../pages/admin/PaymentsPage'));
const NotificationsPage = lazy(() => import('../pages/admin/NotificationsPage'));
const SettingsPage = lazy(() => import('../pages/admin/SettingsPage'));
const AdminSupportPage = lazy(() => import('../pages/admin/AdminSupportPage'));
const BotMonitorPage = lazy(() => import('../pages/admin/BotMonitorPage'));
const GameManagementPage = lazy(() => import('../pages/admin/GameManagementPage'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="courses/:courseId" element={<CourseDetailsPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="course-details.html" element={<LegacyCourseRedirect />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="student" element={<StudentLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="my-courses" element={<MyCoursesPage />} />
            <Route path="checkout/:courseId" element={<CheckoutPage />} />
            <Route path="payments" element={<PaymentRequestsPage />} />
            <Route path="exams" element={<ExamsPage />} />
            <Route path="assessment/:courseId/:itemId" element={<AssessmentPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="revision" element={<RevisionPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="game" element={<GamePage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<Navigate to="/student/profile" replace />} />
            <Route path="notifications" element={<Navigate to="/student" replace />} />
            <Route path="homeworks" element={<Navigate to="/student/exams" replace />} />
            <Route path="support" element={<SupportPage />} />
          </Route>
        </Route>

        <Route path="admin/login" element={<AdminLoginPage />} />

        <Route element={<AdminRoute />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="courses" element={<AdminCoursesPage />} />
            <Route path="courses/:courseId" element={<AdminCourseEditPage />} />
            <Route
              path="courses/:courseId/assessments/:itemId"
              element={<AdminAssessmentEditPage />}
            />
            <Route
              path="courses/:courseId/assessments/:itemId/results"
              element={<AssessmentResultsPage />}
            />
            <Route path="preview/assessment/:courseId/:itemId" element={<AssessmentPage />} />
            <Route path="adopt-courses" element={<AdoptCoursesPage />} />
            <Route path="question-bank" element={<QuestionBankPage />} />
            <Route path="quick-upload" element={<QuickUploadPage />} />
            <Route path="students" element={<AdminStudentsPage />} />
            <Route path="students/:studentId" element={<StudentAnalyticsPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route element={<SeniorRoute />}>
              <Route path="support" element={<AdminSupportPage />} />
              <Route path="bot" element={<BotMonitorPage />} />
              <Route path="bot-monitor" element={<Navigate to="/admin/bot" replace />} />
              <Route path="game" element={<GameManagementPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

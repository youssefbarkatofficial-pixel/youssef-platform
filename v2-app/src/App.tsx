import { KeyRound } from 'lucide-react';
import { Card, EmptyState, ToastProvider } from './components/ui';
import { AuthProvider } from './hooks/useAuth';
import { isFirebaseConfigured } from './lib/firebase';
import AppRoutes from './routes/AppRoutes';
import InstallAppButton from './components/pwa/InstallAppButton';
import PullToRefresh from './components/layout/PullToRefresh';

function ConfigMissingScreen() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-lg">
        <EmptyState
          icon={KeyRound}
          title="ملف .env غير مكتمل"
          description="أنشئ ملفًا باسم .env في جذر المشروع (انسخه من .env.example)، واملأ قيم Firebase، ثم أوقف الموقع بـ Ctrl + C وشغّله من جديد بـ npm run dev."
        />
      </Card>
    </div>
  );
}

export default function App() {
  if (!isFirebaseConfigured) {
    return <ConfigMissingScreen />;
  }

  return (
    <ToastProvider>
      <AuthProvider>
        <AppRoutes />
        <InstallAppButton />
        <PullToRefresh />
      </AuthProvider>
    </ToastProvider>
  );
}

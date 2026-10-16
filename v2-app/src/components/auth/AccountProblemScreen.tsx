import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Ban, ShieldAlert, WifiOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, Card, buttonClasses } from '../ui';
import { useAuth } from '../../hooks/useAuth';
import { logout } from '../../services/auth';

export type AccountProblemReason = 'incomplete' | 'archived' | 'load-error' | 'not-admin';

interface ProblemContent {
  icon: LucideIcon;
  title: string;
  description: string;
}

const contents: Record<AccountProblemReason, ProblemContent> = {
  incomplete: {
    icon: AlertTriangle,
    title: 'بيانات حسابك غير مكتملة',
    description:
      'تم تسجيل دخولك لكننا لم نجد بيانات الطالب الخاصة بك. تواصل مع إدارة المنصة لحل المشكلة.',
  },
  archived: {
    icon: Ban,
    title: 'الحساب موقوف',
    description: 'تم إيقاف هذا الحساب. تواصل مع إدارة المنصة لإعادة تفعيله.',
  },
  'load-error': {
    icon: WifiOff,
    title: 'تعذر تحميل بياناتك',
    description: 'تأكد من اتصالك بالإنترنت ثم اضغط «إعادة المحاولة».',
  },
  'not-admin': {
    icon: ShieldAlert,
    title: 'هذا الحساب ليس حساب إدارة',
    description: 'سجّل الخروج ثم ادخل بحساب الإدارة الصحيح.',
  },
};

interface AccountProblemScreenProps {
  reason: AccountProblemReason;
}

export default function AccountProblemScreen({ reason }: AccountProblemScreenProps) {
  const { refresh } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const content = contents[reason];
  const Icon = content.icon;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[60vh] w-full max-w-lg place-items-center px-4 py-10">
      <Card className="w-full text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gold-500/15 text-gold-400">
          <Icon className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-extrabold text-white">{content.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{content.description}</p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {reason === 'load-error' && (
            <Button loading={retrying} onClick={handleRetry}>
              إعادة المحاولة
            </Button>
          )}
          <Button variant="secondary" loading={loggingOut} onClick={handleLogout}>
            تسجيل الخروج
          </Button>
          <Link to="/" className={buttonClasses({ variant: 'ghost' })}>
            الرئيسية
          </Link>
        </div>
      </Card>
    </div>
  );
}

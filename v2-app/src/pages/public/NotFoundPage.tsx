import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { Card, EmptyState, buttonClasses } from '../../components/ui';

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card>
        <EmptyState
          icon={SearchX}
          title="الصفحة غير موجودة"
          description="الرابط الذي فتحته غير صحيح أو تم نقله."
          action={
            <Link to="/" className={buttonClasses({ variant: 'primary' })}>
              العودة للرئيسية
            </Link>
          }
        />
      </Card>
    </div>
  );
}

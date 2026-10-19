import { Trophy } from 'lucide-react';
import ClosedFeaturePage from '../../components/layout/ClosedFeaturePage';

export default function LeaderboardPage() {
  return (
    <ClosedFeaturePage
      icon={Trophy}
      title="لوحة الشرف وتكريم المتفوقين"
      description="لوحة الأوائل قيد الإعداد وستفتح لتكريم أبطال التاريخ والجغرافيا بعد نشر نتائج الاختبارات الدورية وتحديث الدرجات."
    />
  );
}

import { Hammer } from 'lucide-react';
import { Badge, Card } from '../ui';

interface PlaceholderPageProps {
  title: string;
}

// صفحة مؤقتة للأدمن لميزات لم تُبنَ بعد.
export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card className="text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gold-500/15 text-gold-400">
          <Hammer className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">{title}</h1>
        <p className="mt-2 text-slate-400">تحت الإنشاء</p>
        <div className="mt-4">
          <Badge variant="gold">قريبًا</Badge>
        </div>
      </Card>
    </div>
  );
}

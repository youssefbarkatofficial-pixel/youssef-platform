import { Spinner } from '../ui';

export default function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-3 text-gold-400">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400">جارٍ التحميل...</p>
      </div>
    </div>
  );
}

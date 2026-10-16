import { cn } from './cn';

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function Tabs({ tabs, value, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn('flex gap-1 overflow-x-auto rounded-xl bg-navy-900 p-1', className)}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition-colors',
              active ? 'bg-gold-500 text-navy-950' : 'text-slate-300 hover:bg-navy-800',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

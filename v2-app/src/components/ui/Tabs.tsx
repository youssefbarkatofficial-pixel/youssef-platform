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
      className={cn(
        'flex gap-1.5 overflow-x-auto rounded-btn border border-theme-border/50 bg-theme-surface/80 p-1.5 shadow-soft backdrop-blur-sm',
        className,
      )}
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
              'whitespace-nowrap rounded-btn px-4 py-2 text-sm font-bold transition-[transform,background-color,color,box-shadow] duration-200 ease-out active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-theme-base',
              active
                ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-navy-950 font-extrabold shadow-sm'
                : 'text-theme-text-secondary hover:bg-theme-surface-hover hover:text-theme-text',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

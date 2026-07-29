import { cn } from '@/lib/utils';
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <div className="flex gap-1 overflow-x-auto rounded-2xl border bg-muted/50 p-1">{tabs.map((tab) => <button key={tab.value} onClick={() => onChange(tab.value)} className={cn('whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold smooth', value === tab.value ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{tab.label}</button>)}</div>;
}

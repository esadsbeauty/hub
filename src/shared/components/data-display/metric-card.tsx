import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function MetricCard({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint?: string; icon?: LucideIcon }) {
  return (
    <Card className="glass overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p></div>
          {Icon && <div className="rounded-2xl bg-champagne-soft p-3 text-champagne-dark"><Icon size={22} /></div>}
        </div>
        {hint && <p className="mt-3 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

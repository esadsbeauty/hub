import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function AnalyticsMetric({
  label,
  value,
  detail,
  definition,
  comparison,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  definition: string;
  comparison?: string;
  icon?: LucideIcon;
  onClick?: () => void;
}) {
  const content = (
    <CardContent className="p-5 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-sm font-semibold text-muted-foreground"
            title={definition}
          >
            {label}
          </p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
        </div>
        {Icon && (
          <div className="rounded-2xl bg-champagne-soft p-3 text-champagne-dark">
            <Icon size={21} />
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
      {comparison && <p className="mt-1 text-xs font-semibold">{comparison}</p>}
    </CardContent>
  );
  return onClick ? (
    <button className="w-full rounded-2xl premium-focus" onClick={onClick}>
      <Card className="h-full smooth hover:border-champagne">{content}</Card>
    </button>
  ) : (
    <Card className="h-full">{content}</Card>
  );
}

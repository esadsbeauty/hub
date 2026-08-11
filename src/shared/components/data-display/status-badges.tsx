import { Badge } from "@/components/ui/badge";
import type { Priority, Temperature } from "@/modules/crm/types";

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className="border-champagne bg-champagne-soft text-champagne-dark">
      {status}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const labels: Record<Priority, string> = {
    baixa: "Baixa",
    media: "Média",
    alta: "Alta",
  };
  const className =
    priority === "alta"
      ? "bg-red-50 text-red-700"
      : priority === "media"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-700";
  return <Badge className={className}>{labels[priority]}</Badge>;
}

export function TemperatureBadge({
  temperature,
}: {
  temperature: Temperature;
}) {
  const labels: Record<Temperature, string> = {
    frio: "Frio",
    morno: "Morno",
    quente: "Quente",
  };
  return (
    <Badge className="border bg-card text-foreground">
      {labels[temperature]}
    </Badge>
  );
}

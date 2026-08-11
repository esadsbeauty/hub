import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarX,
  CircleDollarSign,
  ListTodo,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsResult } from "../analytics-service";

export function AttentionPanel({
  analytics,
  onOpen,
}: {
  analytics: AnalyticsResult;
  onOpen: (title: string, ids: string[]) => void;
}) {
  const rows = [
    {
      label: "Oportunidades sem próximo passo",
      count: analytics.attention.withoutNextStep.length,
      icon: ListTodo,
      action: () =>
        onOpen(
          "Oportunidades sem próximo passo",
          analytics.attention.withoutNextStep.map((item) => item.id),
        ),
    },
    {
      label: "Previsão de fechamento vencida",
      count: analytics.attention.overdueCloseDate.length,
      icon: CalendarX,
      action: () =>
        onOpen(
          "Previsões de fechamento vencidas",
          analytics.attention.overdueCloseDate.map((item) => item.id),
        ),
    },
    {
      label: "Oportunidades sem valor",
      count: analytics.attention.withoutValue.length,
      icon: CircleDollarSign,
      action: () =>
        onOpen(
          "Oportunidades sem valor",
          analytics.attention.withoutValue.map((item) => item.id),
        ),
    },
    {
      label: "Oportunidades sem previsão",
      count: analytics.attention.withoutCloseDate.length,
      icon: CalendarX,
      action: () =>
        onOpen(
          "Oportunidades sem previsão de fechamento",
          analytics.attention.withoutCloseDate.map((item) => item.id),
        ),
    },
    {
      label: "Oportunidades sem responsável",
      count: analytics.attention.withoutOwner.length,
      icon: ListTodo,
      action: () =>
        onOpen(
          "Oportunidades sem responsável",
          analytics.attention.withoutOwner.map((item) => item.id),
        ),
    },
    {
      label: "Oportunidades sem origem",
      count: analytics.attention.withoutSource.length,
      icon: ListTodo,
      action: () =>
        onOpen(
          "Oportunidades sem origem",
          analytics.attention.withoutSource.map((item) => item.id),
        ),
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atenção necessária</CardTitle>
        <p className="text-sm text-muted-foreground">
          Condições objetivas que exigem revisão comercial.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link
          className="flex items-center justify-between rounded-xl border p-3 text-sm hover:bg-muted"
          to="/agenda"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} /> Follow-ups atrasados
          </span>
          <b>{analytics.attention.overdueFollowups.length}</b>
        </Link>
        {rows.map((row) => (
          <button
            key={row.label}
            className="flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm hover:bg-muted"
            onClick={row.action}
          >
            <span className="flex items-center gap-2">
              <row.icon size={16} /> {row.label}
            </span>
            <b>{row.count}</b>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currency } from "@/modules/crm/utils/formatters";
import type { AnalyticsResult } from "../analytics-service";

export function PipelineOverview({
  analytics,
}: {
  analytics: AnalyticsResult;
}) {
  const maximum = Math.max(...analytics.stageRows.map((item) => item.value), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline por etapa</CardTitle>
        <p className="text-sm text-muted-foreground">
          Distribuição atual das oportunidades abertas; período não altera
          estoque.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {analytics.stageRows.map((row) => (
          <div key={row.stage.id}>
            <div className="mb-1 flex items-end justify-between gap-3 text-sm">
              <div>
                <b>{row.stage.name}</b>
                <p className="text-xs text-muted-foreground">
                  {row.count} oportunidades · {currency.format(row.weighted)}{" "}
                  ponderado
                </p>
              </div>
              <b>{currency.format(row.value)}</b>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-champagne"
                style={{
                  width: `${Math.max(2, (row.value / maximum) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
        {!analytics.stageRows.some((item) => item.count) && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Não existem oportunidades abertas para os filtros selecionados.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

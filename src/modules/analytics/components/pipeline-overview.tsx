import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
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
        {analytics.stageRows.map((row, index) => (
          <div key={row.stage.id} className={index > 3 ? "hidden sm:block" : undefined}>
            <div className="mb-1 flex items-end justify-between gap-3 text-sm">
              <div>
                <b>{row.stage.name}</b>
                <p className="text-sm text-muted-foreground sm:text-xs">
                  {row.count} oportunidades <span className="hidden sm:inline">· {currency.format(row.weighted)} ponderado</span>
                </p>
              </div>
              <b className="text-sm">{currency.format(row.value)}</b>
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
        {analytics.stageRows.length > 4 && <Link to="/crm" className="flex min-h-12 items-center justify-between rounded-xl bg-muted/70 px-4 text-sm font-semibold sm:hidden">Abrir pipeline completo <ArrowRight size={18}/></Link>}
      </CardContent>
    </Card>
  );
}

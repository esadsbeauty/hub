import { AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currency } from "@/modules/crm/utils/formatters";
import type { AnalyticsResult } from "../analytics-service";

export function ForecastCard({ analytics }: { analytics: AnalyticsResult }) {
  return (
    <Card className="border-champagne/60">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Forecast · {analytics.range.label}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Oportunidades abertas com previsão de fechamento no período.
            </p>
          </div>
          <TrendingUp className="text-champagne-dark" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Bruto</p>
            <b className="text-2xl">
              {currency.format(analytics.forecast.value)}
            </b>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ponderado</p>
            <b className="text-2xl">
              {currency.format(analytics.forecast.weighted)}
            </b>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Oportunidades</p>
            <b className="text-2xl">{analytics.forecast.count}</b>
          </div>
        </div>
        {analytics.attention.withoutCloseDate.length > 0 && (
          <div className="mt-5 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle size={17} className="shrink-0" />
            {analytics.attention.withoutCloseDate.length} oportunidades abertas
            não possuem previsão de fechamento.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

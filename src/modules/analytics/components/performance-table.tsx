import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currency } from "@/modules/crm/utils/formatters";
import type { PerformanceRow } from "../types";

const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});
export function PerformanceTable({
  title,
  rows,
  source = false,
}: {
  title: string;
  rows: PerformanceRow[];
  source?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {source ? (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-y bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Origem</th>
                <th>Oportunidades</th>
                <th>Pipeline gerado</th>
                <th>Ganhos</th>
                <th>Valor ganho</th>
                <th>Win rate</th>
                <th>Ticket médio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b">
                  <td className="px-4 py-3 font-semibold">{row.label}</td>
                  <td>{row.created}</td>
                  <td>{currency.format(row.generated)}</td>
                  <td>{row.won}</td>
                  <td>{currency.format(row.wonValue)}</td>
                  <td>
                    {row.winRate === undefined
                      ? "—"
                      : percent.format(row.winRate)}
                  </td>
                  <td>
                    {row.averageTicket === undefined
                      ? "—"
                      : currency.format(row.averageTicket)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[850px] text-sm">
            <thead className="border-y bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Responsável</th>
                <th>Abertas</th>
                <th>Pipeline</th>
                <th>Ponderado</th>
                <th>Ganhos</th>
                <th>Valor ganho</th>
                <th>Perdidos</th>
                <th>Win rate</th>
                <th>Ticket médio</th>
                <th>Ciclo médio</th>
                <th>Follow-ups atrasados</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b">
                  <td className="px-4 py-3 font-semibold">{row.label}</td>
                  <td>{row.open}</td>
                  <td>{currency.format(row.pipeline)}</td>
                  <td>{currency.format(row.weighted)}</td>
                  <td>{row.won}</td>
                  <td>{currency.format(row.wonValue)}</td>
                  <td>{row.lost}</td>
                  <td>
                    {row.winRate === undefined
                      ? "—"
                      : percent.format(row.winRate)}
                  </td>
                  <td>
                    {row.averageTicket === undefined
                      ? "—"
                      : currency.format(row.averageTicket)}
                  </td>
                  <td>
                    {row.averageCycleDays === undefined
                      ? "—"
                      : `${row.averageCycleDays.toFixed(1)} dias`}
                  </td>
                  <td>{row.overdueFollowups ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!rows.length && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhum dado disponível para o período.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

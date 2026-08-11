import { useState } from "react";
import {
  CircleDollarSign,
  Clock3,
  Percent,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/shared/components/layout/page-container";
import { PageHeader } from "@/shared/components/layout/page-header";
import { ErrorState, Skeleton } from "@/shared/components/feedback/states";
import { Tabs } from "@/shared/components/navigation/tabs";
import { currency } from "@/modules/crm/utils/formatters";
import { AnalyticsFiltersBar } from "@/modules/analytics/components/analytics-filters";
import { AnalyticsMetric } from "@/modules/analytics/components/analytics-metric";
import { ForecastCard } from "@/modules/analytics/components/forecast-card";
import {
  OpportunityDrilldown,
  type Drilldown,
} from "@/modules/analytics/components/opportunity-drilldown";
import { PerformanceTable } from "@/modules/analytics/components/performance-table";
import { PipelineOverview } from "@/modules/analytics/components/pipeline-overview";
import { useAnalytics } from "@/modules/analytics/use-analytics";
import { useAnalyticsFilters } from "@/modules/analytics/use-analytics-filters";
import { zonedDateKey } from "@/modules/analytics/analytics-service";
import { useCrmData } from "@/modules/crm/hooks";

type ReportTab =
  | "overview"
  | "pipeline"
  | "conversion"
  | "sales"
  | "owners"
  | "sources"
  | "losses"
  | "activities";
const tabs: { value: ReportTab; label: string }[] = [
  { value: "overview", label: "Visão geral" },
  { value: "pipeline", label: "Pipeline" },
  { value: "conversion", label: "Conversão" },
  { value: "sales", label: "Vendas" },
  { value: "owners", label: "Responsáveis" },
  { value: "sources", label: "Origens" },
  { value: "losses", label: "Perdas" },
  { value: "activities", label: "Atividades" },
];
const percentage = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function ReportsPage() {
  const crm = useCrmData();
  const [filters, setFilters] = useAnalyticsFilters(
    crm.data?.organization.timezone ?? "America/Sao_Paulo",
  );
  const report = useAnalytics(filters, "reports");
  const [tab, setTab] = useState<ReportTab>("overview");
  const [drilldown, setDrilldown] = useState<Drilldown>();
  if (crm.isError || report.isError)
    return (
      <PageContainer>
        <ErrorState
          retry={() => {
            void crm.refetch();
            void report.refetch();
          }}
        />
      </PageContainer>
    );
  if (!crm.data || !report.analytics)
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-96" />
        </div>
      </PageContainer>
    );
  const analytics = report.analytics;
  const open = (title: string, opportunities: Drilldown["opportunities"]) =>
    setDrilldown({ title, opportunities });
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Revenue Operations"
        title="Relatórios Comerciais"
        description="Indicadores auditáveis de pipeline, vendas ganhas, forecast e performance. Vendas não representam recebimentos financeiros."
      />
      <div className="mt-5 space-y-4">
        <AnalyticsFiltersBar
          data={crm.data}
          filters={filters}
          onChange={setFilters}
        />
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>
      <div className="mt-6 space-y-6">
        {tab === "overview" && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AnalyticsMetric
                label="Pipeline gerado"
                value={currency.format(analytics.generated.value)}
                detail={`${analytics.generated.count} oportunidades criadas`}
                definition="Soma do valor das oportunidades criadas no período."
                icon={TrendingUp}
                onClick={() =>
                  open("Pipeline gerado", analytics.generated.opportunities)
                }
              />
              <AnalyticsMetric
                label="Vendas ganhas"
                value={currency.format(analytics.won.value)}
                detail={`${analytics.won.count} negócios por won_at`}
                definition="Valor de oportunidades ganhas no período; não representa receita recebida."
                icon={CircleDollarSign}
                onClick={() =>
                  open("Vendas ganhas", analytics.won.opportunities)
                }
              />
              <AnalyticsMetric
                label="Ticket médio"
                value={
                  analytics.averageTicket === undefined
                    ? "—"
                    : currency.format(analytics.averageTicket)
                }
                detail="Valor ganho ÷ negócios ganhos"
                definition="Média do valor das oportunidades ganhas no período."
              />
              <AnalyticsMetric
                label="Ciclo médio"
                value={
                  analytics.averageCycleDays === undefined
                    ? "—"
                    : `${analytics.averageCycleDays.toFixed(1)} dias`
                }
                detail="won_at − created_at"
                definition="Tempo médio entre criação e ganho das oportunidades ganhas no período."
                icon={Clock3}
              />
            </section>
            <div className="grid gap-6 xl:grid-cols-2">
              <PipelineOverview analytics={analytics} />
              <ForecastCard analytics={analytics} />
            </div>
          </>
        )}
        {tab === "pipeline" && (
          <>
            <PipelineOverview analytics={analytics} />
            <StageAnalysis analytics={analytics} />
            <PipelinePerformance analytics={analytics} />
          </>
        )}
        {tab === "conversion" && <ConversionFunnel analytics={analytics} />}
        {tab === "sales" && (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <AnalyticsMetric
                label="Valor ganho"
                value={currency.format(analytics.won.value)}
                detail={`${analytics.won.count} negócios`}
                definition="Oportunidades com status ganho por won_at no período."
                icon={TrendingUp}
                onClick={() =>
                  open("Vendas ganhas", analytics.won.opportunities)
                }
              />
              <AnalyticsMetric
                label="Win rate"
                value={
                  analytics.winRate === undefined
                    ? "—"
                    : percentage.format(analytics.winRate)
                }
                detail={`${analytics.won.count} ganhas · ${analytics.lost.count} perdidas`}
                definition="Ganhas ÷ (ganhas + perdidas), por data de encerramento."
                icon={Percent}
              />
              <AnalyticsMetric
                label="Valor perdido"
                value={currency.format(analytics.lost.value)}
                detail={`${analytics.lost.count} negócios`}
                definition="Oportunidades perdidas por lost_at no período."
                icon={TrendingDown}
                onClick={() =>
                  open("Negócios perdidos", analytics.lost.opportunities)
                }
              />
            </section>
            <SalesTrend analytics={analytics} />
          </>
        )}
        {tab === "owners" && (
          <PerformanceTable
            title="Performance por responsável"
            rows={analytics.ownerRows}
          />
        )}
        {tab === "sources" && (
          <PerformanceTable
            title="Performance por origem"
            rows={analytics.sourceRows}
            source
          />
        )}
        {tab === "losses" && (
          <LostReasons analytics={analytics} onOpen={open} />
        )}
        {tab === "activities" && (
          <ActivityReport
            data={crm.data}
            filters={filters}
            opportunityIds={
              new Set(analytics.filteredOpportunities.map((item) => item.id))
            }
            from={analytics.range.from}
            to={analytics.range.to}
            timezone={crm.data.organization.timezone}
          />
        )}
      </div>
      <OpportunityDrilldown
        drilldown={drilldown}
        companies={crm.data.companies}
        onClose={() => setDrilldown(undefined)}
      />
    </PageContainer>
  );
}

function StageAnalysis({
  analytics,
}: {
  analytics: NonNullable<ReturnType<typeof useAnalytics>["analytics"]>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Aging por etapa</CardTitle>
        <p className="text-sm text-muted-foreground">
          Média observada entre entrada e próxima mudança. Sem threshold
          arbitrário de gargalo.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {analytics.stageRows.map((row) => (
          <div key={row.stage.id} className="rounded-xl border p-4">
            <div className="flex justify-between">
              <b>{row.stage.name}</b>
              <span>
                {row.averageDays === undefined
                  ? "Sem histórico suficiente"
                  : `${row.averageDays.toFixed(1)} dias`}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.count} abertas · {currency.format(row.value)} concentrados
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
function PipelinePerformance({
  analytics,
}: {
  analytics: NonNullable<ReturnType<typeof useAnalytics>["analytics"]>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparativo de pipelines</CardTitle>
        <p className="text-sm text-muted-foreground">
          Métricas comparativas sem classificação automática de desempenho.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-y bg-muted/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Pipeline</th>
              <th>Abertas</th>
              <th>Valor aberto</th>
              <th>Ponderado</th>
              <th>Ganhos</th>
              <th>Valor ganho</th>
              <th>Win rate</th>
            </tr>
          </thead>
          <tbody>
            {analytics.pipelineRows.map((row) => (
              <tr key={row.key} className="border-b">
                <td className="px-4 py-3 font-semibold">{row.label}</td>
                <td>{row.open}</td>
                <td>{currency.format(row.pipeline)}</td>
                <td>{currency.format(row.weighted)}</td>
                <td>{row.won}</td>
                <td>{currency.format(row.wonValue)}</td>
                <td>
                  {row.winRate === undefined
                    ? "—"
                    : percentage.format(row.winRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
function ConversionFunnel({
  analytics,
}: {
  analytics: NonNullable<ReturnType<typeof useAnalytics>["analytics"]>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil por histórico de etapas</CardTitle>
        <p className="text-sm text-muted-foreground">
          Entradas e avanços são derivados de opportunity_stage_history, não da
          etapa atual.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {analytics.stageRows.map((row) => {
          const rate = row.entered ? row.advanced / row.entered : undefined;
          return (
            <div
              key={row.stage.id}
              className="grid gap-2 rounded-xl border p-4 md:grid-cols-[1fr_auto_auto_auto]"
            >
              <b>{row.stage.name}</b>
              <span>{row.entered} entraram</span>
              <span>{row.advanced} avançaram</span>
              <span>
                {rate === undefined
                  ? "—"
                  : `${percentage.format(rate)} · ${percentage.format(1 - rate)} drop-off`}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
function SalesTrend({
  analytics,
}: {
  analytics: NonNullable<ReturnType<typeof useAnalytics>["analytics"]>;
}) {
  const max = Math.max(
    ...analytics.salesTrend.flatMap((item) => [item.generated, item.won]),
    1,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline gerado × valor ganho</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {analytics.salesTrend.map((item) => (
          <div
            key={item.key}
            className="grid items-center gap-2 text-sm md:grid-cols-[7rem_1fr_1fr]"
          >
            <b>{item.key.split("-").reverse().join("/")}</b>
            <div>
              <p className="text-xs text-muted-foreground">
                Gerado · {currency.format(item.generated)}
              </p>
              <div className="h-2 rounded bg-muted">
                <div
                  className="h-2 rounded bg-champagne"
                  style={{ width: `${(item.generated / max) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Ganho · {currency.format(item.won)}
              </p>
              <div className="h-2 rounded bg-muted">
                <div
                  className="h-2 rounded bg-emerald-600"
                  style={{ width: `${(item.won / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
        {!analytics.salesTrend.length && (
          <p className="text-sm text-muted-foreground">
            Nenhuma oportunidade criada ou ganha no período.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
function LostReasons({
  analytics,
  onOpen,
}: {
  analytics: NonNullable<ReturnType<typeof useAnalytics>["analytics"]>;
  onOpen: (title: string, opportunities: Drilldown["opportunities"]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Motivos de perda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {analytics.lostReasons.map((item) => (
          <button
            key={item.reason}
            className="grid w-full gap-2 rounded-xl border p-4 text-left md:grid-cols-[1fr_auto_auto_auto]"
            onClick={() => onOpen(`Perdas · ${item.label}`, item.opportunities)}
          >
            <b>{item.label}</b>
            <span>{item.count} negócios</span>
            <span>{percentage.format(item.percentage)}</span>
            <b>{currency.format(item.value)}</b>
          </button>
        ))}
        {!analytics.lostReasons.length && (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum negócio perdido neste período.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
function ActivityReport({
  data,
  filters,
  opportunityIds,
  from,
  to,
  timezone,
}: {
  data: NonNullable<ReturnType<typeof useCrmData>["data"]>;
  filters: Parameters<typeof useAnalytics>[0];
  opportunityIds: Set<string>;
  from: string;
  to: string;
  timezone: string;
}) {
  const events = data.events.filter((item) => {
    const key = zonedDateKey(item.createdAt, timezone);
    const commercialFilter =
      !filters.pipelineId && !filters.ownerId && !filters.source
        ? true
        : Boolean(item.opportunityId && opportunityIds.has(item.opportunityId));
    return key >= from && key <= to && commercialFilter;
  });
  const tasks = data.tasks.filter((item) => {
    const key = zonedDateKey(item.dueAt, timezone);
    const ownerMatch = !filters.ownerId || item.assignedTo === filters.ownerId;
    const commercialMatch =
      !filters.pipelineId && !filters.source
        ? true
        : Boolean(item.opportunityId && opportunityIds.has(item.opportunityId));
    return key >= from && key <= to && ownerMatch && commercialMatch;
  });
  const rows = [
    {
      label: "Follow-ups concluídos",
      value: events.filter((item) => item.type === "followup_completed").length,
    },
    {
      label: "Reuniões realizadas",
      value: events.filter((item) => item.type === "meeting_completed").length,
    },
    {
      label: "Ligações registradas",
      value: events.filter((item) => item.type === "call_completed").length,
    },
    {
      label: "Tarefas concluídas",
      value: events.filter((item) => item.type === "task_completed").length,
    },
    {
      label: "Follow-ups atrasados",
      value: tasks.filter(
        (item) =>
          item.type === "follow_up" &&
          item.status === "pending" &&
          new Date(item.dueAt) < new Date(),
      ).length,
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Execução comercial</CardTitle>
        <p className="text-sm text-muted-foreground">
          Volume operacional contextual; não representa isoladamente performance
          de vendas.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border p-4">
            <b className="text-2xl">{row.value}</b>
            <p className="text-xs text-muted-foreground">{row.label}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

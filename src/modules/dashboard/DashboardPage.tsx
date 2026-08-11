import { useState } from "react";
import {
  CircleDollarSign,
  Handshake,
  Percent,
  Target,
  TrendingUp,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/shared/components/layout/page-container";
import { PageHeader } from "@/shared/components/layout/page-header";
import { ErrorState, Skeleton } from "@/shared/components/feedback/states";
import { ActivityTimeline } from "@/modules/crm/components/activity-timeline";
import { TaskCard } from "@/modules/crm/components/task-card";
import {
  useCrmActions,
  useCrmData,
  useOverdueTasks,
  useTasksRange,
} from "@/modules/crm/hooks";
import { currency } from "@/modules/crm/utils/formatters";
import { AnalyticsFiltersBar } from "@/modules/analytics/components/analytics-filters";
import { AnalyticsMetric } from "@/modules/analytics/components/analytics-metric";
import { AttentionPanel } from "@/modules/analytics/components/attention-panel";
import { ForecastCard } from "@/modules/analytics/components/forecast-card";
import {
  OpportunityDrilldown,
  type Drilldown,
} from "@/modules/analytics/components/opportunity-drilldown";
import { PipelineOverview } from "@/modules/analytics/components/pipeline-overview";
import { useAnalytics } from "@/modules/analytics/use-analytics";
import { useAnalyticsFilters } from "@/modules/analytics/use-analytics-filters";

const percentage = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});
function variation(current: number, previous: number) {
  if (!previous) return current ? "Sem base equivalente anterior" : undefined;
  const value = (current - previous) / previous;
  return `${value >= 0 ? "+" : ""}${percentage.format(value)} vs. período anterior`;
}

export function DashboardPage() {
  const crm = useCrmData();
  const location = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useAnalyticsFilters(
    crm.data?.organization.timezone ?? "America/Sao_Paulo",
  );
  const report = useAnalytics(filters);
  const [drilldown, setDrilldown] = useState<Drilldown>();
  const actions = useCrmActions();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const today = useTasksRange(start.toISOString(), end.toISOString());
  const overdue = useOverdueTasks(start.toISOString());
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
  if (!crm.data || !report.analytics || crm.isLoading)
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-80" />
        </div>
      </PageContainer>
    );
  const analytics = report.analytics;
  const pendingToday = (today.data ?? []).filter(
    (task) => task.status === "pending",
  );
  const open = (title: string, opportunities: Drilldown["opportunities"]) =>
    setDrilldown({ title, opportunities });
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Central de inteligência comercial"
        title="Dashboard Executivo"
        description="Como estamos, o que precisa de atenção e o que provavelmente acontecerá."
        actions={
          <Link
            className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-muted"
            to={`/relatorios${location.search}`}
          >
            Abrir relatórios
          </Link>
        }
      />
      <div className="mt-5">
        <AnalyticsFiltersBar
          data={crm.data}
          filters={filters}
          onChange={setFilters}
        />
      </div>
      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AnalyticsMetric
          label="Pipeline aberto"
          value={currency.format(analytics.pipeline.value)}
          detail={`${analytics.pipeline.count} oportunidades abertas`}
          definition="Soma do valor das oportunidades abertas; exclui ganhas, perdidas, arquivadas e removidas."
          icon={Handshake}
          onClick={() =>
            open("Pipeline aberto", analytics.pipeline.opportunities)
          }
        />
        <AnalyticsMetric
          label="Pipeline ponderado"
          value={currency.format(analytics.weighted.value)}
          detail="Valor × probabilidade das oportunidades abertas"
          definition="Soma do valor de cada oportunidade aberta multiplicado por sua probabilidade de fechamento."
          icon={CircleDollarSign}
          onClick={() =>
            open("Pipeline ponderado", analytics.weighted.opportunities)
          }
        />
        <AnalyticsMetric
          label="Vendas ganhas"
          value={currency.format(analytics.won.value)}
          detail={`${analytics.won.count} negócios por won_at · ${analytics.range.label}`}
          definition="Valor das oportunidades ganhas cuja data de ganho está no período selecionado. Não representa recebimento financeiro."
          comparison={variation(
            analytics.won.value,
            analytics.previousWonValue,
          )}
          icon={TrendingUp}
          onClick={() => open("Vendas ganhas", analytics.won.opportunities)}
        />
        <AnalyticsMetric
          label="Win rate"
          value={
            analytics.winRate === undefined
              ? "—"
              : percentage.format(analytics.winRate)
          }
          detail={`${analytics.won.count} ganhas · ${analytics.lost.count} perdidas`}
          definition="Negócios ganhos divididos pelo total de ganhos e perdidos encerrados no período."
          icon={Percent}
          onClick={() =>
            open("Negócios encerrados", [
              ...analytics.won.opportunities,
              ...analytics.lost.opportunities,
            ])
          }
        />
        <AnalyticsMetric
          label="Follow-ups atrasados"
          value={String(analytics.attention.overdueFollowups.length)}
          detail="Pendentes com due_at anterior a agora"
          definition="Follow-ups pendentes cujo prazo já venceu."
          icon={Target}
          onClick={() => navigate("/agenda")}
        />
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <PipelineOverview analytics={analytics} />
        <ForecastCard analytics={analytics} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <AttentionPanel
          analytics={analytics}
          onOpen={(title, ids) =>
            open(
              title,
              crm.data.opportunities.filter((item) => ids.includes(item.id)),
            )
          }
        />
        <Card>
          <CardHeader>
            <CardTitle>Insights objetivos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="rounded-xl bg-muted p-3">
              As 3 maiores oportunidades representam{" "}
              <b>{percentage.format(analytics.concentration)}</b> do pipeline
              aberto.
            </p>
            <p className="rounded-xl bg-muted p-3">
              <b>{analytics.attention.withoutNextStep.length}</b> oportunidades
              abertas não possuem tarefa futura vinculada.
            </p>
            <p className="rounded-xl bg-muted p-3">
              <b>{analytics.attention.overdueCloseDate.length}</b> oportunidades
              estão com previsão de fechamento vencida.
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Agenda de hoje</CardTitle>
            <Link
              className="text-sm font-semibold text-champagne-dark"
              to="/agenda"
            >
              Ver agenda completa
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {today.isLoading ? (
              <Skeleton className="h-32" />
            ) : pendingToday.length ? (
              pendingToday
                .slice(0, 4)
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    compact
                    onComplete={() => actions.completeTask.mutate(task.id)}
                  />
                ))
            ) : (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Você não possui atividades agendadas para hoje.
              </p>
            )}
            {(overdue.data?.length ?? 0) > 0 && (
              <Link
                className="block rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900"
                to="/agenda"
              >
                {overdue.data?.length} atividades atrasadas — revisar agora
              </Link>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Atividades recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimeline events={crm.data.events.slice(0, 8)} compact />
          </CardContent>
        </Card>
      </div>
      <OpportunityDrilldown
        drilldown={drilldown}
        companies={crm.data.companies}
        onClose={() => setDrilldown(undefined)}
      />
    </PageContainer>
  );
}

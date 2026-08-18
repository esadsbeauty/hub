import { useState } from "react";
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
  const activeClients = crm.data.companies.filter((company) => company.lifecycleStage === "customer" && !company.deletedAt).length;
  const compactCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 0 }).format(value);
  return (
    <PageContainer>
      <PageHeader title="Dashboard" description="Visão geral da sua operação." actions={<Link className="text-sm font-medium text-muted-foreground hover:text-foreground" to={`/relatorios${location.search}`}>Ver relatórios</Link>} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-xl bg-card px-3 py-2 text-sm font-medium shadow-soft">{analytics.range.label}</span>
        <details className="group relative">
          <summary className="cursor-pointer list-none rounded-xl border border-border/70 bg-card px-3 py-2 text-sm font-medium hover:bg-muted">Filtros</summary>
          <div className="mt-2 rounded-2xl bg-card p-3 shadow-overlay xl:absolute xl:left-0 xl:z-10 xl:w-[62rem]"><AnalyticsFiltersBar data={crm.data} filters={filters} onChange={setFilters}/></div>
        </details>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsMetric label="Pipeline" value={compactCurrency(analytics.pipeline.value)} detail={`${analytics.pipeline.count} oportunidades abertas`} definition="Soma das oportunidades abertas." onClick={() => open("Pipeline aberto", analytics.pipeline.opportunities)} />
        <AnalyticsMetric label="Vendas no período" value={compactCurrency(analytics.won.value)} detail={`${analytics.won.count} negócios ganhos`} definition="Valor comercial ganho no período; não representa recebimento." comparison={variation(analytics.won.value, analytics.previousWonValue)} onClick={() => open("Vendas ganhas", analytics.won.opportunities)} />
        <AnalyticsMetric label="Follow-ups" value={String(analytics.attention.overdueFollowups.length)} detail="atrasados" definition="Follow-ups pendentes com prazo vencido." onClick={() => navigate("/agenda")} />
        <AnalyticsMetric label="Clientes" value={String(activeClients)} detail="ativos no relacionamento" definition="Empresas na etapa de relacionamento com clientes." onClick={() => navigate("/clientes")} />
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <PipelineOverview analytics={analytics}/>
        <Card><CardHeader><CardTitle>Agenda de hoje</CardTitle></CardHeader><CardContent className="space-y-3">{today.isLoading?<Skeleton className="h-32"/>:pendingToday.length?pendingToday.slice(0,4).map((task)=><TaskCard key={task.id} task={task} compact onComplete={()=>actions.completeTask.mutate(task.id)}/>):<p className="py-8 text-center text-sm text-muted-foreground">Nenhuma atividade para hoje.</p>}{(overdue.data?.length??0)>0&&<Link className="block rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900" to="/agenda">{overdue.data?.length} atividades atrasadas</Link>}</CardContent></Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <Card><CardHeader><CardTitle>Performance comercial</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Pipeline ponderado</p><p className="mt-1 text-xl font-semibold">{compactCurrency(analytics.weighted.value)}</p></div><div><p className="text-xs text-muted-foreground">Win rate</p><p className="mt-1 text-xl font-semibold">{analytics.winRate===undefined?"—":percentage.format(analytics.winRate)}</p></div><div><p className="text-xs text-muted-foreground">Ticket médio</p><p className="mt-1 text-xl font-semibold">{analytics.averageTicket===undefined?"—":compactCurrency(analytics.averageTicket)}</p></div><div><p className="text-xs text-muted-foreground">Ciclo médio</p><p className="mt-1 text-xl font-semibold">{analytics.averageCycleDays===undefined?"—":`${Math.round(analytics.averageCycleDays)} dias`}</p></div></CardContent></Card>
        <ForecastCard analytics={analytics}/>
      </div>
      <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]"><AttentionPanel analytics={analytics} onOpen={(title,ids)=>open(title,crm.data.opportunities.filter((item)=>ids.includes(item.id)))}/><Card><CardHeader><CardTitle>Atividades recentes</CardTitle></CardHeader><CardContent><ActivityTimeline events={crm.data.events.slice(0,8)} compact/></CardContent></Card></div>
      <details className="rounded-2xl bg-card shadow-soft"><summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium">Mais indicadores e insights</summary><div className="grid gap-4 border-t border-border/50 p-5 text-sm text-muted-foreground md:grid-cols-3"><p>As 3 maiores oportunidades representam <b className="text-foreground">{percentage.format(analytics.concentration)}</b> do pipeline.</p><p><b className="text-foreground">{analytics.attention.withoutNextStep.length}</b> oportunidades não possuem próximo passo.</p><p><b className="text-foreground">{analytics.attention.overdueCloseDate.length}</b> oportunidades estão com fechamento previsto em atraso.</p></div></details>
      <OpportunityDrilldown drilldown={drilldown} companies={crm.data.companies} onClose={()=>setDrilldown(undefined)}/>
    </PageContainer>
  );
}

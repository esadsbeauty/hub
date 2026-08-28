import { useState } from "react";
import { ArrowRight, CalendarPlus, Clock3, SlidersHorizontal, X } from "lucide-react";
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const actions = useCrmActions();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
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
  const pendingToday = crm.data.tasks.filter(
    (task) => task.dueAt >= start.toISOString() && task.dueAt < end.toISOString() && task.status === "pending",
  );
  const overdue = crm.data.tasks.filter(
    (task) => task.dueAt < start.toISOString() && task.status === "pending",
  );
  const open = (title: string, opportunities: Drilldown["opportunities"]) =>
    setDrilldown({ title, opportunities });
  const activeClients = crm.data.companies.filter((company) => company.lifecycleStage === "customer" && !company.deletedAt).length;
  const compactCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 0 }).format(value);
  return (
    <PageContainer>
      <div className="md:hidden"><p className="text-[15px] font-medium text-muted-foreground">Sua operação hoje</p><div className="mt-1 flex items-end justify-between gap-3"><h1 className="text-[2.125rem] font-semibold leading-tight tracking-[-.05em]">Dashboard</h1><Link className="pb-1 text-sm font-semibold" to="/agenda">Ver agenda</Link></div></div>
      <div className="hidden md:block"><PageHeader title="Dashboard" description="Visão geral da sua operação." actions={<Link className="text-sm font-medium text-muted-foreground hover:text-foreground" to={`/relatorios${location.search}`}>Ver relatórios</Link>} /></div>
      <div className="flex items-center gap-2">
        <span className="rounded-xl bg-card px-3.5 py-2.5 text-[15px] font-medium shadow-soft">{analytics.range.label}</span>
        <button onClick={() => setMobileFiltersOpen(true)} className="ml-auto inline-flex min-h-[3.25rem] items-center gap-2 rounded-xl border border-border/70 bg-card px-4 text-[15px] font-semibold md:hidden"><SlidersHorizontal size={17}/> Filtros</button>
        <details className="group relative hidden md:block">
          <summary className="cursor-pointer list-none rounded-xl border border-border/70 bg-card px-3 py-2 text-sm font-medium hover:bg-muted">Filtros</summary>
          <div className="mt-2 rounded-2xl bg-card p-3 shadow-overlay xl:absolute xl:left-0 xl:z-10 xl:w-[62rem]"><AnalyticsFiltersBar data={crm.data} filters={filters} onChange={setFilters}/></div>
        </details>
      </div>
      {mobileFiltersOpen && <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] md:hidden" onClick={() => setMobileFiltersOpen(false)}><section role="dialog" aria-modal="true" aria-label="Filtros do dashboard" className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-auto rounded-t-[2rem] bg-card px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]" onClick={(event)=>event.stopPropagation()}><div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-border"/><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Dashboard</p><h2 className="mt-1 text-2xl font-semibold">Filtros</h2></div><button aria-label="Fechar filtros" className="grid h-11 w-11 place-items-center rounded-xl bg-muted" onClick={()=>setMobileFiltersOpen(false)}><X size={20}/></button></div><AnalyticsFiltersBar data={crm.data} filters={filters} onChange={setFilters}/><button className="mt-5 min-h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground" onClick={()=>setMobileFiltersOpen(false)}>Aplicar filtros</button></section></div>}
      <section aria-label="Indicadores do dashboard" className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-5 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4">
        <div className="min-w-[84vw] snap-center md:min-w-0"><AnalyticsMetric label="Pipeline" value={compactCurrency(analytics.pipeline.value)} detail={`${analytics.pipeline.count} oportunidades abertas`} definition="Soma das oportunidades abertas." onClick={() => open("Pipeline aberto", analytics.pipeline.opportunities)} /></div>
        <div className="min-w-[84vw] snap-center md:min-w-0"><AnalyticsMetric label="Vendas no período" value={compactCurrency(analytics.won.value)} detail={`${analytics.won.count} negócios ganhos`} definition="Valor comercial ganho no período; não representa recebimento." comparison={variation(analytics.won.value, analytics.previousWonValue)} onClick={() => open("Vendas ganhas", analytics.won.opportunities)} /></div>
        <div className="min-w-[84vw] snap-center md:min-w-0"><AnalyticsMetric label="Follow-ups" value={String(analytics.attention.overdueFollowups.length)} detail="atrasados" definition="Follow-ups pendentes com prazo vencido." onClick={() => navigate("/agenda")} /></div>
        <div className="min-w-[84vw] snap-center md:min-w-0"><AnalyticsMetric label="Clientes" value={String(activeClients)} detail="ativos no relacionamento" definition="Empresas na etapa de relacionamento com clientes." onClick={() => navigate("/clientes")} /></div>
      </section>
      <Card className="md:hidden"><CardHeader className="flex-row items-center justify-between"><div><p className="text-[13px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Prioridade</p><CardTitle className="mt-1">Agenda de hoje</CardTitle></div><Link aria-label="Criar atividade" to="/agenda?new=task" className="grid h-[3.25rem] w-[3.25rem] place-items-center rounded-2xl bg-champagne-soft"><CalendarPlus size={23}/></Link></CardHeader><CardContent className="space-y-4 sm:space-y-3">{pendingToday.length?pendingToday.slice(0,3).map((task)=><TaskCard key={task.id} task={task} compact onComplete={()=>actions.completeTask.mutate(task.id)}/>):<div className="rounded-2xl bg-muted/55 px-5 py-8 text-center"><p className="font-semibold">Nenhuma atividade para hoje</p><p className="mt-1.5 text-[15px] leading-6 text-muted-foreground">Aproveite para organizar o próximo contato.</p><Link to="/agenda?new=task" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-card px-4 text-sm font-semibold shadow-soft">Nova tarefa</Link></div>}<Link className="flex min-h-[3.25rem] items-center justify-between border-t border-border/60 pt-3 text-[15px] font-semibold" to="/agenda">Abrir agenda <ArrowRight size={18}/></Link></CardContent></Card>
      <Link to="/agenda" className="flex min-h-[5.75rem] items-center gap-4 rounded-[1.25rem] bg-primary p-5 text-primary-foreground shadow-soft md:hidden"><span className="grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-2xl bg-white/10"><Clock3 size={24}/></span><span className="min-w-0 flex-1"><b className="block text-[17px]">Follow-ups</b><span className="text-[15px] leading-5 text-white/65">{overdue.length} atrasados · {pendingToday.filter((task)=>task.type === "follow_up").length} para hoje</span></span><ArrowRight size={20}/></Link>
      <Card className="md:hidden"><CardHeader><CardTitle>Pipeline resumido</CardTitle></CardHeader><CardContent className="space-y-3">{crm.data.stages.slice(0,3).map(stage=>{const count=crm.data.opportunities.filter(item=>item.stageId===stage.id&&item.status==="open"&&!item.deletedAt).length;return <div key={stage.id} className="flex min-h-14 items-center justify-between rounded-xl bg-muted/60 px-4"><span className="text-base font-semibold">{stage.name}</span><span className="text-base text-muted-foreground">{count}</span></div>})}<Link className="flex min-h-14 items-center justify-between border-t pt-3 text-base font-semibold" to="/crm">Ver pipeline <ArrowRight size={20}/></Link></CardContent></Card>
      <div className="md:hidden"><ForecastCard analytics={analytics}/></div>
      <Card className="md:hidden"><CardHeader><CardTitle>Performance</CardTitle></CardHeader><CardContent className="grid gap-4"><div><p className="text-base text-muted-foreground">Pipeline ponderado</p><p className="mt-1 text-2xl font-semibold">{compactCurrency(analytics.weighted.value)}</p></div><div><p className="text-base text-muted-foreground">Win rate</p><p className="mt-1 text-2xl font-semibold">{analytics.winRate===undefined?"—":percentage.format(analytics.winRate)}</p></div></CardContent></Card>
      <div className="hidden gap-6 md:grid xl:grid-cols-[1.15fr_.85fr]">
        <PipelineOverview analytics={analytics}/>
        <Card><CardHeader><CardTitle>Agenda de hoje</CardTitle></CardHeader><CardContent className="space-y-3">{pendingToday.length?pendingToday.slice(0,4).map((task)=><TaskCard key={task.id} task={task} compact onComplete={()=>actions.completeTask.mutate(task.id)}/>):<p className="py-8 text-center text-sm text-muted-foreground">Nenhuma atividade para hoje.</p>}{overdue.length>0&&<Link className="block rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900" to="/agenda">{overdue.length} atividades atrasadas</Link>}</CardContent></Card>
      </div>
      <div className="hidden gap-6 md:grid xl:grid-cols-[.8fr_1.2fr]">
        <Card><CardHeader><CardTitle>Performance comercial</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Pipeline ponderado</p><p className="mt-1 text-xl font-semibold">{compactCurrency(analytics.weighted.value)}</p></div><div><p className="text-xs text-muted-foreground">Win rate</p><p className="mt-1 text-xl font-semibold">{analytics.winRate===undefined?"—":percentage.format(analytics.winRate)}</p></div><div><p className="text-xs text-muted-foreground">Ticket médio</p><p className="mt-1 text-xl font-semibold">{analytics.averageTicket===undefined?"—":compactCurrency(analytics.averageTicket)}</p></div><div><p className="text-xs text-muted-foreground">Ciclo médio</p><p className="mt-1 text-xl font-semibold">{analytics.averageCycleDays===undefined?"—":`${Math.round(analytics.averageCycleDays)} dias`}</p></div></CardContent></Card>
        <ForecastCard analytics={analytics}/>
      </div>
      <div className="hidden gap-6 md:grid xl:grid-cols-[.9fr_1.1fr]"><AttentionPanel analytics={analytics} onOpen={(title,ids)=>open(title,crm.data.opportunities.filter((item)=>ids.includes(item.id)))}/><Card><CardHeader><CardTitle>Atividades recentes</CardTitle></CardHeader><CardContent><ActivityTimeline events={crm.data.events.slice(0,8)} compact/></CardContent></Card></div>
      <details className="rounded-[1.25rem] bg-card shadow-soft"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-base font-semibold md:text-sm">Mais indicadores e insights <ArrowRight size={18} className="text-muted-foreground"/></summary><div className="grid gap-4 border-t border-border/50 p-5 text-sm text-muted-foreground md:grid-cols-3"><p>As 3 maiores oportunidades representam <b className="text-foreground">{percentage.format(analytics.concentration)}</b> do pipeline.</p><p><b className="text-foreground">{analytics.attention.withoutNextStep.length}</b> oportunidades não possuem próximo passo.</p><p><b className="text-foreground">{analytics.attention.overdueCloseDate.length}</b> oportunidades estão com fechamento previsto em atraso.</p></div></details>
      <OpportunityDrilldown drilldown={drilldown} companies={crm.data.companies} onClose={()=>setDrilldown(undefined)}/>
    </PageContainer>
  );
}
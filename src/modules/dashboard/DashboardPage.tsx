import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Handshake,
  MessageCircle,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageContainer } from "@/shared/components/layout/page-container";
import { PageHeader } from "@/shared/components/layout/page-header";
import {
  ErrorState,
  Skeleton,
} from "@/shared/components/feedback/states";
import { TaskCard } from "@/modules/crm/components/task-card";
import {
  useCrmActions,
  useCrmData,
} from "@/modules/crm/hooks";
import { AnalyticsFiltersBar } from "@/modules/analytics/components/analytics-filters";
import { useAnalytics } from "@/modules/analytics/use-analytics";
import { useAnalyticsFilters } from "@/modules/analytics/use-analytics-filters";
import { OnboardingDashboardCard } from "@/modules/onboarding/OnboardingDashboardCard";
import { useOnboarding } from "@/modules/onboarding/hooks";
import { useAppState } from "@/shared/state/app-state-context";
import { useProspectingDashboardSummary } from "./use-prospecting-dashboard-summary";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 0,
  }).format(value);
}

export function DashboardPage() {
  const crm = useCrmData();
  const onboarding = useOnboarding();
  const { can } = useAppState();
  const location = useLocation();
  const navigate = useNavigate();

  const [filters, setFilters] = useAnalyticsFilters(
    crm.data?.organization.timezone ?? "America/Sao_Paulo",
  );
  const report = useAnalytics(filters);
  const prospecting = useProspectingDashboardSummary();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const actions = useCrmActions();

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  if (crm.isError || report.isError) {
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
  }

  if (!crm.data || !report.analytics || crm.isLoading) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-80" />
        </div>
      </PageContainer>
    );
  }

  if (
    can("settings.manage") &&
    onboarding.data &&
    !onboarding.data.state.introSeenAt &&
    !onboarding.data.state.completedAt
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  const analytics = report.analytics;

  const pendingToday = crm.data.tasks.filter(
    (task) =>
      task.dueAt >= start.toISOString() &&
      task.dueAt < end.toISOString() &&
      task.status === "pending",
  );

  const overdue = crm.data.tasks.filter(
    (task) =>
      task.dueAt < start.toISOString() &&
      task.status === "pending",
  );

  const activeClients = crm.data.companies.filter(
    (company) =>
      company.lifecycleStage === "customer" &&
      !company.deletedAt,
  ).length;

  const stageByName = new Map<string, string>();

  for (const stage of crm.data.stages) {
    stageByName.set(normalize(stage.name), stage.id);
  }

  const countStage = (names: string[]) => {
    const ids = names
      .map((name) => stageByName.get(normalize(name)))
      .filter((id): id is string => Boolean(id));

    return crm.data.opportunities.filter(
      (opportunity) =>
        opportunity.status === "open" &&
        !opportunity.deletedAt &&
        ids.includes(opportunity.stageId),
    ).length;
  };

  const newLeads = countStage([
    "Novo Lead",
    "Em atendimento",
  ]);

  const humanWaiting = countStage([
    "Atendimento humano",
  ]);

  const scheduled = countStage([
    "Agendado",
  ]);

  const defaultPipeline =
    crm.data.pipelines.find(
      (pipeline) => pipeline.isDefault,
    ) ?? crm.data.pipelines[0];

  const esadsPipelineStages =
    crm.data.organization.slug === "esads-beauty" &&
    defaultPipeline
      ? crm.data.stages
          .filter(
            (stage) =>
              stage.pipelineId === defaultPipeline.id &&
              stage.isActive !== false,
          )
          .sort(
            (a, b) =>
              a.position - b.position,
          )
      : [];

  const dashboardStages =
    esadsPipelineStages.length > 0
      ? esadsPipelineStages
      : [
          "Novo Lead",
          "Em atendimento",
          "Atendimento humano",
          "Agendado",
          "Compareceu",
          "Proposta",
          "Fechou",
        ]
          .map((name) =>
            crm.data.stages.find(
              (item) =>
                normalize(item.name) ===
                normalize(name),
            ),
          )
          .filter(
            (
              stage,
            ): stage is (typeof crm.data.stages)[number] =>
              Boolean(stage),
          );

  const keyStages = dashboardStages.map(
    (stage) => {
      const count =
        crm.data.opportunities.filter(
          (opportunity) =>
            opportunity.stageId === stage.id &&
            !opportunity.deletedAt &&
            opportunity.status !== "archived",
        ).length;

      return {
        id: stage.id,
        name: stage.name,
        count,
      };
    },
  );

  return (
    <PageContainer>
      <div className="md:hidden">
        <p className="text-[15px] font-medium text-muted-foreground">
          O que está acontecendo hoje
        </p>

        <div className="mt-1 flex items-end justify-between gap-3">
          <h1 className="text-[1.875rem] font-semibold leading-tight tracking-[-.05em]">
            Dashboard
          </h1>

          <Link
            className="pb-1 text-sm font-semibold"
            to="/agenda"
          >
            Ver agenda
          </Link>
        </div>
      </div>

      <div className="hidden md:block">
        <PageHeader
          title="Dashboard"
          description="Uma visão simples do atendimento e das vendas."
          actions={
            <Link
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              to={`/relatorios${location.search}`}
            >
              Ver relatórios
            </Link>
          }
        />
      </div>

      <OnboardingDashboardCard />

      <div className="flex items-center gap-2">
        <span className="rounded-xl bg-card px-3 py-2 text-sm font-medium shadow-soft">
          {analytics.range.label}
        </span>

        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="ml-auto inline-flex min-h-12 items-center gap-2 rounded-xl border border-border/70 bg-card px-3.5 text-sm font-semibold md:hidden"
        >
          <SlidersHorizontal size={17} />
          Filtros
        </button>

        <details className="group relative hidden md:block">
          <summary className="cursor-pointer list-none rounded-xl border border-border/70 bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
            Filtros
          </summary>

          <div className="mt-2 rounded-2xl bg-card p-3 shadow-overlay xl:absolute xl:left-0 xl:z-10 xl:w-[62rem]">
            <AnalyticsFiltersBar
              data={crm.data}
              filters={filters}
              onChange={setFilters}
            />
          </div>
        </details>
      </div>

      {mobileFiltersOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileFiltersOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Filtros do dashboard"
            className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-auto rounded-t-[2rem] bg-card px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-border" />

            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">
                  Dashboard
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  Filtros
                </h2>
              </div>

              <button
                aria-label="Fechar filtros"
                className="grid h-11 w-11 place-items-center rounded-xl bg-muted"
                onClick={() => setMobileFiltersOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <AnalyticsFiltersBar
              data={crm.data}
              filters={filters}
              onChange={setFilters}
            />

            <button
              className="mt-5 min-h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
              onClick={() => setMobileFiltersOpen(false)}
            >
              Aplicar filtros
            </button>
          </section>
        </div>
      )}

      <section
        aria-label="Resumo do negócio"
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          title="Leads em atendimento"
          value={String(newLeads)}
          detail="novos leads e conversas em andamento"
          icon={MessageCircle}
          onClick={() => navigate("/crm")}
        />

        <SummaryCard
          title="Precisam da sua equipe"
          value={String(humanWaiting)}
          detail={
            humanWaiting === 1
              ? "lead aguardando atendimento humano"
              : "leads aguardando atendimento humano"
          }
          icon={UserCheck}
          attention={humanWaiting > 0}
          onClick={() => navigate("/crm")}
        />

        <SummaryCard
          title="Agendados"
          value={String(scheduled)}
          detail="atendimentos com agendamento"
          icon={CalendarDays}
          onClick={() => navigate("/crm")}
        />

        <SummaryCard
          title="Vendas no período"
          value={compactCurrency(analytics.won.value)}
          detail={`${analytics.won.count} ${analytics.won.count === 1 ? "venda" : "vendas"}`}
          icon={Handshake}
          onClick={() => navigate("/relatorios")}
        />
      </section>

      {(humanWaiting > 0 || overdue.length > 0) && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-amber-700">
                Atenção agora
              </p>

              <h2 className="mt-1 text-lg font-semibold">
                {humanWaiting > 0
                  ? `${humanWaiting} ${humanWaiting === 1 ? "lead precisa" : "leads precisam"} de atendimento humano`
                  : `${overdue.length} ${overdue.length === 1 ? "atividade está atrasada" : "atividades estão atrasadas"}`}
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                {humanWaiting > 0
                  ? "A equipe já pode assumir essas conversas no CRM."
                  : "Abra a agenda e organize os próximos contatos."}
              </p>
            </div>

            <Button
              onClick={() =>
                navigate(
                  humanWaiting > 0
                    ? "/crm"
                    : "/agenda",
                )
              }
            >
              Ver agora
              <ArrowRight size={17} />
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>
                Como estão os seus leads
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Quantidade de pessoas em cada etapa principal.
              </p>
            </div>

            <Link
              className="text-sm font-semibold"
              to="/crm"
            >
              Abrir CRM
            </Link>
          </CardHeader>

          <CardContent>
            {keyStages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma etapa principal encontrada no CRM.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {keyStages.map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => navigate("/crm")}
                    className="flex min-h-16 items-center justify-between rounded-2xl border border-border/60 bg-background px-4 text-left transition hover:bg-muted/50"
                  >
                    <span className="text-sm font-semibold">
                      {stage.name}
                    </span>

                    <span className="grid h-9 min-w-9 place-items-center rounded-xl bg-muted px-2 text-base font-semibold">
                      {stage.count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>
                Agenda de hoje
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                O que precisa ser feito hoje.
              </p>
            </div>

            <Link
              className="text-sm font-semibold"
              to="/agenda"
            >
              Ver agenda
            </Link>
          </CardHeader>

          <CardContent className="space-y-3">
            {pendingToday.length ? (
              pendingToday
                .slice(0, 4)
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    compact
                    onComplete={() =>
                      actions.completeTask.mutate(task.id)
                    }
                  />
                ))
            ) : (
              <div className="rounded-2xl bg-muted/50 px-4 py-8 text-center">
                <CalendarDays
                  className="mx-auto text-muted-foreground"
                  size={25}
                />

                <p className="mt-3 font-semibold">
                  Nenhuma atividade para hoje
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Sua agenda está livre neste momento.
                </p>
              </div>
            )}

            {overdue.length > 0 && (
              <Link
                className="flex items-center justify-between rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900"
                to="/agenda"
              >
                <span>
                  {overdue.length}{" "}
                  {overdue.length === 1
                    ? "atividade atrasada"
                    : "atividades atrasadas"}
                </span>

                <ArrowRight size={17} />
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {prospecting.data && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">
                Prospecção
              </p>
              <CardTitle className="mt-1">
                Sua prospecção em andamento
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Acompanhe rapidamente o trabalho das listas e os leads que avançaram.
              </p>
            </div>

            <Link
              className="text-sm font-semibold"
              to="/prospeccao"
            >
              Abrir prospecção
            </Link>
          </CardHeader>

          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <ProspectingMetric
              label="Listas"
              value={prospecting.data.lists}
              detail="listas criadas"
            />

            <ProspectingMetric
              label="Leads"
              value={prospecting.data.leads}
              detail="contatos importados"
            />

            <ProspectingMetric
              label="Abordados"
              value={prospecting.data.contacted}
              detail="já receberam abordagem"
            />

            <ProspectingMetric
              label="Engajaram"
              value={prospecting.data.engaged}
              detail="responderam ou avançaram"
            />

            <ProspectingMetric
              label="Oportunidades"
              value={prospecting.data.opportunities}
              detail="viraram oportunidade"
            />
          </CardContent>
        </Card>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <QuickLink
          to="/whatsapp"
          icon={MessageCircle}
          title="Conversas"
          detail="Abrir o WhatsApp da equipe"
        />

        <QuickLink
          to="/clientes"
          icon={Users}
          title="Clientes"
          detail={`${activeClients} clientes ativos`}
        />

        <QuickLink
          to="/agenda"
          icon={Clock3}
          title="Acompanhamentos"
          detail={
            overdue.length > 0
              ? `${overdue.length} atrasados`
              : "Nenhum atraso"
          }
        />
      </section>
    </PageContainer>
  );
}

function SummaryCard({
  title,
  value,
  detail,
  icon: Icon,
  onClick,
  attention = false,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Sparkles;
  onClick: () => void;
  attention?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-overlay",
        attention
          ? "border-amber-200 bg-amber-50/60"
          : "border-border/60 bg-card",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {title}
          </p>

          <p className="mt-2 text-3xl font-semibold tracking-[-.04em]">
            {value}
          </p>
        </div>

        <span
          className={[
            "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
            attention
              ? "bg-amber-100 text-amber-800"
              : "bg-muted text-foreground",
          ].join(" ")}
        >
          <Icon size={20} />
        </span>
      </div>

      <p className="mt-3 text-sm leading-5 text-muted-foreground">
        {detail}
      </p>
    </button>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  detail,
}: {
  to: string;
  icon: typeof Sparkles;
  title: string;
  detail: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-20 items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-soft transition hover:bg-muted/40"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-champagne-soft text-champagne-dark">
        <Icon size={20} />
      </span>

      <span className="min-w-0 flex-1">
        <b className="block text-sm">
          {title}
        </b>

        <span className="mt-1 block text-sm text-muted-foreground">
          {detail}
        </span>
      </span>

      <ArrowRight
        size={17}
        className="text-muted-foreground"
      />
    </Link>
  );
}


function ProspectingMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background p-4">
      <p className="text-sm font-medium text-muted-foreground">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold tracking-[-.04em]">
        {value}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}

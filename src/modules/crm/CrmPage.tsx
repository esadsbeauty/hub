import { useDeferredValue, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CalendarClock,
  FilterX,
  Kanban,
  List,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/shared/components/data-display/data-table";
import { MetricCard } from "@/shared/components/data-display/metric-card";
import {
  PriorityBadge,
  TemperatureBadge,
} from "@/shared/components/data-display/status-badges";
import {
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/shared/components/feedback/states";
import { FilterBar } from "@/shared/components/forms/filter-bar";
import { SearchInput } from "@/shared/components/forms/search-input";
import { PageContainer } from "@/shared/components/layout/page-container";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Modal } from "@/shared/components/overlays/modal";
import { useToast } from "@/shared/components/feedback/toast";
import { CompanyForm } from "./components/company-form";
import { FollowUpQuickForm } from "./components/simple-forms";
import { OpportunityForm } from "./components/opportunity-form";
import { OpportunityDetails } from "./components/opportunity-details";
import { useCrmActions, useCrmData } from "./hooks";
import type { CompanyFormData } from "./schema";
import type {
  Company,
  CompanyContact,
  Opportunity,
  PipelineStage,
  Priority,
  Task,
  TimelineEvent,
} from "./types";
import { currency, formatDateTime } from "./utils/formatters";
type View = "kanban" | "list";
type Sort = "newest" | "oldest" | "name" | "activity" | "followup" | "priority";
type Filters = {
  owner: string;
  source: string;
  temperature: string;
  priority: string;
  state: string;
  openOpportunity: string;
  overdue: string;
  activity: string;
  created: string;
};
const emptyFilters: Filters = {
  owner: "all",
  source: "all",
  temperature: "all",
  priority: "all",
  state: "all",
  openOpportunity: "all",
  overdue: "all",
  activity: "all",
  created: "all",
};
export function CrmPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useCrmData();
  const actions = useCrmActions();
  const { notify } = useToast();
  const [query, setQuery] = useState(
    () => sessionStorage.getItem("crm-query") ?? "",
  );
  const deferredQuery = useDeferredValue(query);
  const [view, setView] = useState<View>("kanban");
  const [sort, setSort] = useState<Sort>("newest");
  const [filters, setFilters] = useState<Filters>(() => {
    const saved = sessionStorage.getItem("crm-filters");
    return saved ? { ...emptyFilters, ...JSON.parse(saved) } : emptyFilters;
  });
  const [modal, setModal] = useState<
    "company" | "opportunity" | "followup" | null
  >(null);
  const [pendingCompany, setPendingCompany] = useState<CompanyFormData>();
  const [duplicates, setDuplicates] = useState<Company[]>([]);
  const [selected, setSelected] = useState<Opportunity>();
  const [quickCompanyId, setQuickCompanyId] = useState("");
  const updateFilters = (next: Filters) => {
    setFilters(next);
    sessionStorage.setItem("crm-filters", JSON.stringify(next));
  };
  const companies: Company[] = (data?.companies ?? []).filter(
    (item) => !item.deletedAt,
  );
  const opportunities: Opportunity[] = (data?.opportunities ?? []).filter(
    (item) => !item.deletedAt && item.status !== "archived",
  );
  const tasks: Task[] = (data?.tasks ?? []).filter((item) => !item.deletedAt);
  const events: TimelineEvent[] = data?.events ?? [];
  const contacts: CompanyContact[] = data?.contacts ?? [];
  const activeFilters = Object.values(filters).filter(
    (item) => item !== "all",
  ).length;
  const filtered = useMemo(() => {
    const normalized = deferredQuery.toLowerCase().trim();
    const priorityRank: Record<Priority, number> = {
      alta: 3,
      media: 2,
      baixa: 1,
    };
    return companies
      .filter((company) => {
        const companyContacts = contacts.filter(
          (item) => item.companyId === company.id && !item.deletedAt,
        );
        const open = opportunities.some(
          (item) => item.companyId === company.id && item.status === "open",
        );
        const overdue = tasks.some(
          (item) =>
            item.companyId === company.id &&
            item.status === "pending" &&
            item.dueAt < new Date().toISOString(),
        );
        const latestActivity = events
          .filter((item) => item.companyId === company.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        const staleActivity =
          !latestActivity ||
          latestActivity.createdAt <
            new Date(Date.now() - 30 * 86400000).toISOString();
        const createdAfter =
          filters.created === "7"
            ? new Date(Date.now() - 7 * 86400000).toISOString()
            : filters.created === "30"
              ? new Date(Date.now() - 30 * 86400000).toISOString()
              : undefined;
        const searchable = [
          company.fantasyName,
          company.whatsapp,
          company.phone,
          company.email,
          company.instagram,
          company.city,
          ...companyContacts.flatMap((item) => [
            item.name,
            item.phone,
            item.whatsapp,
            item.email,
          ]),
        ]
          .join(" ")
          .toLowerCase();
        return (
          (!normalized || searchable.includes(normalized)) &&
          (filters.owner === "all" || company.owner === filters.owner) &&
          (filters.source === "all" || company.leadSource === filters.source) &&
          (filters.temperature === "all" ||
            company.temperature === filters.temperature) &&
          (filters.priority === "all" ||
            company.priority === filters.priority) &&
          (filters.state === "all" || company.state === filters.state) &&
          (filters.openOpportunity === "all" ||
            String(open) === filters.openOpportunity) &&
          (filters.overdue === "all" || String(overdue) === filters.overdue) &&
          (filters.activity === "all" ||
            String(staleActivity) === filters.activity) &&
          (!createdAfter || company.createdAt >= createdAfter)
        );
      })
      .sort((a, b) =>
        sort === "newest"
          ? b.createdAt.localeCompare(a.createdAt)
          : sort === "oldest"
            ? a.createdAt.localeCompare(b.createdAt)
            : sort === "name"
              ? a.fantasyName.localeCompare(b.fantasyName)
              : sort === "activity"
                ? (b.lastInteractionAt ?? "").localeCompare(
                    a.lastInteractionAt ?? "",
                  )
                : sort === "followup"
                  ? (nextTask(a.id)?.dueAt ?? "9999").localeCompare(
                      nextTask(b.id)?.dueAt ?? "9999",
                    )
                  : priorityRank[b.priority] - priorityRank[a.priority],
      );
    function nextTask(companyId: string) {
      return tasks
        .filter(
          (item) =>
            item.companyId === companyId &&
            item.status === "pending" &&
            item.type === "follow_up",
        )
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
    }
  }, [
    companies,
    contacts,
    opportunities,
    tasks,
    events,
    deferredQuery,
    filters,
    sort,
  ]);
  if (isLoading)
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </PageContainer>
    );
  if (isError || !data)
    return (
      <PageContainer>
        <ErrorState retry={() => refetch()} />
      </PageContainer>
    );
  const companyById = new Map<string, Company>(
    companies.map((item) => [item.id, item]),
  );
  const nextTask = (companyId: string) =>
    tasks
      .filter(
        (item) =>
          item.companyId === companyId &&
          item.status === "pending" &&
          item.type === "follow_up",
      )
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  const lastEvent = (companyId: string) =>
    events
      .filter((item) => item.companyId === companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const openCount = (companyId: string) =>
    opportunities.filter(
      (item) => item.companyId === companyId && item.status === "open",
    ).length;
  const submitCompany = async (form: CompanyFormData, force = false) => {
    const comparable = (value?: string) =>
      value?.replace(/\W/g, "").toLowerCase();
    const matches = companies.filter((item) =>
      [
        item.fantasyName,
        item.phone,
        item.whatsapp,
        item.email,
        item.instagram,
      ].some(
        (value) =>
          value &&
          [
            form.fantasyName,
            form.phone,
            form.whatsapp,
            form.email,
            form.instagram,
          ].some((candidate) => comparable(candidate) === comparable(value)),
      ),
    );
    if (matches.length && !force) {
      setPendingCompany(form);
      setDuplicates(matches);
      return;
    }
    await actions.createCompany.mutateAsync(form);
    setModal(null);
    notify({
      title: "Empresa criada",
      description: "Empresa e contato principal registrados.",
    });
  };
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Centro comercial"
        title="CRM"
        description="Empresas, contatos, oportunidades e próximos passos em uma visão única."
        actions={
          <>
            <Button variant="outline" onClick={() => setModal("followup")}>
              Tarefa / follow-up
            </Button>
            <Button variant="outline" onClick={() => setModal("opportunity")}>
              Nova oportunidade
            </Button>
            <Button onClick={() => setModal("company")}>
              <Plus size={17} /> Nova empresa
            </Button>
          </>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Empresas"
          value={companies.length}
          icon={Building2}
        />
        <MetricCard
          label="Clientes"
          value={
            companies.filter((item) => item.lifecycleStage === "customer")
              .length
          }
          icon={Users}
        />
        <MetricCard
          label="Oportunidades abertas"
          value={opportunities.filter((item) => item.status === "open").length}
          icon={TrendingUp}
        />
        <MetricCard
          label="Follow-ups pendentes"
          value={tasks.filter((item) => item.status === "pending").length}
          icon={CalendarClock}
        />
      </section>
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div className="inline-flex rounded-xl border bg-muted/50 p-1">
          <Button
            size="sm"
            variant={view === "kanban" ? "default" : "ghost"}
            onClick={() => setView("kanban")}
          >
            <Kanban size={15} /> Kanban
          </Button>
          <Button
            size="sm"
            variant={view === "list" ? "default" : "ghost"}
            onClick={() => setView("list")}
          >
            <List size={15} /> Lista
          </Button>
        </div>
        <Select
          className="sm:w-52"
          value={sort}
          onChange={(event) => {
            const value = event.target.value;
            if (
              value === "newest" ||
              value === "oldest" ||
              value === "name" ||
              value === "activity" ||
              value === "followup" ||
              value === "priority"
            )
              setSort(value);
          }}
        >
          <option value="newest">Mais recentes</option>
          <option value="oldest">Mais antigos</option>
          <option value="name">Nome</option>
          <option value="activity">Última atividade</option>
          <option value="followup">Próximo follow-up</option>
          <option value="priority">Prioridade</option>
        </Select>
      </div>
      <FilterBar>
        <SearchInput
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            sessionStorage.setItem("crm-query", event.target.value);
          }}
          placeholder="Buscar empresa, contato, telefone, email..."
        />
        <FilterSelect
          value={filters.owner}
          label="Responsável"
          values={companies.map((item) => item.owner)}
          onChange={(owner) => updateFilters({ ...filters, owner })}
        />
        <FilterSelect
          value={filters.source}
          label="Origem"
          values={companies.map((item) => item.leadSource)}
          onChange={(source) => updateFilters({ ...filters, source })}
        />
        <FilterSelect
          value={filters.state}
          label="Estado"
          values={companies.map((item) => item.state)}
          onChange={(state) => updateFilters({ ...filters, state })}
        />
        <Select
          value={filters.temperature}
          onChange={(event) =>
            updateFilters({ ...filters, temperature: event.target.value })
          }
        >
          <option value="all">Temperatura</option>
          <option value="frio">Frio</option>
          <option value="morno">Morno</option>
          <option value="quente">Quente</option>
        </Select>
        <Select
          value={filters.priority}
          onChange={(event) =>
            updateFilters({ ...filters, priority: event.target.value })
          }
        >
          <option value="all">Prioridade</option>
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
        </Select>
        <Select
          value={filters.openOpportunity}
          onChange={(event) =>
            updateFilters({ ...filters, openOpportunity: event.target.value })
          }
        >
          <option value="all">Oportunidades</option>
          <option value="true">Com oportunidade aberta</option>
          <option value="false">Sem oportunidade aberta</option>
        </Select>
        <Select
          value={filters.overdue}
          onChange={(event) =>
            updateFilters({ ...filters, overdue: event.target.value })
          }
        >
          <option value="all">Follow-ups</option>
          <option value="true">Com follow-up atrasado</option>
          <option value="false">Sem follow-up atrasado</option>
        </Select>
        <Select
          value={filters.activity}
          onChange={(event) =>
            updateFilters({ ...filters, activity: event.target.value })
          }
        >
          <option value="all">Atividade</option>
          <option value="true">Sem atividade recente</option>
          <option value="false">Com atividade recente</option>
        </Select>
        <Select
          value={filters.created}
          onChange={(event) =>
            updateFilters({ ...filters, created: event.target.value })
          }
        >
          <option value="all">Período de criação</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
        </Select>
        {activeFilters > 0 && (
          <Button variant="ghost" onClick={() => updateFilters(emptyFilters)}>
            <FilterX size={15} /> Limpar ({activeFilters})
          </Button>
        )}
      </FilterBar>
      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma empresa encontrada"
          description="Ajuste a busca ou os filtros para continuar."
        />
      ) : view === "kanban" ? (
        <OpportunityKanban
          opportunities={opportunities.filter((item) =>
            filtered.some((company) => company.id === item.companyId),
          )}
          stages={data.stages}
          companyById={companyById}
          nextTask={nextTask}
          onMove={(opportunity, stageId) =>
            actions.moveOpportunity.mutate(
              { opportunityId: opportunity.id, stageId },
              {
                onError: () =>
                  notify({
                    title: "Não foi possível mover",
                    description: "A oportunidade voltou para a etapa anterior.",
                  }),
              },
            )
          }
          onOpen={setSelected}
        />
      ) : (
        <DataTable<Company>
          data={filtered}
          onRowClick={(company) => navigate(`/crm/companies/${company.id}`)}
          columns={[
            {
              key: "company",
              header: "Empresa",
              render: (company) => (
                <div>
                  <b>{company.fantasyName}</b>
                  <p className="text-xs text-muted-foreground">
                    {contacts.find(
                      (item) => item.companyId === company.id && item.isPrimary,
                    )?.name ?? "Sem contato principal"}
                  </p>
                </div>
              ),
            },
            {
              key: "contact",
              header: "Contato",
              render: (company) => (
                <div className="text-sm">
                  {company.whatsapp ?? company.phone ?? "—"}
                  <p className="text-xs text-muted-foreground">
                    {company.city ?? "—"} / {company.state ?? "—"}
                  </p>
                </div>
              ),
            },
            {
              key: "commercial",
              header: "Comercial",
              render: (company) => (
                <div className="flex flex-wrap gap-1">
                  <TemperatureBadge temperature={company.temperature} />
                  <PriorityBadge priority={company.priority} />
                  <span className="text-xs">
                    {openCount(company.id)} abertas
                  </span>
                </div>
              ),
            },
            {
              key: "next",
              header: "Próximo passo",
              render: (company) => (
                <div className="text-sm">
                  {nextTask(company.id)
                    ? formatDateTime(nextTask(company.id)?.dueAt)
                    : "Nenhum"}
                  <p className="text-xs text-muted-foreground">
                    Última:{" "}
                    {lastEvent(company.id)
                      ? formatDateTime(lastEvent(company.id)?.createdAt)
                      : "—"}
                  </p>
                </div>
              ),
            },
          ]}
        />
      )}
      <Modal
        open={modal === "company"}
        title="Nova empresa"
        onClose={() => setModal(null)}
      >
        <CompanyForm
          onCancel={() => setModal(null)}
          onSubmit={(form) => submitCompany(form)}
        />
      </Modal>
      <Modal
        open={duplicates.length > 0}
        title="Encontramos possíveis empresas semelhantes"
        onClose={() => {
          setDuplicates([]);
          setPendingCompany(undefined);
        }}
      >
        <div className="space-y-3">
          {duplicates.map((item) => (
            <button
              key={item.id}
              className="w-full rounded-xl border p-3 text-left hover:border-champagne"
              onClick={() => navigate(`/crm/companies/${item.id}`)}
            >
              <b>{item.fantasyName}</b>
              <p className="text-sm text-muted-foreground">
                {item.whatsapp ?? item.email ?? "Sem contato"}
              </p>
            </button>
          ))}
          <Button
            className="w-full"
            variant="outline"
            onClick={() => {
              if (pendingCompany) submitCompany(pendingCompany, true);
              setDuplicates([]);
              setPendingCompany(undefined);
            }}
          >
            Continuar cadastro mesmo assim
          </Button>
        </div>
      </Modal>
      <Modal
        open={modal === "opportunity"}
        title="Nova oportunidade"
        onClose={() => setModal(null)}
      >
        <OpportunityForm
          companies={companies}
          pipelines={data.pipelines}
          stages={data.stages}
          onCancel={() => setModal(null)}
          onSubmit={async (form) => {
            await actions.createOpportunity.mutateAsync(form);
            setModal(null);
            notify({ title: "Oportunidade criada" });
          }}
        />
      </Modal>
      <Modal
        open={modal === "followup"}
        title="Novo follow-up"
        onClose={() => setModal(null)}
      >
        <div className="space-y-3">
          <Select
            value={quickCompanyId}
            onChange={(event) => setQuickCompanyId(event.target.value)}
          >
            <option value="">Selecione a empresa</option>
            {companies.map((item) => (
              <option key={item.id} value={item.id}>
                {item.fantasyName}
              </option>
            ))}
          </Select>
          {quickCompanyId && (
            <FollowUpQuickForm
              onSubmit={async (form) => {
                await actions.createFollowUp.mutateAsync({
                  companyId: quickCompanyId,
                  data: form,
                });
                setModal(null);
                setQuickCompanyId("");
                notify({ title: "Follow-up criado" });
              }}
            />
          )}
        </div>
      </Modal>
      <OpportunityDetails
        opportunity={selected}
        company={companyById.get(selected?.companyId ?? "")}
        pipeline={data.pipelines.find(
          (item) => item.id === selected?.pipelineId,
        )}
        stages={data.stages}
        activities={data.events.filter(
          (event) => event.opportunityId === selected?.id,
        )}
        nextTask={selected ? nextTask(selected.companyId) : undefined}
        open={Boolean(selected)}
        onClose={() => setSelected(undefined)}
        onMove={(stageId) =>
          selected &&
          actions.moveOpportunity.mutate({
            opportunityId: selected.id,
            stageId,
          })
        }
        onEdit={() =>
          notify({ title: "Abra a empresa para editar esta oportunidade" })
        }
        onDuplicate={() =>
          selected && actions.duplicateOpportunity.mutate(selected.id)
        }
        onArchive={() =>
          selected &&
          actions.archiveOpportunity.mutate(selected.id, {
            onSuccess: () => setSelected(undefined),
          })
        }
        onWon={() =>
          selected &&
          actions.markOpportunityWon.mutate(selected.id, {
            onSuccess: () => setSelected(undefined),
          })
        }
        onAddNote={() =>
          notify({ title: "Abra a empresa para adicionar uma nota" })
        }
        onAddFollowUp={() =>
          notify({ title: "Abra a empresa para criar um follow-up" })
        }
        onLost={(form) =>
          selected &&
          actions.markOpportunityLost.mutate(
            { id: selected.id, data: form },
            { onSuccess: () => setSelected(undefined) },
          )
        }
      />
    </PageContainer>
  );
}
function FilterSelect({
  value,
  label,
  values,
  onChange,
}: {
  value: string;
  label: string;
  values: (string | undefined)[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="all">{label}</option>
      {[...new Set(values.filter((item): item is string => Boolean(item)))].map(
        (item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ),
      )}
    </Select>
  );
}
function OpportunityKanban({
  opportunities,
  stages,
  companyById,
  nextTask,
  onMove,
  onOpen,
}: {
  opportunities: Opportunity[];
  stages: PipelineStage[];
  companyById: Map<string, Company>;
  nextTask: (companyId: string) => Task | undefined;
  onMove: (opportunity: Opportunity, stageId: string) => void;
  onOpen: (opportunity: Opportunity) => void;
}) {
  const [dragging, setDragging] = useState<Opportunity>();
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {[...stages]
        .sort((a, b) => a.position - b.position)
        .map((stage) => {
          const rows = opportunities.filter(
            (item) => item.stageId === stage.id,
          );
          return (
            <section
              key={stage.id}
              className="min-w-72 rounded-2xl bg-muted/60 p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dragging && onMove(dragging, stage.id)}
            >
              <header className="mb-3">
                <h2 className="font-bold">{stage.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {rows.length} oportunidades ·{" "}
                  {currency.format(
                    rows.reduce((sum, item) => sum + item.value, 0),
                  )}
                </p>
              </header>
              <div className="space-y-3">
                {rows.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
                    Nenhuma oportunidade. Arraste uma para cá.
                  </p>
                ) : (
                  rows.map((item) => {
                    const company = companyById.get(item.companyId);
                    const task = nextTask(item.companyId);
                    return (
                      <Card
                        key={item.id}
                        draggable
                        onDragStart={() => setDragging(item)}
                        onDragEnd={() => setDragging(undefined)}
                        className="cursor-grab smooth hover:-translate-y-0.5 hover:shadow-premium"
                      >
                        <CardContent className="p-4">
                          <button
                            className="w-full text-left"
                            onClick={() => onOpen(item)}
                          >
                            <p className="text-xs font-semibold text-muted-foreground">
                              {company?.fantasyName}
                            </p>
                            <h3 className="mt-1 font-bold">{item.title}</h3>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <p className="font-bold">
                                {currency.format(item.value)}
                              </p>
                              {company && (
                                <PriorityBadge priority={company.priority} />
                              )}
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {item.owner ?? "Sem responsável"}
                            </p>
                            {task && (
                              <p className="mt-2 text-xs">
                                Próximo: {formatDateTime(task.dueAt)}
                              </p>
                            )}
                          </button>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
    </div>
  );
}

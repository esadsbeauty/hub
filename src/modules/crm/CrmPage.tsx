import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Building2,
  CalendarClock,
  FilterX,
  Kanban,
  List,
  ArrowDownUp,
  Plus,
  SlidersHorizontal,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
import { MobileCrmView } from "./components/mobile-crm-view";
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
import { contactWhatsappUrl } from "./utils/contact-links";
type View = "kanban" | "list";
export type CrmSort = "newest" | "oldest" | "name" | "activity" | "followup" | "priority";
export type CrmFilters = {
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
const emptyFilters: CrmFilters = {
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, isError, refetch } = useCrmData();
  const actions = useCrmActions();
  const { notify } = useToast();
  const [query, setQuery] = useState(
    () => searchParams.get("q") ?? sessionStorage.getItem("crm-query") ?? "",
  );
  const deferredQuery = useDeferredValue(query);
  const [view, setView] = useState<View>("kanban");
  const [sort, setSort] = useState<CrmSort>("newest");
  const [filters, setFilters] = useState<CrmFilters>(() => {
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
  const [quickOpportunityId, setQuickOpportunityId] = useState<string>();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  useEffect(() => { const requested = searchParams.get("new"); if (requested === "company" || requested === "opportunity") setModal(requested); }, [searchParams]);
  useEffect(() => { const requestedQuery = searchParams.get("q"); if (requestedQuery !== null) { setQuery(requestedQuery); sessionStorage.setItem("crm-query", requestedQuery); } }, [searchParams]);
  const closeModal = () => { setModal(null); if (searchParams.has("new")) { const next = new URLSearchParams(searchParams); next.delete("new"); next.delete("quick"); setSearchParams(next, { replace: true }); } };
  const updateFilters = (next: CrmFilters) => {
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
  const nextTask = (companyId: string, opportunityId?: string) =>
    tasks
      .filter(
        (item) =>
          item.companyId === companyId &&
          (!opportunityId || item.opportunityId === opportunityId) &&
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
      title: "Lead criado",
      description: "Empresa registrada e oportunidade adicionada em Novo Lead.",
    });
    if (searchParams.get("onboarding") === "1") navigate("/onboarding");
  };
  return (
    <PageContainer>
      <MobileCrmView
        companies={filtered}
        contacts={contacts}
        opportunities={opportunities.filter((item)=>filtered.some((company)=>company.id===item.companyId))}
        tasks={tasks}
        stages={data.stages}
        query={query}
        filters={filters}
        sort={sort}
        activeFilters={activeFilters}
        onQueryChange={(value)=>{setQuery(value);sessionStorage.setItem("crm-query",value)}}
        onFiltersChange={updateFilters}
        onSortChange={setSort}
        onOpenCompany={(company)=>navigate(`/crm/companies/${company.id}`)}
        onOpenOpportunity={setSelected}
        onCreateOpportunity={()=>setModal("opportunity")}
        onMoveOpportunity={(opportunity,stageId)=>actions.moveOpportunity.mutate({opportunityId:opportunity.id,stageId},{onError:()=>notify({title:"Não foi possível mover",description:"A oportunidade voltou para a etapa anterior."})})}
        nextTask={nextTask}
      />
      <div className="hidden md:contents">
      <PageHeader
        title="CRM"
        description="Empresas, oportunidades e próximos passos."
        actions={
          <>
            <Button className="hidden md:inline-flex" variant="outline" onClick={() => setModal("followup")}>
              Tarefa / follow-up
            </Button>
            <Button className="hidden md:inline-flex" variant="outline" onClick={() => setModal("opportunity")}>
              Nova oportunidade
            </Button>
            <Button className="hidden md:inline-flex" onClick={() => setModal("company")}>
              <Plus size={17} /> <span className="md:hidden">Novo lead</span><span className="hidden md:inline">Nova empresa</span>
            </Button>
          </>
        }
      />
      <section aria-label="Indicadores do CRM" className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4">
        <div className="min-w-[82vw] snap-center md:min-w-0">
        <MetricCard
          label="Empresas"
          value={companies.length}
          hint="Contas no relacionamento comercial"
          icon={Building2}
        />
        </div>
        <div className="min-w-[82vw] snap-center md:min-w-0">
        <MetricCard
          label="Clientes"
          value={
            companies.filter((item) => item.lifecycleStage === "customer")
              .length
          }
          hint="Relacionamentos já convertidos"
          icon={Users}
        />
        </div>
        <div className="min-w-[82vw] snap-center md:min-w-0">
        <MetricCard
          label="Oportunidades abertas"
          value={opportunities.filter((item) => item.status === "open").length}
          hint="Negociações em andamento"
          icon={TrendingUp}
        />
        </div>
        <div className="min-w-[82vw] snap-center md:min-w-0">
        <MetricCard
          label="Follow-ups pendentes"
          value={tasks.filter((item) => item.status === "pending").length}
          hint="Ações que ainda precisam acontecer"
          icon={CalendarClock}
        />
        </div>
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
        <Button className="md:hidden" variant="outline" onClick={()=>setMobileSortOpen(true)}><ArrowDownUp size={19}/> Ordenar</Button>
        <Select
          className="hidden md:block md:w-52"
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
      <div className="space-y-3 md:hidden"><SearchInput value={query} onChange={(event) => { setQuery(event.target.value); sessionStorage.setItem("crm-query", event.target.value); }} placeholder="Buscar lead ou contato…"/><Button className="w-full" variant="outline" aria-label="Abrir filtros" onClick={()=>setMobileFiltersOpen(true)}><SlidersHorizontal size={20}/> Filtros{activeFilters > 0 && <span className="grid h-7 min-w-7 place-items-center rounded-full bg-primary px-2 text-sm text-primary-foreground">{activeFilters}</span>}</Button>{activeFilters>0&&<p className="text-sm text-muted-foreground">{activeFilters} filtro(s) ativo(s)</p>}</div>
      <FilterBar className="hidden md:flex">
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
      <Modal open={mobileFiltersOpen} title="Filtrar CRM" onClose={()=>setMobileFiltersOpen(false)}>
        <div className="grid gap-5">
          <MobileFilterField label="Responsável"><FilterSelect value={filters.owner} label="Todos os responsáveis" values={companies.map((item) => item.owner)} onChange={(owner) => updateFilters({ ...filters, owner })}/></MobileFilterField>
          <MobileFilterField label="Origem"><FilterSelect value={filters.source} label="Todas as origens" values={companies.map((item) => item.leadSource)} onChange={(source) => updateFilters({ ...filters, source })}/></MobileFilterField>
          <MobileFilterField label="Estado"><FilterSelect value={filters.state} label="Todos os estados" values={companies.map((item) => item.state)} onChange={(state) => updateFilters({ ...filters, state })}/></MobileFilterField>
          <MobileFilterField label="Temperatura"><Select value={filters.temperature} onChange={(event)=>updateFilters({...filters,temperature:event.target.value})}><option value="all">Todas as temperaturas</option><option value="frio">Frio</option><option value="morno">Morno</option><option value="quente">Quente</option></Select></MobileFilterField>
          <MobileFilterField label="Prioridade"><Select value={filters.priority} onChange={(event)=>updateFilters({...filters,priority:event.target.value})}><option value="all">Todas as prioridades</option><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></Select></MobileFilterField>
          <MobileFilterField label="Oportunidade"><Select value={filters.openOpportunity} onChange={(event)=>updateFilters({...filters,openOpportunity:event.target.value})}><option value="all">Todas as empresas</option><option value="true">Com oportunidade aberta</option><option value="false">Sem oportunidade aberta</option></Select></MobileFilterField>
          <MobileFilterField label="Follow-up"><Select value={filters.overdue} onChange={(event)=>updateFilters({...filters,overdue:event.target.value})}><option value="all">Todos os follow-ups</option><option value="true">Com follow-up atrasado</option><option value="false">Sem follow-up atrasado</option></Select></MobileFilterField>
          <MobileFilterField label="Atividade"><Select value={filters.activity} onChange={(event)=>updateFilters({...filters,activity:event.target.value})}><option value="all">Qualquer atividade</option><option value="true">Sem atividade recente</option><option value="false">Com atividade recente</option></Select></MobileFilterField>
          <MobileFilterField label="Período"><Select value={filters.created} onChange={(event)=>updateFilters({...filters,created:event.target.value})}><option value="all">Qualquer período</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></Select></MobileFilterField>
          <div className="sticky bottom-0 -mx-5 mt-2 grid grid-cols-2 gap-3 border-t bg-card px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"><Button variant="outline" onClick={()=>updateFilters(emptyFilters)}>Limpar</Button><Button onClick={()=>setMobileFiltersOpen(false)}>Aplicar filtros</Button></div>
        </div>
      </Modal>
      <Modal open={mobileSortOpen} title="Ordenar CRM" onClose={()=>setMobileSortOpen(false)}>
        <div className="space-y-4"><Label htmlFor="crm-mobile-sort">Ordenar empresas por</Label><Select id="crm-mobile-sort" value={sort} onChange={(event)=>setSort(event.target.value as CrmSort)}><option value="newest">Mais recentes</option><option value="oldest">Mais antigos</option><option value="name">Nome</option><option value="activity">Última atividade</option><option value="followup">Próximo follow-up</option><option value="priority">Prioridade</option></Select><Button className="w-full" onClick={()=>setMobileSortOpen(false)}>Aplicar ordenação</Button></div>
      </Modal>
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
          contacts={contacts}
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
        <><div className="grid gap-4 md:hidden">{filtered.map(company=><button key={company.id} onClick={()=>navigate(`/crm/companies/${company.id}`)} className="rounded-[1.5rem] bg-card p-5 text-left shadow-soft premium-focus"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-[-.025em]">{company.fantasyName}</h2><p className="mt-1 text-base text-muted-foreground">{contacts.find(item=>item.companyId===company.id&&item.isPrimary)?.name??"Sem contato principal"}</p></div><span className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold">{openCount(company.id)} abertas</span></div><div className="mt-5 flex flex-wrap gap-2"><TemperatureBadge temperature={company.temperature}/><PriorityBadge priority={company.priority}/></div><div className="mt-5 border-t pt-4 text-base"><p>{company.whatsapp??company.phone??"Contato não informado"}</p><p className="mt-2 text-muted-foreground">Próximo passo: {nextTask(company.id)?formatDateTime(nextTask(company.id)?.dueAt):"Nenhum"}</p></div></button>)}</div><div className="hidden md:block"><DataTable<Company>
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
        /></div></>
      )}</div>
      <Modal
        open={modal === "company"}
        title="Nova empresa"
        onClose={closeModal}
      >
        <CompanyForm
          onCancel={closeModal}
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
        onClose={closeModal}
      >
        <OpportunityForm
          companies={companies}
          pipelines={data.pipelines}
          stages={data.stages}
          onCancel={closeModal}
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
        onClose={closeModal}
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
                  opportunityId: quickOpportunityId,
                });
                setModal(null);
                setQuickCompanyId("");
                setQuickOpportunityId(undefined);
                notify({ title: "Follow-up criado" });
              }}
            />
          )}
        </div>
      </Modal>
      <OpportunityDetails
        opportunity={selected}
        company={companyById.get(selected?.companyId ?? "")}
        contact={contacts.find(item=>item.companyId===selected?.companyId&&item.isPrimary&&!item.deletedAt)??contacts.find(item=>item.companyId===selected?.companyId&&!item.deletedAt)}
        pipeline={data.pipelines.find(
          (item) => item.id === selected?.pipelineId,
        )}
        stages={data.stages}
        activities={data.events.filter(
          (event) => event.opportunityId === selected?.id,
        )}
        nextTask={selected ? nextTask(selected.companyId,selected.id) : undefined}
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
        onSaveNote={async(text)=>{if(!selected)return;await actions.addNote.mutateAsync({companyId:selected.companyId,opportunityId:selected.id,text});notify({title:"Observação adicionada"})}}
        onAddFollowUp={() => {if(!selected)return;setQuickCompanyId(selected.companyId);setQuickOpportunityId(selected.id);setModal("followup")}}
        onCompleteNextTask={()=>{const task=selected?nextTask(selected.companyId,selected.id):undefined;if(task)actions.completeTask.mutate(task.id)}}
        onRescheduleNextTask={(dueAt)=>{const task=selected?nextTask(selected.companyId,selected.id):undefined;if(task)actions.rescheduleTask.mutate({id:task.id,dueAt})}}
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
function MobileFilterField({label,children}:{label:string;children:React.ReactNode}) {
  return <label className="grid gap-2"><span className="text-base font-semibold">{label}</span>{children}</label>;
}
function OpportunityKanban({
  opportunities,
  stages,
  companyById,
  contacts,
  nextTask,
  onMove,
  onOpen,
}: {
  opportunities: Opportunity[];
  stages: PipelineStage[];
  companyById: Map<string, Company>;
  contacts: CompanyContact[];
  nextTask: (companyId: string, opportunityId?: string) => Task | undefined;
  onMove: (opportunity: Opportunity, stageId: string) => void;
  onOpen: (opportunity: Opportunity) => void;
}) {
  const [dragging, setDragging] = useState<Opportunity>();
  return (
    <div aria-label="Pipeline por etapas" className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-5 md:mx-0 md:snap-none md:px-0">
      {[...stages]
        .sort((a, b) => a.position - b.position)
        .map((stage) => {
          const rows = opportunities.filter(
            (item) => item.stageId === stage.id,
          );
          return (
            <section
              key={stage.id}
              className="min-w-[90vw] max-w-[24rem] snap-center rounded-[1.75rem] bg-muted/55 p-5 md:min-w-72 md:max-w-none md:rounded-2xl md:p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dragging && onMove(dragging, stage.id)}
            >
              <header className="mb-5 border-b border-border/60 pb-4 md:mb-3 md:border-0 md:pb-0">
                <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold md:text-sm">{stage.name}</h2><span className="grid h-9 min-w-9 place-items-center rounded-full bg-card px-2 text-base font-semibold shadow-soft md:h-auto md:min-w-0 md:bg-transparent md:p-0 md:text-xs md:shadow-none">{rows.length}</span></div>
                <p className="mt-2 text-lg font-semibold md:mt-1 md:text-xs md:font-normal md:text-muted-foreground">
                  {currency.format(
                    rows.reduce((sum, item) => sum + item.value, 0),
                  )}
                </p>
              </header>
              <div className="space-y-4 md:space-y-3">
                {rows.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-5 text-base leading-6 text-muted-foreground md:p-4 md:text-xs">
                    Nenhuma oportunidade. Arraste uma para cá.
                  </p>
                ) : (
                  rows.map((item) => {
                    const company = companyById.get(item.companyId);
                    const contact = contacts.find(value=>value.companyId===item.companyId&&value.isPrimary&&!value.deletedAt)??contacts.find(value=>value.companyId===item.companyId&&!value.deletedAt);
                    const task = nextTask(item.companyId,item.id);
                    const phone=contact?.whatsapp??contact?.phone??company?.whatsapp??company?.phone,whatsapp=contactWhatsappUrl(phone);
                    return (
                      <Card
                        key={item.id}
                        draggable
                        onDragStart={() => setDragging(item)}
                        onDragEnd={() => setDragging(undefined)}
                        className="cursor-grab ring-1 ring-black/[.025] transition-shadow hover:shadow-[0_10px_30px_rgba(24,20,16,.08)]"
                      >
                        <CardContent className="p-5 md:p-4">
                          <button
                            className="w-full text-left"
                            onClick={() => onOpen(item)}
                          >
                            <h3 className="text-xl font-semibold leading-snug tracking-[-.02em] md:text-sm">{contact?.name??company?.responsibleName??item.title}</h3>
                            {company?.fantasyName&&<p className="mt-1 text-sm text-muted-foreground md:text-xs">{company.fantasyName}</p>}
                            {phone&&<p className="mt-2 text-sm font-medium md:text-xs">{phone}</p>}
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <p className="text-lg font-semibold md:text-sm">
                                {currency.format(item.value)}
                              </p>
                              {company && <div className="flex flex-wrap justify-end gap-2"><TemperatureBadge temperature={company.temperature}/><PriorityBadge priority={company.priority}/></div>}
                            </div>
                            {task && (
                              <p className="mt-3 text-base md:mt-2 md:text-xs">
                                Próximo: {formatDateTime(task.dueAt)}
                              </p>
                            )}
                          </button>
                          {whatsapp&&<a aria-label="Abrir WhatsApp do contato" className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#e8f7ee] text-sm font-semibold text-[#176b3a]" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>}
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

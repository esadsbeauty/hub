import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, CalendarPlus, Kanban, List, MessageCircle, MoveRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MetricCard } from "@/shared/components/data-display/metric-card";
import { PriorityBadge, TemperatureBadge } from "@/shared/components/data-display/status-badges";
import { SearchInput } from "@/shared/components/forms/search-input";
import { Modal } from "@/shared/components/overlays/modal";
import type { Company, CompanyContact, Opportunity, PipelineStage, Task } from "../types";
import type { CrmFilters, CrmSort } from "../CrmPage";
import { currency, formatDateTime } from "../utils/formatters";
import { contactWhatsappUrl } from "../utils/contact-links";
import { crmTerminology, type BusinessMode } from "../business-mode";

type Props = {
  businessMode: BusinessMode;
  companies: Company[];
  contacts: CompanyContact[];
  opportunities: Opportunity[];
  tasks: Task[];
  stages: PipelineStage[];
  query: string;
  filters: CrmFilters;
  sort: CrmSort;
  activeFilters: number;
  onQueryChange: (value: string) => void;
  onFiltersChange: (filters: CrmFilters) => void;
  onSortChange: (sort: CrmSort) => void;
  onOpenCompany: (company: Company) => void;
  onOpenOpportunity: (opportunity: Opportunity) => void;
  onCreateOpportunity: () => void;
  onMoveOpportunity: (opportunity: Opportunity, stageId: string) => void;
  nextTask: (companyId: string, opportunityId?: string) => Task | undefined;
};

const emptyFilters: CrmFilters = {owner:"all",source:"all",temperature:"all",priority:"all",state:"all",openOpportunity:"all",overdue:"all",activity:"all",created:"all"};

export function MobileCrmView(props: Props) {
  const [view,setView]=useState<"kanban"|"list">("kanban");
  const [filterSheet,setFilterSheet]=useState(false);
  const [sortSheet,setSortSheet]=useState(false);
  const [stageFilter,setStageFilter]=useState("all");
  const clients=props.companies.filter(item=>item.lifecycleStage==="customer").length,terms=crmTerminology(props.businessMode),b2c=props.businessMode==="b2c";
  return <div className="space-y-6 md:hidden">
    <header><p className="text-[15px] font-medium text-muted-foreground">Gestão comercial</p><h1 className="mt-1 text-[2rem] font-bold leading-none tracking-[-.055em]">CRM</h1><p className="mt-2 text-base leading-6 text-muted-foreground">{b2c?"Leads, clientes e próximos passos.":"Empresas, oportunidades e próximos passos."}</p></header>
    <section aria-label="Indicadores do CRM" className="-mx-4 flex min-[430px]:-mx-5 snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 min-[430px]:px-5 pb-2">
      <MobileMetric label={terms.companies} value={props.companies.length} hint={b2c?"Pessoas no relacionamento comercial":"Contas no relacionamento comercial"}/>
      <MobileMetric label="Clientes" value={clients} hint="Relacionamentos já convertidos"/>
      <MobileMetric label="Oportunidades abertas" value={props.opportunities.filter(item=>item.status==="open").length} hint="Negociações em andamento"/>
      <MobileMetric label="Follow-ups pendentes" value={props.tasks.filter(item=>item.status==="pending").length} hint="Ações que ainda precisam acontecer"/>
    </section>
    <section className="space-y-3">
      <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
        <Button variant={view==="kanban"?"default":"ghost"} onClick={()=>setView("kanban")}><Kanban size={18}/>Kanban</Button>
        <Button variant={view==="list"?"default":"ghost"} onClick={()=>setView("list")}><List size={18}/>Lista</Button>
      </div>
      <SearchInput value={props.query} onChange={event=>props.onQueryChange(event.target.value)} placeholder="Buscar lead ou contato…"/>
      <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={()=>setFilterSheet(true)}><SlidersHorizontal size={18}/>Filtros{props.activeFilters>0&&` (${props.activeFilters})`}</Button><Button variant="outline" onClick={()=>setSortSheet(true)}><ArrowDownUp size={18}/>{sortLabel[props.sort]}</Button></div>
    </section>
    {view==="kanban"?<MobileKanban {...props} stageFilter={stageFilter}/>:<MobileCompanyList {...props}/>} 
    <FilterSheet open={filterSheet} close={()=>setFilterSheet(false)} stageFilter={stageFilter} onStageFilter={setStageFilter} {...props}/>
    <Modal open={sortSheet} title="Ordenar CRM" onClose={()=>setSortSheet(false)}><div className="space-y-5"><Label htmlFor="mobile-sort">Ordenar {terms.companies.toLowerCase()} por</Label><Select id="mobile-sort" value={props.sort} onChange={event=>props.onSortChange(event.target.value as CrmSort)}>{Object.entries(sortLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select><Button className="w-full" onClick={()=>setSortSheet(false)}>Aplicar ordenação</Button></div></Modal>
  </div>;
}

function MobileMetric({label,value,hint}:{label:string;value:number;hint:string}) { return <div className="min-w-[78vw] snap-center"><MetricCard label={label} value={value} hint={hint}/></div>; }

const sortLabel:Record<CrmSort,string>={newest:"Mais recentes",oldest:"Mais antigos",name:"Nome",activity:"Última atividade",followup:"Próximo follow-up",priority:"Prioridade"};

function MobileCompanyList(props:Props){const b2c=props.businessMode==="b2c";return <section className="grid gap-3" aria-label={`${crmTerminology(props.businessMode).companies} em lista`}>{props.companies.map(company=>{const contact=props.contacts.find(item=>item.companyId===company.id&&item.isPrimary);const task=props.nextTask(company.id);return <button key={company.id} onClick={()=>props.onOpenCompany(company)} className="rounded-[1.25rem] bg-card p-4 text-left shadow-soft premium-focus"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-[-.025em]">{company.fantasyName}</h2><p className="mt-1 text-sm text-muted-foreground">{b2c?(company.businessArea??"Interesse não informado"):(contact?.name??"Sem contato principal")}</p></div><span className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold">{props.opportunities.filter(item=>item.companyId===company.id&&item.status==="open").length} abertas</span></div><div className="mt-3 flex flex-wrap gap-2"><TemperatureBadge temperature={company.temperature}/><PriorityBadge priority={company.priority}/></div><div className="mt-4 border-t pt-3 text-base"><p>{company.whatsapp??company.phone??"Contato não informado"}</p><p className="mt-2 text-muted-foreground">Próximo passo: {task?formatDateTime(task.dueAt):"Nenhum"}</p></div></button>})}</section>}

function MobileKanban({stageFilter,...props}:Props&{stageFilter:string}){
 const ordered=useMemo(()=>[...props.stages].sort((a,b)=>a.position-b.position),[props.stages]);const visible=useMemo(()=>stageFilter==="all"?ordered:ordered.filter(item=>item.id===stageFilter),[ordered,stageFilter]);const[first,setFirst]=useState(visible[0]?.id??ordered[0]?.id??"");useEffect(()=>{if(visible.length&&!visible.some(item=>item.id===first))setFirst(visible[0].id)},[stageFilter,first,visible]);const[moving,setMoving]=useState<Opportunity>();
 const jump=(stageId:string)=>{setFirst(stageId);document.getElementById(`mobile-stage-${stageId}`)?.scrollIntoView({behavior:"smooth",inline:"center",block:"nearest"})};
 return <section className="space-y-3"><div className="rounded-2xl bg-card p-4 shadow-soft"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">Etapa do pipeline</p><p className="mt-1 text-base font-semibold">{ordered.find(item=>item.id===first)?.name??"Pipeline"}</p></div><span className="text-sm text-muted-foreground">{Math.max(1,visible.findIndex(item=>item.id===first)+1)} de {visible.length}</span></div><Select className="mt-2" aria-label="Ir para etapa" value={first} onChange={event=>jump(event.target.value)}>{visible.map(stage=><option key={stage.id} value={stage.id}>{stage.name}</option>)}</Select></div><div className="-mx-4 flex min-[430px]:-mx-5 snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 min-[430px]:px-5 pb-5" aria-label="Pipeline por etapas">{visible.map((stage,index)=>{const rows=props.opportunities.filter(item=>item.stageId===stage.id);return <section id={`mobile-stage-${stage.id}`} key={stage.id} onFocus={()=>setFirst(stage.id)} className="min-w-[86vw] max-w-[24rem] snap-center rounded-[1.5rem] bg-muted/55 p-4"><header className="mb-4 border-b pb-3"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{stage.name}</h2><p className="mt-1 text-sm text-muted-foreground">{rows.length} {rows.length===1?"oportunidade":"oportunidades"} · etapa {index+1}</p></div><span className="rounded-full bg-card px-3 py-1.5 text-base font-semibold shadow-soft">{rows.length}</span></div><p className="mt-2.5 text-lg font-semibold">{currency.format(rows.reduce((sum,item)=>sum+item.value,0))}</p></header><div className="space-y-3">{rows.length?rows.map(item=><MobileOpportunityCard key={item.id} item={item} company={props.companies.find(company=>company.id===item.companyId)} contact={props.contacts.find(contact=>contact.companyId===item.companyId&&contact.isPrimary&&!contact.deletedAt)??props.contacts.find(contact=>contact.companyId===item.companyId&&!contact.deletedAt)} task={props.nextTask(item.companyId,item.id)} open={()=>props.onOpenOpportunity(item)} move={()=>setMoving(item)}/>):<div className="rounded-2xl border border-dashed bg-card/70 p-6 text-center"><p className="text-lg font-semibold">Nenhuma oportunidade nesta etapa</p><p className="mt-2 text-base text-muted-foreground">Crie uma oportunidade ou mova uma negociação para cá.</p><Button className="mt-5 w-full" onClick={props.onCreateOpportunity}>+ Criar oportunidade</Button></div>}</div></section>})}</div><Modal open={Boolean(moving)} title="Mover etapa" onClose={()=>setMoving(undefined)}>{moving&&<div className="grid gap-3">{ordered.map(stage=><button key={stage.id} onClick={()=>{props.onMoveOpportunity(moving,stage.id);setMoving(undefined)}} className="flex min-h-16 items-center justify-between rounded-2xl border px-5 text-left text-base font-semibold premium-focus"><span>{stage.name}</span>{stage.id===moving.stageId&&<span className="text-sm text-muted-foreground">Atual</span>}</button>)}</div>}</Modal></section>;
}

function MobileOpportunityCard({item,company,contact,task,open,move}:{item:Opportunity;company?:Company;contact?:CompanyContact;task?:Task;open:()=>void;move:()=>void}){const phone=contact?.whatsapp??contact?.phone??company?.whatsapp??company?.phone,whatsapp=contactWhatsappUrl(phone);return <Card className="ring-1 ring-black/[.025]"><CardContent className="p-4"><button className="w-full text-left" onClick={open}><h3 className="text-xl font-semibold leading-snug tracking-[-.025em]">{contact?.name??company?.responsibleName??item.title}</h3>{company?.fantasyName&&<p className="mt-1 text-sm text-muted-foreground">{company.fantasyName}</p>}{phone&&<p className="mt-2 text-[15px] font-medium">{phone}</p>}<p className="mt-2 text-sm text-muted-foreground">Próxima ação: {task?formatDateTime(task.dueAt):"não programada"}</p></button><div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3">{whatsapp?<a aria-label="Abrir WhatsApp do contato" className="grid min-h-12 place-items-center rounded-xl bg-[#e8f7ee] text-[#176b3a] premium-focus" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={21}/></a>:<span aria-label="WhatsApp não informado" className="grid min-h-12 place-items-center rounded-xl bg-muted text-muted-foreground opacity-50"><MessageCircle size={21}/></span>}<button aria-label="Abrir oportunidade" className="grid min-h-12 place-items-center rounded-xl bg-muted premium-focus" onClick={open}><CalendarPlus size={21}/></button><button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground premium-focus" onClick={move}><MoveRight size={19}/>Mover</button></div></CardContent></Card>}

function FilterSheet({open,close,stageFilter,onStageFilter,...props}:Props&{open:boolean;close:()=>void;stageFilter:string;onStageFilter:(value:string)=>void}){const field=(label:string,child:React.ReactNode)=><label className="grid gap-2"><span className="text-base font-semibold">{label}</span>{child}</label>;const values=(items:(string|undefined)[])=>[...new Set(items.filter((item):item is string=>Boolean(item)))];return <Modal open={open} title="Filtros do CRM" onClose={close}><div className="grid gap-5">{field("Responsável",<Select value={props.filters.owner} onChange={e=>props.onFiltersChange({...props.filters,owner:e.target.value})}><option value="all">Todos</option>{values(props.companies.map(item=>item.owner)).map(item=><option key={item}>{item}</option>)}</Select>)}{field("Origem",<Select value={props.filters.source} onChange={e=>props.onFiltersChange({...props.filters,source:e.target.value})}><option value="all">Todas</option>{values(props.companies.map(item=>item.leadSource)).map(item=><option key={item}>{item}</option>)}</Select>)}{field("Etapa",<Select value={stageFilter} onChange={event=>onStageFilter(event.target.value)}><option value="all">Todas as etapas</option>{props.stages.map(stage=><option key={stage.id} value={stage.id}>{stage.name}</option>)}</Select>)}{field("Temperatura",<Select value={props.filters.temperature} onChange={e=>props.onFiltersChange({...props.filters,temperature:e.target.value})}><option value="all">Todas</option><option value="frio">Frio</option><option value="morno">Morno</option><option value="quente">Quente</option></Select>)}{field("Prioridade",<Select value={props.filters.priority} onChange={e=>props.onFiltersChange({...props.filters,priority:e.target.value})}><option value="all">Todas</option><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></Select>)}{field("Oportunidade",<Select value={props.filters.openOpportunity} onChange={e=>props.onFiltersChange({...props.filters,openOpportunity:e.target.value})}><option value="all">Todas</option><option value="true">Com oportunidade aberta</option><option value="false">Sem oportunidade aberta</option></Select>)}{field("Follow-up",<Select value={props.filters.overdue} onChange={e=>props.onFiltersChange({...props.filters,overdue:e.target.value})}><option value="all">Todos</option><option value="true">Atrasado</option><option value="false">Em dia</option></Select>)}{field("Atividade",<Select value={props.filters.activity} onChange={e=>props.onFiltersChange({...props.filters,activity:e.target.value})}><option value="all">Qualquer atividade</option><option value="true">Sem atividade recente</option><option value="false">Com atividade recente</option></Select>)}{field("Período",<Select value={props.filters.created} onChange={e=>props.onFiltersChange({...props.filters,created:e.target.value})}><option value="all">Qualquer período</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></Select>)}<div className="sticky bottom-0 -mx-5 grid grid-cols-2 gap-3 border-t bg-card px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"><Button variant="outline" onClick={()=>props.onFiltersChange(emptyFilters)}>Limpar</Button><Button onClick={close}>Aplicar filtros</Button></div></div></Modal>}

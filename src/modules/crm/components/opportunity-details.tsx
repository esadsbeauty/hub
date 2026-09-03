import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AtSign, CalendarClock, Check, Edit, MessageCircle, Phone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Drawer } from "@/shared/components/overlays/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { lostOpportunitySchema, type LostOpportunityFormData } from "../schema";
import type { Company, CompanyContact, Opportunity, Pipeline, PipelineStage, Task, TimelineEvent } from "../types";
import { currency, daysSince, formatDateTime } from "../utils/formatters";
import { contactInstagramUrl, contactTelephoneUrl, contactWhatsappUrl } from "../utils/contact-links";
import { ActivityTimeline } from "./activity-timeline";
import { OpportunityValueInput } from "./opportunity-value-input";
import { crmTerminology, type BusinessMode } from "../business-mode";

const lossReasons: { value: LostOpportunityFormData["reason"]; label: string }[] = [
  { value: "price", label: "Preço" }, { value: "no_response", label: "Sem resposta" },
  { value: "no_interest", label: "Sem interesse" }, { value: "competitor", label: "Concorrente" },
  { value: "timing", label: "Timing" }, { value: "no_budget", label: "Sem orçamento" },
  { value: "unqualified", label: "Não qualificado" }, { value: "other", label: "Outro" },
];

type Props = {
  businessMode?: BusinessMode;
  opportunity?: Opportunity; company?: Company; contact?: CompanyContact; pipeline?: Pipeline;
  stages: PipelineStage[]; nextTask?: Task; activities: TimelineEvent[]; open: boolean;
  onClose: () => void; onMove: (stageId: string) => void; onEdit: () => void;
  onDuplicate: () => void; onArchive: () => void; onWon: () => void;
  onLost: (data: LostOpportunityFormData) => void; onAddFollowUp: () => void;
  onSaveNote: (text: string) => Promise<void> | void; onCompleteNextTask: () => void;
  onRescheduleNextTask: (dueAt: string) => void;
  onEditContact: () => void;
};

export function OpportunityDetails(props: Props) {
  const { opportunity, company, contact, pipeline, stages, nextTask, activities } = props;
  const businessMode=props.businessMode??"b2b",b2c=businessMode==="b2c",terms=crmTerminology(businessMode);
  const [confirmWon,setConfirmWon]=useState(false),[confirmArchive,setConfirmArchive]=useState(false),[lossOpen,setLossOpen]=useState(false);
  const [note,setNote]=useState(""),[savingNote,setSavingNote]=useState(false),[rescheduling,setRescheduling]=useState(false),[newDueAt,setNewDueAt]=useState("");
  const {register,handleSubmit,formState:{errors}}=useForm<LostOpportunityFormData>({resolver:zodResolver(lostOpportunitySchema),defaultValues:{reason:"no_response",notes:""}});
  if (!opportunity) return null;
  const stage=stages.find(item=>item.id===opportunity.stageId),leadName=contact?.name??company?.responsibleName??opportunity.title;
  const rawPhone=contact?.whatsapp??contact?.phone??company?.whatsapp??company?.phone;
  const whatsapp=contactWhatsappUrl(rawPhone),telephone=contactTelephoneUrl(rawPhone),instagram=contactInstagramUrl(contact?.instagram??company?.instagram);
  const contactRows=[["WhatsApp / telefone",rawPhone],["E-mail",contact?.email??company?.email],["Instagram",contact?.instagram??company?.instagram],[b2c?"Interesse":"Cidade",b2c?company?.businessArea:company?.city]] as const;
  const commercial=[["Valor",currency.format(opportunity.value)],["Valor ponderado",currency.format(opportunity.value*opportunity.probability/100)],["Probabilidade",`${opportunity.probability}%`],["Responsável",opportunity.owner],["Origem",opportunity.source],["Previsão",opportunity.expectedCloseDate],["Criada em",formatDateTime(opportunity.createdAt)],["Tempo na etapa",`${daysSince(opportunity.stageEnteredAt)} dias`]];
  return <><Drawer open={props.open} title="Detalhe da oportunidade" onClose={props.onClose}><div className="space-y-5 overflow-x-hidden">
    <header><p className="text-xs font-bold uppercase tracking-[.16em] text-muted-foreground">Detalhe da oportunidade</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.04em]">{leadName}</h2>{company?.fantasyName&&company.fantasyName!==leadName&&<p className="mt-1 text-base text-muted-foreground">{company.fantasyName}</p>}<p className="mt-2 text-sm font-medium text-champagne-dark">{pipeline?.name} · {stage?.name}</p></header>
    <section className="rounded-[1.25rem] bg-card p-4 shadow-soft"><div className="flex items-center justify-between gap-3"><h3 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">{b2c?"Dados do Lead":"Contato principal"}</h3><Button size="sm" variant="ghost" onClick={props.onEditContact}><Edit size={15}/>{b2c?"Editar Lead":"Editar contato"}</Button></div><p className="mt-3 text-xl font-semibold">{leadName}</p><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{contactRows.filter(([,value])=>Boolean(value)).map(([label,value])=><div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-semibold">{value}</dd></div>)}</dl><div className="mt-4 grid grid-cols-3 gap-2">{whatsapp&&<a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#e8f7ee] px-2 text-sm font-semibold text-[#176b3a]" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={19}/>WhatsApp</a>}{telephone&&<a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-muted px-2 text-sm font-semibold" href={telephone}><Phone size={18}/>Ligar</a>}{instagram&&<a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-muted px-2 text-sm font-semibold" href={instagram} target="_blank" rel="noreferrer"><AtSign size={18}/>Instagram</a>}</div></section>
    <section><div className="flex items-center justify-between"><div><h3 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Etapa atual</h3><p className="mt-1 font-semibold">{stage?.name} · {stage?.probability??opportunity.probability}%</p></div></div><Select className="mt-3" aria-label="Alterar etapa da oportunidade" value={opportunity.stageId} disabled={opportunity.status!=="open"} onChange={event=>props.onMove(event.target.value)}>{stages.filter(item=>item.pipelineId===opportunity.pipelineId).sort((a,b)=>a.position-b.position).map(item=><option key={item.id} value={item.id}>{item.name} · {item.probability}%</option>)}</Select></section>
    <section className="rounded-[1.25rem] border p-4"><h3 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Próxima ação</h3>{nextTask?<><p className="mt-3 text-lg font-semibold">{nextTask.title||"Follow-up"}</p><p className="mt-1 text-sm text-muted-foreground">{formatDateTime(nextTask.dueAt)}</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={props.onCompleteNextTask}><Check size={17}/>Concluir</Button><Button size="sm" variant="outline" onClick={()=>setRescheduling(value=>!value)}><RefreshCw size={16}/>Reagendar</Button></div>{rescheduling&&<div className="mt-3 flex gap-2"><Input type="datetime-local" aria-label="Nova data do follow-up" value={newDueAt} onChange={event=>setNewDueAt(event.target.value)}/><Button disabled={!newDueAt} onClick={()=>{props.onRescheduleNextTask(new Date(newDueAt).toISOString());setRescheduling(false)}}>Salvar</Button></div>}</>:<><p className="mt-3 text-sm text-muted-foreground">Nenhuma próxima ação programada.</p><Button className="mt-3" variant="outline" onClick={props.onAddFollowUp}><CalendarClock size={17}/>Criar follow-up</Button></>}</section>
    <section><h3 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Observação rápida</h3><Textarea className="mt-3" value={note} onChange={event=>setNote(event.target.value)} placeholder="Adicionar observação..."/><Button className="mt-2" disabled={!note.trim()||savingNote} onClick={async()=>{setSavingNote(true);try{await props.onSaveNote(note.trim());setNote("")}finally{setSavingNote(false)}}}>{savingNote?"Salvando...":"Salvar observação"}</Button></section>
    <section><h3 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Comercial</h3><dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">{commercial.map(([label,value])=><div key={label} className="border-b pb-2"><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold">{value||"—"}</dd></div>)}</dl>{opportunity.description&&<p className="mt-3 rounded-xl bg-muted p-3 text-sm">{opportunity.description}</p>}{!b2c&&<p className="mt-3 text-xs text-muted-foreground">{terms.company} vinculada: <b className="text-foreground">{company?.fantasyName??"—"}</b></p>}</section>
    <section className="border-t pt-5"><h3 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Histórico</h3><div className="mt-3"><ActivityTimeline events={activities} compact/></div></section>
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={props.onEdit}>Editar negociação</Button><Button variant="outline" onClick={props.onDuplicate}>Duplicar</Button>{opportunity.status==="open"&&<><Button onClick={()=>setConfirmWon(true)}>Marcar como ganha</Button><Button variant="outline" onClick={()=>setLossOpen(true)}>Marcar como perdida</Button></>}<Button variant="ghost" onClick={()=>setConfirmArchive(true)}>Arquivar</Button></div>
    {lossOpen&&<form className="space-y-3 rounded-2xl border p-4" onSubmit={handleSubmit(data=>{props.onLost(data);setLossOpen(false)})}><h3 className="font-bold">Motivo da perda</h3><Select {...register("reason")}>{lossReasons.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</Select><Textarea placeholder="Observação opcional" {...register("notes")}/>{errors.notes&&<p className="text-sm text-red-600">{errors.notes.message}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setLossOpen(false)}>Cancelar</Button><Button>Confirmar perda</Button></div></form>}
  </div></Drawer><ConfirmDialog open={confirmArchive} title={`Arquivar “${opportunity.title}”?`} onCancel={()=>setConfirmArchive(false)} onConfirm={()=>{props.onArchive();setConfirmArchive(false)}}/><ConfirmDialog open={confirmWon} title={`Marcar “${opportunity.title}” como ganha por ${currency.format(opportunity.value)}?`} onCancel={()=>setConfirmWon(false)} onConfirm={()=>{props.onWon();setConfirmWon(false)}}/></>;
}

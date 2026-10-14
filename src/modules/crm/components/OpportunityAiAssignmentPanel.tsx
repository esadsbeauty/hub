import { useEffect, useState } from "react";
import { Bot, PauseCircle, PlayCircle, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAppState } from "@/shared/state/app-state-context";
import { Button } from "@/components/ui/button";

type AiAssignment={
  opportunity_id:string;
  assistant_type:"prospecting"|"regina"|"human";
  lead_origin:string;
  automation_status:"active"|"paused"|"review";
};
export function OpportunityAiAssignmentPanel({opportunityId,source}:{opportunityId:string;source?:string|null}){
  const {organizationId}=useAppState();
  const [assignment,setAssignment]=useState<AiAssignment|null>(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    if(!supabase||!opportunityId)return;
    let active=true;
    setAssignment(null);
    void supabase.from("crm_ai_assignments" as never).select("opportunity_id,assistant_type,lead_origin,automation_status")
      .eq("organization_id",organizationId).eq("opportunity_id",opportunityId).maybeSingle()
      .then(({data})=>{if(active)setAssignment(data as AiAssignment|null);});
    return ()=>{active=false;};
  },[organizationId,opportunityId]);
  if(organizationId!=="c6ee7876-c88b-4419-abba-b2ed4cc54257")return null;
  const agent=assignment?.assistant_type==="prospecting"?"Agente de Prospecção":assignment?.assistant_type==="regina"?"Regina":assignment?.assistant_type==="human"?"Equipe humana":"Não definida";
  const status=assignment?.automation_status==="active"?"Ativa":assignment?.automation_status==="review"?"Aguardando revisão":"Pausada";
  async function change(next:"active"|"paused"|"human"){
    if(!supabase||!assignment)return;
    setSaving(true);setError("");
    const newAssignment={
      ...assignment,
      assistant_type:next==="human"?"human":assignment.assistant_type,
      automation_status:next==="active"?"active":"paused",
    };
    const {error:dbError}=await supabase.from("crm_ai_assignments" as never)
      .update({assistant_type:newAssignment.assistant_type,automation_status:newAssignment.automation_status} as never)
      .eq("organization_id",organizationId).eq("opportunity_id",opportunityId);
    if(dbError){setError("Não foi possível atualizar o atendimento.");}
    else setAssignment(newAssignment as AiAssignment);
    setSaving(false);
  }
  return <section className="rounded-2xl border bg-card p-4">
    <div className="mb-3 flex items-center gap-2"><Bot size={17}/><h3 className="text-sm font-semibold">Controle do atendimento</h3></div>
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Origem</dt><dd>{assignment?.lead_origin==="prospecting"?"Prospecção ativa":source||assignment?.lead_origin||"Não informada"}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Assistente</dt><dd className="font-medium">{agent}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Automação</dt><dd>{assignment?status:"Sem vínculo automático"}</dd></div>
    </dl>
    <div className="mt-3 flex flex-wrap gap-2">
      {assignment?.assistant_type!=="human"&&assignment?.automation_status==="active"&&
        <Button size="sm" variant="outline" disabled={saving} onClick={()=>void change("paused")}><PauseCircle size={15}/>Pausar</Button>}
      {assignment?.assistant_type!=="human"&&assignment?.automation_status!=="active"&&assignment&&
        <Button size="sm" variant="outline" disabled={saving} onClick={()=>void change("active")}><PlayCircle size={15}/>Retomar</Button>}
      {assignment?.assistant_type!=="human"&&assignment&&
        <Button size="sm" variant="outline" disabled={saving} onClick={()=>void change("human")}><UserRound size={15}/>Assumir atendimento</Button>}
    </div>
    {error&&<p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
  </section>;
}

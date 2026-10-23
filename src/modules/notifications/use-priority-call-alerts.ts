import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAppState } from "@/shared/state/app-state-context";
import { useToast } from "@/shared/components/feedback/toast";
export type PriorityCallAlert = {id:string;title:string;description:string;createdAt:string;href:string};
export function usePriorityCallAlerts() {
 const {organizationId,authorizationLoading}=useAppState();
 const {notify}=useToast();
 const query=useQuery({
  queryKey:["notifications","priority-calls",organizationId],
  enabled:!authorizationLoading&&Boolean(organizationId)&&Boolean(supabase),
  refetchInterval:15000,
  refetchIntervalInBackground:true,
  queryFn:async():Promise<PriorityCallAlert[]>=>{
   if(!supabase)return [];
   const {data,error}=await supabase.from("tasks")
    .select("id,title,description,created_at,company_id,opportunity_id")
    .eq("organization_id",organizationId)
    .eq("title","Ligar: diagnóstico ESADS autorizado")
    .eq("status","pending").is("deleted_at",null)
    .order("created_at",{ascending:false}).limit(30);
   if(error)throw error;
   return (data??[]).map(t=>({
    id:`priority-call:${t.id}`,title:"Lead aguardando ligação",
    description:t.description??"Ligação autorizada. Atendimento prioritário.",
    createdAt:t.created_at,
    href:t.opportunity_id?`/crm?opportunity=${encodeURIComponent(t.opportunity_id)}`:t.company_id?`/crm/companies/${t.company_id}`:"/agenda"
   }));
  }
 });
 const alerts=useMemo(()=>query.data??[],[query.data]);
 useEffect(()=>{
  if(!query.isSuccess||!organizationId)return;
  const now=Date.now();
  for(const alert of alerts){
   if(now-new Date(alert.createdAt).getTime()>120000)continue;
   const key=`esads-priority-call-toast:${organizationId}:${alert.id}`;
   if(localStorage.getItem(key))continue;
   localStorage.setItem(key,"1");
   notify({title:alert.title,description:"Autorizou uma ligação. Toque para abrir o atendimento prioritário.",href:alert.href});
  }
 },[alerts,notify,query.isSuccess,organizationId]);
 return {...query,alerts};
}

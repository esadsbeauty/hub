import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAppState } from "@/shared/state/app-state-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Settings = {
  enabled: boolean;
  automation_mode: "hybrid" | "approval" | "automatic";
  agent_name: string;
  system_instructions: string;
};
const defaults: Settings = {
  enabled: false,
  automation_mode: "hybrid",
  agent_name: "Assistente de Prospecção",
  system_instructions: "Converse naturalmente com profissionais de estética que a ESADS abordou. Não se apresente como cliente da clínica. Uma pergunta por vez, sem interrogatório. Se a resposta for automática ou ambígua, aguarde aprovação humana.",
};

export function ProspectingAgentPanel() {
  const { organizationId } = useAppState();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Settings>(defaults);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const query = useQuery({
    queryKey: ["prospecting", "agent-settings", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase indisponível");
      const { data, error } = await supabase.from("prospecting_agent_settings" as never)
        .select("enabled,automation_mode,agent_name,system_instructions")
        .eq("organization_id", organizationId).maybeSingle();
      if (error) throw error;
      return (data ?? defaults) as Settings;
    },
  });
  const reviews = useQuery({
    queryKey: ["prospecting", "reviews", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase indisponível");
      const { data, error } = await supabase.from("prospecting_agent_reviews" as never)
        .select("id,inbound_text,reason,created_at,whatsapp_conversation_id")
        .eq("organization_id", organizationId).eq("status", "pending")
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => { if (query.data) setDraft(query.data); }, [query.data]);
  async function save() {
    if (!supabase || !organizationId) return;
    setSaving(true);setFeedback("");
    const { error } = await supabase.from("prospecting_agent_settings" as never).upsert({
      organization_id: organizationId, ...draft, updated_at: new Date().toISOString(),
    } as never);
    setSaving(false);
    setFeedback(error ? "Não foi possível salvar as configurações." : "Configurações salvas.");
    if (!error) void queryClient.invalidateQueries({queryKey:["prospecting","agent-settings",organizationId]});
  }
  return <Card>
    <CardContent className="space-y-4 p-5">
      <div className="flex items-center gap-2"><Bot size={20}/><h2 className="text-lg font-semibold">Agente de Prospecção</h2></div>
      <p className="text-sm text-muted-foreground">Configuração independente da Regina Comercial. A automação só será habilitada depois da validação do roteador e da aprovação humana.</p>
      <label className="block text-sm font-medium">Nome da agente
        <input className="mt-1 w-full rounded-md border bg-background p-2" value={draft.agent_name} onChange={e=>setDraft(v=>({...v,agent_name:e.target.value}))}/>
      </label>
      <label className="block text-sm font-medium">Modo de operação
        <select className="mt-1 w-full rounded-md border bg-background p-2" value={draft.automation_mode} onChange={e=>setDraft(v=>({...v,automation_mode:e.target.value as Settings["automation_mode"]}))}>
          <option value="hybrid">Híbrido — automático quando seguro, humano quando ambíguo</option>
          <option value="approval">Todas as mensagens aguardam aprovação</option>
          <option value="automatic">Automático com proteções</option>
        </select>
      </label>
      <label className="block text-sm font-medium">Instruções específicas
        <textarea className="mt-1 min-h-32 w-full rounded-md border bg-background p-2" value={draft.system_instructions} onChange={e=>setDraft(v=>({...v,system_instructions:e.target.value}))}/>
      </label>
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldAlert size={17}/> Ativação automática ainda bloqueada até a validação dos envios e da fila de aprovação.</p>
      <Button type="button" disabled={saving||query.isLoading} onClick={()=>void save()}>{saving?"Salvando…":"Salvar configurações"}</Button>
      {feedback&&<p role="status" className="text-sm">{feedback}</p>}
      <div className="border-t pt-3"><h3 className="font-semibold">Conversas aguardando revisão</h3>
        {reviews.data?.length===0&&<p className="mt-2 text-sm text-muted-foreground">Nenhuma conversa pendente.</p>}
        {reviews.data?.map((item:any)=><div key={item.id} className="mt-2 rounded-lg border p-3">
          <p className="text-sm">{item.inbound_text}</p><p className="mt-1 text-xs text-muted-foreground">{item.reason} · {new Date(item.created_at).toLocaleString("pt-BR")}</p>
          <p className="mt-1 text-xs text-muted-foreground">Abra a conversa no WhatsApp do sistema para responder manualmente.</p>
        </div>)}
      </div>
    </CardContent>
  </Card>;
}

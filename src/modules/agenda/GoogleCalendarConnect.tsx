import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
type Connection = { connected: boolean; googleEmail?: string | null; error?: string; url?: string };
export function GoogleCalendarConnect() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<Array<{ id:string; title:string; startAt:string; endAt:string }>>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google_calendar");
    if (result) {
      setMessage(result === "connected" ? "Google Agenda conectado. A sincronização de eventos ainda está em preparação." : "Não foi possível concluir a conexão com o Google: " + result);
      params.delete("google_calendar");
      const suffix = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (suffix ? "?" + suffix : ""));
    }
    if (supabase) void supabase.functions.invoke("google-calendar-oauth", { body: { action: "status" } })
      .then(({ data }) => { if (active && data) setConnection(data as Connection); });
    return () => { active = false; };
  }, []);
  const call = async (action: "start" | "disconnect") => {
    if (!supabase) return;
    setBusy(true); setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-oauth", { body: { action } });
      if (error) throw error;
      const response = data as Connection;
      if (response.error) throw new Error(response.error === "google_calendar_not_configured" ? "Credenciais do Google ainda não configuradas no Supabase." : response.error);
      if (action === "start" && response.url) { window.location.assign(response.url); return; }
      setConnection({ connected: false });
    } catch (err) { setMessage(err instanceof Error ? err.message : "Falha ao conectar ao Google."); }
    finally { setBusy(false); }
  };
  const sync = async (action: "preview" | "push") => {
    if (!supabase) return;
    setBusy(true); setMessage("");
    try {
      const from = new Date(); from.setDate(from.getDate() - 7);
      const to = new Date(); to.setDate(to.getDate() + 30);
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {body: {action, from: from.toISOString(), to: to.toISOString()}});
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      if (action === "preview") {setGoogleEvents(data.events ?? []); setMessage(`${data.events?.length ?? 0} compromissos encontrados no Google nos próximos 30 dias (incluindo os últimos 7).`);}
      else setMessage(`${data.created ?? 0} eventos enviados ao Google. ${data.skipped ?? 0} ignorados. ${data.failed ?? 0} falhas.`);
    } catch(err) { setMessage(err instanceof Error ? err.message : "Falha na sincronização."); }
    finally { setBusy(false); }
  };
  return <div className="flex flex-wrap items-center gap-2">
    {connection?.connected ? <>
      <span className="text-xs text-muted-foreground">Google conectado{connection.googleEmail ? ": " + connection.googleEmail : ""}</span>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void sync("preview")}>Ver compromissos Google</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void sync("push")}>Enviar meus eventos ao Google</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void call("disconnect")}>Desconectar Google</Button>
    </> : <Button size="sm" variant="outline" disabled={busy} onClick={() => void call("start")}>Conectar Google Agenda</Button>}
    {message && <span role="status" className="max-w-64 text-xs text-muted-foreground">{message}</span>}
    {googleEvents.length > 0 && <details className="w-full text-xs"><summary className="cursor-pointer">Compromissos do Google ({googleEvents.length})</summary><ul className="max-h-48 overflow-auto rounded border p-2">{googleEvents.slice(0,100).map(e => <li key={e.id} className="py-1">{new Date(e.startAt).toLocaleString("pt-BR")} — {e.title}</li>)}</ul></details>}
  </div>;
}

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
type Connection = { connected: boolean; googleEmail?: string | null; error?: string; url?: string };
export function GoogleCalendarConnect() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
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
  return <div className="flex flex-wrap items-center gap-2">
    {connection?.connected ? <>
      <span className="text-xs text-muted-foreground">Google conectado{connection.googleEmail ? ": " + connection.googleEmail : ""}</span>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void call("disconnect")}>Desconectar Google</Button>
    </> : <Button size="sm" variant="outline" disabled={busy} onClick={() => void call("start")}>Conectar Google Agenda</Button>}
    {message && <span role="status" className="max-w-64 text-xs text-muted-foreground">{message}</span>}
  </div>;
}

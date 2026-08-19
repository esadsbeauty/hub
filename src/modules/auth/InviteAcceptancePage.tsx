import { useState } from "react";
import { Navigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/auth-context";
import { useAppState } from "@/shared/state/app-state-context";

export function InviteAcceptancePage() {
  const auth = useAuth(); const { organizationName, status, authorizationLoading } = useAppState();
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  if (!auth.loading && !auth.user) return <Navigate to="/login" replace/>;
  if (!authorizationLoading && status === "active") return <Navigate to="/" replace/>;
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(""); if (password.length < 8) return setError("A senha deve possuir pelo menos 8 caracteres."); if (password !== confirmation) return setError("As senhas não coincidem."); setSaving(true); try { await auth.completeInvitation(password); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível criar seu acesso."); setSaving(false); } }
  return <main className="grid min-h-dvh place-items-center bg-background p-4"><Card className="w-full max-w-md"><CardContent className="p-6 sm:p-9"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-champagne-soft"><KeyRound size={22}/></div><h1 className="mt-6 text-2xl font-bold">Você foi convidado</h1><p className="mt-2 text-sm text-muted-foreground">Crie sua senha para acessar o Hub da {organizationName || "ESADS Beauty"}.</p><form className="mt-7 space-y-4" onSubmit={submit}><div><Label htmlFor="invite-password">Nova senha</Label><Input id="invite-password" type="password" autoComplete="new-password" className="mt-1" value={password} onChange={(event) => setPassword(event.target.value)}/></div><div><Label htmlFor="invite-confirmation">Confirmar senha</Label><Input id="invite-confirmation" type="password" autoComplete="new-password" className="mt-1" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}/></div>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button className="w-full" disabled={saving}>{saving ? "Criando acesso…" : "Criar meu acesso"}</Button></form></CardContent></Card></main>;
}

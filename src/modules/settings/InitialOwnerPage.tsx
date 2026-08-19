import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/auth-provider";
import { useAppState } from "@/shared/state/app-state";
import { useBootstrapStatus, useGovernanceActions } from "./hooks";

export function InitialOwnerPage() {
  const { user } = useAuth(); const { status } = useAppState(); const bootstrap = useBootstrapStatus(); const actions = useGovernanceActions();
  const [name, setName] = useState(() => user?.user_metadata?.name ?? ""); const [error, setError] = useState("");
  if (status === "active") return <Navigate to="/" replace/>;
  if (bootstrap.isLoading) return <div className="grid min-h-[65dvh] place-items-center text-sm text-muted-foreground">Validando configuração inicial…</div>;
  const allowed = bootstrap.data?.available && bootstrap.data.eligible;
  return <div className="grid min-h-[70dvh] place-items-center px-4"><Card className="w-full max-w-lg"><CardContent className="p-6 sm:p-10"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-champagne-soft"><Crown size={22}/></div><h1 className="mt-6 text-2xl font-bold">{allowed ? "Finalizar configuração" : "Acesso pendente"}</h1><p className="mt-2 text-sm text-muted-foreground">{allowed ? `Vamos configurar seu acesso principal à ${bootstrap.data?.organizationName ?? "ESADS Beauty"}.` : "Seu usuário ainda não está autorizado para concluir a configuração inicial. Entre em contato com o responsável pela organização."}</p>{allowed && <div className="mt-7 space-y-4"><div><Label htmlFor="owner-name">Seu nome</Label><Input id="owner-name" autoComplete="name" className="mt-1" value={name} onChange={(event) => setName(event.target.value)}/></div><div className="rounded-xl bg-muted p-4 text-sm"><span className="text-muted-foreground">Organização</span><b className="mt-1 block">{bootstrap.data?.organizationName}</b></div>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button className="w-full" disabled={!name.trim() || actions.claimInitialOwner.isPending} onClick={() => { setError(""); actions.claimInitialOwner.mutate(name.trim(), { onSuccess: () => window.location.assign("/"), onError: (cause) => setError(cause.message) }); }}>{actions.claimInitialOwner.isPending ? "Ativando…" : "Ativar como Administrador Geral"}</Button></div>}</CardContent></Card></div>;
}

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { PageContainer } from "@/shared/components/layout/page-container";
import { PageHeader } from "@/shared/components/layout/page-header";
import { platformRepository } from "./repository";
import type { PlatformSnapshot } from "./types";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function PlatformPage() {
  const [data, setData] = useState<PlatformSnapshot>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const load = () => platformRepository.snapshot().then(setData).catch((reason: Error) => setError(reason.message));
  useEffect(() => { void load(); }, []);
  if (error) return <PageContainer><p role="alert" className="text-destructive">{error}</p></PageContainer>;
  if (!data) return <PageContainer><p className="text-muted-foreground">Carregando gestão da plataforma...</p></PageContainer>;
  return <PageContainer>
    <PageHeader title="Administração da plataforma" description="Planos e entitlements globais, separados da administração de cada organização." />
    <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <section className="space-y-3"><h2 className="text-lg font-semibold">Planos</h2>{data.plans.map((plan) => <Card key={plan.id}><CardHeader><div className="flex items-center justify-between"><CardTitle>{plan.name}</CardTitle><Badge>{plan.isActive ? "Ativo" : "Inativo"}</Badge></div></CardHeader><CardContent><p className="text-2xl font-semibold">{money(plan.priceCents)}<span className="text-sm font-normal text-muted-foreground">/mês</span></p><p className="mt-1 text-sm text-muted-foreground">Cobrança {plan.billingMode === "manual" ? "manual, sem renovação automática" : "automática"}</p><div className="mt-4 flex flex-wrap gap-2">{plan.entitlements.map((item) => <Badge key={item}>{item}</Badge>)}</div></CardContent></Card>)}</section>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Organizações</h2>{data.organizations.map((organization) => <Card key={organization.id}><CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold">{organization.name}</p><p className="text-sm text-muted-foreground">Plano atual: {organization.planName ?? "Sem plano"}</p></div><Select aria-label={`Plano de ${organization.name}`} value={organization.planId ?? ""} onChange={(event) => setData((current) => current && ({ ...current, organizations: current.organizations.map((item) => item.id === organization.id ? { ...item, planId: event.target.value } : item) }))}><option value="">Selecione</option>{data.plans.filter((plan) => plan.isActive).map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</Select><Button disabled={!organization.planId || saving === organization.id} onClick={async () => { if (!organization.planId) return; setSaving(organization.id); try { await platformRepository.assignPlan(organization.id, organization.planId); await load(); } catch (reason) { setError((reason as Error).message); } finally { setSaving(""); } }}>{saving === organization.id ? "Salvando..." : "Aplicar"}</Button></CardContent></Card>)}</section>
    </div>
  </PageContainer>;
}

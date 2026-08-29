import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageContainer } from "@/shared/components/layout/page-container";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Modal } from "@/shared/components/overlays/modal";
import { platformRepository } from "./repository";
import type { PlatformSnapshot, ProvisionOrganizationInput } from "./types";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const date = (value?: string) => value ? new Intl.DateTimeFormat("pt-BR").format(new Date(value)) : "—";
const emptyForm: ProvisionOrganizationInput = { organizationName: "", ownerName: "", ownerEmail: "", ownerWhatsapp: "", pipelineName: "Pipeline Comercial" };

export function PlatformPage() {
  const [data, setData] = useState<PlatformSnapshot>();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState("");
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [form, setForm] = useState<ProvisionOrganizationInput>(emptyForm);
  const load = () => platformRepository.snapshot().then((snapshot) => { setData(snapshot); setError(""); }).catch((reason: Error) => setError(reason.message));
  useEffect(() => { void load(); }, []);
  const founders = data?.plans.find((plan) => plan.slug === "fundadores" && plan.isActive);
  const openProvisioning = () => { setForm({ ...emptyForm, planId: founders?.id }); setError(""); setSuccess(""); setProvisionOpen(true); };
  const provision = async (event: React.FormEvent) => {
    event.preventDefault(); setProvisioning(true); setError("");
    try { const result = await platformRepository.provision(form); setProvisionOpen(false); setSuccess(result.message); await load(); }
    catch (reason) { setError((reason as Error).message); }
    finally { setProvisioning(false); }
  };

  if (!data) return <PageContainer><p className="text-muted-foreground">{error || "Carregando gestão da plataforma..."}</p></PageContainer>;
  return <PageContainer>
    <PageHeader title="Administração da plataforma" description="Planos, organizações e provisionamento seguro de novos clientes." actions={<Button onClick={openProvisioning}><Plus size={18}/>Nova organização</Button>} />
    {success && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>}
    {error && !provisionOpen && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-destructive">{error}</p>}
    <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <section className="space-y-3"><h2 className="text-lg font-semibold">Planos</h2>{data.plans.map((plan) => <Card key={plan.id}><CardHeader><div className="flex items-center justify-between"><CardTitle>{plan.name}</CardTitle><Badge>{plan.isActive ? "Ativo" : "Técnico"}</Badge></div></CardHeader><CardContent><p className="text-2xl font-semibold">{money(plan.priceCents)}<span className="text-sm font-normal text-muted-foreground">/mês</span></p><p className="mt-1 text-sm text-muted-foreground">Cobrança {plan.billingMode === "manual" ? "manual, sem renovação automática" : "automática"}</p><div className="mt-4 flex flex-wrap gap-2">{plan.entitlements.map((item) => <Badge key={item}>{item}</Badge>)}</div></CardContent></Card>)}</section>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Organizações</h2>{data.organizations.map((organization) => <Card key={organization.id}><CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold">{organization.name}</p><p className="text-sm text-muted-foreground">{organization.ownerName || "Responsável não informado"}{organization.ownerEmail ? ` · ${organization.ownerEmail}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">Criada em {date(organization.createdAt)} · {organization.status ?? "active"}</p></div><Select aria-label={`Plano de ${organization.name}`} value={organization.planId ?? ""} onChange={(event) => setData((current) => current && ({ ...current, organizations: current.organizations.map((item) => item.id === organization.id ? { ...item, planId: event.target.value } : item) }))}><option value="">Selecione</option>{data.plans.filter((plan) => plan.isActive).map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</Select><Button disabled={!organization.planId || saving === organization.id} onClick={async () => { if (!organization.planId) return; setSaving(organization.id); try { await platformRepository.assignPlan(organization.id, organization.planId); await load(); } catch (reason) { setError((reason as Error).message); } finally { setSaving(""); } }}>{saving === organization.id ? "Salvando..." : "Aplicar"}</Button></CardContent></Card>)}</section>
    </div>
    <Modal open={provisionOpen} title="Nova organização" onClose={() => !provisioning && setProvisionOpen(false)}>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={provision}>
        <Field label="Nome da empresa"><Input required value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })}/></Field>
        <Field label="Nome do responsável"><Input required value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })}/></Field>
        <Field label="E-mail do responsável"><Input required type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}/></Field>
        <Field label="WhatsApp do responsável"><Input required type="tel" value={form.ownerWhatsapp} onChange={(e) => setForm({ ...form, ownerWhatsapp: e.target.value })}/></Field>
        <Field label="Plano"><Select required value={form.planId ?? ""} onChange={(e) => setForm({ ...form, planId: e.target.value })}>{data.plans.filter((plan) => plan.isActive).map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</Select></Field>
        <Field label="Nome do pipeline"><Input required value={form.pipelineName} onChange={(e) => setForm({ ...form, pipelineName: e.target.value })}/></Field>
        {error && <p role="alert" className="text-sm text-destructive md:col-span-2">{error}</p>}
        <div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="outline" disabled={provisioning} onClick={() => setProvisionOpen(false)}>Cancelar</Button><Button type="submit" disabled={provisioning}>{provisioning ? "Preparando organização..." : "Criar e enviar convite"}</Button></div>
      </form>
    </Modal>
  </PageContainer>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }

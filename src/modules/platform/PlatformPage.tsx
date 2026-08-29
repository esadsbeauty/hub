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

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const date = (value?: string) =>
  value ? new Intl.DateTimeFormat("pt-BR").format(new Date(value)) : "—";

const emptyForm: ProvisionOrganizationInput = {
  organizationName: "",
  ownerName: "",
  ownerEmail: "",
  ownerWhatsapp: "",
  pipelineName: "Pipeline Comercial",
};

export function PlatformPage() {
  const [data, setData] = useState<PlatformSnapshot>();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState("");
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [form, setForm] = useState<ProvisionOrganizationInput>(emptyForm);

  const load = () =>
    platformRepository
      .snapshot()
      .then((snapshot) => {
        setData(snapshot);
        setError("");
      })
      .catch((reason: Error) => setError(reason.message));

  useEffect(() => {
    void load();
  }, []);

  const founders = data?.plans.find((plan) => plan.slug === "fundadores" && plan.isActive);

  const openProvisioning = () => {
    setForm({ ...emptyForm, planId: founders?.id });
    setError("");
    setSuccess("");
    setProvisionOpen(true);
  };

  const provision = async (event: React.FormEvent) => {
    event.preventDefault();
    setProvisioning(true);
    setError("");

    try {
      const result = await platformRepository.provision(form);
      setProvisionOpen(false);
      setSuccess(result.message);
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setProvisioning(false);
    }
  };

  if (!data) {
    return (
      <PageContainer>
        <p className="text-muted-foreground">{error || "Carregando gestão da plataforma..."}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Administração da plataforma"
        description="Planos, organizações e provisionamento seguro de novos clientes."
        actions={
          <Button onClick={openProvisioning}>
            <Plus size={18} />
            Nova organização
          </Button>
        }
      />

      {success && (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </p>
      )}

      {error && !provisionOpen && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Planos</h2>
          {data.plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{plan.name}</CardTitle>
                  <Badge>{plan.isActive ? "Ativo" : "Inativo"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {money(plan.priceCents)}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cobrança {plan.billingMode === "manual" ? "manual, sem renovação automática" : "automática"}
                </p>
                {plan.slug === "legacy" && (
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    Plano legado — somente manutenção. Não disponível para novas contratações.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {plan.entitlements.map((item) => (
                    <Badge key={item}>{item}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Organizações</h2>
          {data.organizations.map((organization) => {
            const currentPlan = data.plans.find((plan) => plan.id === organization.planId);
            const selectedActivePlanId = currentPlan?.isActive ? organization.planId ?? "" : "";

            return (
              <Card key={organization.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{organization.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {organization.ownerName || "Responsável não informado"}
                        {organization.ownerEmail ? ` · ${organization.ownerEmail}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <p className="text-sm text-muted-foreground">
                          Plano atual: <span className="font-medium text-foreground">{organization.planName ?? "Sem plano"}</span>
                        </p>
                        {currentPlan?.slug === "legacy" && <Badge>Legado</Badge>}
                      </div>
                      {currentPlan?.slug === "legacy" && (
                        <p className="mt-1 text-xs text-muted-foreground">Plano legado — somente manutenção.</p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Criada em {date(organization.createdAt)} · {organization.status ?? "active"}
                      </p>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center lg:max-w-xl">
                      <Select
                        aria-label={`Alterar plano de ${organization.name}`}
                        value={selectedActivePlanId}
                        onChange={(event) =>
                          setData((current) =>
                            current && {
                              ...current,
                              organizations: current.organizations.map((item) =>
                                item.id === organization.id ? { ...item, planId: event.target.value } : item,
                              ),
                            },
                          )
                        }
                      >
                        <option value="">Alterar para...</option>
                        {data.plans
                          .filter((plan) => plan.isActive)
                          .map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name} — {money(plan.priceCents)}/mês
                            </option>
                          ))}
                      </Select>

                      <Button
                        disabled={!organization.planId || organization.planId === currentPlan?.id || saving === organization.id}
                        onClick={async () => {
                          if (!organization.planId || organization.planId === currentPlan?.id) return;
                          setSaving(organization.id);
                          try {
                            await platformRepository.assignPlan(organization.id, organization.planId);
                            await load();
                          } catch (reason) {
                            setError((reason as Error).message);
                          } finally {
                            setSaving("");
                          }
                        }}
                      >
                        {saving === organization.id ? "Salvando..." : "Aplicar"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>

      <Modal open={provisionOpen} title="Nova organização" onClose={() => !provisioning && setProvisionOpen(false)}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={provision}>
          <Field label="Nome da empresa">
            <Input
              required
              value={form.organizationName}
              onChange={(event) => setForm({ ...form, organizationName: event.target.value })}
            />
          </Field>

          <Field label="Nome do responsável">
            <Input
              required
              value={form.ownerName}
              onChange={(event) => setForm({ ...form, ownerName: event.target.value })}
            />
          </Field>

          <Field label="E-mail do responsável">
            <Input
              required
              type="email"
              value={form.ownerEmail}
              onChange={(event) => setForm({ ...form, ownerEmail: event.target.value })}
            />
          </Field>

          <Field label="WhatsApp do responsável">
            <Input
              required
              type="tel"
              value={form.ownerWhatsapp}
              onChange={(event) => setForm({ ...form, ownerWhatsapp: event.target.value })}
            />
          </Field>

          <Field label="Plano">
            <Select
              required
              value={form.planId ?? ""}
              onChange={(event) => setForm({ ...form, planId: event.target.value })}
            >
              {data.plans
                .filter((plan) => plan.isActive)
                .map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — {money(plan.priceCents)}/mês
                  </option>
                ))}
            </Select>
          </Field>

          <Field label="Nome do pipeline">
            <Input
              required
              value={form.pipelineName}
              onChange={(event) => setForm({ ...form, pipelineName: event.target.value })}
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-destructive md:col-span-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="outline" disabled={provisioning} onClick={() => setProvisionOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={provisioning}>
              {provisioning ? "Preparando organização..." : "Criar e enviar convite"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

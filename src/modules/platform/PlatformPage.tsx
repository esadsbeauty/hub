import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { PageContainer } from "@/shared/components/layout/page-container";
import { PageHeader } from "@/shared/components/layout/page-header";
import { platformRepository } from "./repository";
import type { PlatformSnapshot } from "./types";

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);

export function PlatformPage() {
  const [data, setData] = useState<PlatformSnapshot>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");

  const load = () =>
    platformRepository
      .snapshot()
      .then(setData)
      .catch((reason: Error) => setError(reason.message));

  useEffect(() => {
    void load();
  }, []);

  if (error) {
    return (
      <PageContainer>
        <p role="alert" className="text-destructive">
          {error}
        </p>
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer>
        <p className="text-muted-foreground">Carregando gestão da plataforma...</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Administração da plataforma"
        description="Planos e entitlements globais, separados da administração de cada organização."
      />

      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Planos</h2>
          {data.plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
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
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-sm text-muted-foreground">
                          Plano atual: <span className="font-medium text-foreground">{organization.planName ?? "Sem plano"}</span>
                        </p>
                        {currentPlan?.slug === "legacy" && <Badge>Legado</Badge>}
                      </div>
                      {currentPlan?.slug === "legacy" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Plano legado — somente manutenção.
                        </p>
                      )}
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
    </PageContainer>
  );
}

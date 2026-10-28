import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/shared/components/overlays/drawer";
import { platformRepository } from "../repository";
import { organizationsRepository } from "./repository";
import type {
  CommercialAssistantDetails,
  OrganizationDetails,
  OrganizationType,
} from "./types";

const date = (v?: string) =>
  v ? new Intl.DateTimeFormat("pt-BR").format(new Date(v)) : "—";

const money = (v = 0) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v / 100);

export function OrganizationDetailsDrawer({
  details,
  plans,
  open,
  onClose,
  onChanged,
}: {
  details?: OrganizationDetails;
  plans: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    organizationType: "production" as OrganizationType,
    timezone: "",
    locale: "",
    currency: "",
  });
  const [planId, setPlanId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [suspendConfirm, setSuspendConfirm] = useState(false);
  const [deleteStep, setDeleteStep] = useState(false);
  const [typed, setTyped] = useState("");
  const [assistant, setAssistant] =
    useState<CommercialAssistantDetails>();
  const [assistantPipelineId, setAssistantPipelineId] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);

  useEffect(() => {
    if (!details) return;

    setForm({
      name: details.name,
      slug: details.slug,
      organizationType: details.organizationType,
      timezone: details.timezone,
      locale: details.locale,
      currency: details.currency,
    });
    setPlanId(details.plan?.id ?? "");
    setTyped("");
    setDeleteStep(false);

    let active = true;
    setAssistantLoading(true);

    void organizationsRepository
      .assistantDetails(details.id)
      .then((value) => {
        if (!active) return;
        setAssistant(value);

        const configuredPipeline =
          String(value.agent?.crmConfig?.pipeline_id ?? "");
        const defaultPipeline =
          value.pipelines.find((pipeline) => pipeline.isDefault)?.id ??
          value.pipelines[0]?.id ??
          "";

        setAssistantPipelineId(configuredPipeline || defaultPipeline);
      })
      .catch((cause) => {
        if (active) setError((cause as Error).message);
      })
      .finally(() => {
        if (active) setAssistantLoading(false);
      });

    return () => {
      active = false;
    };
  }, [details]);

  if (!details) return null;

  const suspended =
    details.subscription?.status === "suspended" ||
    details.subscription?.status === "cancelled";

  const act = async (fn: () => Promise<unknown>) => {
    setSaving(true);
    setError("");

    try {
      await fn();
      await onChanged();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const configureAssistant = async (enabled: boolean) => {
    setSaving(true);
    setError("");

    try {
      const updated = await organizationsRepository.configureAssistant(
        details.id,
        enabled ? assistantPipelineId || null : null,
        enabled,
      );
      setAssistant(updated);

      const configuredPipeline =
        String(updated.agent?.crmConfig?.pipeline_id ?? "");
      if (configuredPipeline) {
        setAssistantPipelineId(configuredPipeline);
      }

      await onChanged();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const impact = Object.entries(details.impact);

  return (
    <>
      <Drawer open={open} title="Organização" onClose={onClose}>
        <div className="space-y-6 overflow-x-hidden">
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <section>
            <h2 className="text-2xl font-semibold">{details.name}</h2>
            <p className="text-sm text-muted-foreground">
              {details.slug} · criada em {date(details.createdAt)}
            </p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome">
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </Field>
            <Field label="Slug">
              <Input
                value={form.slug}
                onChange={(event) =>
                  setForm({ ...form, slug: event.target.value })
                }
              />
            </Field>
            <Field label="Tipo">
              <Select
                value={form.organizationType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    organizationType: event.target.value as OrganizationType,
                  })
                }
              >
                <option value="production">Produção</option>
                <option value="test">Teste</option>
                <option value="demo">Demo</option>
              </Select>
            </Field>
            <Field label="Timezone">
              <Input
                value={form.timezone}
                onChange={(event) =>
                  setForm({ ...form, timezone: event.target.value })
                }
              />
            </Field>
            <Field label="Locale">
              <Input
                value={form.locale}
                onChange={(event) =>
                  setForm({ ...form, locale: event.target.value })
                }
              />
            </Field>
            <Field label="Moeda">
              <Input
                maxLength={3}
                value={form.currency}
                onChange={(event) =>
                  setForm({
                    ...form,
                    currency: event.target.value.toUpperCase(),
                  })
                }
              />
            </Field>
            <Button
              className="sm:col-span-2"
              disabled={saving}
              onClick={() =>
                void act(() => organizationsRepository.update(details.id, form))
              }
            >
              Salvar identificação
            </Button>
          </section>

          <Info title="Owner">
            {details.owner ? (
              <>
                <b>{details.owner.name}</b>
                <p>{details.owner.email}</p>
                <p className="break-all text-xs text-muted-foreground">
                  {details.owner.id} · vínculo {details.owner.membershipStatus}
                </p>
              </>
            ) : (
              <p>Owner não encontrado.</p>
            )}
          </Info>

          <Info title="Plano e assinatura">
            <p>
              <b>{details.plan?.name ?? "Sem plano"}</b> ·{" "}
              {money(details.plan?.priceCents)}
            </p>
            <p>Status: {details.subscription?.status ?? "—"}</p>
            <p>
              Início: {date(details.subscription?.startedAt)} · próximo
              vencimento: {date(details.subscription?.nextDueAt)}
            </p>
            <p>
              Suspensão: {date(details.subscription?.suspendedAt)} ·
              cancelamento: {date(details.subscription?.cancelledAt)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Entitlements: {details.plan?.entitlements.join(", ") || "—"}
            </p>
            <div className="mt-3 flex gap-2">
              <Select
                value={planId}
                onChange={(event) => setPlanId(event.target.value)}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </Select>
              <Button
                variant="outline"
                disabled={!planId || saving}
                onClick={() =>
                  void act(() =>
                    platformRepository.assignPlan(details.id, planId),
                  )
                }
              >
                Alterar plano
              </Button>
            </div>
          </Info>

          <section className="rounded-2xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">
                  Assistente Comercial
                </p>
                <h3 className="mt-1 font-semibold">
                  {assistant?.enabled ? "Ativada" : "Desativada"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {assistant?.enabled
                    ? (assistant.agent?.name ?? "Assistente") +
                      " está liberada para esta organização."
                    : "Ative para preparar o pipeline e o roteamento do atendimento automaticamente."}
                </p>
              </div>
              <span
                className={[
                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                  assistant?.enabled
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {assistantLoading
                  ? "Carregando..."
                  : assistant?.enabled
                    ? "Ativa"
                    : "Inativa"}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <Field label="Pipeline">
                <Select
                  value={assistantPipelineId}
                  disabled={assistantLoading || saving}
                  onChange={(event) =>
                    setAssistantPipelineId(event.target.value)
                  }
                >
                  <option value="">Selecione um pipeline</option>
                  {(assistant?.pipelines ?? []).map((pipeline) => (
                    <option key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                      {pipeline.isDefault ? " · padrão" : ""}
                    </option>
                  ))}
                </Select>
              </Field>

              {assistant?.enabled && assistant.agent?.crmConfig && (
                <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">
                    Roteamento configurado
                  </p>
                  <p className="mt-1">
                    Novo Lead → Em atendimento → Atendimento humano → Agendado
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {assistant?.enabled ? (
                  <>
                    <Button
                      variant="outline"
                      disabled={!assistantPipelineId || saving}
                      onClick={() => void configureAssistant(true)}
                    >
                      Reconfigurar pipeline
                    </Button>
                    <Button
                      variant="outline"
                      disabled={saving}
                      onClick={() => void configureAssistant(false)}
                    >
                      Desativar Assistente
                    </Button>
                  </>
                ) : (
                  <Button
                    disabled={saving || assistantLoading}
                    onClick={() => void configureAssistant(true)}
                  >
                    {assistantPipelineId
                      ? "Ativar Assistente Comercial"
                      : "Ativar e criar pipeline"}
                  </Button>
                )}
              </div>

              {!assistantLoading && (assistant?.pipelines.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">
                  Esta organização ainda não possui pipeline. Ao ativar, o sistema
                  criará automaticamente o Pipeline Beauty com as etapas padrão.
                </p>
              )}
            </div>
          </section>

          <Info title="Usuários">
            <div className="grid grid-cols-4 gap-2 text-center">
              {Object.entries(details.users).map(([key, value]) => (
                <p key={key}>
                  <b className="block text-lg">{value}</b>
                  <span className="text-xs text-muted-foreground">{key}</span>
                </p>
              ))}
            </div>
          </Info>

          <Info title="Dados operacionais">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {impact.map(([key, value]) => (
                <p key={key}>
                  <b>{value}</b> {key}
                </p>
              ))}
            </div>
          </Info>

          <section>
            <h3 className="font-semibold">Acesso operacional</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Suspender preserva usuários e dados; apenas bloqueia o acesso
              operacional.
            </p>
            {suspended ? (
              <Button
                className="mt-3"
                variant="outline"
                disabled={saving || !details.subscription}
                onClick={() =>
                  details.subscription &&
                  void act(() =>
                    platformRepository.reactivate(details.subscription!.id),
                  )
                }
              >
                Reativar organização
              </Button>
            ) : (
              <Button
                className="mt-3"
                variant="outline"
                disabled={saving || !details.subscription}
                onClick={() => setSuspendConfirm(true)}
              >
                Suspender organização
              </Button>
            )}
          </section>

          <section className="rounded-2xl border border-red-200 p-4">
            <h3 className="font-semibold text-destructive">Zona de perigo</h3>
            {details.organizationType === "production" ||
            details.slug === "esads-beauty" ? (
              <p className="mt-2 text-sm">
                Organizações de produção e a organização principal ESADS Beauty
                não podem ser excluídas por esta interface. Suspenda ou revise
                manualmente.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm">
                  A exclusão permanente remove os dados tenant apresentados
                  acima, mas não apaga usuários do Auth.
                </p>
                <Button
                  className="mt-3"
                  variant="ghost"
                  onClick={() => setDeleteStep(true)}
                >
                  Preparar exclusão permanente
                </Button>
                {deleteStep && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm">
                      Digite exatamente <b>{details.name}</b>:
                    </p>
                    <Input
                      value={typed}
                      onChange={(event) => setTyped(event.target.value)}
                    />
                    <Button
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={typed !== details.name || saving}
                      onClick={() => {
                        if (
                          confirm(
                            "Confirma a exclusão permanente de " +
                              details.name +
                              "?",
                          )
                        ) {
                          void act(() =>
                            organizationsRepository.remove(details.id, typed),
                          );
                        }
                      }}
                    >
                      Excluir permanentemente
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </Drawer>

      <ConfirmDialog
        open={suspendConfirm}
        title="Suspender esta organização?"
        description="Os dados serão preservados, mas o acesso operacional será bloqueado."
        confirmLabel="Suspender organização"
        onCancel={() => setSuspendConfirm(false)}
        onConfirm={() => {
          setSuspendConfirm(false);
          if (details.subscription) {
            void act(() =>
              platformRepository.suspend(details.subscription!.id),
            );
          }
        }}
      />
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Info({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-muted/50 p-4 text-sm">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

import { useEffect, useState } from "react";
import { Bot, Save, SlidersHorizontal, ShieldCheck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/shared/components/feedback/states";
import { useToast } from "@/shared/components/feedback/toast";

import {
  useAiAgent,
  useUpdateAiAgent,
} from "./ai-agent-hooks";

import type {
  AiAgentConfig,
  AiAgentConfigUpdate,
} from "./ai-agent-repository";

type Props = {
  organizationId: string;
  editable: boolean;
};

export function AiAgentSettingsPanel({
  organizationId,
  editable,
}: Props) {
  const query = useAiAgent(organizationId);
  const updateAgent = useUpdateAiAgent(organizationId);
  const { notify } = useToast();

  const [form, setForm] = useState<AiAgentConfig | null>(null);

  useEffect(() => {
    if (query.data) {
      setForm(query.data);
    }
  }, [query.data]);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!query.data || !form) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            Nenhuma assistente comercial foi encontrada para esta organização.
          </p>
        </CardContent>
      </Card>
    );
  }

  const save = async () => {
    const input: Partial<AiAgentConfigUpdate> = {
      name: form.name,
      role: form.role,
      is_enabled: form.is_enabled,
      objective: form.objective,
      tone: form.tone,
      welcome_message: form.welcome_message,
      behavior_config: form.behavior_config,
      capabilities: form.capabilities,
    };

    try {
      await updateAgent.mutateAsync(input);

      notify({
        title: "Configurações da assistente salvas.",
      });
    } catch (error) {
      notify({
        title:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a assistente.",
      });
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">
          Assistente Comercial
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Configure como a assistente deve se apresentar, conversar e atuar no atendimento comercial.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound size={18} />
            Identidade
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="agent-name">
                Nome da assistente
              </Label>

              <Input
                id="agent-name"
                disabled={!editable}
                className="mt-1"
                value={form.name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    name: event.target.value,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="agent-role">
                Função
              </Label>

              <Input
                id="agent-role"
                disabled={!editable}
                className="mt-1"
                value={form.role}
                onChange={(event) =>
                  setForm({
                    ...form,
                    role: event.target.value,
                  })
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="agent-objective">
              Objetivo principal
            </Label>

            <textarea
              id="agent-objective"
              disabled={!editable}
              className="mt-1 min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={form.objective}
              onChange={(event) =>
                setForm({
                  ...form,
                  objective: event.target.value,
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="agent-tone">
              Tom de voz
            </Label>

            <Input
              id="agent-tone"
              disabled={!editable}
              className="mt-1"
              value={form.tone}
              onChange={(event) =>
                setForm({
                  ...form,
                  tone: event.target.value,
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="agent-welcome">
              Mensagem de apresentação
            </Label>

            <textarea
              id="agent-welcome"
              disabled={!editable}
              className="mt-1 min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={form.welcome_message ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  welcome_message: event.target.value,
                })
              }
            />
          </div>

          <label className="flex items-center gap-3 rounded-xl border p-4">
            <input
              type="checkbox"
              disabled={!editable}
              checked={form.is_enabled}
              onChange={(event) =>
                setForm({
                  ...form,
                  is_enabled: event.target.checked,
                })
              }
            />

            <span>
              <b className="block text-sm">
                Assistente ativa
              </b>

              <span className="text-xs text-muted-foreground">
                Permite que a assistente responda quando as demais regras do CRM autorizarem.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal size={18} />
            Comportamento da conversa
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="mobile-lines">
                Linhas por mensagem no mobile
              </Label>

              <Select
                id="mobile-lines"
                disabled={!editable}
                className="mt-1"
                value={String(
                  form.behavior_config.mobile_lines_per_message,
                )}
                onChange={(event) =>
                  setForm({
                    ...form,
                    behavior_config: {
                      ...form.behavior_config,
                      mobile_lines_per_message:
                        Number(event.target.value),
                    },
                  })
                }
              >
                <option value="2">2 linhas</option>
                <option value="3">3 linhas</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="max-messages">
                Máximo de mensagens consecutivas
              </Label>

              <Select
                id="max-messages"
                disabled={!editable}
                className="mt-1"
                value={String(
                  form.behavior_config.max_consecutive_messages,
                )}
                onChange={(event) =>
                  setForm({
                    ...form,
                    behavior_config: {
                      ...form.behavior_config,
                      max_consecutive_messages:
                        Number(event.target.value),
                    },
                  })
                }
              >
                <option value="3">3 mensagens</option>
                <option value="4">4 mensagens</option>
                <option value="5">5 mensagens</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="questions-per-message">
                Perguntas por mensagem
              </Label>

              <Select
                id="questions-per-message"
                disabled={!editable}
                className="mt-1"
                value={String(
                  form.behavior_config.questions_per_message,
                )}
                onChange={(event) =>
                  setForm({
                    ...form,
                    behavior_config: {
                      ...form.behavior_config,
                      questions_per_message:
                        Number(event.target.value),
                    },
                  })
                }
              >
                <option value="1">1 pergunta</option>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-xl border p-4">
            <input
              type="checkbox"
              disabled={!editable}
              checked={
                form.behavior_config.avoid_long_paragraphs
              }
              onChange={(event) =>
                setForm({
                  ...form,
                  behavior_config: {
                    ...form.behavior_config,
                    avoid_long_paragraphs:
                      event.target.checked,
                  },
                })
              }
            />

            <span>
              <b className="block text-sm">
                Evitar parágrafos longos
              </b>

              <span className="text-xs text-muted-foreground">
                Prioriza mensagens curtas e fáceis de ler no WhatsApp.
              </span>
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-xl border p-4">
            <input
              type="checkbox"
              disabled={!editable}
              checked={
                form.behavior_config.split_long_messages
              }
              onChange={(event) =>
                setForm({
                  ...form,
                  behavior_config: {
                    ...form.behavior_config,
                    split_long_messages:
                      event.target.checked,
                  },
                })
              }
            />

            <span>
              <b className="block text-sm">
                Quebrar mensagens longas
              </b>

              <span className="text-xs text-muted-foreground">
                Respostas maiores podem ser divididas em mensagens menores, preservando frases completas.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck size={18} />
            Permissões da assistente
          </CardTitle>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-2">
          <CapabilityToggle
            label="Responder novas mensagens"
            checked={form.capabilities.respond_new_messages}
            disabled={!editable}
            onChange={(checked) =>
              setForm({
                ...form,
                capabilities: {
                  ...form.capabilities,
                  respond_new_messages: checked,
                },
              })
            }
          />

          <CapabilityToggle
            label="Continuar conversas da equipe"
            checked={form.capabilities.continue_team_conversations}
            disabled={!editable}
            onChange={(checked) =>
              setForm({
                ...form,
                capabilities: {
                  ...form.capabilities,
                  continue_team_conversations: checked,
                },
              })
            }
          />

          <CapabilityToggle
            label="Qualificar leads"
            checked={form.capabilities.qualify_leads}
            disabled={!editable}
            onChange={(checked) =>
              setForm({
                ...form,
                capabilities: {
                  ...form.capabilities,
                  qualify_leads: checked,
                },
              })
            }
          />

          <CapabilityToggle
            label="Atualizar CRM"
            checked={form.capabilities.update_crm}
            disabled={!editable}
            onChange={(checked) =>
              setForm({
                ...form,
                capabilities: {
                  ...form.capabilities,
                  update_crm: checked,
                },
              })
            }
          />

          <CapabilityToggle
            label="Gerar resumo"
            checked={form.capabilities.generate_summary}
            disabled={!editable}
            onChange={(checked) =>
              setForm({
                ...form,
                capabilities: {
                  ...form.capabilities,
                  generate_summary: checked,
                },
              })
            }
          />

          <CapabilityToggle
            label="Calcular score"
            checked={form.capabilities.calculate_score}
            disabled={!editable}
            onChange={(checked) =>
              setForm({
                ...form,
                capabilities: {
                  ...form.capabilities,
                  calculate_score: checked,
                },
              })
            }
          />

          <CapabilityToggle
            label="Fazer handoff para humano"
            checked={form.capabilities.handoff_to_human}
            disabled={!editable}
            onChange={(checked) =>
              setForm({
                ...form,
                capabilities: {
                  ...form.capabilities,
                  handoff_to_human: checked,
                },
              })
            }
          />

          <CapabilityToggle
            label="Informar preços"
            checked={form.capabilities.send_prices}
            disabled={!editable}
            onChange={(checked) =>
              setForm({
                ...form,
                capabilities: {
                  ...form.capabilities,
                  send_prices: checked,
                },
              })
            }
          />

          <CapabilityToggle
            label="Agendar automaticamente"
            checked={form.capabilities.schedule_appointments}
            disabled={!editable}
            onChange={(checked) =>
              setForm({
                ...form,
                capabilities: {
                  ...form.capabilities,
                  schedule_appointments: checked,
                },
              })
            }
          />

          <CapabilityToggle
            label="Reativar leads"
            checked={form.capabilities.reactivate_leads}
            disabled={!editable}
            onChange={(checked) =>
              setForm({
                ...form,
                capabilities: {
                  ...form.capabilities,
                  reactivate_leads: checked,
                },
              })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot size={18} />
            Próximas configurações
          </CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-sm text-muted-foreground">
            Na próxima etapa vamos adicionar aqui as perguntas de qualificação, regras de handoff, contexto do negócio e etapas do CRM.
          </p>
        </CardContent>
      </Card>

      {editable && (
        <div className="flex justify-end">
          <Button
            onClick={save}
            disabled={updateAgent.isPending}
          >
            <Save size={16} />

            {updateAgent.isPending
              ? "Salvando..."
              : "Salvar configurações"}
          </Button>
        </div>
      )}
    </section>
  );
}

function CapabilityToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border p-4">
      <input
        type="checkbox"
        disabled={disabled}
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked)
        }
      />

      <span className="text-sm font-medium">
        {label}
      </span>
    </label>
  );
}

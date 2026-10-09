import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  BriefcaseBusiness,
  ListChecks,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from "lucide-react";

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
  AiAgentBusinessContext,
  AiAgentConfig,
  AiAgentConfigUpdate,
  AiAgentQualificationQuestion,
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
      const normalizedQuestions = Array.isArray(
        query.data.qualification_questions,
      )
        ? query.data.qualification_questions.map(
            (item: any, index: number) => ({
              key: String(
                item?.key ??
                  item?.field ??
                  item?.name ??
                  `question_${index + 1}`,
              ).trim(),
              question: String(
                item?.question ??
                  item?.label ??
                  item?.text ??
                  "",
              ).trim(),
              required: Boolean(item?.required ?? false),
              enabled: item?.enabled !== false,
            }),
          )
        : [];

      setForm({
        ...query.data,
        qualification_questions: normalizedQuestions,
        business_context:
          query.data.business_context &&
          typeof query.data.business_context === "object"
            ? query.data.business_context
            : {},
      });
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
      qualification_questions: form.qualification_questions,
      business_context: form.business_context,
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

  const updateBusinessContext = (
    key: keyof AiAgentBusinessContext,
    value: string,
  ) => {
    setForm({
      ...form,
      business_context: {
        ...form.business_context,
        [key]: value,
      },
    });
  };

  const updateQuestion = (
    index: number,
    patch: Partial<AiAgentQualificationQuestion>,
  ) => {
    const next = [...form.qualification_questions];

    next[index] = {
      ...next[index],
      ...patch,
    };

    setForm({
      ...form,
      qualification_questions: next,
    });
  };

  const addQuestion = () => {
    setForm({
      ...form,
      qualification_questions: [
        ...form.qualification_questions,
        {
          key: "",
          question: "",
          required: false,
          enabled: true,
        },
      ],
    });
  };

  const removeQuestion = (index: number) => {
    setForm({
      ...form,
      qualification_questions:
        form.qualification_questions.filter(
          (_, itemIndex) => itemIndex !== index,
        ),
    });
  };

  const moveQuestion = (
    index: number,
    direction: -1 | 1,
  ) => {
    const targetIndex = index + direction;

    if (
      targetIndex < 0 ||
      targetIndex >= form.qualification_questions.length
    ) {
      return;
    }

    const next = [...form.qualification_questions];
    const current = next[index];

    next[index] = next[targetIndex];
    next[targetIndex] = current;

    setForm({
      ...form,
      qualification_questions: next,
    });
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
            label="Fazer follow-up automático"
            checked={form.capabilities.follow_up_leads === true}
            disabled={!editable}
            onChange={(checked) =>
              setForm({
                ...form,
                capabilities: {
                  ...form.capabilities,
                  follow_up_leads: checked,
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
            <ListChecks size={18} />
            Perguntas de qualificação
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Essas perguntas orientam o que a assistente precisa descobrir durante a conversa. Ela não precisa seguir a lista como um questionário.
          </p>

          {form.qualification_questions.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              Nenhuma pergunta configurada.
            </div>
          ) : (
            <div className="space-y-3">
              {form.qualification_questions.map(
                (question, index) => (
                  <div
                    key={`${question.key}-${index}`}
                    className="rounded-xl border p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">
                        Pergunta {index + 1}
                      </span>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!editable || index === 0}
                          onClick={() => moveQuestion(index, -1)}
                          title="Mover para cima"
                        >
                          <ArrowUp size={16} />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            !editable ||
                            index ===
                              form.qualification_questions.length - 1
                          }
                          onClick={() => moveQuestion(index, 1)}
                          title="Mover para baixo"
                        >
                          <ArrowDown size={16} />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!editable}
                          onClick={() => removeQuestion(index)}
                          title="Excluir pergunta"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                      <div>
                        <Label>Pergunta</Label>
                        <textarea
                          disabled={!editable}
                          className="mt-1 min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                          value={question.question}
                          placeholder="Ex.: Qual é o principal serviço que você quer vender mais hoje?"
                          onChange={(event) =>
                            updateQuestion(index, {
                              question: event.target.value,
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label>Campo interno</Label>
                        <Input
                          disabled={!editable}
                          className="mt-1"
                          value={question.key}
                          placeholder="main_service"
                          onChange={(event) =>
                            updateQuestion(index, {
                              key: event.target.value
                                .toLowerCase()
                                .replace(/\s+/g, "_"),
                            })
                          }
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Usado internamente para salvar a resposta.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          disabled={!editable}
                          checked={question.enabled}
                          onChange={(event) =>
                            updateQuestion(index, {
                              enabled: event.target.checked,
                            })
                          }
                        />
                        Ativa
                      </label>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          disabled={!editable}
                          checked={question.required}
                          onChange={(event) =>
                            updateQuestion(index, {
                              required: event.target.checked,
                            })
                          }
                        />
                        Importante para qualificação
                      </label>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          {editable && (
            <Button
              type="button"
              variant="outline"
              onClick={addQuestion}
            >
              <Plus size={16} />
              Adicionar pergunta
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BriefcaseBusiness size={18} />
            Contexto do negócio
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Informações que ajudam a assistente a entender a empresa e responder de forma mais contextualizada.
          </p>

          <BusinessContextField
            label="Sobre a empresa"
            value={String(form.business_context.company_about ?? "")}
            disabled={!editable}
            placeholder="Explique de forma simples o que a empresa faz e como ajuda seus clientes."
            onChange={(value) =>
              updateBusinessContext("company_about", value)
            }
          />

          <div className="grid gap-4 md:grid-cols-2">
            <BusinessContextField
              label="Principais serviços"
              value={String(form.business_context.main_services ?? "")}
              disabled={!editable}
              placeholder="Liste os principais serviços, procedimentos ou produtos."
              onChange={(value) =>
                updateBusinessContext("main_services", value)
              }
            />

            <BusinessContextField
              label="Diferenciais"
              value={String(form.business_context.differentiators ?? "")}
              disabled={!editable}
              placeholder="O que diferencia a empresa dos concorrentes?"
              onChange={(value) =>
                updateBusinessContext("differentiators", value)
              }
            />

            <BusinessContextField
              label="Público-alvo"
              value={String(form.business_context.target_audience ?? "")}
              disabled={!editable}
              placeholder="Quem são os clientes ideais?"
              onChange={(value) =>
                updateBusinessContext("target_audience", value)
              }
            />

            <BusinessContextField
              label="Região de atendimento"
              value={String(form.business_context.service_region ?? "")}
              disabled={!editable}
              placeholder="Cidade, região ou atendimento online."
              onChange={(value) =>
                updateBusinessContext("service_region", value)
              }
            />

            <BusinessContextField
              label="Horário de atendimento"
              value={String(form.business_context.business_hours ?? "")}
              disabled={!editable}
              placeholder="Ex.: Segunda a sexta, das 8h às 18h."
              onChange={(value) =>
                updateBusinessContext("business_hours", value)
              }
            />

            <BusinessContextField
              label="Informações comerciais importantes"
              value={String(
                form.business_context.commercial_information ?? "",
              )}
              disabled={!editable}
              placeholder="Condições, regras ou orientações importantes para o atendimento."
              onChange={(value) =>
                updateBusinessContext(
                  "commercial_information",
                  value,
                )
              }
            />

            <BusinessContextField
              label="Preços que pode informar"
              value={String(form.business_context.allowed_prices ?? "")}
              disabled={!editable}
              placeholder="Informe somente preços que a assistente pode dizer ao lead."
              onChange={(value) =>
                updateBusinessContext("allowed_prices", value)
              }
            />

            <BusinessContextField
              label="Informações que não deve informar"
              value={String(
                form.business_context.restricted_information ?? "",
              )}
              disabled={!editable}
              placeholder="Ex.: descontos internos, dados sensíveis ou condições não públicas."
              onChange={(value) =>
                updateBusinessContext(
                  "restricted_information",
                  value,
                )
              }
            />
          </div>
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
            Na próxima etapa vamos adicionar regras de handoff e configuração das etapas do CRM.
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

function BusinessContextField({
  label,
  value,
  disabled,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>

      <textarea
        disabled={disabled}
        className="mt-1 min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
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

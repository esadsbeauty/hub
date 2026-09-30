import { createClient } from "npm:@supabase/supabase-js@2";

type AgentPayload = {
  organization_id?: string;
  whatsapp_conversation_id?: string | null;
  agent_conversation_id?: string | null;
  company_id?: string | null;
  opportunity_id?: string | null;
  message?: string;
  test_mode?: boolean;
};

type QualificationUpdate = {
  key: string;
  value: string;
};

type AgentResult = {
  messages: string[];
  qualification_updates: QualificationUpdate[];
  qualification_score: number;
  handoff: boolean;
  handoff_reason: string | null;
  summary: string;
};

const jsonResponse = (
  status: number,
  body: Record<string, unknown>,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });

function extractOutputText(response: any): string | null {
  if (!Array.isArray(response?.output)) return null;

  for (const item of response.output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;

    for (const content of item.content) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(405, {
      code: "method_not_allowed",
      message: "Método não permitido.",
    });
  }

  const internalSecret = Deno.env.get("AI_AGENT_INTERNAL_SECRET");
  const receivedSecret = request.headers.get("x-ai-agent-secret");

  if (!internalSecret || !receivedSecret || receivedSecret !== internalSecret) {
    return jsonResponse(401, {
      code: "unauthorized",
      message: "Acesso não autorizado.",
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !serviceRole || !openAiKey) {
    return jsonResponse(503, {
      code: "not_configured",
      message: "Configuração do agente incompleta.",
    });
  }

  const payload = await request.json().catch(() => ({})) as AgentPayload;
  const organizationId = payload.organization_id?.trim();
  const message = payload.message?.trim();

  if (!organizationId || !message) {
    return jsonResponse(400, {
      code: "invalid_input",
      message: "organization_id e message são obrigatórios.",
    });
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: agent, error: agentError } = await admin
    .from("ai_agents")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (agentError || !agent) {
    return jsonResponse(404, {
      code: "agent_not_found",
      message: "Agente de IA não encontrado.",
    });
  }

  if (!agent.is_enabled && !payload.test_mode) {
    return jsonResponse(409, {
      code: "agent_disabled",
      message: "O agente está desativado.",
    });
  }

  let conversation: any = null;

  if (payload.agent_conversation_id) {
    const { data } = await admin
      .from("ai_agent_conversations")
      .select("*")
      .eq("id", payload.agent_conversation_id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    conversation = data;
  }

  if (!conversation && payload.whatsapp_conversation_id) {
    const { data } = await admin
      .from("ai_agent_conversations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("whatsapp_conversation_id", payload.whatsapp_conversation_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    conversation = data;
  }

  if (!conversation) {
    const { data, error } = await admin
      .from("ai_agent_conversations")
      .insert({
        organization_id: organizationId,
        agent_id: agent.id,
        whatsapp_conversation_id: payload.whatsapp_conversation_id ?? null,
        company_id: payload.company_id ?? null,
        opportunity_id: payload.opportunity_id ?? null,
        status: "active",
        last_lead_message_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("ai_agent_conversation_create_failed", error?.message);
      return jsonResponse(500, {
        code: "conversation_create_failed",
        message: "Não foi possível iniciar a conversa da IA.",
      });
    }

    conversation = data;
  }

  const { data: recentRuns } = await admin
    .from("ai_agent_runs")
    .select("input_message,output_message,created_at")
    .eq("conversation_id", conversation.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(8);

  const history = [...(recentRuns ?? [])]
    .reverse()
    .map((run: any) => [
      `Lead: ${run.input_message ?? ""}`,
      `Regina: ${run.output_message ?? ""}`,
    ].join("\n"))
    .join("\n\n");

  const modelName = agent.model_name?.trim() || "gpt-5.6-luna";

  const { data: run, error: runError } = await admin
    .from("ai_agent_runs")
    .insert({
      organization_id: organizationId,
      agent_id: agent.id,
      conversation_id: conversation.id,
      input_message: message,
      model_provider: "openai",
      model_name: modelName,
      status: "processing",
    })
    .select("*")
    .single();

  if (runError || !run) {
    console.error("ai_agent_run_create_failed", runError?.message);
    return jsonResponse(500, {
      code: "run_create_failed",
      message: "Não foi possível iniciar o processamento.",
    });
  }

  try {
    const qualificationQuestions = JSON.stringify(agent.qualification_questions ?? [], null, 2);
    const handoffRules = JSON.stringify(agent.handoff_rules ?? [], null, 2);
    const businessContext = JSON.stringify(agent.business_context ?? {}, null, 2);
    const currentQualification = JSON.stringify(conversation.qualification_data ?? {}, null, 2);

    const instructions = `
${agent.system_prompt ?? ""}

CONTEXTO DO NEGÓCIO:
${businessContext}

PERGUNTAS DE QUALIFICAÇÃO CONFIGURADAS:
${qualificationQuestions}

REGRAS DE HANDOFF:
${handoffRules}

DADOS JÁ COLETADOS:
${currentQualification}

RESUMO ATUAL:
${conversation.summary ?? "Ainda não existe resumo."}

REGRAS OPERACIONAIS IMPORTANTES:

1. Converse como uma atendente humana da ESADS Beauty.
2. Não diga que é um modelo de linguagem.
3. Você pode se identificar como Regina, assistente virtual da ESADS Beauty.
4. Faça exatamente uma pergunta por mensagem. Nunca envie duas perguntas na mesma resposta.
5. Não peça confirmação de uma informação que o lead já deixou clara. Exemplo: se ele disser que quer mais clientes para preenchimento labial, considere "preenchimento labial" como o serviço principal e siga para a próxima pergunta.
6. Não repita perguntas que já foram respondidas.
7. Aproveite informações espontâneas fornecidas pelo lead.
8. Seja curta e natural para WhatsApp.
9. Não invente informações sobre preços, resultados, clientes ou serviços.
10. Quando não tiver segurança para responder, faça handoff.
11. Se o lead pedir reunião, proposta ou atendimento humano, faça handoff.
12. qualification_updates deve conter apenas informações realmente obtidas do lead.
13. qualification_score deve ser de 0 a 100.
14. O resumo deve ser objetivo e útil para o atendente humano.
15. Se handoff for false, handoff_reason deve ser null.
16. Retorne de 1 a 3 mensagens curtas no campo messages.
17. Na maioria dos turnos, use apenas 1 mensagem. Divida em 2 ou 3 somente quando isso deixar a conversa mais natural ou evitar um bloco longo.
18. Cada item de messages deve ser curto e próprio para WhatsApp, em geral com no máximo 2 ou 3 linhas visuais.
19. Mesmo quando usar mais de uma mensagem, faça apenas UMA pergunta principal no turno inteiro.
20. Evite começar com \"Entendi\", \"Perfeito\", \"Ótimo\", \"Certo\" ou equivalentes.
21. Não use emoji em todas as mensagens. Emojis são opcionais e devem aparecer apenas ocasionalmente.
22. Evite repetir o que o lead acabou de dizer. Use a informação e avance.
`;

    const userInput = `
HISTÓRICO RECENTE:
${history || "Sem histórico anterior."}

NOVA MENSAGEM DO LEAD:
${message}

Responda à nova mensagem considerando todo o contexto acima.
`;

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        instructions,
        input: userInput,
        store: false,
        max_output_tokens: 700,
        text: {
          format: {
            type: "json_schema",
            name: "regina_agent_response",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                messages: {
                  type: "array",
                  minItems: 1,
                  maxItems: 3,
                  items: { type: "string" },
                },
                qualification_updates: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      key: { type: "string" },
                      value: { type: "string" },
                    },
                    required: ["key", "value"],
                  },
                },
                qualification_score: {
                  type: "integer",
                  minimum: 0,
                  maximum: 100,
                },
                handoff: { type: "boolean" },
                handoff_reason: {
                  type: ["string", "null"],
                },
                summary: { type: "string" },
              },
              required: [
                "messages",
                "qualification_updates",
                "qualification_score",
                "handoff",
                "handoff_reason",
                "summary",
              ],
            },
          },
        },
      }),
    });

    const openAiBody = await openAiResponse.json();

    if (!openAiResponse.ok) {
      console.error(
        "openai_response_error",
        openAiResponse.status,
        openAiBody?.error?.message ?? "unknown_error",
      );
      throw new Error(openAiBody?.error?.message ?? "openai_request_failed");
    }

    const outputText = extractOutputText(openAiBody);

    if (!outputText) throw new Error("openai_empty_output");

    let result: AgentResult;

    try {
      result = JSON.parse(outputText) as AgentResult;
    } catch {
      throw new Error("openai_invalid_json");
    }

    const cleanMessages = Array.isArray(result.messages)
      ? result.messages
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];

    if (cleanMessages.length === 0) {
      throw new Error("openai_empty_messages");
    }

    const mergedQualification = {
      ...(conversation.qualification_data ?? {}),
    };

    for (const update of result.qualification_updates ?? []) {
      if (update?.key && typeof update.value === "string" && update.value.trim()) {
        mergedQualification[update.key] = update.value.trim();
      }
    }

    let conversationStatus = "active";

    if (result.handoff) {
      conversationStatus = "handoff";
    } else if (result.qualification_score >= 70) {
      conversationStatus = "qualified";
    }

    const now = new Date().toISOString();

    const { error: conversationUpdateError } = await admin
      .from("ai_agent_conversations")
      .update({
        qualification_data: mergedQualification,
        qualification_score: result.qualification_score,
        summary: result.summary,
        status: conversationStatus,
        handoff_reason: result.handoff ? result.handoff_reason : null,
        last_lead_message_at: now,
        last_ai_message_at: now,
        updated_at: now,
      })
      .eq("id", conversation.id);

    if (conversationUpdateError) {
      throw new Error(`conversation_update_failed:${conversationUpdateError.message}`);
    }

    const { data: crmSyncResult, error: crmSyncError } = await admin.rpc(
      "sync_ai_agent_crm",
      {
        p_ai_conversation_id: conversation.id,
      },
    );

    if (crmSyncError) {
      console.error(
        "ai_agent_crm_sync_failed",
        crmSyncError.message,
      );
    } else {
      console.log(
        "ai_agent_crm_sync_completed",
        crmSyncResult,
      );
    }

    if (
      Array.isArray(result.qualification_updates) &&
      result.qualification_updates.length > 0
    ) {
      await admin
        .from("ai_agent_actions")
        .insert({
          organization_id: organizationId,
          agent_id: agent.id,
          conversation_id: conversation.id,
          run_id: run.id,
          action_type: "qualification_updated",
          payload: {
            updates: result.qualification_updates,
            score: result.qualification_score,
          },
          status: "completed",
        });
    }

    if (result.handoff) {
      await admin
        .from("ai_agent_actions")
        .insert({
          organization_id: organizationId,
          agent_id: agent.id,
          conversation_id: conversation.id,
          run_id: run.id,
          action_type: "handoff_requested",
          payload: {
            reason: result.handoff_reason,
            summary: result.summary,
          },
          status: "completed",
        });
    }

    const combinedOutput = cleanMessages.join("\n\n");

    await admin
      .from("ai_agent_runs")
      .update({
        output_message: combinedOutput,
        status: result.handoff ? "handoff" : "completed",
        completed_at: now,
        metadata: {
          openai_response_id: openAiBody?.id ?? null,
          qualification_score: result.qualification_score,
          handoff: result.handoff,
          message_count: cleanMessages.length,
          usage: openAiBody?.usage ?? null,
        },
      })
      .eq("id", run.id);

    return jsonResponse(200, {
      ok: true,
      agent: {
        id: agent.id,
        name: agent.name,
      },
      conversation_id: conversation.id,
      messages: cleanMessages,
      reply: combinedOutput,
      qualification_updates: result.qualification_updates,
      qualification_score: result.qualification_score,
      handoff: result.handoff,
      handoff_reason: result.handoff_reason,
      summary: result.summary,
      summary: result.summary,
      crm_sync: crmSyncResult ?? null,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "unknown_error";

    console.error("ai_agent_process_failed", errorMessage);

    await admin
      .from("ai_agent_runs")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    return jsonResponse(500, {
      code: "ai_processing_failed",
      message: "Não foi possível processar a mensagem com a Regina.",
    });
  }
});

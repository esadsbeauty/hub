import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY =
  Deno.env.get("OPENAI_API_KEY") ?? "";
const AI_AGENT_INTERNAL_SECRET =
  Deno.env.get("AI_AGENT_INTERNAL_SECRET") ?? "";
const AI_FOLLOWUPS_CRON_SECRET =
  Deno.env.get("AI_FOLLOWUPS_CRON_SECRET") ?? "";

const admin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

type FollowupJob = {
  id: string;
  organization_id: string;
  agent_id: string;
  ai_conversation_id: string;
  whatsapp_conversation_id: string;
  round_key: string;
  sequence: number;
  source_lead_message_at: string;
  source_ai_message_at: string;
  due_at: string;
  status: string;
};

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function extractOutputText(response: any) {
  if (!Array.isArray(response?.output)) return null;

  for (const item of response.output) {
    if (
      item?.type !== "message" ||
      !Array.isArray(item.content)
    ) {
      continue;
    }

    for (const content of item.content) {
      if (
        content?.type === "output_text" &&
        typeof content.text === "string"
      ) {
        return content.text;
      }
    }
  }

  return null;
}

function localHourMinute(
  date: Date,
  timeZone: string,
) {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  ).formatToParts(date);

  const hour = Number(
    parts.find((part) => part.type === "hour")?.value ?? 0,
  );
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );

  return { hour, minute };
}

function quietDelayMinutes(
  now: Date,
  timeZone: string,
  quietStart: number,
  quietEnd: number,
) {
  const { hour, minute } =
    localHourMinute(now, timeZone);

  const isQuiet =
    quietStart > quietEnd
      ? hour >= quietStart || hour < quietEnd
      : hour >= quietStart && hour < quietEnd;

  if (!isQuiet) return 0;

  const currentMinutes = hour * 60 + minute;
  const endMinutes = quietEnd * 60;

  let delay =
    currentMinutes < endMinutes
      ? endMinutes - currentMinutes
      : 24 * 60 - currentMinutes + endMinutes;

  // Pequena folga depois das 06h para não disparar tudo exatamente no mesmo minuto.
  delay += 10 + Math.floor(Math.random() * 21);

  return delay;
}

async function cancelJob(
  job: FollowupJob,
  reason: string,
  expired = false,
) {
  const now = new Date().toISOString();

  await admin
    .from("ai_agent_followups")
    .update({
      status: expired ? "expired" : "cancelled",
      cancelled_at: now,
      error_message: reason,
      updated_at: now,
    })
    .eq("id", job.id)
    .eq("status", "processing");
}

async function failJob(
  job: FollowupJob,
  reason: string,
) {
  const now = new Date().toISOString();

  await admin
    .from("ai_agent_followups")
    .update({
      status: "failed",
      error_message: reason,
      updated_at: now,
    })
    .eq("id", job.id);
}

async function sendWhatsAppText(
  connectionId: string,
  phoneNumberId: string,
  organizationId: string,
  conversationId: string,
  waId: string,
  text: string,
) {
  const secretResult = await admin
    .from("whatsapp_connection_secrets")
    .select("access_token,token_expires_at")
    .eq("connection_id", connectionId)
    .maybeSingle();

  if (secretResult.error) {
    throw new Error(
      `whatsapp_secret_load_failed:${secretResult.error.message}`,
    );
  }

  const accessToken =
    secretResult.data?.access_token ??
    Deno.env.get("WHATSAPP_ACCESS_TOKEN");

  if (!accessToken) {
    throw new Error("whatsapp_access_token_missing");
  }

  const tokenExpiresAt =
    secretResult.data?.token_expires_at;

  if (
    tokenExpiresAt &&
    new Date(tokenExpiresAt).getTime() <= Date.now()
  ) {
    throw new Error("whatsapp_access_token_expired");
  }

  const response = await fetch(
    `https://graph.facebook.com/v26.0/${encodeURIComponent(
      phoneNumberId,
    )}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: waId,
        type: "text",
        text: {
          preview_url: false,
          body: text.slice(0, 4096),
        },
      }),
    },
  );

  const payload = await response
    .json()
    .catch(() => ({})) as {
      messages?: Array<{ id?: string }>;
      error?: { code?: number; message?: string };
    };

  if (!response.ok) {
    throw new Error(
      `meta_send_failed:${payload.error?.code ?? response.status}`,
    );
  }

  const externalMessageId =
    payload.messages?.[0]?.id;

  if (!externalMessageId) {
    throw new Error("meta_message_id_missing");
  }

  const sentAt = new Date().toISOString();

  const { error: messageError } = await admin
    .from("whatsapp_messages")
    .insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      external_message_id: externalMessageId,
      direction: "outbound",
      message_type: "text",
      text_body: text.slice(0, 4096),
      message_timestamp: sentAt,
      raw_payload: {
        messages: [{ id: externalMessageId }],
        source: "ai_followup",
      },
    });

  if (
    messageError &&
    messageError.code !== "23505"
  ) {
    throw new Error(
      `followup_message_save_failed:${messageError.message}`,
    );
  }

  await admin
    .from("whatsapp_conversations")
    .update({
      last_message_at: sentAt,
      updated_at: sentAt,
    })
    .eq("id", conversationId)
    .eq("organization_id", organizationId);

  return {
    externalMessageId,
    sentAt,
  };
}

async function generateContextualFollowup(
  job: FollowupJob,
  agent: any,
  contactName: string | null,
) {
  const { data: history, error } = await admin
    .from("whatsapp_messages")
    .select(
      "direction,text_body,message_timestamp,raw_payload",
    )
    .eq(
      "conversation_id",
      job.whatsapp_conversation_id,
    )
    .order("message_timestamp", {
      ascending: false,
    })
    .limit(24);

  if (error) {
    throw new Error(
      `followup_history_failed:${error.message}`,
    );
  }

  const transcript = [...(history ?? [])]
    .reverse()
    .map((item: any) => {
      const body =
        String(item?.text_body ?? "").trim();

      if (!body) return null;

      if (item.direction === "inbound") {
        return `Lead: ${body}`;
      }

      const source =
        item?.raw_payload?.source;

      if (source === "ai_followup") {
        return `Follow-up anterior: ${body}`;
      }

      if (source === "ai_agent") {
        return `${agent.name}: ${body}`;
      }

      return `Equipe: ${body}`;
    })
    .filter(Boolean)
    .join("\n");

  const businessContext =
    JSON.stringify(
      agent.business_context ?? {},
      null,
      2,
    );

  const systemPrompt =
    String(agent.system_prompt ?? "").trim();

  const prompt = `
Você está escrevendo um follow-up de WhatsApp em nome de ${agent.name}, uma assistente comercial.

Este é o follow-up ${job.sequence} desta rodada de silêncio.

OBJETIVO:
Retomar a conversa exatamente do ponto em que ela parou e aumentar a chance de o lead responder, sem parecer uma mensagem automática.

REGRAS OBRIGATÓRIAS:
- Gere EXATAMENTE uma única mensagem.
- A mensagem deve fazer sentido com o contexto real da conversa.
- Considere a última pergunta ou assunto que ficou sem resposta.
- Não repita literalmente nenhum follow-up anterior.
- Não use sempre "conseguiu ver minha mensagem?", "viu minha mensagem?" ou variações genéricas.
- Não repita uma pergunta que o lead já respondeu.
- Não invente informações.
- Faça no máximo uma pergunta principal.
- Seja curta: idealmente 1 a 3 linhas no WhatsApp.
- Tom humano, natural, profissional e acolhedor.
- Follow-up 1: retomada leve e contextual.
- Follow-up 2: retomada contextual com tom um pouco mais conclusivo; pode deixar a porta aberta sem pressionar.
- Não diga que é um sistema, IA ou automação.
- Não prometa preço, condição ou agenda que não esteja no histórico.
- Se a conversa já estiver claramente encerrada pelo lead, devolva uma mensagem vazia.

NOME DO CONTATO:
${contactName ?? "Não informado"}

CONTEXTO DO NEGÓCIO:
${businessContext}

ORIENTAÇÕES GERAIS DA ASSISTENTE:
${systemPrompt || "Não há orientação adicional."}

HISTÓRICO DA CONVERSA:
${transcript || "Sem histórico disponível."}
`.trim();

  const model =
    String(agent.model_name ?? "").trim() ||
    "gpt-5.6-luna";

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "Gere somente o JSON solicitado. Nunca inclua explicações fora do JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "followup_message",
            strict: true,
            schema: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                },
              },
              required: ["message"],
              additionalProperties: false,
            },
          },
        },
      }),
    },
  );

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `openai_followup_failed:${
        body?.error?.message ?? response.status
      }`,
    );
  }

  const outputText = extractOutputText(body);

  if (!outputText) {
    throw new Error("openai_followup_empty");
  }

  let parsed: { message?: string };

  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("openai_followup_invalid_json");
  }

  return String(parsed.message ?? "").trim();
}

async function processJob(job: FollowupJob) {
  const claimTime = new Date().toISOString();

  const { data: claimed, error: claimError } = await admin
    .from("ai_agent_followups")
    .update({
      status: "processing",
      updated_at: claimTime,
    })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (claimError || !claimed) {
    return {
      id: job.id,
      result: "not_claimed",
    };
  }

  job = claimed as FollowupJob;

  const { data: agentConversation } = await admin
    .from("ai_agent_conversations")
    .select("status,last_lead_message_at,last_ai_message_at")
    .eq("id", job.ai_conversation_id)
    .eq("organization_id", job.organization_id)
    .maybeSingle();

  if (
    !agentConversation ||
    !["active", "qualified"].includes(
      String(agentConversation.status ?? ""),
    )
  ) {
    await cancelJob(job, "conversation_not_eligible");
    return {
      id: job.id,
      result: "cancelled_conversation_state",
    };
  }

  const { data: agent } = await admin
    .from("ai_agents")
    .select(
      "id,name,is_enabled,model_name,system_prompt,business_context,behavior_config,capabilities",
    )
    .eq("id", job.agent_id)
    .eq("organization_id", job.organization_id)
    .maybeSingle();

  if (
    !agent ||
    agent.is_enabled !== true ||
    agent.capabilities?.follow_up_leads !== true
  ) {
    await cancelJob(job, "followups_disabled");
    return {
      id: job.id,
      result: "cancelled_disabled",
    };
  }

  const behavior =
    agent.behavior_config ?? {};

  const timeZone =
    String(
      behavior.followup_timezone ??
        "America/Sao_Paulo",
    );

  const quietStart =
    Number(
      behavior.followup_quiet_start_hour ?? 22,
    );

  const quietEnd =
    Number(
      behavior.followup_quiet_end_hour ?? 6,
    );

  const delay = quietDelayMinutes(
    new Date(),
    timeZone,
    quietStart,
    quietEnd,
  );

  if (delay > 0) {
    const nextDue = new Date(
      Date.now() + delay * 60_000,
    ).toISOString();

    await admin
      .from("ai_agent_followups")
      .update({
        status: "pending",
        due_at: nextDue,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", job.id);

    return {
      id: job.id,
      result: "deferred_quiet_hours",
      next_due_at: nextDue,
    };
  }

  const { data: whatsappConversation } = await admin
    .from("whatsapp_conversations")
    .select(
      "id,wa_id,contact_name,connection_id,opportunity_id,status",
    )
    .eq("id", job.whatsapp_conversation_id)
    .eq("organization_id", job.organization_id)
    .maybeSingle();

  if (
    !whatsappConversation ||
    whatsappConversation.status === "closed"
  ) {
    await cancelJob(job, "whatsapp_conversation_closed");
    return {
      id: job.id,
      result: "cancelled_whatsapp_closed",
    };
  }

  const { data: latestInbound } = await admin
    .from("whatsapp_messages")
    .select("message_timestamp")
    .eq(
      "conversation_id",
      job.whatsapp_conversation_id,
    )
    .eq("direction", "inbound")
    .order("message_timestamp", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (!latestInbound?.message_timestamp) {
    await cancelJob(job, "latest_inbound_missing");
    return {
      id: job.id,
      result: "cancelled_missing_inbound",
    };
  }

  const latestInboundAt =
    new Date(
      latestInbound.message_timestamp,
    ).getTime();

  const sourceAiAt =
    new Date(job.source_ai_message_at).getTime();

  if (latestInboundAt > sourceAiAt) {
    await cancelJob(job, "lead_replied_after_round");
    return {
      id: job.id,
      result: "cancelled_lead_replied",
    };
  }

  if (
    Date.now() - latestInboundAt >=
    24 * 60 * 60 * 1000
  ) {
    await cancelJob(
      job,
      "meta_24h_window_closed",
      true,
    );

    return {
      id: job.id,
      result: "expired_meta_window",
    };
  }

  const { data: latestOutbound } = await admin
    .from("whatsapp_messages")
    .select(
      "message_timestamp,raw_payload",
    )
    .eq(
      "conversation_id",
      job.whatsapp_conversation_id,
    )
    .eq("direction", "outbound")
    .order("message_timestamp", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (latestOutbound?.message_timestamp) {
    const latestOutboundAt =
      new Date(
        latestOutbound.message_timestamp,
      ).getTime();

    const source =
      latestOutbound.raw_payload?.source;

    if (
      latestOutboundAt > sourceAiAt &&
      source !== "ai_followup" &&
      source !== "ai_agent"
    ) {
      await cancelJob(
        job,
        "team_took_over_conversation",
      );

      return {
        id: job.id,
        result: "cancelled_team_takeover",
      };
    }
  }

  const maxPer24h =
    Number(
      behavior.followup_max_per_24h ?? 3,
    );

  const since = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  const {
    count: sentInLast24h,
    error: countError,
  } = await admin
    .from("ai_agent_followups")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq(
      "ai_conversation_id",
      job.ai_conversation_id,
    )
    .eq("status", "sent")
    .gte("sent_at", since);

  if (countError) {
    throw new Error(
      `followup_count_failed:${countError.message}`,
    );
  }

  if (
    (sentInLast24h ?? 0) >=
    maxPer24h
  ) {
    await cancelJob(
      job,
      "daily_followup_limit_reached",
    );

    return {
      id: job.id,
      result: "cancelled_daily_limit",
    };
  }

  const { data: connection } = await admin
    .from("whatsapp_connections")
    .select("id,phone_number_id,status")
    .eq(
      "id",
      whatsappConversation.connection_id,
    )
    .eq("organization_id", job.organization_id)
    .maybeSingle();

  if (
    !connection ||
    connection.status !== "active"
  ) {
    throw new Error("whatsapp_connection_inactive");
  }

  const message =
    await generateContextualFollowup(
      job,
      agent,
      whatsappConversation.contact_name,
    );

  if (!message) {
    await cancelJob(
      job,
      "model_decided_conversation_is_closed",
    );

    return {
      id: job.id,
      result: "cancelled_no_message",
    };
  }

  // Revalida imediatamente antes do envio. Isso fecha a janela
  // de corrida entre a geração do texto e uma eventual nova resposta do lead.
  const { data: finalInbound } = await admin
    .from("whatsapp_messages")
    .select("message_timestamp")
    .eq(
      "conversation_id",
      job.whatsapp_conversation_id,
    )
    .eq("direction", "inbound")
    .order("message_timestamp", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (
    finalInbound?.message_timestamp &&
    new Date(finalInbound.message_timestamp).getTime() >
      sourceAiAt
  ) {
    await cancelJob(
      job,
      "lead_replied_while_followup_was_being_generated",
    );

    return {
      id: job.id,
      result: "cancelled_lead_replied_during_generation",
    };
  }

  const { data: finalConversationState } = await admin
    .from("ai_agent_conversations")
    .select("status")
    .eq("id", job.ai_conversation_id)
    .maybeSingle();

  if (
    !finalConversationState ||
    !["active", "qualified"].includes(
      String(finalConversationState.status ?? ""),
    )
  ) {
    await cancelJob(
      job,
      "conversation_changed_before_send",
    );

    return {
      id: job.id,
      result: "cancelled_state_changed_before_send",
    };
  }

  const {
    sentAt,
    externalMessageId,
  } = await sendWhatsAppText(
    connection.id,
    connection.phone_number_id,
    job.organization_id,
    job.whatsapp_conversation_id,
    whatsappConversation.wa_id,
    message,
  );

  await admin
    .from("ai_agent_followups")
    .update({
      status: "sent",
      generated_message: message,
      sent_at: sentAt,
      updated_at: sentAt,
      metadata: {
        external_message_id: externalMessageId,
        sequence: job.sequence,
      },
    })
    .eq("id", job.id);

  /*
   * O segundo follow-up só passa a existir depois que o primeiro foi
   * efetivamente enviado. O intervalo é contado a partir do envio real,
   * não do horário originalmente previsto.
   */
  if (job.sequence === 1) {
    const maxPerRound = Math.min(
      2,
      Math.max(
        1,
        Number(
          behavior.followup_max_per_round ?? 2,
        ),
      ),
    );

    if (maxPerRound >= 2) {
      const secondDelay = Math.round(
        Math.max(
          1,
          Math.min(
            Number(
              behavior.followup_second_min_minutes ??
                360,
            ),
            Number(
              behavior.followup_second_max_minutes ??
                480,
            ),
          ),
        ) +
          Math.random() *
            Math.max(
              0,
              Math.max(
                Number(
                  behavior.followup_second_min_minutes ??
                    360,
                ),
                Number(
                  behavior.followup_second_max_minutes ??
                    480,
                ),
              ) -
                Math.max(
                  1,
                  Math.min(
                    Number(
                      behavior.followup_second_min_minutes ??
                        360,
                    ),
                    Number(
                      behavior.followup_second_max_minutes ??
                        480,
                    ),
                  ),
                ),
            ),
      );

      const secondDueAt = new Date(
        new Date(sentAt).getTime() +
          secondDelay * 60_000,
      ).toISOString();

      const { error: secondScheduleError } =
        await admin
          .from("ai_agent_followups")
          .upsert(
            {
              organization_id:
                job.organization_id,
              agent_id: job.agent_id,
              ai_conversation_id:
                job.ai_conversation_id,
              whatsapp_conversation_id:
                job.whatsapp_conversation_id,
              round_key: job.round_key,
              sequence: 2,
              source_lead_message_at:
                job.source_lead_message_at,
              source_ai_message_at:
                sentAt,
              due_at: secondDueAt,
              status: "pending",
              metadata: {
                delay_minutes:
                  secondDelay,
                scheduled_after_followup:
                  1,
              },
            },
            {
              onConflict:
                "ai_conversation_id,round_key,sequence",
              ignoreDuplicates: true,
            },
          );

      if (secondScheduleError) {
        console.error(
          "Failed to schedule second AI follow-up",
          {
            followupId: job.id,
            organizationId:
              job.organization_id,
            roundKey: job.round_key,
            code:
              secondScheduleError.code,
            message:
              secondScheduleError.message,
          },
        );
      }
    }
  }

  await admin
    .from("ai_agent_conversations")
    .update({
      last_ai_message_at: sentAt,
      updated_at: sentAt,
    })
    .eq("id", job.ai_conversation_id);

  await admin
    .from("ai_agent_actions")
    .insert({
      organization_id: job.organization_id,
      agent_id: job.agent_id,
      conversation_id:
        job.ai_conversation_id,
      action_type: "followup_sent",
      payload: {
        followup_id: job.id,
        round_key: job.round_key,
        sequence: job.sequence,
        message,
      },
      status: "completed",
    });

  return {
    id: job.id,
    result: "sent",
    sequence: job.sequence,
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(405, {
      code: "method_not_allowed",
    });
  }

  const receivedSecret =
    request.headers.get(
      "x-ai-agent-secret",
    );

  const receivedCronSecret =
    request.headers.get(
      "x-ai-followups-cron-secret",
    );

  const authorizedByInternalSecret =
    Boolean(AI_AGENT_INTERNAL_SECRET) &&
    receivedSecret ===
      AI_AGENT_INTERNAL_SECRET;

  const authorizedByCronSecret =
    Boolean(AI_FOLLOWUPS_CRON_SECRET) &&
    receivedCronSecret ===
      AI_FOLLOWUPS_CRON_SECRET;

  if (
    !authorizedByInternalSecret &&
    !authorizedByCronSecret
  ) {
    return jsonResponse(401, {
      code: "unauthorized",
    });
  }

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !OPENAI_API_KEY
  ) {
    return jsonResponse(503, {
      code: "not_configured",
    });
  }

  const { data: jobs, error } = await admin
    .from("ai_agent_followups")
    .select("*")
    .eq("status", "pending")
    .lte(
      "due_at",
      new Date().toISOString(),
    )
    .order("due_at", {
      ascending: true,
    })
    .limit(50);

  if (error) {
    return jsonResponse(500, {
      code: "followup_queue_failed",
      message: error.message,
    });
  }

  const results: unknown[] = [];

  for (const job of jobs ?? []) {
    try {
      results.push(
        await processJob(job as FollowupJob),
      );
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "unknown_error";

      console.error(
        "ai_followup_job_failed",
        {
          jobId: job.id,
          reason,
        },
      );

      await failJob(
        job as FollowupJob,
        reason,
      );

      results.push({
        id: job.id,
        result: "failed",
        reason,
      });
    }
  }

  return jsonResponse(200, {
    ok: true,
    processed: results.length,
    results,
  });
});

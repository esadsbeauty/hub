import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
const APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const AI_AGENT_INTERNAL_SECRET =
  Deno.env.get("AI_AGENT_INTERNAL_SECRET") ?? "";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

const jsonHeaders = {
  "Content-Type": "application/json",
};

type Connection = {
  id: string;
  organization_id: string;
  phone_number_id: string;
};

type Conversation = {
  id: string;
  contact_name?: string | null;
};

type MetaChange = {
  field?: string;
  value?: Record<string, any>;
};

type AiAgentResponse = {
  ok?: boolean;
  messages?: string[];
  reply?: string;
  handoff?: boolean;
  handoff_reason?: string | null;
  conversation_id?: string;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: jsonHeaders,
    },
  );
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

async function registerPaidTrafficLead(
  connection: Connection,
  message: any,
  waId: string,
  contactName: string,
) {
  const referral = message?.referral;

  if (!referral) {
    return;
  }

  const cameFromMetaAd =
    referral?.source_type === "ad" ||
    Boolean(referral?.ctwa_clid) ||
    Boolean(referral?.source_id);

  if (!cameFromMetaAd) {
    return;
  }

  const { error } = await supabase.rpc(
    "upsert_paid_traffic_lead",
    {
      p_organization_id:
        connection.organization_id,
      p_name: contactName || waId,
      p_whatsapp: waId,
    },
  );

  if (error) {
    console.error(
      "Error registering paid traffic lead:",
      {
        waId,
        code: error.code,
        message: error.message,
      },
    );
    return;
  }

  console.log(
    "Paid traffic lead registered",
    {
      waId,
      sourceId:
        referral?.source_id ?? null,
      ctwaClid:
        referral?.ctwa_clid ?? null,
    },
  );
}

async function verifyMetaSignature(
  body: string,
  signatureHeader: string | null,
) {
  if (!APP_SECRET || !signatureHeader) {
    return false;
  }

  if (!signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const receivedSignature =
    signatureHeader.replace("sha256=", "");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );

  const expectedSignature =
    bytesToHex(new Uint8Array(signature));

  return safeEqual(
    receivedSignature,
    expectedSignature,
  );
}

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function timestampToIso(value: unknown) {
  const unixTimestamp = Number(value);

  return Number.isFinite(unixTimestamp)
    ? new Date(unixTimestamp * 1000).toISOString()
    : new Date().toISOString();
}

function textFromMessage(message: any): string | null {
  const type = message?.type ?? "unknown";

  if (type === "text") {
    return message?.text?.body ?? null;
  }

  if (
    type === "image" ||
    type === "video" ||
    type === "document"
  ) {
    return message?.[type]?.caption ?? null;
  }

  if (type === "button") {
    return message?.button?.text ?? null;
  }

  if (type === "interactive") {
    return (
      message?.interactive?.button_reply?.title ??
      message?.interactive?.list_reply?.title ??
      null
    );
  }

  return null;
}

async function findConnection(
  phoneNumberId: string,
): Promise<Connection | null> {
  const {
    data,
    error,
  } = await supabase
    .from("whatsapp_connections")
    .select("id, organization_id, phone_number_id")
    .eq("phone_number_id", phoneNumberId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error(
      "Error finding WhatsApp connection:",
      error,
    );
    return null;
  }

  if (!data) {
    console.log(
      `No active WhatsApp connection found for phone_number_id ${phoneNumberId}`,
    );
    return null;
  }

  return data as Connection;
}

async function findOrCreateConversation(
  connection: Connection,
  waIdRaw: string,
  contactName: string | null,
  messageTimestamp: string,
): Promise<Conversation | null> {
  const waId = normalizePhone(waIdRaw);

  if (!waId) {
    return null;
  }

  const {
    data: existingConversation,
    error: conversationLookupError,
  } = await supabase
    .from("whatsapp_conversations")
    .select("id, contact_name")
    .eq(
      "organization_id",
      connection.organization_id,
    )
    .eq("wa_id", waId)
    .maybeSingle();

  if (conversationLookupError) {
    console.error(
      "Error finding conversation:",
      conversationLookupError,
    );
    return null;
  }

  if (!existingConversation) {
    const {
      data: newConversation,
      error: conversationInsertError,
    } = await supabase
      .from("whatsapp_conversations")
      .insert({
        organization_id:
          connection.organization_id,
        connection_id:
          connection.id,
        wa_id: waId,
        contact_name:
          contactName || waId,
        status: "open",
        last_message_at:
          messageTimestamp,
      })
      .select("id, contact_name")
      .single();

    if (
      conversationInsertError ||
      !newConversation
    ) {
      console.error(
        "Error creating conversation:",
        conversationInsertError,
      );
      return null;
    }

    return newConversation as Conversation;
  }

  const updatePayload: Record<string, unknown> = {
    connection_id: connection.id,
    last_message_at: messageTimestamp,
    status: "open",
    updated_at: new Date().toISOString(),
  };

  if (
    contactName &&
    contactName !== waId &&
    (
      !existingConversation.contact_name ||
      existingConversation.contact_name === waId
    )
  ) {
    updatePayload.contact_name = contactName;
  }

  const {
    error: conversationUpdateError,
  } = await supabase
    .from("whatsapp_conversations")
    .update(updatePayload)
    .eq(
      "id",
      existingConversation.id,
    );

  if (conversationUpdateError) {
    console.error(
      "Error updating conversation:",
      conversationUpdateError,
    );
  }

  return existingConversation as Conversation;
}

async function saveMessage(
  connection: Connection,
  conversationId: string,
  message: any,
  direction: "inbound" | "outbound",
) {
  const externalMessageId = message?.id;

  if (!externalMessageId) {
    return;
  }

  const messageType =
    message?.type ?? "unknown";

  const messageTimestamp =
    timestampToIso(message?.timestamp);

  const {
    error: messageInsertError,
  } = await supabase
    .from("whatsapp_messages")
    .upsert(
      {
        organization_id:
          connection.organization_id,
        conversation_id:
          conversationId,
        external_message_id:
          externalMessageId,
        direction,
        message_type:
          messageType,
        text_body:
          textFromMessage(message),
        message_timestamp:
          messageTimestamp,
        raw_payload:
          message,
      },
      {
        onConflict:
          "external_message_id",
        ignoreDuplicates:
          true,
      },
    );

  if (messageInsertError) {
    console.error(
      "Error saving WhatsApp message:",
      {
        externalMessageId,
        direction,
        code: messageInsertError.code,
      },
    );
  }
}

async function shouldSkipAiAutomation(
  organizationId: string,
  whatsappConversationId: string,
) {
  const { data, error } = await supabase
    .from("ai_agent_conversations")
    .select("status")
    .eq("organization_id", organizationId)
    .eq(
      "whatsapp_conversation_id",
      whatsappConversationId,
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Error checking AI conversation status:",
      {
        organizationId,
        whatsappConversationId,
        code: error.code,
        message: error.message,
      },
    );

    return false;
  }

  return (
    data?.status === "handoff" ||
    data?.status === "paused" ||
    data?.status === "closed"
  );
}

async function sendAiWhatsAppMessage(
  connection: Connection,
  conversationId: string,
  waId: string,
  text: string,
) {
  const cleanText = text.trim();

  if (!cleanText) {
    return false;
  }

  const secretResult = await supabase
    .from("whatsapp_connection_secrets")
    .select("access_token,token_expires_at")
    .eq("connection_id", connection.id)
    .maybeSingle();

  if (secretResult.error) {
    console.error(
      "Failed to load WhatsApp token for AI reply",
      {
        connectionId: connection.id,
        organizationId: connection.organization_id,
        code: secretResult.error.code,
      },
    );
  }

  let accessToken =
    secretResult.data?.access_token ?? null;

  if (!accessToken) {
    accessToken =
      Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? null;
  }

  if (!accessToken) {
    console.error(
      "AI reply skipped: WhatsApp access token missing",
      {
        connectionId: connection.id,
        organizationId: connection.organization_id,
      },
    );

    return false;
  }

  const tokenExpiresAt =
    secretResult.data?.token_expires_at ?? null;

  if (
    tokenExpiresAt &&
    new Date(tokenExpiresAt).getTime() <= Date.now()
  ) {
    console.error(
      "AI reply skipped: WhatsApp token expired",
      {
        connectionId: connection.id,
        organizationId: connection.organization_id,
      },
    );

    return false;
  }

  let metaResponse: Response;

  try {
    metaResponse = await fetch(
      `https://graph.facebook.com/v26.0/${encodeURIComponent(
        connection.phone_number_id,
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
            body: cleanText.slice(0, 4096),
          },
        }),
      },
    );
  } catch (error) {
    console.error(
      "AI WhatsApp send request failed",
      {
        conversationId,
        organizationId: connection.organization_id,
        error:
          error instanceof Error
            ? error.message
            : "network_error",
      },
    );

    return false;
  }

  const providerPayload = await metaResponse
    .json()
    .catch(() => ({})) as {
      messages?: Array<{ id?: string }>;
      error?: {
        code?: number;
        error_subcode?: number;
        message?: string;
      };
    };

  if (!metaResponse.ok) {
    console.error(
      "Meta rejected AI WhatsApp reply",
      {
        conversationId,
        organizationId: connection.organization_id,
        status: metaResponse.status,
        providerCode: providerPayload.error?.code,
        providerSubcode:
          providerPayload.error?.error_subcode,
      },
    );

    return false;
  }

  const externalMessageId =
    providerPayload.messages?.[0]?.id;

  if (!externalMessageId) {
    console.error(
      "AI WhatsApp reply missing message id",
      {
        conversationId,
        organizationId: connection.organization_id,
      },
    );

    return false;
  }

  const sentAt = new Date().toISOString();

  const { error: saveError } = await supabase
    .from("whatsapp_messages")
    .insert({
      organization_id: connection.organization_id,
      conversation_id: conversationId,
      external_message_id: externalMessageId,
      direction: "outbound",
      message_type: "text",
      text_body: cleanText.slice(0, 4096),
      message_timestamp: sentAt,
      raw_payload: {
        messages: [
          {
            id: externalMessageId,
          },
        ],
        source: "ai_agent",
      },
    });

  if (
    saveError &&
    saveError.code !== "23505"
  ) {
    console.error(
      "Failed to persist AI WhatsApp reply",
      {
        conversationId,
        organizationId: connection.organization_id,
        code: saveError.code,
      },
    );
  }

  const { error: updateError } = await supabase
    .from("whatsapp_conversations")
    .update({
      last_message_at: sentAt,
      updated_at: sentAt,
    })
    .eq("id", conversationId)
    .eq(
      "organization_id",
      connection.organization_id,
    );

  if (updateError) {
    console.error(
      "Failed to update conversation after AI reply",
      {
        conversationId,
        organizationId: connection.organization_id,
        code: updateError.code,
      },
    );
  }

  return true;
}

async function processAiAgentMessage(
  connection: Connection,
  conversation: Conversation,
  message: any,
  waId: string,
) {
  const inboundText =
    textFromMessage(message)?.trim();

  if (!inboundText) {
    return;
  }

  if (!AI_AGENT_INTERNAL_SECRET) {
    console.warn(
      "AI agent skipped: AI_AGENT_INTERNAL_SECRET missing",
    );
    return;
  }

  const skipAutomation =
    await shouldSkipAiAutomation(
      connection.organization_id,
      conversation.id,
    );

  if (skipAutomation) {
    console.log(
      "AI automation skipped for handed-off/paused conversation",
      {
        organizationId: connection.organization_id,
        conversationId: conversation.id,
      },
    );

    return;
  }

  let agentResponse: Response;

  try {
    agentResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/ai-agent-process`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json; charset=utf-8",
          "x-ai-agent-secret":
            AI_AGENT_INTERNAL_SECRET,
        },
        body: JSON.stringify({
          organization_id:
            connection.organization_id,
          whatsapp_conversation_id:
            conversation.id,
          message: inboundText,
        }),
      },
    );
  } catch (error) {
    console.error(
      "AI agent request failed",
      {
        organizationId: connection.organization_id,
        conversationId: conversation.id,
        error:
          error instanceof Error
            ? error.message
            : "network_error",
      },
    );

    return;
  }

  const agentPayload = await agentResponse
    .json()
    .catch(() => ({})) as AiAgentResponse & {
      code?: string;
      message?: string;
    };

  if (!agentResponse.ok) {
    if (
      agentResponse.status === 404 ||
      (
        agentResponse.status === 409 &&
        agentPayload.code === "agent_disabled"
      )
    ) {
      console.log(
        "AI agent not active for organization",
        {
          organizationId: connection.organization_id,
          conversationId: conversation.id,
          status: agentResponse.status,
          code: agentPayload.code ?? null,
        },
      );

      return;
    }

    console.error(
      "AI agent returned an error",
      {
        organizationId: connection.organization_id,
        conversationId: conversation.id,
        status: agentResponse.status,
        code: agentPayload.code ?? null,
      },
    );

    return;
  }

  const aiMessages = Array.isArray(agentPayload.messages)
    ? agentPayload.messages
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  if (
    aiMessages.length === 0 &&
    typeof agentPayload.reply === "string" &&
    agentPayload.reply.trim()
  ) {
    aiMessages.push(agentPayload.reply.trim());
  }

  if (aiMessages.length === 0) {
    console.warn(
      "AI agent returned no reply messages",
      {
        organizationId: connection.organization_id,
        conversationId: conversation.id,
      },
    );

    return;
  }

  for (let index = 0; index < aiMessages.length; index++) {
    const sent = await sendAiWhatsAppMessage(
      connection,
      conversation.id,
      waId,
      aiMessages[index],
    );

    if (!sent) {
      console.error(
        "Failed to send AI WhatsApp message",
        {
          organizationId: connection.organization_id,
          conversationId: conversation.id,
          messageIndex: index,
        },
      );

      return;
    }

    if (index < aiMessages.length - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, 700)
      );
    }
  }

  if (agentPayload.handoff === true) {
    console.log(
      "AI handoff requested after final AI messages",
      {
        organizationId: connection.organization_id,
        conversationId: conversation.id,
        reason:
          agentPayload.handoff_reason ?? null,
      },
    );
  }
}

async function processStandardMessages(
  value: Record<string, any>,
) {
  const phoneNumberId =
    value?.metadata?.phone_number_id;

  if (!phoneNumberId) {
    console.log(
      "Messages webhook without phone_number_id",
    );
    return;
  }

  const connection =
    await findConnection(phoneNumberId);

  if (!connection) {
    return;
  }

  const messages = value?.messages ?? [];
  const contacts = value?.contacts ?? [];

  const contactMap = new Map<
    string,
    string
  >();

  for (const contact of contacts) {
    const waId =
      normalizePhone(contact?.wa_id);

    if (waId) {
      contactMap.set(
        waId,
        contact?.profile?.name ?? waId,
      );
    }
  }

  for (const message of messages) {
    const waId =
      normalizePhone(message?.from);

    if (!message?.id || !waId) {
      continue;
    }

    const messageTimestamp =
      timestampToIso(message?.timestamp);

    const conversation =
      await findOrCreateConversation(
        connection,
        waId,
        contactMap.get(waId) ?? waId,
        messageTimestamp,
      );

    if (!conversation) {
      continue;
    }

    await saveMessage(
      connection,
      conversation.id,
      message,
      "inbound",
    );

    await registerPaidTrafficLead(
      connection,
      message,
      waId,
      contactMap.get(waId) ?? waId,
    );

    await processAiAgentMessage(
      connection,
      conversation,
      message,
      waId,
    );
  }
}

async function processMessageEchoes(
  value: Record<string, any>,
) {
  const phoneNumberId =
    value?.metadata?.phone_number_id;

  if (!phoneNumberId) {
    console.log(
      "smb_message_echoes webhook without phone_number_id",
    );
    return;
  }

  const connection =
    await findConnection(phoneNumberId);

  if (!connection) {
    return;
  }

  const echoes =
    value?.message_echoes ?? [];

  for (const message of echoes) {
    const waId =
      normalizePhone(message?.to);

    if (!message?.id || !waId) {
      continue;
    }

    const messageTimestamp =
      timestampToIso(message?.timestamp);

    const conversation =
      await findOrCreateConversation(
        connection,
        waId,
        null,
        messageTimestamp,
      );

    if (!conversation) {
      continue;
    }

    await saveMessage(
      connection,
      conversation.id,
      message,
      "outbound",
    );
  }
}

async function processHistory(
  value: Record<string, any>,
) {
  const phoneNumberId =
    value?.metadata?.phone_number_id;

  if (!phoneNumberId) {
    console.log(
      "History webhook without phone_number_id",
    );
    return;
  }

  const connection =
    await findConnection(phoneNumberId);

  if (!connection) {
    return;
  }

  const historyChunks =
    value?.history ?? [];

  for (const chunk of historyChunks) {
    if (
      Array.isArray(chunk?.errors) &&
      chunk.errors.length > 0
    ) {
      console.warn(
        "WhatsApp history sync returned errors",
        chunk.errors.map((error: any) => ({
          code: error?.code,
          title: error?.title,
        })),
      );
      continue;
    }

    const threads =
      chunk?.threads ?? [];

    for (const thread of threads) {
      const waId =
        normalizePhone(thread?.id);

      if (!waId) {
        continue;
      }

      const messages =
        thread?.messages ?? [];

      if (messages.length === 0) {
        continue;
      }

      const latestTimestamp =
        messages
          .map((message: any) =>
            timestampToIso(
              message?.timestamp,
            )
          )
          .sort()
          .at(-1) ??
        new Date().toISOString();

      const conversation =
        await findOrCreateConversation(
          connection,
          waId,
          null,
          latestTimestamp,
        );

      if (!conversation) {
        continue;
      }

      for (const message of messages) {
        if (!message?.id) {
          continue;
        }

        const from =
          normalizePhone(message?.from);

        const direction:
          "inbound" | "outbound" =
          from === waId
            ? "inbound"
            : "outbound";

        await saveMessage(
          connection,
          conversation.id,
          message,
          direction,
        );
      }
    }

    console.log(
      "WhatsApp history chunk processed",
      {
        phase:
          chunk?.metadata?.phase ?? null,
        chunkOrder:
          chunk?.metadata?.chunk_order ?? null,
        progress:
          chunk?.metadata?.progress ?? null,
      },
    );
  }
}

async function processAppStateSync(
  value: Record<string, any>,
) {
  const phoneNumberId =
    value?.metadata?.phone_number_id;

  if (!phoneNumberId) {
    console.log(
      "smb_app_state_sync webhook without phone_number_id",
    );
    return;
  }

  const connection =
    await findConnection(phoneNumberId);

  if (!connection) {
    return;
  }

  const updates =
    value?.state_sync ?? [];

  for (const item of updates) {
    if (
      item?.type !== "contact" ||
      item?.action === "remove"
    ) {
      continue;
    }

    const waId =
      normalizePhone(
        item?.contact?.phone_number ??
        item?.contact?.wa_id,
      );

    const fullName =
      String(
        item?.contact?.full_name ??
        item?.contact?.first_name ??
        "",
      ).trim();

    if (!waId || !fullName) {
      continue;
    }

    const {
      error,
    } = await supabase
      .from("whatsapp_conversations")
      .update({
        contact_name: fullName,
        connection_id: connection.id,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "organization_id",
        connection.organization_id,
      )
      .eq("wa_id", waId);

    if (error) {
      console.error(
        "Error applying WhatsApp contact sync:",
        {
          waId,
          code: error.code,
        },
      );
    }
  }
}

async function processChange(
  change: MetaChange,
) {
  const field = change?.field;
  const value =
    change?.value ?? {};

  switch (field) {
    case "messages":
      await processStandardMessages(
        value,
      );
      return;

    case "smb_message_echoes":
      await processMessageEchoes(
        value,
      );
      return;

    case "history":
      await processHistory(
        value,
      );
      return;

    case "smb_app_state_sync":
      await processAppStateSync(
        value,
      );
      return;

    default:
      return;
  }
}

async function processPayload(
  payload: any,
) {
  /*
   * Formato padrÃ£o de Webhooks da WABA:
   * object -> entry[] -> changes[].
   */
  const entries =
    payload?.entry ?? [];

  for (const entry of entries) {
    const changes =
      entry?.changes ?? [];

    for (const change of changes) {
      await processChange(change);
    }
  }

  /*
   * Alguns fluxos/parceiros de coexistÃªncia podem encaminhar
   * history/state_sync no formato direto:
   * { id, event, data }.
   * Mantemos compatibilidade sem alterar o fluxo padrÃ£o.
   */
  if (
    payload?.event &&
    payload?.data &&
    (
      payload.event === "history" ||
      payload.event === "smb_app_state_sync"
    )
  ) {
    await processChange({
      field: payload.event,
      value: payload.data,
    });
  }
}

Deno.serve(async (request) => {
  const url = new URL(request.url);

  // =====================================================
  // META WEBHOOK VERIFICATION
  // =====================================================

  if (request.method === "GET") {
    const mode =
      url.searchParams.get("hub.mode");

    const token =
      url.searchParams.get(
        "hub.verify_token",
      );

    const challenge =
      url.searchParams.get(
        "hub.challenge",
      );

    if (
      mode === "subscribe" &&
      token === VERIFY_TOKEN &&
      challenge
    ) {
      return new Response(
        challenge,
        {
          status: 200,
          headers: {
            "Content-Type":
              "text/plain",
          },
        },
      );
    }

    return jsonResponse(
      {
        error:
          "Webhook verification failed",
      },
      403,
    );
  }

  // =====================================================
  // WHATSAPP EVENTS
  // =====================================================

  if (request.method === "POST") {
    try {
      const rawBody =
        await request.text();

      const signature =
        request.headers.get(
          "x-hub-signature-256",
        );

      const signatureIsValid =
        await verifyMetaSignature(
          rawBody,
          signature,
        );

      if (!signatureIsValid) {
        console.error(
          "Invalid WhatsApp webhook signature",
        );

        return jsonResponse(
          {
            error:
              "Invalid signature",
          },
          401,
        );
      }

      const payload =
        JSON.parse(rawBody);

      console.log(
        "WhatsApp webhook received",
        {
          object:
            payload?.object ?? null,
          event:
            payload?.event ?? null,
          fields:
            (
              payload?.entry ?? []
            ).flatMap(
              (entry: any) =>
                (
                  entry?.changes ?? []
                ).map(
                  (change: any) =>
                    change?.field,
                ),
            ),
        },
      );

      await processPayload(payload);

      return jsonResponse({
        received: true,
      });
    } catch (error) {
      console.error(
        "WhatsApp webhook processing error:",
        error,
      );

      return jsonResponse(
        {
          error:
            "Webhook processing failed",
        },
        500,
      );
    }
  }

  return jsonResponse(
    {
      error: "Method not allowed",
    },
    405,
  );
});

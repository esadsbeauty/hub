import { createClient } from "npm:@supabase/supabase-js@2";

const productionOrigin = Deno.env.get("APP_ORIGIN") ?? "";

const allowedOrigins = new Set(
  [
    productionOrigin,
    "http://localhost:5173",
  ].filter(Boolean),
);

const allowedRoles = new Set([
  "owner",
  "admin",
  "manager",
  "sales",
  "operations",
  "marketing",
]);

const maxTextLength = 4096;

type Input = {
  organizationId?: string;
  conversationId?: string;
  text?: string;
};

type Authorization = {
  organization_id?: string;
  role?: string;
  status?: string;
  is_platform_admin?: boolean;
};

type MetaResponse = {
  messages?: Array<{ id?: string }>;
  error?: {
    code?: number;
    error_subcode?: number;
    message?: string;
  };
};

Deno.serve(async (request) => {
  const requestOrigin = request.headers.get("origin");

  const originAllowed =
    requestOrigin !== null &&
    allowedOrigins.has(requestOrigin);

  const headers = {
    "Access-Control-Allow-Origin": originAllowed
      ? requestOrigin
      : productionOrigin || "null",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  const reply = (
    status: number,
    code: string,
    message: string,
    extra: Record<string, unknown> = {},
  ) =>
    new Response(
      JSON.stringify({
        code,
        message,
        ...extra,
      }),
      {
        status,
        headers,
      },
    );

  if (request.method === "OPTIONS") {
    return originAllowed
      ? new Response("ok", { headers })
      : reply(
          403,
          "origin_denied",
          "Origem não autorizada.",
        );
  }

  if (request.method !== "POST") {
    return reply(
      405,
      "method_not_allowed",
      "Método não permitido.",
    );
  }

  if (!originAllowed) {
    return reply(
      403,
      "origin_denied",
      "Origem não autorizada.",
    );
  }

  const authorizationHeader =
    request.headers.get("authorization");

  if (!authorizationHeader) {
    return reply(
      401,
      "not_authenticated",
      "Não autenticado.",
    );
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (
    !url ||
    !anonKey ||
    !serviceRoleKey
  ) {
    return reply(
      503,
      "not_configured",
      "O envio pelo WhatsApp ainda não está configurado.",
    );
  }

  const userClient = createClient(
    url,
    anonKey,
    {
      global: {
        headers: {
          Authorization: authorizationHeader,
        },
      },
    },
  );

  const authenticated =
    await userClient.auth.getUser();

  if (
    authenticated.error ||
    !authenticated.data.user
  ) {
    return reply(
      401,
      "not_authenticated",
      "Não autenticado.",
    );
  }

  const body = await request
    .json()
    .catch(() => ({})) as Input;

  const organizationId =
    body.organizationId?.trim();

  const conversationId =
    body.conversationId?.trim();

  const text =
    body.text?.trim() ?? "";

  if (
    !organizationId ||
    !conversationId ||
    !text ||
    text.length > maxTextLength
  ) {
    return reply(
      422,
      "invalid_message",
      `Mensagem inválida. Informe um texto de até ${maxTextLength} caracteres.`,
    );
  }

  const authorization =
    await userClient.rpc(
      "current_authorization",
    );

  const context =
    authorization.data as Authorization | null;

  const isActiveTenant =
    !authorization.error &&
    context?.status === "active" &&
    context.organization_id === organizationId;

  const canReply =
    context?.is_platform_admin === true ||
    allowedRoles.has(
      context?.role ?? "",
    );

  if (!isActiveTenant || !canReply) {
    return reply(
      403,
      "reply_forbidden",
      "Você não tem permissão para responder nesta organização.",
    );
  }

  const admin = createClient(
    url,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const conversationResult =
    await admin
      .from("whatsapp_conversations")
      .select(
        "id,organization_id,connection_id,wa_id",
      )
      .eq("id", conversationId)
      .eq(
        "organization_id",
        organizationId,
      )
      .maybeSingle();

  const conversation =
    conversationResult.data;

  if (
    conversationResult.error ||
    !conversation
  ) {
    return reply(
      404,
      "conversation_not_found",
      "Conversa não encontrada.",
    );
  }

  let connectionResult =
    await admin
      .from("whatsapp_connections")
      .select(
        "id,organization_id,phone_number_id,status,connected_at",
      )
      .eq(
        "id",
        conversation.connection_id,
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq("status", "active")
      .maybeSingle();

  let connection =
    connectionResult.data;

  /*
   * Após uma reconexão/Embedded Signup, conversas antigas podem
   * continuar apontando para uma conexão que foi marcada como inactive.
   * Nesse caso, usamos a conexão ativa mais recente da organização
   * e reatribuímos a conversa antes de enviar.
   */
  if (!connection) {
    connectionResult =
      await admin
        .from("whatsapp_connections")
        .select(
          "id,organization_id,phone_number_id,status,connected_at",
        )
        .eq(
          "organization_id",
          organizationId,
        )
        .eq("status", "active")
        .order(
          "connected_at",
          { ascending: false },
        )
        .limit(1)
        .maybeSingle();

    connection =
      connectionResult.data;

    if (connection) {
      const rebound =
        await admin
          .from("whatsapp_conversations")
          .update({
            connection_id: connection.id,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            conversationId,
          )
          .eq(
            "organization_id",
            organizationId,
          );

      if (rebound.error) {
        console.error(
          "Failed to rebind conversation to active WhatsApp connection",
          {
            conversationId,
            organizationId,
            code: rebound.error.code,
          },
        );
      }
    }
  }

  if (
    connectionResult.error ||
    !connection
  ) {
    return reply(
      409,
      "active_connection_not_found",
      "Não há uma conexão ativa do WhatsApp para esta organização.",
    );
  }

  const secretResult =
    await admin
      .from("whatsapp_connection_secrets")
      .select("access_token,token_expires_at")
      .eq("connection_id", connection.id)
      .maybeSingle();

  if (secretResult.error) {
    console.error(
      "Failed to load WhatsApp connection token",
      {
        connectionId: connection.id,
        organizationId,
        code: secretResult.error.code,
      },
    );
  }

  let accessToken =
    secretResult.data?.access_token ?? null;

  /*
   * Fallback temporário para a conexão V2 já existente.
   * Pode ser removido depois que todas as organizações
   * estiverem conectadas pelo Embedded Signup V3.
   */
  if (!accessToken) {
    accessToken =
      Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? null;
  }

  if (!accessToken) {
    return reply(
      409,
      "connection_token_missing",
      "A conexão do WhatsApp não possui um token válido. Reconecte o WhatsApp em Configurações.",
    );
  }

  const tokenExpiresAt =
    secretResult.data?.token_expires_at ?? null;

  if (
    tokenExpiresAt &&
    new Date(tokenExpiresAt).getTime() <= Date.now()
  ) {
    return reply(
      409,
      "connection_token_expired",
      "A autorização do WhatsApp expirou. Reconecte o WhatsApp em Configurações.",
    );
  }

  let metaResponse: Response;

  try {
    metaResponse = await fetch(
      `https://graph.facebook.com/v26.0/${encodeURIComponent(
        String(connection.phone_number_id),
      )}/messages`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: conversation.wa_id,
          type: "text",
          text: {
            preview_url: false,
            body: text,
          },
        }),
      },
    );
  } catch (error) {
    console.error(
      "WhatsApp Cloud API request failed",
      {
        conversationId,
        organizationId,
        error:
          error instanceof Error
            ? error.message
            : "network_error",
      },
    );

    return reply(
      502,
      "provider_unavailable",
      "Não foi possível enviar a mensagem pelo WhatsApp.",
    );
  }

  const providerPayload =
    await metaResponse
      .json()
      .catch(() => ({})) as MetaResponse;

  if (!metaResponse.ok) {
    console.error(
      "WhatsApp Cloud API rejected message",
      {
        conversationId,
        organizationId,
        status: metaResponse.status,
        providerCode:
          providerPayload.error?.code,
        providerSubcode:
          providerPayload.error
            ?.error_subcode,
      },
    );

    if (
      providerPayload.error?.code ===
        131047 ||
      providerPayload.error?.code ===
        131026
    ) {
      return reply(
        409,
        "customer_care_window_expired",
        "Não é possível enviar uma mensagem livre porque a janela de atendimento expirou. Será necessário usar um template aprovado.",
      );
    }

    return reply(
      502,
      "provider_rejected",
      "Não foi possível enviar a mensagem pelo WhatsApp.",
    );
  }

  const externalMessageId =
    providerPayload.messages?.[0]?.id;

  if (!externalMessageId) {
    console.error(
      "WhatsApp Cloud API response did not contain a message id",
      {
        conversationId,
        organizationId,
      },
    );

    return reply(
      502,
      "invalid_provider_response",
      "Não foi possível confirmar o envio da mensagem pelo WhatsApp.",
    );
  }

  const sentAt =
    new Date().toISOString();

  const saved =
    await admin
      .from("whatsapp_messages")
      .insert({
        organization_id:
          organizationId,
        conversation_id:
          conversationId,
        external_message_id:
          externalMessageId,
        direction: "outbound",
        message_type: "text",
        text_body: text,
        message_timestamp: sentAt,
        raw_payload: {
          messages: [
            {
              id: externalMessageId,
            },
          ],
        },
      })
      .select("id")
      .single();

  if (saved.error) {
    if (saved.error.code !== "23505") {
      console.error(
        "Failed to persist outbound WhatsApp message",
        {
          conversationId,
          organizationId,
          code: saved.error.code,
        },
      );

      return reply(
        500,
        "message_persistence_failed",
        "A mensagem foi enviada, mas não foi possível atualizar a Inbox.",
      );
    }
  }

  const updated =
    await admin
      .from("whatsapp_conversations")
      .update({
        last_message_at: sentAt,
        updated_at: sentAt,
      })
      .eq(
        "id",
        conversationId,
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "connection_id",
        connection.id,
      );

  if (updated.error) {
    console.error(
      "Failed to update WhatsApp conversation timestamp",
      {
        conversationId,
        organizationId,
        code: updated.error.code,
      },
    );
  }

  return reply(
    200,
    "message_sent",
    "Mensagem enviada.",
    {
      messageId:
        saved.data?.id ?? null,
      externalMessageId,
    },
  );
});
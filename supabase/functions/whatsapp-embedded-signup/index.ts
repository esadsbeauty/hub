import { createClient } from "npm:@supabase/supabase-js@2";

const graphVersion = "v26.0";
const productionOrigin = Deno.env.get("APP_ORIGIN") ?? "";
const allowedOrigins = new Set(
  [productionOrigin, "http://localhost:5173"].filter(Boolean),
);
const allowedRoles = new Set(["owner", "admin"]);

type ConnectionMode = "standard" | "coexistence";

type Input = {
  action?: "connect" | "sync" | "disconnect";
  organizationId?: string;
  code?: string;
  wabaId?: string;
  phoneNumberId?: string | null;
  connectionMode?: ConnectionMode;
};

type Authorization = {
  organization_id?: string;
  role?: string;
  status?: string;
  is_platform_admin?: boolean;
};

type PhoneNumber = {
  id?: string;
  display_phone_number?: string;
  verified_name?: string;
};

type PhoneNumberDetails = PhoneNumber & {
  is_on_biz_app?: boolean;
  platform_type?: string;
};

type SyncType = "history" | "smb_app_state_sync";

type SyncResult = {
  ok: boolean;
  status: number;
  requestId?: string;
  errorCode?: number;
  errorMessage?: string;
};

async function requestSmbAppData(
  phoneNumberId: string,
  accessToken: string,
  syncType: SyncType,
): Promise<SyncResult> {
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(
      phoneNumberId,
    )}/smb_app_data`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        sync_type: syncType,
      }),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    request_id?: string;
    error?: {
      code?: number;
      message?: string;
    };
  };

  if (!response.ok) {
    console.error("WhatsApp coexistence sync request failed", {
      syncType,
      status: response.status,
      providerCode: payload.error?.code,
      providerMessage: payload.error?.message,
    });
  }

  return {
    ok: response.ok,
    status: response.status,
    requestId: payload.request_id,
    errorCode: payload.error?.code,
    errorMessage: payload.error?.message,
  };
}

function reply(
  origin: string | null,
  status: number,
  body: Record<string, unknown>,
) {
  const allowed = Boolean(origin && allowedOrigins.has(origin));

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin":
        allowed && origin ? origin : productionOrigin || "null",
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

async function getPhoneDetails(
  phoneNumberId: string,
  accessToken: string,
): Promise<PhoneNumberDetails | null> {
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(
      phoneNumberId,
    )}?fields=id,display_phone_number,verified_name,is_on_biz_app,platform_type`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  const data = (await response.json().catch(() => ({}))) as PhoneNumberDetails;

  if (!response.ok || data.id !== phoneNumberId) {
    return null;
  }

  return data;
}

async function resolveCoexistencePhone(
  phones: PhoneNumber[],
  accessToken: string,
): Promise<PhoneNumberDetails | null> {
  const candidates = phones.filter(
    (item): item is PhoneNumber & { id: string } => Boolean(item.id),
  );

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    const only = candidates[0];
    const details = await getPhoneDetails(only.id, accessToken);

    return {
      ...only,
      ...(details ?? {}),
    };
  }

  const checked = await Promise.all(
    candidates.map(async (candidate) => {
      const details = await getPhoneDetails(candidate.id, accessToken);

      if (!details) return null;

      return {
        ...candidate,
        ...details,
      };
    }),
  );

  const coexistencePhones = checked.filter(
    (item): item is PhoneNumberDetails & { id: string } =>
      Boolean(
        item?.id &&
          item.is_on_biz_app === true &&
          item.platform_type === "CLOUD_API",
      ),
  );

  return coexistencePhones.length === 1 ? coexistencePhones[0] : null;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return origin && allowedOrigins.has(origin)
      ? reply(origin, 200, { ok: true })
      : reply(origin, 403, { code: "origin_denied" });
  }

  if (request.method !== "POST") {
    return reply(origin, 405, { code: "method_not_allowed" });
  }

  if (!origin || !allowedOrigins.has(origin)) {
    return reply(origin, 403, { code: "origin_denied" });
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return reply(origin, 401, { code: "not_authenticated" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appId = Deno.env.get("META_APP_ID");
  const appSecret = Deno.env.get("META_APP_SECRET");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !appId || !appSecret) {
    return reply(origin, 503, {
      code: "not_configured",
      message: "Integração com a Meta ainda não está configurada.",
    });
  }

  const body = (await request.json().catch(() => ({}))) as Input;

  const action =
    body.action === "sync"
      ? "sync"
      : body.action === "disconnect"
        ? "disconnect"
        : "connect";
  const organizationId = body.organizationId?.trim();
  const code = body.code?.trim();
  const wabaId = body.wabaId?.trim();
  const requestedPhoneNumberId = body.phoneNumberId?.trim() || null;
  const connectionMode: ConnectionMode =
    body.connectionMode === "coexistence" ? "coexistence" : "standard";

  if (!organizationId) {
    return reply(origin, 422, {
      code: "invalid_request",
      message: "Organização não informada.",
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const authenticated = await userClient.auth.getUser();

  if (authenticated.error || !authenticated.data.user) {
    return reply(origin, 401, { code: "not_authenticated" });
  }

  const authorization = await userClient.rpc("current_authorization");
  const context = authorization.data as Authorization | null;

  const canManage =
    !authorization.error &&
    context?.status === "active" &&
    context.organization_id === organizationId &&
    (context.is_platform_admin === true ||
      allowedRoles.has(context.role ?? ""));

  if (!canManage) {
    return reply(origin, 403, {
      code: "connection_forbidden",
      message: "Você não pode configurar o WhatsApp desta organização.",
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  if (action === "disconnect") {
    const connectionResult = await admin
      .from("whatsapp_connections")
      .select("id,phone_number_id,connected_at")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionResult.error) {
      console.error("Could not load active WhatsApp connection for disconnect", {
        organizationId,
        code: connectionResult.error.code,
      });

      return reply(origin, 500, {
        code: "disconnect_lookup_failed",
        message: "Não foi possível localizar a conexão ativa.",
      });
    }

    if (!connectionResult.data) {
      return reply(origin, 200, {
        code: "whatsapp_already_disconnected",
        message: "O WhatsApp já está desconectado do ESADS Beauty.",
      });
    }

    const now = new Date().toISOString();

    const deactivate = await admin
      .from("whatsapp_connections")
      .update({
        status: "inactive",
        disconnected_at: now,
      })
      .eq("id", connectionResult.data.id)
      .eq("organization_id", organizationId)
      .eq("status", "active");

    if (deactivate.error) {
      console.error("Could not deactivate WhatsApp connection", {
        organizationId,
        connectionId: connectionResult.data.id,
        code: deactivate.error.code,
      });

      return reply(origin, 500, {
        code: "disconnect_failed",
        message: "Não foi possível desconectar o WhatsApp.",
      });
    }

    const deleteSecret = await admin
      .from("whatsapp_connection_secrets")
      .delete()
      .eq("connection_id", connectionResult.data.id);

    if (deleteSecret.error) {
      console.error("WhatsApp disconnected but token cleanup failed", {
        organizationId,
        connectionId: connectionResult.data.id,
        code: deleteSecret.error.code,
      });
    }

    return reply(origin, 200, {
      code: "whatsapp_disconnected",
      message: "WhatsApp desconectado do ESADS Beauty.",
      credentialCleanupCompleted: !deleteSecret.error,
    });
  }

  if (action === "sync") {
    const connectionResult = await admin
      .from("whatsapp_connections")
      .select("id,phone_number_id,connected_at")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionResult.error || !connectionResult.data) {
      return reply(origin, 409, {
        code: "active_connection_not_found",
        message: "Não há uma conexão ativa do WhatsApp para sincronizar.",
      });
    }

    const secretResult = await admin
      .from("whatsapp_connection_secrets")
      .select("access_token,token_expires_at")
      .eq("connection_id", connectionResult.data.id)
      .maybeSingle();

    if (
      secretResult.error ||
      !secretResult.data?.access_token
    ) {
      return reply(origin, 409, {
        code: "connection_token_missing",
        message: "A conexão não possui autorização válida. Reconecte o WhatsApp.",
      });
    }

    if (
      secretResult.data.token_expires_at &&
      new Date(secretResult.data.token_expires_at).getTime() <= Date.now()
    ) {
      return reply(origin, 409, {
        code: "connection_token_expired",
        message: "A autorização do WhatsApp expirou. Reconecte o WhatsApp.",
      });
    }

    const accessToken = secretResult.data.access_token;
    const phoneNumberId = connectionResult.data.phone_number_id;

    const contacts = await requestSmbAppData(
      phoneNumberId,
      accessToken,
      "smb_app_state_sync",
    );

    const history = await requestSmbAppData(
      phoneNumberId,
      accessToken,
      "history",
    );

    if (!contacts.ok && !history.ok) {
      return reply(origin, 502, {
        code: "coexistence_sync_failed",
        message:
          "A Meta não aceitou a sincronização. Verifique se o número foi conectado há menos de 24 horas e se o compartilhamento de histórico foi autorizado.",
        sync: {
          contacts,
          history,
        },
      });
    }

    return reply(origin, 200, {
      code: "coexistence_sync_requested",
      message:
        "Sincronização solicitada. O histórico e os contatos chegarão pelos webhooks da Meta.",
      sync: {
        contacts,
        history,
      },
    });
  }

  if (!code || !wabaId) {
    return reply(origin, 422, {
      code: "invalid_request",
      message: "Dados de conexão incompletos.",
    });
  }

  if (connectionMode === "standard" && !requestedPhoneNumberId) {
    return reply(origin, 422, {
      code: "phone_number_required",
      message: "O número selecionado não foi informado.",
    });
  }

  const exchangeUrl = new URL(
    `https://graph.facebook.com/${graphVersion}/oauth/access_token`,
  );

  exchangeUrl.searchParams.set("client_id", appId);
  exchangeUrl.searchParams.set("client_secret", appSecret);
  exchangeUrl.searchParams.set("code", code);

  const exchangeResponse = await fetch(exchangeUrl);

  const exchange = (await exchangeResponse.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: {
      code?: number;
      message?: string;
    };
  };

  if (!exchangeResponse.ok || !exchange.access_token) {
    console.error("Embedded Signup code exchange failed", {
      status: exchangeResponse.status,
      providerCode: exchange.error?.code,
      providerMessage: exchange.error?.message,
    });

    return reply(origin, 502, {
      code: "meta_code_exchange_failed",
      message: "A Meta não confirmou a autorização. Tente conectar novamente.",
    });
  }

  const accessToken = exchange.access_token;

  const wabaResponse = await fetch(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(
      wabaId,
    )}?fields=id,name`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  const waba = (await wabaResponse.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
  };

  if (!wabaResponse.ok || waba.id !== wabaId) {
    return reply(origin, 403, {
      code: "waba_not_authorized",
      message: "A conta do WhatsApp Business não foi autorizada.",
    });
  }

  const phonesResponse = await fetch(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(
      wabaId,
    )}/phone_numbers?fields=id,display_phone_number,verified_name`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  const phones = (await phonesResponse.json().catch(() => ({}))) as {
    data?: PhoneNumber[];
    error?: {
      code?: number;
      message?: string;
    };
  };

  if (!phonesResponse.ok || !Array.isArray(phones.data)) {
    console.error("Could not list WABA phone numbers", {
      status: phonesResponse.status,
      providerCode: phones.error?.code,
      providerMessage: phones.error?.message,
    });

    return reply(origin, 502, {
      code: "phone_lookup_failed",
      message: "Não foi possível localizar os números da conta autorizada.",
    });
  }

  let phone: PhoneNumberDetails | null = null;

  if (requestedPhoneNumberId) {
    const listedPhone = phones.data.find(
      (item) => item.id === requestedPhoneNumberId,
    );

    if (listedPhone?.id) {
      const details = await getPhoneDetails(listedPhone.id, accessToken);

      phone = {
        ...listedPhone,
        ...(details ?? {}),
      };
    }
  } else if (connectionMode === "coexistence") {
    phone = await resolveCoexistencePhone(phones.data, accessToken);
  }

  if (!phone?.id) {
    return reply(origin, 409, {
      code:
        connectionMode === "coexistence"
          ? "coexistence_phone_not_resolved"
          : "phone_not_authorized",
      message:
        connectionMode === "coexistence"
          ? "A Meta autorizou a conta, mas não foi possível identificar automaticamente o número em coexistência."
          : "O número selecionado não pertence à conta autorizada.",
    });
  }

  if (
    connectionMode === "coexistence" &&
    (phone.is_on_biz_app !== true || phone.platform_type !== "CLOUD_API")
  ) {
    const refreshed = await getPhoneDetails(phone.id, accessToken);

    if (refreshed) {
      phone = {
        ...phone,
        ...refreshed,
      };
    }

    if (
      phone.is_on_biz_app !== true ||
      phone.platform_type !== "CLOUD_API"
    ) {
      return reply(origin, 409, {
        code: "coexistence_not_confirmed",
        message:
          "O número foi localizado, mas a Meta ainda não confirmou o modo de coexistência.",
      });
    }
  }

  const subscribeResponse = await fetch(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(
      wabaId,
    )}/subscribed_apps`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!subscribeResponse.ok) {
    const subscribeError = (await subscribeResponse
      .json()
      .catch(() => ({}))) as {
      error?: {
        code?: number;
        message?: string;
      };
    };

    console.error("Failed to subscribe app to WABA", {
      status: subscribeResponse.status,
      providerCode: subscribeError.error?.code,
      providerMessage: subscribeError.error?.message,
    });

    return reply(origin, 502, {
      code: "waba_subscription_failed",
      message: "Não foi possível ativar os webhooks desta conta.",
    });
  }

  const now = new Date().toISOString();

  const deactivate = await admin
    .from("whatsapp_connections")
    .update({
      status: "inactive",
      disconnected_at: now,
    })
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (deactivate.error) {
    return reply(origin, 500, {
      code: "connection_update_failed",
      message: "Não foi possível atualizar a conexão anterior.",
    });
  }

  const connectionResult = await admin
    .from("whatsapp_connections")
    .insert({
      organization_id: organizationId,
      waba_id: wabaId,
      phone_number_id: phone.id,
      display_phone_number: phone.display_phone_number ?? null,
      verified_name: phone.verified_name ?? waba.name ?? null,
      status: "active",
      connected_at: now,
      disconnected_at: null,
    })
    .select("id")
    .single();

  if (connectionResult.error || !connectionResult.data) {
    console.error("Could not persist WhatsApp connection", {
      code: connectionResult.error?.code,
    });

    return reply(origin, 500, {
      code: "connection_persistence_failed",
      message: "Não foi possível salvar a conexão.",
    });
  }

  const expiresAt =
    typeof exchange.expires_in === "number"
      ? new Date(Date.now() + exchange.expires_in * 1000).toISOString()
      : null;

  const secretResult = await admin
    .from("whatsapp_connection_secrets")
    .upsert({
      connection_id: connectionResult.data.id,
      access_token: accessToken,
      token_expires_at: expiresAt,
    });

  if (secretResult.error) {
    await admin
      .from("whatsapp_connections")
      .update({
        status: "inactive",
        disconnected_at: now,
      })
      .eq("id", connectionResult.data.id);

    return reply(origin, 500, {
      code: "token_persistence_failed",
      message: "A conexão foi autorizada, mas não pôde ser ativada.",
    });
  }

  let coexistenceSync: {
    contacts: SyncResult;
    history: SyncResult;
  } | null = null;

  if (connectionMode === "coexistence") {
    const contacts = await requestSmbAppData(
      phone.id,
      accessToken,
      "smb_app_state_sync",
    );

    const history = await requestSmbAppData(
      phone.id,
      accessToken,
      "history",
    );

    coexistenceSync = {
      contacts,
      history,
    };
  }

  return reply(origin, 200, {
    code: "whatsapp_connected",
    message:
      connectionMode === "coexistence"
        ? "WhatsApp conectado em modo de coexistência."
        : "WhatsApp conectado.",
    connectionMode,
    wabaId,
    phoneNumberId: phone.id,
    isOnBusinessApp: phone.is_on_biz_app ?? null,
    platformType: phone.platform_type ?? null,
    coexistenceSync,
  });
});

import { createClient } from "npm:@supabase/supabase-js@2";

const configuredOrigin = Deno.env.get("APP_ORIGIN") ?? "";

const isAllowedOrigin = (origin: string) => {
  if (!origin) return false;
  if (configuredOrigin && origin === configuredOrigin) return true;

  try {
    const url = new URL(origin);
    return (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      (url.protocol === "http:" || url.protocol === "https:")
    );
  } catch {
    return false;
  }
};

const responseHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": isAllowedOrigin(origin)
    ? origin
    : configuredOrigin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin",
});

const reply = (
  status: number,
  body: Record<string, unknown>,
  origin: string,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (request) => {
  const requestOrigin = request.headers.get("origin") ?? "";

  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: responseHeaders(requestOrigin),
    });
  }

  if (request.method !== "POST") {
    return reply(405, {
      code: "method_not_allowed",
      message: "Método não permitido.",
    }, requestOrigin);
  }

  if (!isAllowedOrigin(requestOrigin)) {
    return reply(
      403,
      {
        code: "origin_denied",
        message: "Origem não autorizada.",
      },
      requestOrigin,
    );
  }

  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return reply(401, {
      code: "invalid_session",
      message: "Sessão inválida.",
    }, requestOrigin);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anon || !serviceRole) {
    return reply(503, {
      code: "not_configured",
      message: "Gestão de usuários ainda não está configurada.",
    }, requestOrigin);
  }

  const userClient = createClient(url, anon, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const { data: auth, error: authError } =
    await userClient.auth.getUser();

  if (authError || !auth.user) {
    return reply(401, {
      code: "invalid_session",
      message: "Sessão inválida.",
    }, requestOrigin);
  }

  const admin = createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const payload = await request
    .json()
    .catch(() => ({})) as {
      action?: string;
      name?: string;
      email?: string;
      roleId?: string;
      memberId?: string;
    };

  const action = payload.action ?? "invite";

  const { data: allowed } = await userClient.rpc("has_permission", {
    required_permission: "users.manage",
  });

  if (!allowed) {
    return reply(403, {
      code: "permission_denied",
      message: "Você não possui permissão para gerenciar usuários.",
    }, requestOrigin);
  }

  const { data: organizationId, error: organizationError } =
    await userClient.rpc("current_organization_id");

  if (organizationError || !organizationId) {
    return reply(403, {
      code: "permission_denied",
      message: "Você não possui permissão para gerenciar usuários.",
    }, requestOrigin);
  }

  // CONVITE
  if (action === "invite") {
    const name = payload.name?.trim();
    const email = payload.email?.trim().toLowerCase();

    if (
      !name ||
      !email ||
      !emailPattern.test(email) ||
      !payload.roleId
    ) {
      return reply(400, {
        code: "invalid_input",
        message: "Preencha nome, email e função.",
      }, requestOrigin);
    }

    const { data: role } = await admin
      .from("roles")
      .select("id,slug,organization_id")
      .eq("id", payload.roleId)
      .maybeSingle();

    if (
      !role ||
      role.slug === "owner" ||
      (role.organization_id &&
        role.organization_id !== organizationId)
    ) {
      return reply(400, {
        code: "invalid_role",
        message: "Função inválida para convite.",
      }, requestOrigin);
    }

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (existingProfile) {
      const { data: membership } = await admin
        .from("organization_members")
        .select("id,status")
        .eq("organization_id", organizationId)
        .eq("user_id", existingProfile.id)
        .maybeSingle();

      if (membership?.status === "active") {
        return reply(409, {
          code: "member_exists",
          message: "Este usuário já faz parte da equipe.",
        }, requestOrigin);
      }

      if (membership?.status === "invited") {
        return reply(409, {
          code: "invite_pending",
          message: "Este email já possui um convite pendente.",
        }, requestOrigin);
      }
    }

    const invited = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        name,
      },
      redirectTo: `${configuredOrigin}/aceitar-convite`,
    });

    if (invited.error) {
      console.error("invite_user_failed", {
        organizationId,
        email,
        status: invited.error.status,
        name: invited.error.name,
        message: invited.error.message,
      });

      const normalized = invited.error.message.toLowerCase();
      const message =
        normalized.includes("already") || normalized.includes("registered")
          ? "Este e-mail já possui uma conta. Use outro e-mail ou vincule o usuário existente."
          : normalized.includes("rate")
            ? "O limite temporário de envio de convites foi atingido. Tente novamente em alguns minutos."
            : "Não foi possível enviar o convite pelo serviço de autenticação.";

      return reply(
        400,
        {
          code: "invite_failed",
          message,
        },
        requestOrigin,
      );
    }

    const targetUserId =
      existingProfile?.id ?? invited.data.user?.id;

    if (!targetUserId) {
      return reply(500, {
        code: "invite_reconciliation_required",
        message:
          "Convite enviado, mas a vinculação precisa ser reconciliada.",
      }, requestOrigin);
    }

    await admin
      .from("profiles")
      .update({
        name,
      })
      .eq("id", targetUserId);

    const { error } = await admin.rpc(
      "manage_member_invitation",
      {
        actor_user_id: auth.user.id,
        actor_organization_id: organizationId,
        target_user_id: targetUserId,
        target_role_id: payload.roleId,
        target_action: "invite",
      },
    );

    if (error) {
      return reply(500, {
        code: "invite_reconciliation_required",
        message:
          "Convite enviado. Tente reenviar para concluir a vinculação.",
      }, requestOrigin);
    }

    return reply(200, {
      message: "Convite enviado.",
    }, requestOrigin);
  }

  // ALTERAÇÃO DE E-MAIL
  if (action === "change_email") {
    if (!payload.memberId) {
      return reply(400, {
        code: "invalid_member",
        message: "Usuário inválido.",
      }, requestOrigin);
    }

    const email = payload.email?.trim().toLowerCase();

    if (!email || !emailPattern.test(email)) {
      return reply(400, {
        code: "invalid_email",
        message: "Informe um e-mail válido.",
      }, requestOrigin);
    }

    const { data: member } = await admin
      .from("organization_members")
      .select("user_id,status,profiles!inner(email)")
      .eq("organization_id", organizationId)
      .eq("id", payload.memberId)
      .maybeSingle();

    if (!member) {
      return reply(404, {
        code: "member_not_found",
        message: "Usuário não encontrado.",
      }, requestOrigin);
    }

    const currentEmail = (
      member.profiles as unknown as { email: string }
    ).email?.toLowerCase();

    if (currentEmail === email) {
      return reply(200, {
        message: "O e-mail informado já está cadastrado.",
      }, requestOrigin);
    }

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .neq("id", member.user_id)
      .maybeSingle();

    if (existingProfile) {
      return reply(409, {
        code: "email_in_use",
        message: "Este e-mail já está sendo utilizado por outro usuário.",
      }, requestOrigin);
    }

    const authUpdate = await admin.auth.admin.updateUserById(
      member.user_id,
      {
        email,
        email_confirm: true,
      },
    );

    if (authUpdate.error) {
      return reply(400, {
        code: "auth_email_update_failed",
        message: "Não foi possível alterar o e-mail de acesso.",
      }, requestOrigin);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        email,
      })
      .eq("id", member.user_id);

    if (profileError) {
      return reply(500, {
        code: "profile_email_update_failed",
        message:
          "O e-mail de acesso foi alterado, mas o perfil precisa ser sincronizado.",
      }, requestOrigin);
    }

    return reply(200, {
      message: "E-mail atualizado com sucesso.",
    }, requestOrigin);
  }

  // REENVIAR OU CANCELAR CONVITE
  if (action === "resend" || action === "cancel") {
    if (!payload.memberId) {
      return reply(400, {
        code: "invalid_member",
        message: "Usuário inválido.",
      }, requestOrigin);
    }

    const { data: member } = await admin
      .from("organization_members")
      .select("user_id,role_id,status,profiles!inner(email)")
      .eq("organization_id", organizationId)
      .eq("id", payload.memberId)
      .maybeSingle();

    if (!member || member.status !== "invited") {
      return reply(409, {
        code: "invite_not_pending",
        message: "Este convite não está mais pendente.",
      }, requestOrigin);
    }

    const email = (
      member.profiles as unknown as { email: string }
    ).email;

    if (action === "resend") {
      const resent = await admin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: `${configuredOrigin}/aceitar-convite`,
        },
      );

      if (resent.error) {
        return reply(400, {
          code: "resend_failed",
          message: "Não foi possível reenviar o convite.",
        }, requestOrigin);
      }
    }

    const { error } = await admin.rpc(
      "manage_member_invitation",
      {
        actor_user_id: auth.user.id,
        actor_organization_id: organizationId,
        target_user_id: member.user_id,
        target_role_id: member.role_id,
        target_action: action,
      },
    );

    if (error) {
      return reply(403, {
        code: "operation_denied",
        message:
          "Você não possui permissão para realizar esta ação.",
      }, requestOrigin);
    }

    return reply(200, {
      message:
        action === "resend"
          ? "Convite reenviado."
          : "Convite cancelado.",
    }, requestOrigin);
  }

  return reply(400, {
    code: "invalid_action",
    message: "Ação inválida.",
  }, requestOrigin);
});
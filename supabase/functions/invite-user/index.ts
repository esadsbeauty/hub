import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("APP_ORIGIN") ?? "";
const headers = { "Access-Control-Allow-Origin": allowedOrigin, "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { code: "method_not_allowed", message: "Método não permitido." });
  if (!allowedOrigin || request.headers.get("origin") !== allowedOrigin) return reply(403, { code: "origin_denied", message: "Origem não autorizada." });
  const authorization = request.headers.get("authorization");
  if (!authorization) return reply(401, { code: "invalid_session", message: "Sessão inválida." });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceRole) return reply(503, { code: "not_configured", message: "Gestão de usuários ainda não está configurada." });

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return reply(401, { code: "invalid_session", message: "Sessão inválida." });
  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const payload = await request.json().catch(() => ({})) as { action?: string; name?: string; email?: string; roleId?: string; memberId?: string };
  const action = payload.action ?? "invite";


  const { data: allowed } = await userClient.rpc("has_permission", { required_permission: "users.manage" });
  if (!allowed) return reply(403, { code: "permission_denied", message: "Você não possui permissão para gerenciar usuários." });
  const { data: activeOrganizationId } = await userClient.rpc("current_organization_id");
  if (!activeOrganizationId) return reply(403, { code: "active_organization_required", message: "Selecione uma organização ativa válida." });

  if (action === "invite") {
    const name = payload.name?.trim();
    const email = payload.email?.trim().toLowerCase();
    if (!name || !email || !emailPattern.test(email) || !payload.roleId) return reply(400, { code: "invalid_input", message: "Preencha nome, email e função." });
    const { data: role } = await admin.from("roles").select("id,slug,organization_id").eq("id", payload.roleId).maybeSingle();
    if (!role || role.slug === "owner" || (role.organization_id && role.organization_id !== activeOrganizationId)) return reply(400, { code: "invalid_role", message: "Função inválida para convite." });
    const { data: existingProfile } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (existingProfile) {
      const { data: membership } = await admin.from("organization_members").select("id,status").eq("organization_id", activeOrganizationId).eq("user_id", existingProfile.id).maybeSingle();
      if (membership?.status === "active") return reply(409, { code: "member_exists", message: "Este usuário já faz parte da equipe." });
      if (membership?.status === "invited") return reply(409, { code: "invite_pending", message: "Este email já possui um convite pendente." });
    }
    const invited = await admin.auth.admin.inviteUserByEmail(email, { data: { name }, redirectTo: `${allowedOrigin}/aceitar-convite` });
    if (invited.error) return reply(400, { code: "invite_failed", message: "Não foi possível enviar o convite." });
    const targetUserId = existingProfile?.id ?? invited.data.user?.id;
    if (!targetUserId) return reply(500, { code: "invite_reconciliation_required", message: "Convite enviado, mas a vinculação precisa ser reconciliada." });
    await admin.from("profiles").update({ name }).eq("id", targetUserId);
    const { error } = await admin.rpc("manage_member_invitation", { actor_user_id: auth.user.id, target_user_id: targetUserId, target_role_id: payload.roleId, target_action: "invite" });
    if (error) return reply(500, { code: "invite_reconciliation_required", message: "Convite enviado. Tente reenviar para concluir a vinculação." });
    return reply(200, { message: "Convite enviado." });
  }

  if (action === "resend" || action === "cancel") {
    if (!payload.memberId) return reply(400, { code: "invalid_member", message: "Usuário inválido." });
    const { data: member } = await admin.from("organization_members").select("user_id,role_id,status,profiles!inner(email)").eq("organization_id", activeOrganizationId).eq("id", payload.memberId).maybeSingle();
    if (!member || member.status !== "invited") return reply(409, { code: "invite_not_pending", message: "Este convite não está mais pendente." });
    const email = (member.profiles as unknown as { email: string }).email;
    if (action === "resend") {
      const resent = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${allowedOrigin}/aceitar-convite` });
      if (resent.error) return reply(400, { code: "resend_failed", message: "Não foi possível reenviar o convite." });
    }
    const { error } = await admin.rpc("manage_member_invitation", { actor_user_id: auth.user.id, target_user_id: member.user_id, target_role_id: member.role_id, target_action: action });
    if (error) return reply(403, { code: "operation_denied", message: "Você não possui permissão para realizar esta ação." });
    return reply(200, { message: action === "resend" ? "Convite reenviado." : "Convite cancelado." });
  }

  return reply(400, { code: "invalid_action", message: "Ação inválida." });
});

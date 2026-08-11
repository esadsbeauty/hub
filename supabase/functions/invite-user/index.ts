import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("APP_ORIGIN") ?? "";
const headers = { "Access-Control-Allow-Origin": allowedOrigin, "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Content-Type": "application/json" };
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.headers.get("origin") !== allowedOrigin) return reply(403, { message: "Origem não autorizada." });
  const authorization = request.headers.get("authorization");
  if (!authorization) return reply(401, { message: "Sessão inválida." });
  const url = Deno.env.get("SUPABASE_URL"); const anon = Deno.env.get("SUPABASE_ANON_KEY"); const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceRole) return reply(503, { message: "Convites ainda não estão configurados." });
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const [{ data: allowed }, { data: auth }] = await Promise.all([userClient.rpc("has_permission", { required_permission: "users.manage" }), userClient.auth.getUser()]);
  if (!allowed || !auth.user) return reply(403, { message: "Você não possui permissão para convidar usuários." });
  const payload = await request.json() as { name?: string; email?: string; roleId?: string };
  if (!payload.name?.trim() || !payload.email?.includes("@") || !payload.roleId) return reply(400, { message: "Preencha nome, email e papel." });
  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: actor } = await admin.from("organization_members").select("organization_id").eq("user_id", auth.user.id).eq("status", "active").single();
  const { data: role } = await admin.from("roles").select("id,organization_id").eq("id", payload.roleId).maybeSingle();
  if (!actor || !role || (role.organization_id && role.organization_id !== actor.organization_id)) return reply(400, { message: "Papel inválido." });
  const invited = await admin.auth.admin.inviteUserByEmail(payload.email.trim().toLowerCase(), { data: { name: payload.name.trim() }, redirectTo: `${allowedOrigin}/login` });
  if (invited.error || !invited.data.user) return reply(400, { message: "Não foi possível enviar o convite." });
  await admin.from("profiles").update({ name: payload.name.trim() }).eq("id", invited.data.user.id);
  await admin.from("organization_members").update({ role_id: payload.roleId, status: "invited", invited_by: auth.user.id }).eq("organization_id", actor.organization_id).eq("user_id", invited.data.user.id);
  await userClient.rpc("write_invitation_audit", { invited_user_id: invited.data.user.id, invited_role_id: payload.roleId });
  return reply(200, { message: "Convite enviado com segurança." });
});

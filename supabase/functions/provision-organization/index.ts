import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("APP_ORIGIN") ?? "";
const headers = { "Access-Control-Allow-Origin": allowedOrigin, "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Input = { organizationName?: string; ownerName?: string; ownerEmail?: string; ownerWhatsapp?: string; planId?: string; pipelineName?: string };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { code: "method_not_allowed", message: "Método não permitido." });
  if (!allowedOrigin || request.headers.get("origin") !== allowedOrigin) return reply(403, { code: "origin_denied", message: "Origem não autorizada." });
  const authorization = request.headers.get("authorization");
  if (!authorization) return reply(401, { code: "invalid_session", message: "Sessão inválida." });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceRole) return reply(503, { code: "not_configured", message: "Provisionamento ainda não está configurado." });

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return reply(401, { code: "invalid_session", message: "Sessão inválida." });
  const { data: isPlatformAdmin } = await userClient.rpc("is_platform_admin");
  if (!isPlatformAdmin) return reply(403, { code: "platform_admin_required", message: "Apenas administradores da plataforma podem criar organizações." });

  const input = await request.json().catch(() => ({})) as Input;
  const organizationName = input.organizationName?.trim();
  const ownerName = input.ownerName?.trim();
  const ownerEmail = input.ownerEmail?.trim().toLowerCase();
  const ownerWhatsapp = input.ownerWhatsapp?.trim() ?? "";
  const pipelineName = input.pipelineName?.trim() || "Pipeline Comercial";
  if (!organizationName || !ownerName || !ownerEmail || !emailPattern.test(ownerEmail)) return reply(400, { code: "invalid_input", message: "Preencha empresa, responsável e um e-mail válido." });

  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existingProfile } = await admin.from("profiles").select("id").ilike("email", ownerEmail).maybeSingle();
  if (existingProfile) return reply(409, { code: "owner_exists", message: "Este e-mail já possui uma conta e não pode ser movido entre organizações." });

  const invited = await admin.auth.admin.inviteUserByEmail(ownerEmail, { data: { name: ownerName }, redirectTo: `${allowedOrigin}/aceitar-convite` });
  const ownerUserId = invited.data.user?.id;
  if (invited.error || !ownerUserId) return reply(400, { code: "invite_failed", message: "Não foi possível enviar o convite ao responsável." });

  const provisioned = await admin.rpc("platform_provision_organization", {
    actor_user_id: auth.user.id,
    owner_user_id: ownerUserId,
    organization_name: organizationName,
    owner_name: ownerName,
    owner_email: ownerEmail,
    owner_whatsapp: ownerWhatsapp,
    selected_plan_id: input.planId || null,
    pipeline_name: pipelineName,
  });
  if (provisioned.error) {
    await admin.auth.admin.deleteUser(ownerUserId);
    return reply(400, { code: "provisioning_failed", message: "Não foi possível preparar a organização. O convite foi cancelado." });
  }
  return reply(201, { message: "Organização criada e convite enviado ao responsável.", organization: provisioned.data });
});

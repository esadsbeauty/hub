import { supabase } from "@/lib/supabase";
import { isLocalMode } from "@/config/app-mode";
import { permissionKeys } from "@/shared/permissions/permissions";
import type { BootstrapStatus, GovernanceData, MemberStatus } from "./types";

const client = () => { if (!supabase) throw new Error("Não foi possível conectar ao serviço de autenticação."); return supabase; };
const fail = (error: { message: string } | null, message = "Você não possui permissão para realizar esta ação.") => { if (error) { if (import.meta.env.DEV) console.error("[Governance]", error.message); throw new Error(message); } };
async function invoke<T>(body: Record<string, unknown>, fallback: string): Promise<T> {
  const result = await client().functions.invoke("invite-user", { body });
  if (result.error) throw new Error(fallback);
  return result.data as T;
}
const supabaseGovernanceRepository = {
  async list(page = 0): Promise<GovernanceData> { const result = await client().rpc("governance_snapshot", { audit_limit: 50, audit_offset: page * 50 }); fail(result.error); return result.data as unknown as GovernanceData; },
  async changeRole(memberId: string, roleId: string) { const result = await client().rpc("change_member_role", { target_member_id: memberId, target_role_id: roleId }); fail(result.error, "Não foi possível atualizar a função."); },
  async changeStatus(memberId: string, status: MemberStatus) { const result = await client().rpc("change_member_status", { target_member_id: memberId, target_status: status }); fail(result.error, "Não foi possível atualizar o acesso."); },
  async approveAccess(memberId: string, roleId: string) { const result = await client().rpc("approve_access_request", { target_member_id: memberId, target_role_id: roleId }); fail(result.error, "Não foi possível aprovar o usuário."); },
  async rejectAccess(memberId: string) { const result = await client().rpc("reject_access_request", { target_member_id: memberId }); fail(result.error, "Não foi possível recusar o acesso."); },
  async updateOrganization(input: Omit<GovernanceData["organization"], "id">) { const result = await client().rpc("update_organization_settings", { settings_data: input }); fail(result.error); },
  inviteUser(input: { name: string; email: string; roleId: string }) { return invoke<{ message: string }>({ action: "invite", ...input }, "Não foi possível enviar o convite."); },
  resendInvite(memberId: string) { return invoke<{ message: string }>({ action: "resend", memberId }, "Não foi possível reenviar o convite."); },
  cancelInvite(memberId: string) { return invoke<{ message: string }>({ action: "cancel", memberId }, "Não foi possível cancelar o convite."); },
  async bootstrapStatus(): Promise<BootstrapStatus> { const result = await client().rpc("initial_owner_bootstrap_status"); fail(result.error, "Não foi possível validar a configuração inicial."); return result.data as unknown as BootstrapStatus; },
  async claimInitialOwner(name: string) { const result = await client().rpc("claim_initial_owner", { target_name: name }); fail(result.error, "Não foi possível ativar o Administrador Geral."); return result.data; },
};

const createdAt = new Date().toISOString();
const localGovernance: GovernanceData = {
  organization: { id: "local-esads-beauty", name: "ESADS Beauty", timezone: "America/Sao_Paulo", currency: "BRL", locale: "pt-BR" },
  members: [{ id: "local-owner-member", userId: "local-owner", name: "Admin ESADS Beauty", email: "admin@esadsbeauty.local", roleId: "local-owner-role", roleName: "Administrador Geral", roleSlug: "owner", status: "active", joinedAt: createdAt, createdAt }],
  roles: [{ id: "local-owner-role", name: "Administrador Geral", slug: "owner", permissions: [...permissionKeys] }],
  audits: [],
};
const requiresSupabase = async () => { throw new Error("Esta ação exige o modo Supabase."); };
const localGovernanceRepository = {
  async list(): Promise<GovernanceData> { return localGovernance; },
  changeRole: requiresSupabase,
  changeStatus: requiresSupabase,
  approveAccess: requiresSupabase,
  rejectAccess: requiresSupabase,
  async updateOrganization(input: Omit<GovernanceData["organization"], "id">) { Object.assign(localGovernance.organization, input); },
  inviteUser: requiresSupabase,
  resendInvite: requiresSupabase,
  cancelInvite: requiresSupabase,
  async bootstrapStatus(): Promise<BootstrapStatus> { return { available: false, eligible: false, organizationName: "ESADS Beauty", reason: "owner_exists" }; },
  claimInitialOwner: requiresSupabase,
};

export const governanceRepository = isLocalMode ? localGovernanceRepository : supabaseGovernanceRepository;

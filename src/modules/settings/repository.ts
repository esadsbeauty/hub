import { supabase } from "@/lib/supabase";
import type { BootstrapStatus, GovernanceData, MemberStatus } from "./types";

const client = () => { if (!supabase) throw new Error("Não foi possível conectar ao serviço de autenticação."); return supabase; };
const fail = (error: { message: string } | null, message = "Você não possui permissão para realizar esta ação.") => { if (error) { if (import.meta.env.DEV) console.error("[Governance]", error.message); throw new Error(message); } };
async function invoke<T>(body: Record<string, unknown>, fallback: string): Promise<T> {
  const result = await client().functions.invoke("invite-user", { body });
  if (result.error) throw new Error(fallback);
  return result.data as T;
}
export const governanceRepository = {
  async list(page = 0): Promise<GovernanceData> { const result = await client().rpc("governance_snapshot", { audit_limit: 50, audit_offset: page * 50 }); fail(result.error); return result.data as unknown as GovernanceData; },
  async changeRole(memberId: string, roleId: string) { const result = await client().rpc("change_member_role", { target_member_id: memberId, target_role_id: roleId }); fail(result.error, "Não foi possível atualizar a função."); },
  async changeStatus(memberId: string, status: MemberStatus) { const result = await client().rpc("change_member_status", { target_member_id: memberId, target_status: status }); fail(result.error, "Não foi possível atualizar o acesso."); },
  async updateOrganization(input: Omit<GovernanceData["organization"], "id">) { const result = await client().rpc("update_organization_settings", { settings_data: input }); fail(result.error); },
  inviteUser(input: { name: string; email: string; roleId: string }) { return invoke<{ message: string }>({ action: "invite", ...input }, "Não foi possível enviar o convite."); },
  resendInvite(memberId: string) { return invoke<{ message: string }>({ action: "resend", memberId }, "Não foi possível reenviar o convite."); },
  cancelInvite(memberId: string) { return invoke<{ message: string }>({ action: "cancel", memberId }, "Não foi possível cancelar o convite."); },
  bootstrapStatus() { return invoke<BootstrapStatus>({ action: "bootstrap_status" }, "Não foi possível validar a configuração inicial."); },
  claimInitialOwner(name: string) { return invoke<{ message: string }>({ action: "claim_owner", name }, "Não foi possível ativar o Administrador Geral."); },
};

import { supabase } from "@/lib/supabase";
import type { GovernanceData, MemberStatus } from "./types";

const client = () => { if (!supabase) throw new Error("Não foi possível conectar ao serviço de autenticação."); return supabase; };
const fail = (error: { message: string } | null) => { if (error) { console.error("[Governance]", error); throw new Error("Você não possui permissão para realizar esta ação."); } };
export const governanceRepository = {
  async list(page = 0): Promise<GovernanceData> { const result = await client().rpc("governance_snapshot", { audit_limit: 50, audit_offset: page * 50 }); fail(result.error); return result.data as unknown as GovernanceData; },
  async changeRole(memberId: string, roleId: string) { const result = await client().rpc("change_member_role", { target_member_id: memberId, target_role_id: roleId }); fail(result.error); },
  async changeStatus(memberId: string, status: MemberStatus) { const result = await client().rpc("change_member_status", { target_member_id: memberId, target_status: status }); fail(result.error); },
  async updateOrganization(input: Omit<GovernanceData["organization"], "id">) { const result = await client().rpc("update_organization_settings", { settings_data: input }); fail(result.error); },
  async inviteUser(input: { name: string; email: string; roleId: string }) { const result = await client().functions.invoke("invite-user", { body: input }); fail(result.error); },
};

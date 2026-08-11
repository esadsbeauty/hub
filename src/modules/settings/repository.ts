import { supabase } from "@/lib/supabase";
import { previewRolePermissions, type RoleSlug } from "@/shared/permissions/permissions";
import type { GovernanceData, MemberStatus } from "./types";

const roleNames: Record<RoleSlug, string> = { admin: "Administrador", manager: "Gestor", sales: "Comercial", operations: "Operacional", financial: "Financeiro", marketing: "Marketing", reader: "Leitura" };
const preview = (): GovernanceData => ({ organization: { id: "esads-beauty", name: "ESADS Beauty", timezone: "America/Sao_Paulo", currency: "BRL", locale: "pt-BR" }, members: [{ id: "preview-member", userId: "preview-admin", name: "Administrador Preview", email: "admin@esadsbeauty.com", roleId: "preview-admin-role", roleName: roleNames.admin, roleSlug: "admin", status: "active", joinedAt: new Date().toISOString(), createdAt: new Date().toISOString() }], roles: (Object.keys(previewRolePermissions) as RoleSlug[]).map((slug) => ({ id: `preview-${slug}-role`, name: roleNames[slug], slug, permissions: previewRolePermissions[slug] })), audits: [] });
const fail = (error: { message: string } | null) => { if (error) { console.error("[Governance]", error); throw new Error("Não foi possível concluir a operação administrativa."); } };

export const governanceRepository = {
  async list(page = 0): Promise<GovernanceData> {
    if (!supabase) return preview();
    const result = await supabase.rpc("governance_snapshot", { audit_limit: 50, audit_offset: page * 50 }); fail(result.error);
    return result.data as unknown as GovernanceData;
  },
  async changeRole(memberId: string, roleId: string) { if (!supabase) return; const result = await supabase.rpc("change_member_role", { target_member_id: memberId, target_role_id: roleId }); fail(result.error); },
  async changeStatus(memberId: string, status: MemberStatus) { if (!supabase) return; const result = await supabase.rpc("change_member_status", { target_member_id: memberId, target_status: status }); fail(result.error); },
  async updateOrganization(input: Omit<GovernanceData["organization"], "id">) { if (!supabase) return; const result = await supabase.rpc("update_organization_settings", { settings_data: input }); fail(result.error); },
  async inviteUser(input: { name: string; email: string; roleId: string }) { if (!supabase) return; const result = await supabase.functions.invoke("invite-user", { body: input }); fail(result.error); },
};

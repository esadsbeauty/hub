import type { Permission, RoleSlug } from "@/shared/permissions/permissions";

export type MemberStatus = "pending" | "invited" | "active" | "suspended" | "inactive";
export type OrganizationSettings = { id: string; name: string; timezone: string; currency: string; locale: string };
export type Role = { id: string; name: string; slug: RoleSlug; permissions: Permission[] };
export type Member = { id: string; userId: string; name: string; email: string; roleId: string; roleName: string; roleSlug: RoleSlug; status: MemberStatus; joinedAt?: string; lastSignInAt?: string; createdAt: string };
export type AuditLog = { id: string; userId?: string; userName?: string; action: string; entityType: string; entityId?: string; module: string; oldValues: Record<string, unknown>; newValues: Record<string, unknown>; metadata: Record<string, unknown>; createdAt: string };
export type GovernanceData = { organization: OrganizationSettings; members: Member[]; roles: Role[]; audits: AuditLog[] };
export type BootstrapStatus = {
  available: boolean;
  eligible: boolean;
  organizationName: string;
  reason: "ready" | "owner_exists" | "not_initial_auth_user";
};

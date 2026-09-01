import { createContext, useContext } from "react";
import type { Permission, RoleSlug } from "@/shared/permissions/permissions";

export type MemberStatus = "pending" | "active" | "invited" | "suspended" | "inactive" | "unlinked";
export type PlatformOrganizationOption = { id: string; name: string; slug: string; type?: string };
export type Authorization = { organizationId: string; organizationName: string; baseOrganizationId: string; baseOrganizationName: string; role: RoleSlug; permissions: Permission[]; entitlements: string[]; status: MemberStatus; isPlatformAdmin: boolean; isImpersonating: boolean; platformOrganizations: PlatformOrganizationOption[] };
export type AppState = Authorization & { authorizationLoading: boolean; theme: "light" | "dark"; can: (permission: Permission) => boolean; canAny: (permissions: Permission[]) => boolean; canAll: (permissions: Permission[]) => boolean; setTheme: (theme: "light" | "dark") => void; switchOrganization: (organizationId: string) => Promise<void>; returnToBaseOrganization: () => Promise<void> };
export const AppStateContext = createContext<AppState | null>(null);
export function useAppState() { const value = useContext(AppStateContext); if (!value) throw new Error("useAppState must be used inside an app state provider"); return value; }

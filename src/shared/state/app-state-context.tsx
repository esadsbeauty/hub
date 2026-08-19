import { createContext, useContext } from "react";
import type { Permission, RoleSlug } from "@/shared/permissions/permissions";

export type MemberStatus = "pending" | "active" | "invited" | "suspended" | "inactive" | "unlinked";
export type Authorization = { organizationId: string; organizationName: string; role: RoleSlug; permissions: Permission[]; status: MemberStatus };
export type AppState = Authorization & { authorizationLoading: boolean; theme: "light" | "dark"; can: (permission: Permission) => boolean; canAny: (permissions: Permission[]) => boolean; canAll: (permissions: Permission[]) => boolean; setTheme: (theme: "light" | "dark") => void };
export const AppStateContext = createContext<AppState | null>(null);
export function useAppState() { const value = useContext(AppStateContext); if (!value) throw new Error("useAppState must be used inside an app state provider"); return value; }

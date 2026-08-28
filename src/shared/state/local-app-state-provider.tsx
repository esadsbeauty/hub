import { useMemo, useState } from "react";
import { permissionKeys } from "@/shared/permissions/permissions";
import { AppStateContext, type AppState } from "./app-state-context";

export function LocalAppStateProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const value = useMemo<AppState>(() => ({
    organizationId: "local-esads-beauty", organizationName: "ESADS Beauty", role: "owner", permissions: [...permissionKeys], entitlements: ["dashboard", "crm", "agenda", "customers", "finance", "marketing", "reports", "settings", "users", "roles", "audit", "blog"], status: "active", isPlatformAdmin: true, authorizationLoading: false, theme, setTheme,
    can: () => true, canAny: () => true, canAll: () => true,
  }), [theme]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

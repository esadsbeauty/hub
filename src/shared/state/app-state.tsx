import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { permissionKeys, type Permission, type RoleSlug } from "@/shared/permissions/permissions";

type MemberStatus = "active" | "invited" | "suspended" | "inactive" | "unlinked";
type Authorization = { organizationId: string; organizationName: string; role: RoleSlug; permissions: Permission[]; status: MemberStatus };
type AppState = Authorization & { authorizationLoading: boolean; theme: "light" | "dark"; can: (permission: Permission) => boolean; canAny: (permissions: Permission[]) => boolean; canAll: (permissions: Permission[]) => boolean; setTheme: (theme: "light" | "dark") => void };
const AppStateContext = createContext<AppState | null>(null);
const denied: Authorization = { organizationId: "", organizationName: "", role: "reader", permissions: [], status: "unlinked" };

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const { user, appMode, loading: authLoading } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [authorization, setAuthorization] = useState<Authorization>(denied);
  const [authorizationLoading, setAuthorizationLoading] = useState(true);
  useEffect(() => {
    if (authLoading) return;
    if (appMode === "local" && user) {
      setAuthorization({ organizationId: "local-esads-beauty", organizationName: "ESADS Beauty", role: "owner", permissions: [...permissionKeys], status: "active" });
      setAuthorizationLoading(false);
      return;
    }
    if (!supabase || !user) { setAuthorization(denied); setAuthorizationLoading(false); return; }
    const client = supabase; setAuthorizationLoading(true);
    const loadAuthorization = () => client.rpc("current_authorization").then(({ data, error }) => {
      if (error || !data) setAuthorization(denied);
      else { const value = data as unknown as { organization_id: string; organization_name: string; role: RoleSlug; status: Authorization["status"]; permissions: Permission[] }; setAuthorization({ organizationId: value.organization_id, organizationName: value.organization_name, role: value.role, status: value.status, permissions: value.status === "active" ? value.permissions : [] }); }
      setAuthorizationLoading(false);
    });
    void loadAuthorization();
    const interval = window.setInterval(() => void loadAuthorization(), 30_000);
    const onVisibility = () => { if (document.visibilityState === "visible") void loadAuthorization(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, [appMode, authLoading, user?.id]);
  const value = useMemo<AppState>(() => ({ ...authorization, authorizationLoading, theme, setTheme, can: (key) => authorization.permissions.includes(key), canAny: (keys) => keys.some((key) => authorization.permissions.includes(key)), canAll: (keys) => keys.every((key) => authorization.permissions.includes(key)) }), [authorization, authorizationLoading, theme]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
export function useAppState() { const value = useContext(AppStateContext); if (!value) throw new Error("useAppState must be used inside AppStateProvider"); return value; }

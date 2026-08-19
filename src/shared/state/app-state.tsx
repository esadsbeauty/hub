import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-context";
import type { Permission, RoleSlug } from "@/shared/permissions/permissions";
import { AppStateContext, type AppState, type Authorization } from "./app-state-context";

const denied: Authorization = { organizationId: "", organizationName: "", role: "reader", permissions: [], status: "unlinked" };
export function SupabaseAppStateProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [authorization, setAuthorization] = useState<Authorization>(denied);
  const [authorizationLoading, setAuthorizationLoading] = useState(true);
  useEffect(() => {
    if (authLoading) return;
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
  }, [authLoading, user?.id]);
  const value = useMemo<AppState>(() => ({ ...authorization, authorizationLoading, theme, setTheme, can: (key) => authorization.permissions.includes(key), canAny: (keys) => keys.some((key) => authorization.permissions.includes(key)), canAll: (keys) => keys.every((key) => authorization.permissions.includes(key)) }), [authorization, authorizationLoading, theme]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

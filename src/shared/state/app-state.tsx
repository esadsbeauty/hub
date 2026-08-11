import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { type Permission, previewRolePermissions, type RoleSlug } from "@/shared/permissions/permissions";

type Authorization = { organizationId: string; organizationName: string; role: RoleSlug; permissions: Permission[]; status: "active" | "invited" | "suspended" | "inactive" };
type AppState = Authorization & { authorizationLoading: boolean; theme: "light" | "dark"; can: (permission: Permission) => boolean; canAny: (permissions: Permission[]) => boolean; canAll: (permissions: Permission[]) => boolean; setTheme: (theme: "light" | "dark") => void };
const AppStateContext = createContext<AppState | null>(null);
const preview: Authorization = { organizationId: "esads-beauty", organizationName: "ESADS Beauty", role: "admin", permissions: previewRolePermissions.admin, status: "active" };

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [authorization, setAuthorization] = useState<Authorization>(preview);
  const [authorizationLoading, setAuthorizationLoading] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase || !user) { setAuthorization(preview); setAuthorizationLoading(false); return; }
    const client = supabase;
    setAuthorizationLoading(true);
    client.rpc("accept_own_invitation").then(() => client.rpc("current_authorization")).then(({ data, error }) => {
      if (error || !data) setAuthorization({ ...preview, organizationId: "", organizationName: "", role: "reader", permissions: [], status: "inactive" });
      else {
        const value = data as unknown as { organization_id: string; organization_name: string; role: RoleSlug; status: Authorization["status"]; permissions: Permission[] };
        setAuthorization({ organizationId: value.organization_id, organizationName: value.organization_name, role: value.role, status: value.status, permissions: value.permissions });
      }
      setAuthorizationLoading(false);
    });
  }, [user?.id]);
  const value = useMemo<AppState>(() => ({ ...authorization, authorizationLoading, theme, setTheme, can: (key) => authorization.permissions.includes(key), canAny: (keys) => keys.some((key) => authorization.permissions.includes(key)), canAll: (keys) => keys.every((key) => authorization.permissions.includes(key)) }), [authorization, authorizationLoading, theme]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() { const value = useContext(AppStateContext); if (!value) throw new Error("useAppState must be used inside AppStateProvider"); return value; }

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-context";
import type { Permission, RoleSlug } from "@/shared/permissions/permissions";
import { AppStateContext, type AppState, type Authorization } from "./app-state-context";
import { useQueryClient } from "@tanstack/react-query";

const denied: Authorization = { organizationId: "", organizationName: "", role: "reader", permissions: [], status: "unlinked" };
export function SupabaseAppStateProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [authorization, setAuthorization] = useState<Authorization>(denied);
  const [authorizationLoading, setAuthorizationLoading] = useState(true);
  const queryClient = useQueryClient();
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
    const membershipChannel=client.channel(`authorization:${user.id}`).on("postgres_changes",{event:"*",schema:"public",table:"organization_members",filter:`user_id=eq.${user.id}`},()=>void loadAuthorization()).subscribe();
    const onVisibility = () => { if (document.visibilityState === "visible") void loadAuthorization(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {document.removeEventListener("visibilitychange", onVisibility);void client.removeChannel(membershipChannel);};
  }, [authLoading, user?.id]);
  const value = useMemo<AppState>(() => { const isAdministrator = authorization.status === "active" && (authorization.role === "owner" || authorization.role === "admin"); const can = (key: Permission) => isAdministrator || authorization.permissions.includes(key); const setActiveOrganization=async(organizationId:string)=>{if(!supabase)throw new Error("Supabase indisponível");const{error}=await supabase.rpc("set_active_organization",{target_organization_id:organizationId});if(error)throw error;queryClient.clear();setAuthorizationLoading(true);const{data,error:authorizationError}=await supabase.rpc("current_authorization");if(authorizationError||!data)throw authorizationError??new Error("Organização ativa inválida");const current=data as unknown as {organization_id:string;organization_name:string;role:RoleSlug;status:Authorization["status"];permissions:Permission[]};setAuthorization({organizationId:current.organization_id,organizationName:current.organization_name,role:current.role,status:current.status,permissions:current.status==="active"?current.permissions:[]});setAuthorizationLoading(false);};return ({ ...authorization, authorizationLoading, theme, setTheme, setActiveOrganization, can, canAny: (keys) => keys.some(can), canAll: (keys) => keys.every(can) }); }, [authorization, authorizationLoading, theme, queryClient]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

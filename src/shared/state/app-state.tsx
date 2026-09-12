import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-context";
import type { Permission, RoleSlug } from "@/shared/permissions/permissions";
import { AppStateContext, type AppState, type Authorization } from "./app-state-context";

const denied: Authorization = { organizationId: "", organizationName: "", baseOrganizationId: "", baseOrganizationName: "", role: "reader", permissions: [], entitlements: [], status: "unlinked", isPlatformAdmin: false, isImpersonating: false, platformOrganizations: [] };

export function SupabaseAppStateProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [authorization, setAuthorization] = useState<Authorization>(denied);
  const [authorizationLoading, setAuthorizationLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!supabase || !user) {
      setAuthorization(denied);
      setAuthorizationLoading(false);
      return;
    }

    const client = supabase;
    setAuthorizationLoading(true);

    const loadAuthorization = () =>
      client.rpc("current_authorization").then(({ data, error }) => {
        if (error || !data) {
          setAuthorization(denied);
        } else {
          const value = data as unknown as {
            organization_id: string;
            organization_name: string;
            role: RoleSlug;
            status: Authorization["status"];
            permissions: Permission[];
            entitlements?: string[];
            is_platform_admin?: boolean;
            is_impersonating?: boolean;
            base_organization_id?: string;
            base_organization_name?: string;
            organizations?: Authorization["platformOrganizations"];
          };

          setAuthorization({
            organizationId: value.organization_id,
            organizationName: value.organization_name,
            role: value.role,
            status: value.status,
            permissions: value.status === "active" ? value.permissions : [],
            entitlements: value.status === "active" ? value.entitlements ?? [] : [],
            isPlatformAdmin: value.is_platform_admin === true,
            isImpersonating: value.is_impersonating === true,
            baseOrganizationId: value.base_organization_id ?? value.organization_id,
            baseOrganizationName: value.base_organization_name ?? value.organization_name,
            platformOrganizations: value.organizations ?? [],
          });
        }

        setAuthorizationLoading(false);
      });

    void loadAuthorization();

    const membershipChannel = client
      .channel(`authorization:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "organization_members",
          filter: `user_id=eq.${user.id}`,
        },
        () => void loadAuthorization(),
      )
      .subscribe();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadAuthorization();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void client.removeChannel(membershipChannel);
    };
  }, [authLoading, user?.id]);

  const switchOrganization = useCallback(async (organizationId: string) => {
    if (!supabase || !authorization.isPlatformAdmin) throw new Error("Acesso restrito ao Platform Admin.");
    setAuthorizationLoading(true);
    const result = await supabase.rpc("platform_switch_organization", { target_organization_id: organizationId });
    if (result.error) { setAuthorizationLoading(false); throw new Error("Não foi possível trocar a organização."); }
    queryClient.clear();
    const auth = await supabase.rpc("current_authorization");
    if (auth.error || !auth.data) { setAuthorization(denied); setAuthorizationLoading(false); return; }
    const value = auth.data as any;
    setAuthorization({ organizationId:value.organization_id,organizationName:value.organization_name,baseOrganizationId:value.base_organization_id,baseOrganizationName:value.base_organization_name,role:value.role,status:value.status,permissions:value.permissions??[],entitlements:value.entitlements??[],isPlatformAdmin:value.is_platform_admin===true,isImpersonating:value.is_impersonating===true,platformOrganizations:value.organizations??[] });
    setAuthorizationLoading(false);
  }, [authorization.isPlatformAdmin, queryClient]);

  const value = useMemo<AppState>(() => {
    // The backend already intersects role permissions with plan entitlements.
    // Owners and tenant administrators must not bypass the organization's plan.
    const can = (key: Permission) =>
      authorization.status === "active" && authorization.permissions.includes(key);

    return {
      ...authorization,
      authorizationLoading,
      theme,
      setTheme,
      switchOrganization,
      returnToBaseOrganization: () => switchOrganization(authorization.baseOrganizationId),
      can,
      canAny: (keys) => keys.some(can),
      canAll: (keys) => keys.every(can),
    };
  }, [authorization, authorizationLoading, theme, switchOrganization]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

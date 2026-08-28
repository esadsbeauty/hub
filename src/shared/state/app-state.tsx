import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-context";
import type { Permission, RoleSlug } from "@/shared/permissions/permissions";
import { AppStateContext, type AppState, type Authorization } from "./app-state-context";

const denied: Authorization = { organizationId: "", organizationName: "", role: "reader", permissions: [], entitlements: [], status: "unlinked", isPlatformAdmin: false };

export function SupabaseAppStateProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
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
          };

          setAuthorization({
            organizationId: value.organization_id,
            organizationName: value.organization_name,
            role: value.role,
            status: value.status,
            permissions: value.status === "active" ? value.permissions : [],
            entitlements: value.status === "active" ? value.entitlements ?? [] : [],
            isPlatformAdmin: value.is_platform_admin === true,
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
      can,
      canAny: (keys) => keys.some(can),
      canAll: (keys) => keys.every(can),
    };
  }, [authorization, authorizationLoading, theme]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

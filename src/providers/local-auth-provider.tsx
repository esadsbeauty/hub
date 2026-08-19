import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthContext, type AuthUser, type AuthValue } from "./auth-context";

const LOCAL_SESSION_KEY = "esads-hub-local-v1:session";
const localOwner: AuthUser = { id: "local-owner", email: "admin@esadsbeauty.local", user_metadata: { name: "Admin ESADS Beauty" } };
const unavailable = async () => { throw new Error("Esta operação exige o modo Supabase."); };

export function LocalAuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem(LOCAL_SESSION_KEY) === "active");
  const value = useMemo<AuthValue>(() => ({
    user: authenticated ? localOwner : null,
    session: null,
    authenticated,
    appMode: "local",
    loading: false,
    configured: true,
    passwordRecovery: false,
    signIn: unavailable,
    resetPassword: unavailable,
    updatePassword: unavailable,
    completeInvitation: unavailable,
    enterLocalMode() { queryClient.clear(); sessionStorage.setItem(LOCAL_SESSION_KEY, "active"); setAuthenticated(true); },
    async signOut() { queryClient.clear(); sessionStorage.removeItem(LOCAL_SESSION_KEY); setAuthenticated(false); },
  }), [authenticated, queryClient]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

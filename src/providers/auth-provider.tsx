import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isLocalMode } from "@/config/app-mode";
import { supabase } from "@/lib/supabase";

const LOCAL_SESSION_KEY = "esads-hub-local-v1:session";
type AuthUser = { id: string; email?: string; user_metadata: Record<string, string | undefined> };
const localOwner: AuthUser = {
  id: "local-owner",
  email: "admin@esadsbeauty.local",
  user_metadata: { name: "Admin ESADS Beauty" },
};

type Auth = {
  user: AuthUser | null;
  session: Session | null;
  authenticated: boolean;
  appMode: "local" | "supabase";
  loading: boolean;
  configured: boolean;
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  enterLocalMode: () => void;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  completeInvitation: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<Auth | null>(null);
const unavailable = () => new Error("Não foi possível conectar ao serviço de autenticação.");

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [localSession, setLocalSession] = useState(() => isLocalMode && sessionStorage.getItem(LOCAL_SESSION_KEY) === "active");
  const [loading, setLoading] = useState(!isLocalMode);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const activeUserId = useRef<string | null>(null);

  useEffect(() => {
    if (isLocalMode) { setSession(null); setLoading(false); return; }
    if (!supabase) { setSession(null); setLoading(false); return; }
    const client = supabase;
    client.auth.getSession().then(({ data, error }) => { setSession(error ? null : data.session); activeUserId.current = data.session?.user.id ?? null; setLoading(false); });
    const { data: { subscription } } = client.auth.onAuthStateChange((event, nextSession) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_OUT" || activeUserId.current !== nextUserId) queryClient.clear();
      activeUserId.current = nextUserId;
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const value = useMemo<Auth>(() => ({
    user: isLocalMode ? (localSession ? localOwner : null) : session?.user ?? null,
    session,
    authenticated: isLocalMode ? localSession : Boolean(session),
    appMode: isLocalMode ? "local" : "supabase",
    loading,
    configured: isLocalMode || Boolean(supabase),
    passwordRecovery: !isLocalMode && passwordRecovery,
    async signIn(email, password) { if (isLocalMode) throw new Error("Use o acesso do modo local."); if (!supabase) throw unavailable(); const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }); if (error) throw new Error("Email ou senha incorretos."); },
    enterLocalMode() {
      if (!isLocalMode) throw new Error("O modo local não está disponível.");
      queryClient.clear();
      sessionStorage.setItem(LOCAL_SESSION_KEY, "active");
      setLocalSession(true);
    },
    async resetPassword(email) { if (isLocalMode) throw new Error("Recuperação indisponível no modo local."); if (!supabase) throw unavailable(); const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/login` }); if (error) throw new Error("Não foi possível enviar a recuperação agora."); },
    async updatePassword(password) { if (isLocalMode) throw new Error("Atualização indisponível no modo local."); if (!supabase) throw unavailable(); const { error } = await supabase.auth.updateUser({ password }); if (error) throw new Error("Não foi possível atualizar a senha."); setPasswordRecovery(false); },
    async completeInvitation(password) {
      if (isLocalMode) throw new Error("Convites exigem o modo Supabase.");
      if (!supabase) throw unavailable();
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw new Error("Não foi possível criar seu acesso.");
      const { error: membershipError } = await supabase.rpc("accept_own_invitation");
      if (membershipError) throw new Error("Seu convite não está mais disponível.");
      queryClient.clear(); window.location.assign("/");
    },
    async signOut() {
      queryClient.clear();
      if (isLocalMode) { sessionStorage.removeItem(LOCAL_SESSION_KEY); setLocalSession(false); return; }
      setSession(null); activeUserId.current = null; if (supabase) await supabase.auth.signOut();
    },
  }), [session, localSession, loading, passwordRecovery, queryClient]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth must be used inside AuthProvider"); return value; }

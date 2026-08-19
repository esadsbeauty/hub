import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type Auth = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
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
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const activeUserId = useRef<string | null>(null);

  useEffect(() => {
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
    user: session?.user ?? null, session, loading, configured: Boolean(supabase), passwordRecovery,
    async signIn(email, password) { if (!supabase) throw unavailable(); const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }); if (error) throw new Error("Email ou senha incorretos."); },
    async resetPassword(email) { if (!supabase) throw unavailable(); const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/login` }); if (error) throw new Error("Não foi possível enviar a recuperação agora."); },
    async updatePassword(password) { if (!supabase) throw unavailable(); const { error } = await supabase.auth.updateUser({ password }); if (error) throw new Error("Não foi possível atualizar a senha."); setPasswordRecovery(false); },
    async completeInvitation(password) {
      if (!supabase) throw unavailable();
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw new Error("Não foi possível criar seu acesso.");
      const { error: membershipError } = await supabase.rpc("accept_own_invitation");
      if (membershipError) throw new Error("Seu convite não está mais disponível.");
      queryClient.clear();
      window.location.assign("/");
    },
    async signOut() { queryClient.clear(); setSession(null); activeUserId.current = null; if (!supabase) return; await supabase.auth.signOut(); },
  }), [session, loading, passwordRecovery, queryClient]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth must be used inside AuthProvider"); return value; }

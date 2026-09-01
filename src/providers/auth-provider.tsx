import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authRedirectUrls } from "@/config/site-url";
import { supabase } from "@/lib/supabase";
import { AuthContext, type AuthValue, type RegistrationResult } from "./auth-context";

const unavailable = () => new Error("Não foi possível conectar ao serviço de autenticação.");
const registrationResult = (value: unknown): RegistrationResult => {
  if (typeof value !== "object" || value === null || !("status" in value)) throw new Error("Não foi possível concluir a configuração do acesso.");
  const status = value.status;
  if (status !== "active" && status !== "pending") throw new Error("Não foi possível concluir a configuração do acesso.");
  return { status, role: "role" in value && typeof value.role === "string" ? value.role : undefined };
};
async function finalizeRegistration() {
  if (!supabase) throw unavailable();
  const result = await supabase.rpc("complete_registration");
  if (result.error) throw new Error("Não foi possível concluir a configuração do acesso.");
  return registrationResult(result.data);
}
export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const activeUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    const client = supabase;
    void client.auth.getSession().then(({ data, error }) => { setSession(error ? null : data.session); activeUserId.current = data.session?.user.id ?? null; setLoading(false); });
    const { data: { subscription } } = client.auth.onAuthStateChange((event, nextSession) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_OUT" || activeUserId.current !== nextUserId) queryClient.clear();
      activeUserId.current = nextUserId; setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);
  const value = useMemo<AuthValue>(() => ({
    user: session?.user ?? null, session, authenticated: Boolean(session), appMode: "supabase", loading, configured: Boolean(supabase), passwordRecovery,
    async signUp(name, email, password) {
      if (!supabase) throw unavailable();
      const result = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { name: name.trim() }, emailRedirectTo: authRedirectUrls.emailConfirmation } });
      if (result.error) throw new Error("Não foi possível criar o cadastro. Verifique os dados e tente novamente.");
      if (result.data.user?.identities?.length === 0) throw new Error("Já existe uma conta com este email.");
      if (!result.data.session) return { status: "confirmation_required" };
      const access = await finalizeRegistration();
      queryClient.clear();
      return access;
    },
    async signIn(email, password) { if (!supabase) throw unavailable(); const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }); if (error) throw new Error("Email ou senha incorretos."); const access = await supabase.rpc("complete_registration"); if (access.error) throw new Error("Não foi possível validar seu acesso agora."); queryClient.clear(); window.location.assign("/"); },
    enterLocalMode() { throw new Error("O modo local não está disponível."); },
    async resetPassword(email) { if (!supabase) throw unavailable(); const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: authRedirectUrls.passwordRecovery }); if (error) throw new Error("Não foi possível enviar a recuperação agora."); },
    async updatePassword(password) { if (!supabase) throw unavailable(); const { error } = await supabase.auth.updateUser({ password }); if (error) throw new Error("Não foi possível atualizar a senha."); setPasswordRecovery(false); },
    async completeInvitation(password) { if (!supabase) throw unavailable(); const { error } = await supabase.auth.updateUser({ password }); if (error) throw new Error("Não foi possível criar seu acesso."); const membership = await supabase.rpc("accept_own_invitation"); if (membership.error) throw new Error("Seu convite não está mais disponível."); queryClient.clear(); window.location.assign("/"); },
    async signOut() { queryClient.clear(); setSession(null); activeUserId.current = null; if (supabase) { await supabase.rpc("platform_clear_tenant_context"); await supabase.auth.signOut(); } },
  }), [session, loading, passwordRecovery, queryClient]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

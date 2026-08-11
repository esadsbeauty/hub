import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

type PreviewUser = Pick<User, 'id' | 'email'>;
type Auth = { user: User | PreviewUser | null; session: Session | null; loading: boolean; passwordRecovery: boolean; signIn: (email: string, password: string) => Promise<void>; resetPassword: (email: string) => Promise<void>; updatePassword: (password: string) => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [previewUser, setPreviewUser] = useState<PreviewUser | null>(() => localStorage.getItem('esads_preview_auth') ? { id: 'preview-admin', email: 'admin@esadsbeauty.com' } : null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const activeUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => { const nextUserId = nextSession?.user.id ?? null; if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true); if (event === 'SIGNED_OUT' || activeUserId.current !== nextUserId) queryClient.clear(); activeUserId.current = nextUserId; setSession(nextSession); });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const value = useMemo<Auth>(() => ({
    user: session?.user ?? previewUser,
    session,
    loading, passwordRecovery,
    async signIn(email, password) { if (!supabase) { localStorage.setItem('esads_preview_auth', 'true'); setPreviewUser({ id: 'preview-admin', email }); return; } const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; },
    async resetPassword(email) { if (!supabase) return; const { error } = await supabase.auth.resetPasswordForEmail(email); if (error) throw error; },
    async updatePassword(password) { if (!supabase) return; const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; setPasswordRecovery(false); },
    async signOut() { await supabase?.auth.signOut(); queryClient.clear(); localStorage.removeItem('esads_preview_auth'); setPreviewUser(null); setSession(null); },
  }), [session, previewUser, loading, passwordRecovery, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }

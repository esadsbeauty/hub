import type { Session } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

export type AuthUser = { id: string; email?: string; user_metadata: Record<string, string | undefined> };
export type AuthValue = {
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
export const AuthContext = createContext<AuthValue | null>(null);
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth must be used inside an auth provider"); return value; }

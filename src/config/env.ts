import { isLocalMode } from "@/config/app-mode";

type SupabaseConfigurationIssue = "missing" | "invalid" | null;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

function isValidSupabaseUrl(value: string | undefined) {
  if (!value || value.includes("your-project")) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isValidPublicKey(value: string | undefined) {
  if (!value || value.includes("your-anon-key")) return false;
  if (value.startsWith("sb_publishable_")) return true;
  if (!value.startsWith("eyJ")) return false;

  try {
    const [, payload] = value.split(".");
    if (!payload) return false;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(normalized)) as { role?: string };
    return decoded.role === "anon";
  } catch {
    return false;
  }
}

const missing = !supabaseUrl || !supabaseAnonKey;
const invalid = !missing && (!isValidSupabaseUrl(supabaseUrl) || !isValidPublicKey(supabaseAnonKey));

export const env = { supabaseUrl, supabaseAnonKey } as const;
export const supabaseConfigurationIssue: SupabaseConfigurationIssue = missing
  ? "missing"
  : invalid
    ? "invalid"
    : null;
export const isSupabaseConfigured = !isLocalMode && supabaseConfigurationIssue === null;

if (import.meta.env.DEV && !isLocalMode && supabaseConfigurationIssue) {
  console.error(
    `[Auth configuration] ${supabaseConfigurationIssue === "missing" ? "VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausente." : "Variável pública do Supabase inválida."}`,
  );
}

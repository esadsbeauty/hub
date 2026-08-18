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
  return value.startsWith("eyJ") || value.startsWith("sb_publishable_");
}

const missing = !supabaseUrl || !supabaseAnonKey;
const invalid = !missing && (!isValidSupabaseUrl(supabaseUrl) || !isValidPublicKey(supabaseAnonKey));

export const env = { supabaseUrl, supabaseAnonKey } as const;
export const supabaseConfigurationIssue: SupabaseConfigurationIssue = missing
  ? "missing"
  : invalid
    ? "invalid"
    : null;
export const isSupabaseConfigured = supabaseConfigurationIssue === null;

if (import.meta.env.DEV && supabaseConfigurationIssue) {
  console.error(
    `[Auth configuration] ${supabaseConfigurationIssue === "missing" ? "VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausente." : "Variável pública do Supabase inválida."}`,
  );
}

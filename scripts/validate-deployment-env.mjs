const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
const missing = required.filter((name) => !process.env[name]?.trim());
const isVercelBuild = process.env.VERCEL === "1";
const vercelEnv = process.env.VERCEL_ENV ?? "unknown";
const url = process.env.VITE_SUPABASE_URL?.trim();
const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();
let invalid = false;

if (isVercelBuild) {
  console.log("[deployment-env]", JSON.stringify({
    hasSupabaseUrl: Boolean(url),
    hasSupabaseAnonKey: Boolean(key),
    vercelEnv,
  }));
}

function isPublicSupabaseKey(value) {
  if (value.startsWith("sb_publishable_")) return true;
  if (!value.startsWith("eyJ")) return false;

  try {
    const payload = value.split(".")[1];
    if (!payload) return false;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role === "anon";
  } catch {
    return false;
  }
}

if (!missing.length) {
  try {
    const parsed = new URL(url);
    invalid = parsed.protocol !== "https:" || !parsed.hostname;
  } catch {
    invalid = true;
  }
  invalid ||= !isPublicSupabaseKey(key);
}

if (missing.length && isVercelBuild) {
  console.error(
    `Deployment ${vercelEnv} bloqueado: configure ${missing.join(" e ")} para o ambiente ${vercelEnv} do projeto Vercel e faça um novo deployment.`,
  );
  process.exit(1);
}

if (invalid && isVercelBuild) {
  console.error("Deployment bloqueado: a configuração pública do Supabase é inválida.");
  process.exit(1);
}

if (missing.length) {
  console.warn(
    `Build local sem autenticação configurada: ${missing.join(", ")}. Nenhum fallback será habilitado.`,
  );
}


if (invalid) {
  console.warn("Build local com configuração pública do Supabase inválida. Nenhum fallback será habilitado.");
}

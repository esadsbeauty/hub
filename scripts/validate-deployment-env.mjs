const required = ["VITE_SITE_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
const isVercelBuild = process.env.VERCEL === "1";
const vercelEnv = process.env.VERCEL_ENV ?? "unknown";
const requestedMode = process.env.VITE_APP_MODE ?? "supabase";
const localMode = requestedMode === "local" && (!isVercelBuild || vercelEnv === "preview");
const missing = required.filter((name) => !process.env[name]?.trim());
const url = process.env.VITE_SUPABASE_URL?.trim();
const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const siteUrl = process.env.VITE_SITE_URL?.trim();
let invalid = false;
let invalidSiteUrl = false;

if (!['local', 'supabase'].includes(requestedMode)) {
  console.error("Build bloqueado: VITE_APP_MODE deve ser local ou supabase.");
  process.exit(1);
}
if (requestedMode === "local" && isVercelBuild && vercelEnv !== "preview") {
  console.error(`Deployment ${vercelEnv} bloqueado: o modo local só pode ser usado em Preview.`);
  process.exit(1);
}
if (isVercelBuild) console.log("[deployment-env]", JSON.stringify({ appMode: localMode ? "local" : "supabase", hasSiteUrl: Boolean(siteUrl), hasSupabaseUrl: Boolean(url), hasSupabaseAnonKey: Boolean(key), vercelEnv }));

function isPublicSupabaseKey(value) {
  if (value.startsWith("sb_publishable_")) return true;
  if (!value.startsWith("eyJ")) return false;
  try { const payload = value.split(".")[1]; return Boolean(payload) && JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role === "anon"; }
  catch { return false; }
}
if (!missing.length) {
  try { const parsed = new URL(url); invalid = parsed.protocol !== "https:" || !parsed.hostname; }
  catch { invalid = true; }
  invalid ||= !isPublicSupabaseKey(key);
}
if (siteUrl) {
  try {
    const parsed = new URL(siteUrl);
    invalidSiteUrl = parsed.protocol !== "https:" || !parsed.hostname || ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch { invalidSiteUrl = true; }
}
if (!localMode && missing.length && isVercelBuild) { console.error(`Deployment ${vercelEnv} bloqueado: configure ${missing.join(" e ")}.`); process.exit(1); }
if (!localMode && invalidSiteUrl && isVercelBuild) { console.error("Deployment bloqueado: VITE_SITE_URL deve ser uma URL HTTPS pública, nunca localhost."); process.exit(1); }
if (!localMode && invalid && isVercelBuild) { console.error("Deployment bloqueado: a configuração pública do Supabase é inválida."); process.exit(1); }
if (localMode) console.warn("Modo local ativo: nenhuma infraestrutura Supabase será utilizada pela aplicação.");
else if (missing.length) console.warn(`Build local sem autenticação configurada: ${missing.join(", ")}.`);
else if (invalid) console.warn("Build local com configuração pública do Supabase inválida.");

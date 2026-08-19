import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { normalizeInstagram, normalizeWhatsapp } from "../src/modules/crm/utils/contact-normalizers";

describe("modos local e Supabase", () => {
  const auth = readFileSync("src/providers/auth-provider.tsx", "utf8");
  test("preserva Supabase Auth e isola a sessão local", () => {
    expect(auth).toContain("signInWithPassword");
    expect(auth).toContain("esads-hub-local-v1:session");
    expect(auth).toContain("enterLocalMode");
    expect(auth).not.toContain("service_role");
  });
  test("todos os data sources selecionam provider pela configuração central", () => {
    for (const path of ["src/modules/crm/data-source.ts", "src/modules/customers/data-source.ts", "src/modules/finance/data-source.ts", "src/modules/marketing/data-source.ts"]) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("isLocalMode");
      expect(source).toMatch(/isLocalMode\s*\?/);
    }
  });
  test("modo local não depende de hostname e falha fechado", () => {
    const mode = readFileSync("src/config/app-mode.ts", "utf8");
    expect(mode).toContain('requestedMode === "local"');
    expect(mode).toContain('runtimeEnvironment === "development" || runtimeEnvironment === "preview"');
    expect(mode).not.toContain("window.location");
  });
  test("modo local não instancia Supabase e começa sem dados comerciais fictícios", () => {
    const supabase = readFileSync("src/lib/supabase.ts", "utf8");
    const env = readFileSync("src/config/env.ts", "utf8");
    const crm = readFileSync("src/modules/crm/repository.ts", "utf8");
    const settingsHooks = readFileSync("src/modules/settings/hooks.ts", "utf8");
    expect(env).toContain("!isLocalMode && supabaseConfigurationIssue === null");
    expect(supabase).toContain("isSupabaseConfigured");
    expect(crm).toContain('const STORAGE = "esads-hub-local-v1:crm"');
    expect(crm).toContain("companies: []");
    expect(crm).toContain("opportunities: []");
    expect(settingsHooks).toContain("enabled: !isLocalMode");
  });
  test("owner é protegido no banco e usuário suspenso não resolve organização", () => {
    const owner = readFileSync("supabase/migrations/202608180001_real_auth_owner.sql", "utf8");
    const governance = readFileSync("supabase/migrations/202608110008_governance_rbac_audit.sql", "utf8");
    expect(owner).toContain("owner_access_protected");
    expect(governance).toContain("m.status='active'");
  });
});

describe("captura mobile", () => {
  test("normaliza WhatsApp brasileiro colado", () => expect(normalizeWhatsapp("(47) 99999-9999")).toBe("+5547999999999"));
  test("normaliza URL do Instagram", () => expect(normalizeInstagram("https://instagram.com/clinicabella/ ")).toBe("@clinicabella"));
});

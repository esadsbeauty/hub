import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { normalizeInstagram, normalizeWhatsapp } from "../src/modules/crm/utils/contact-normalizers";

describe("autenticação real", () => {
  const auth = readFileSync("src/providers/auth-provider.tsx", "utf8");
  test("usa Supabase Auth e não possui sessão local simulada", () => {
    expect(auth).toContain("signInWithPassword");
    expect(auth).not.toContain("esads_preview_auth");
    expect(auth).not.toContain("PreviewUser");
  });
  test("repositórios operacionais não selecionam fallback local", () => {
    for (const path of ["src/modules/crm/data-source.ts", "src/modules/customers/data-source.ts", "src/modules/finance/data-source.ts", "src/modules/marketing/data-source.ts"]) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(/supabase\s*\?/);
      expect(source).toContain("supabase");
    }
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

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const app = readFileSync("src/app/public-app-root.tsx", "utf8");
const entry = readFileSync("src/main.tsx", "utf8");
const layout = readFileSync("src/layouts/public-layout.tsx", "utf8");
const privacy = readFileSync("src/modules/legal/pages/PrivacyPolicyPage.tsx", "utf8");
const terms = readFileSync("src/modules/legal/pages/TermsOfUsePage.tsx", "utf8");
const document = readFileSync("src/modules/legal/components/legal-document.tsx", "utf8");
const contact = readFileSync("src/config/contact.ts", "utf8");

describe("public legal pages", () => {
  test("registers canonical public routes without authentication", () => {
    expect(app).toContain('path="/politica-de-privacidade"');
    expect(app).toContain('path="/termos-de-uso"');
    expect(entry).toContain("politica-de-privacidade|termos-de-uso");
  });

  test("keeps legacy legal URLs as redirects", () => {
    expect(app).toContain('path="/privacidade" element={<Navigate to="/politica-de-privacidade"');
    expect(app).toContain('path="/termos" element={<Navigate to="/termos-de-uso"');
  });

  test("provides editable contacts and cross-links", () => {
    expect(contact).toContain('privacyContactEmail = "privacy@esads.com.br"');
    expect(contact).toContain('generalContactEmail = "contato@esads.com.br"');
    expect(privacy).toContain('to:"/termos-de-uso"');
    expect(terms).toContain('to="/politica-de-privacidade"');
    expect(layout).toContain('to="/politica-de-privacidade"');
    expect(layout).toContain('to="/termos-de-uso"');
  });

  test("covers LGPD, WhatsApp, Meta and SaaS operating terms", () => {
    for (const value of ["LGPD", "WhatsApp Business", "Meta", "não vende dados pessoais", "Direitos do titular", "Transferência e infraestrutura internacional"]) expect(privacy).toContain(value);
    for (const value of ["Uso proibido", "WhatsApp Business", "Planos, cobrança e pagamentos", "Propriedade intelectual", "Lei aplicável"]) expect(terms).toContain(value);
  });

  test("uses the shared responsive reading layout and SEO metadata", () => {
    expect(document).toContain("max-w-4xl");
    expect(document).toContain("max-w-5xl");
    expect(document).toContain("Voltar para o início");
    expect(document).toContain("<SeoHead");
    expect(document).toContain("overflow-hidden");
  });
});

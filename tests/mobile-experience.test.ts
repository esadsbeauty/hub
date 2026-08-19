import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("experiência operacional mobile", () => {
  test("dashboard prioriza KPIs, agenda, follow-ups e pipeline", () => {
    const page = readFileSync("src/modules/dashboard/DashboardPage.tsx", "utf8");
    const kpis = page.indexOf('className="grid grid-cols-2');
    const agenda = page.indexOf("Agenda de hoje", kpis);
    const followups = page.indexOf('className="flex min-h-[5.25rem]', agenda);
    const pipeline = page.indexOf('<div className="md:hidden"><PipelineOverview', followups);
    expect(kpis).toBeGreaterThan(-1);
    expect(agenda).toBeGreaterThan(kpis);
    expect(followups).toBeGreaterThan(agenda);
    expect(pipeline).toBeGreaterThan(followups);
    expect(page).toContain('aria-label="Filtros do dashboard"');
  });

  test("navegação possui cinco zonas e ação rápida central", () => {
    const navigation = readFileSync("src/shared/components/layout/mobile-navigation.tsx", "utf8");
    expect(navigation).toContain("grid-cols-5");
    expect(navigation).toContain('aria-label="Abrir ações rápidas"');
    expect(navigation).toContain("Novo lead");
    expect(navigation).toContain("Novo follow-up");
    expect(navigation).toContain("safe-area-inset-bottom");
  });

  test("CRM oferece busca direta, filtros em sheet e cadastro rápido", () => {
    const crm = readFileSync("src/modules/crm/CrmPage.tsx", "utf8");
    expect(crm).toContain('placeholder="Buscar lead ou contato…"');
    expect(crm).toContain('title="Filtrar CRM"');
    expect(crm).toContain("Novo lead");
  });

  test("controles mobile respeitam área de toque mínima", () => {
    const button = readFileSync("src/components/ui/button.tsx", "utf8");
    const input = readFileSync("src/components/ui/input.tsx", "utf8");
    const select = readFileSync("src/components/ui/select.tsx", "utf8");
    expect(button).toContain("h-12");
    expect(input).toContain("h-12");
    expect(select).toContain("h-12");
  });
});

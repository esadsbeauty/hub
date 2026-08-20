import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("experiência operacional mobile", () => {
  test("dashboard prioriza KPIs, agenda, follow-ups e pipeline", () => {
    const page = readFileSync("src/modules/dashboard/DashboardPage.tsx", "utf8");
    const kpis = page.indexOf('className="grid grid-cols-1');
    const agenda = page.indexOf("Agenda de hoje", kpis);
    const followups = page.indexOf('className="flex min-h-[5.75rem]', agenda);
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
    expect(navigation).toContain("Nova empresa");
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
    expect(button).toContain("h-[var(--mobile-button-height)]");
    expect(input).toContain("h-[3.75rem]");
    expect(select).toContain("h-[3.75rem]");
  });

  test("escala confortável é responsiva e não usa zoom global", () => {
    const tokens = readFileSync("src/design-system/tokens.ts", "utf8");
    const styles = readFileSync("src/styles/globals.css", "utf8");
    const header = readFileSync("src/shared/components/layout/page-header.tsx", "utf8");
    expect(tokens).toContain("inputHeight: '3.75rem'");
    expect(tokens).toContain("buttonHeight: '3.5rem'");
    expect(tokens).toContain("pageTitle: '2.125rem'");
    expect(header).toContain("text-[2.125rem]");
    expect(styles).not.toMatch(/zoom\s*:/);
    expect(styles).not.toContain("transform:scale");
    expect(styles).toContain("--mobile-bottom-nav-height:5.25rem");
  });

  test("kanban usa uma coluna larga por viewport no telefone", () => {
    const crm = readFileSync("src/modules/crm/CrmPage.tsx", "utf8");
    expect(crm).toContain("min-w-[90vw]");
    expect(crm).toContain("md:min-w-72");
    expect(crm).toContain("snap-x snap-mandatory");
  });

  test("CRM mobile reduz densidade com carrossel, sheets e lista em cards", () => {
    const crm = readFileSync("src/modules/crm/CrmPage.tsx", "utf8");
    const topbar = readFileSync("src/shared/components/layout/topbar.tsx", "utf8");
    expect(crm).toContain('aria-label="Indicadores do CRM"');
    expect(crm).toContain('title="Ordenar CRM"');
    expect(crm).toContain('className="grid gap-4 md:hidden"');
    expect(topbar).toContain('className="mt-4 md:hidden"');
    expect(topbar).not.toContain('Novo</Link>\n      </form>');
  });
});

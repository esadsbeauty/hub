import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("organization-scoped prospecting feature", () => {
  test("loads the flag for the active organization without a fixed tenant id", () => {
    const hook = read("src/shared/features/use-organization-feature.ts");
    expect(hook).toContain("useAppState");
    expect(hook).toContain('from("organization_features")');
    expect(hook).toContain('.eq("organization_id", organizationId)');
    expect(hook).toContain('.eq("enabled", true)');
    expect(hook).not.toContain("c6ee7876-c88b-4419-abba-b2ed4cc54257");
  });

  test("guards direct access and registers the prospecting page", () => {
    const app = read("src/app/App.tsx");
    const route = read("src/routes/feature-route.tsx");
    expect(app).toContain('path="prospeccao"');
    expect(app).toContain('featureKey="prospecting_agent"');
    expect(route).toContain('<Navigate to="/" replace />');
  });

  test("shows feature-aware desktop and mobile navigation", () => {
    const sidebar = read("src/shared/components/layout/sidebar.tsx");
    const mobile = read("src/shared/components/layout/mobile-navigation.tsx");
    for (const source of [sidebar, mobile]) {
      expect(source).toContain('useOrganizationFeature("prospecting_agent")');
      expect(source).toContain('to="/prospeccao"');
      expect(source).toContain("Prospecção");
    }
  });

  test("renders only the requested first-stage empty state", () => {
    const page = read("src/modules/prospecting/ProspectingPage.tsx");
    expect(page).toContain('title="Prospecção"');
    expect(page).toContain("Nova lista");
    expect(page).toContain("Nenhuma lista criada ainda");
  });
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("platform plans and entitlements", () => {
  const migrationPath = "supabase/migrations/202608280001_platform_plans_entitlements.sql";
  const migration = readFileSync(migrationPath, "utf8");

  test("keeps the CRM performance migration and adds the required schema", () => {
    expect(readFileSync("supabase/migrations/202608270004_crm_tenant_performance_fix.sql", "utf8")).toContain("create_company_with_primary_contact");
    for (const table of ["platform_admins", "plans", "plan_entitlements", "organization_plans"]) expect(migration).toContain(`public.${table}`);
  });

  test("founders plan costs R$49.90 and never enables automatic billing", () => {
    expect(migration).toContain("'Fundadores','fundadores',4990,'BRL','monthly','manual'");
    expect(migration).toContain("billing_mode='manual'");
  });

  test("existing organizations are backfilled to legacy while new ones receive founders", () => {
    expect(migration).toContain("values('Legacy','legacy',0,'BRL','monthly','manual',false)");
    expect(migration).toContain("where p.slug='legacy' and not exists(select 1 from public.organization_plans op where op.organization_id=o.id)");
    expect(migration).toContain("where slug='fundadores' and is_active limit 1");
    expect(migration).not.toContain("where p.slug='fundadores' and not exists");
  });

  test("database access intersects role permission and module entitlement", () => {
    expect(migration).toContain("public.has_module_entitlement(p.module)");
    expect(migration).toContain("platform_admin_required");
  });

  test("platform route and menus use a dedicated platform-admin flag", () => {
    const app = readFileSync("src/app/App.tsx", "utf8");
    const route = readFileSync("src/routes/platform-admin-route.tsx", "utf8");
    const state = readFileSync("src/shared/state/app-state.tsx", "utf8");
    expect(app).toContain('path="plataforma"');
    expect(route).toContain("isPlatformAdmin");
    expect(state).not.toContain("isAdministrator ||");
  });
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202609120001_platform_admin_tenant_context.sql", "utf8");
const state = readFileSync("src/shared/state/app-state.tsx", "utf8");
const switcher = readFileSync("src/shared/components/layout/tenant-switcher.tsx", "utf8");
const banner = readFileSync("src/shared/components/layout/tenant-context-banner.tsx", "utf8");
const auth = readFileSync("src/providers/auth-provider.tsx", "utf8");
const crm = readFileSync("src/modules/crm/supabase-repository.ts", "utf8");

describe("Platform Admin tenant context", () => {
  test("only a Platform Admin can switch to an existing organization", () => {
    expect(migration).toContain("if not public.is_platform_admin()");
    expect(migration).toContain("organization_not_found");
    expect(migration).toContain("platform_admin_user_id=auth.uid()");
    expect(migration).not.toMatch(/service_role/i);
  });

  test("current organization is centralized and normal users retain their membership tenant", () => {
    expect(migration).toContain("create or replace function public.current_organization_id()");
    expect(migration).toContain("else public.base_organization_id() end");
    expect(migration).toContain("required_permission=any(array[");
    for (const forbidden of ["finance.manage","settings.manage","users.manage","roles.manage"])
      expect(migration.match(/required_permission=any\(array\[([^\]]+)/)?.[1]).not.toContain(forbidden);
  });

  test("context persists securely, is audited, and logout clears it", () => {
    expect(migration).toContain("platform_admin_tenant_context");
    expect(migration).toContain("platform_tenant_context_switched");
    expect(migration).toContain("previous_organization_id");
    expect(auth).toContain('rpc("platform_clear_tenant_context")');
  });

  test("switching clears tenant query caches and reloads backend authorization", () => {
    expect(state).toContain('rpc("platform_switch_organization"');
    expect(state).toContain("queryClient.clear()");
    expect(state).toContain('rpc("current_authorization")');
    expect(crm).toContain('rpc("active_tenant_actor")');
  });

  test("responsive UI is hidden from normal users and clearly identifies impersonation", () => {
    expect(switcher).toContain("if (!state.isPlatformAdmin) return null");
    expect(switcher).toContain("Pesquisar organização");
    expect(switcher).toContain("Voltar para");
    expect(banner).toContain("Visualizando organização:");
    expect(banner).toContain("state.isImpersonating");
  });
});

import { describe, expect, test } from "bun:test";
import { can, canAll, canAny, previewRolePermissions } from "../src/shared/permissions/permissions";

describe("RBAC domain", () => {
  test("admin receives every critical permission", () => {
    expect(canAll(previewRolePermissions.admin, ["users.manage", "audit.view", "finance.transactions.reverse", "settings.manage"])).toBeTrue();
  });
  test("financial access is not inherited by sales or marketing", () => {
    expect(can(previewRolePermissions.sales, "finance.view")).toBeFalse();
    expect(can(previewRolePermissions.marketing, "finance.view")).toBeFalse();
    expect(can(previewRolePermissions.financial, "finance.view")).toBeTrue();
  });
  test("read-only role cannot mutate business or administrative data", () => {
    expect(canAny(previewRolePermissions.reader, ["crm.manage", "users.manage", "marketing.manage", "finance.manage"])).toBeFalse();
  });
  test("financial reversal remains separate from general visibility", () => {
    expect(can(previewRolePermissions.manager, "finance.transactions.reverse")).toBeFalse();
    expect(can(previewRolePermissions.financial, "finance.transactions.reverse")).toBeTrue();
  });
});

test("security migration protects last admin and financial reads in PostgreSQL", async () => {
  const migration = await Bun.file("supabase/migrations/202608110008_governance_rbac_audit.sql").text();
  expect(migration).toContain("last_admin_required");
  expect(migration).toContain("public.has_permission(''finance.view'')");
  expect(migration).toContain("create policy audit_read");
  expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
});

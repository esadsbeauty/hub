import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = "supabase/migrations/202608270004_crm_tenant_performance_fix.sql";

describe("CRM tenant and performance regression", () => {
  test("preserves the required CRM migration and RPC", () => {
    expect(existsSync(migrationPath)).toBeTrue();
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("create or replace function public.create_company_with_primary_contact");
    expect(sql).toContain("grant execute on function public.create_company_with_primary_contact(jsonb,jsonb)to authenticated");
  });

  test("derives tenant and actor from the authenticated session", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("tenant uuid:=public.current_organization_id()");
    expect(sql).toContain("actor uuid:=auth.uid()");
    expect(sql).toContain("organization_id=tenant and user_id=actor and status='active'");
    expect(sql).toContain("insert into public.companies(");
    expect(sql).toContain("tenant,company_data->>'name'");
  });

  test("creates the initial opportunity in the tenant Novo Lead stage", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("where organization_id=tenant and is_default=true");
    expect(sql).toContain("and(slug='novo_lead' or lower(name)='novo lead')");
    expect(sql).toContain("insert into public.opportunities(organization_id,company_id,pipeline_id,stage_id,title,value,probability,owner_id,status,created_by)");
    expect(sql).toContain("tenant,created_company.id,default_pipeline.id,initial_stage.id");
  });

  test("keeps indexes for tenant-scoped CRM read paths", () => {
    const sql = readFileSync(migrationPath, "utf8");
    for (const index of [
      "organization_members_active_user_idx",
      "companies_tenant_created_idx",
      "contacts_tenant_company_idx",
      "opportunities_tenant_stage_idx",
      "activities_tenant_created_idx",
      "tasks_tenant_due_idx",
      "notes_tenant_created_idx",
      "opportunity_history_tenant_changed_idx",
    ]) expect(sql).toContain(`create index if not exists ${index}`);
  });
});

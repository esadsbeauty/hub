import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202608270003_multitenant_phase1.sql", "utf8");
const invite = readFileSync("supabase/functions/invite-user/index.ts", "utf8");
const repositories = ["crm", "customers", "finance", "marketing", "blog"].map((module) => readFileSync(`src/modules/${module}/supabase-repository.ts`, "utf8"));

describe("fase 1 multi-tenant", () => {
  test("tenant ativo é explícito e exige membership ativa", () => {
    expect(migration).toContain("create table public.user_active_organizations");
    expect(migration).toContain("m.status='active'");
    expect(migration).toContain("set_active_organization(target_organization_id uuid)");
    expect(migration.match(/current_organization_id\(\)[\s\S]*?\$\$/)?.[0]).not.toContain("limit 1");
  });
  test("RBAC é calculado apenas no tenant ativo", () => {
    expect(migration).toContain("m.organization_id=public.current_organization_id()");
    expect(migration).toContain("crm.opportunity.close_required");
    expect(migration).toContain("agenda.manage");
    expect(migration).toContain("customers.manage");
  });
  test("relações e triggers bloqueiam referências cross-tenant", () => {
    expect(migration).toContain("cross_tenant_reference");
    expect(migration).toContain("stage_pipeline_mismatch");
    expect(migration).toContain("where id=new.company_id and organization_id=new.organization_id");
    expect(migration).toContain("enforce_contract_service_tenant");
  });
  test("funções privilegiadas têm search_path e grants mínimos", () => {
    expect(migration).not.toMatch(/security definer(?! set search_path)/);
    expect(migration).toContain("revoke all on function public.create_default_pipeline(uuid)from public,anon,authenticated");
  });
  test("convites derivam a organização ativa do token autenticado", () => {
    expect(invite).toContain('userClient.rpc("current_organization_id")');
    expect(invite).not.toContain('.eq("user_id", auth.user.id).eq("status", "active").limit(1)');
  });
  test("repositories aplicam filtro explícito de organização", () => {
    for (const repository of repositories) expect(repository).toContain('.eq("organization_id"');
  });
  test("query keys são segmentadas por organização", () => {
    for (const module of ["crm", "customers", "finance", "marketing"]) {
      const keys = readFileSync(`src/modules/${module}/query-keys.ts`, "utf8");
      expect(keys).toContain("organizationId");
    }
    expect(readFileSync("src/modules/blog/query-keys.ts", "utf8")).toContain("tenant:(organizationId");
  });
});

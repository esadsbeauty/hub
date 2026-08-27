import { describe,expect,test } from "bun:test";
import { readFileSync } from "node:fs";
const migration=readFileSync("supabase/migrations/202608270004_crm_tenant_performance_fix.sql","utf8");
const dashboard=readFileSync("src/modules/dashboard/DashboardPage.tsx","utf8");
const app=readFileSync("src/app/App.tsx","utf8");
const state=readFileSync("src/shared/state/app-state.tsx","utf8");

describe("CRM tenant-safe e performance",()=>{
 test("owner cria empresa no tenant ativo, nunca no organization_id legado do profile",()=>{
  expect(migration).toContain("tenant uuid:=public.current_organization_id()");
  expect(migration).toContain("public.has_permission('crm.manage')");
  expect(migration).toContain("organization_id=tenant and user_id=actor and status='active'");
  expect(migration).not.toContain("current_profile.organization_id");
 });
 test("empresa, contato e oportunidade são atômicos e isolados",()=>{
  expect(migration).toContain("insert into public.companies");
  expect(migration).toContain("insert into public.contacts");
  expect(migration).toContain("insert into public.opportunities");
  expect(migration).toContain("values(tenant,created_company.id,default_pipeline.id,initial_stage.id");
 });
 test("usa exclusivamente o pipeline default e o estágio Novo Lead do tenant",()=>{
  expect(migration).toContain("where organization_id=tenant and is_default=true");
  expect(migration).toContain("where pipeline_id=default_pipeline.id and not is_won and not is_lost");
  expect(migration).toContain("slug='novo_lead' or lower(name)='novo lead'");
 });
 test("dashboard reutiliza snapshot CRM sem requests duplicados de agenda",()=>{
  expect(dashboard).not.toContain("useTasksRange");
  expect(dashboard).not.toContain("useOverdueTasks");
  expect(dashboard).toContain("crm.data.tasks.filter");
 });
 test("rotas privadas são carregadas sob demanda",()=>{
  expect(app).toContain('lazy, Suspense');
  expect(app).toContain('page(()=>import("@/modules/crm/CrmPage")');
  expect(app).toContain('page(()=>import("@/modules/dashboard/DashboardPage")');
 });
 test("autorização não executa polling contínuo",()=>{
  expect(state).not.toContain("setInterval");
  expect(state).toContain('table:"organization_members"');
  expect(state).toContain('document.addEventListener("visibilitychange"');
 });
 test("índices cobrem filtros tenant mais usados",()=>{
  for(const index of ["companies_tenant_created_idx","opportunities_tenant_stage_idx","activities_tenant_created_idx","tasks_tenant_due_idx"])
   expect(migration).toContain(index);
 });
});

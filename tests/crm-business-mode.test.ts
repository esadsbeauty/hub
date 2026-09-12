import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { crmTerminology } from "../src/modules/crm/business-mode-model";

const migration=readFileSync("supabase/migrations/202609130001_organization_business_mode.sql","utf8");
const permissionFix=readFileSync("supabase/migrations/202609140001_fix_business_mode_admin_permission.sql","utf8");
const authorizationFix=readFileSync("supabase/migrations/202609150001_harden_business_mode_authorization.sql","utf8");
const settings=readFileSync("src/modules/settings/SettingsPage.tsx","utf8");
const form=readFileSync("src/modules/crm/components/company-form.tsx","utf8");
const crm=readFileSync("src/modules/crm/CrmPage.tsx","utf8");
const details=readFileSync("src/modules/crm/components/opportunity-details.tsx","utf8");
const repository=readFileSync("src/modules/crm/supabase-repository.ts","utf8");

describe("per-organization B2C/B2B CRM experience",()=>{
  test("defaults every existing organization safely to compatible B2B",()=>{
    expect(migration).toContain("business_mode text not null default 'b2b'");
    expect(migration).toContain("business_mode in ('b2c','b2b')");
    expect(migration).not.toMatch(/delete\s+from|drop\s+(table|column)/i);
    expect(crmTerminology("b2b").companies).toBe("Empresas");
  });

  test("B2C presents leads while B2B preserves companies and contacts",()=>{
    expect(crmTerminology("b2c")).toMatchObject({company:"Lead",companies:"Leads",newCompany:"Novo Lead"});
    expect(crmTerminology("b2b")).toMatchObject({company:"Empresa",companies:"Empresas",newCompany:"Nova empresa"});
    expect(crm).toContain('b2c?"Leads, clientes e próximos passos."');
  });

  test("B2C quick form hides corporate fields and reuses one atomic primary-contact flow",()=>{
    expect(form).toContain("Interesse / Procedimento");
    expect(form).toContain("required={b2c}");
    expect(form).toContain("{!b2c&&<details");
    for(const corporate of ["Razão social","CNPJ","Funcionários","Área de atuação","Cargo do contato"])expect(form).toContain(corporate);
    expect(form).toContain("responsibleName:data.fantasyName");
    expect(repository).toContain('rpc("create_company_with_primary_contact"');
  });

  test("settings switch mode immediately and enforce tenant-safe backend permissions",()=>{
    expect(settings).toContain("Atendimento a pessoas / B2C");
    expect(settings).toContain("Atendimento a empresas / B2B");
    expect(migration).toContain("tenant uuid:=public.current_organization_id()");
    expect(migration).toContain("public.has_permission('settings.manage')");
    expect(migration).toContain("public.is_platform_admin()");
    expect(migration).toContain("business_mode_updated");
  });

  test("owner, tenant admin and Platform Admin can save only the active organization",()=>{
    expect(permissionFix).toContain("r.slug in('owner','admin')");
    expect(permissionFix).toContain("m.organization_id=tenant");
    expect(permissionFix).toContain("m.user_id=auth.uid()");
    expect(permissionFix).toContain("m.status='active'");
    expect(permissionFix).toContain("not public.is_platform_admin()");
    expect(permissionFix).toContain("not public.has_permission('settings.manage')");
    expect(permissionFix).not.toMatch(/service_role|using\s*\(true\)/i);
  });

  test("backend authorization uses the active membership instead of generic module entitlement",()=>{
    expect(authorizationFix).toContain("can_manage_current_business_mode");
    expect(authorizationFix).toContain("m.organization_id=public.current_organization_id()");
    expect(authorizationFix).toContain("m.user_id=auth.uid()");
    expect(authorizationFix).toContain("m.status='active'");
    expect(authorizationFix).toContain("r.slug in('owner','admin') or p.id is not null");
    expect(authorizationFix).toContain("raise exception 'access_denied'");
    expect(authorizationFix).not.toContain("public.has_permission(");
  });

  test("business-mode audit records only actual B2C/B2B changes",()=>{
    expect(authorizationFix).toContain("if previous_mode=next_mode then return next_mode;end if");
    expect(authorizationFix).toContain("business_mode_updated");
    expect(authorizationFix).toContain("jsonb_build_object('business_mode',previous_mode)");
    expect(authorizationFix).toContain("jsonb_build_object('business_mode',next_mode)");
  });

  test("mode selection is staged until save and unauthorized users cannot trigger feedback loops",()=>{
    expect(settings).toContain("setSelectedMode(option.value)");
    expect(settings).toContain("if(selectedMode!==businessMode)saveBusinessMode(selectedMode)");
    expect(settings).toContain("Esta configuração é gerenciada pelo administrador da organização.");
    expect(settings.match(/onError:error=>notify/g)?.length).toBe(1);
  });

  test("tenant switching keys presentation by active organization and preserves CRM records",()=>{
    const mode=readFileSync("src/modules/crm/business-mode.ts","utf8");
    expect(mode).toContain('["organization", organizationId, "business-mode"]');
    expect(mode).toContain("client.setQueryData");
    for(const table of ["companies","contacts","opportunities","tasks"])expect(migration).not.toMatch(new RegExp(`(update|insert|delete)\\s+(?:into\\s+|from\\s+)?public\\.${table}`,"i"));
  });

  test("opportunity details and Kanban retain value, follow-up and history in B2C",()=>{
    expect(details).toContain('b2c?"Dados do Lead":"Contato principal"');
    expect(details).toContain("Valor da proposta");
    expect(details).toContain("Próxima ação");
    expect(details).toContain("Histórico");
    expect(crm).toContain('businessMode==="b2b"&&company?.fantasyName');
  });
});

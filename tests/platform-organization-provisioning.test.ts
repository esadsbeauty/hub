import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202608290001_platform_organization_provisioning.sql", "utf8");
const edge = readFileSync("supabase/functions/provision-organization/index.ts", "utf8");
const crm = readFileSync("supabase/migrations/202608270004_crm_tenant_performance_fix.sql", "utf8");

describe("platform organization provisioning", () => {
  test("is restricted to Platform Admin and service-role orchestration", () => {
    expect(migration).toContain("not exists(select 1 from public.platform_admins where user_id=actor_user_id)");
    expect(migration).toContain("grant execute on function public.platform_provision_organization");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("from public,anon,authenticated");
    expect(edge).toContain('userClient.rpc("is_platform_admin")');
  });

  test("uses Fundadores by slug by default or a selected active non-Legacy plan", () => {
    expect(migration).toContain("where slug='fundadores' and is_active");
    expect(migration).toContain("where id=selected_plan_id and is_active");
    expect(migration).toContain("target_plan.slug='legacy'");
    expect(migration).toContain("assigned_by=actor_user_id");
  });

  test("creates an invited Tenant Owner without granting Platform Admin", () => {
    expect(migration).toContain("slug='owner'");
    expect(migration).toContain("status='invited'");
    expect(migration).toContain("status in('pending','inactive')");
    expect(migration).toContain("owner_cannot_be_platform_admin");
    expect(migration).not.toMatch(/insert into public\.platform_admins/i);
    expect(edge).toContain("inviteUserByEmail");
    expect(edge).toContain("deleteUser(ownerUserId)");
  });

  test("reuses the canonical ten-stage pipeline and supports a custom name", () => {
    const canonical = readFileSync("supabase/migrations/202607290001_initial_crm.sql", "utf8");
    for (const [position, name] of ["Novo Lead", "Pesquisado", "Primeiro Contato", "Aguardando Resposta", "Em Conversa", "Reunião Agendada", "Proposta Enviada", "Negociação", "Cliente Fechado", "Perdido"].entries()) {
      expect(canonical).toContain(`'${name}'`);
      expect(canonical).toContain(`,${position},`);
    }
    expect(canonical).toContain("'Cliente Fechado','cliente_fechado',8,100,true,false");
    expect(canonical).toContain("'Perdido','perdido',9,0,false,true");
    expect(migration).toContain("update public.pipelines set name=clean_pipeline_name");
  });

  test("preserves tenant CRM creation and entitlement enforcement", () => {
    expect(crm).toContain("tenant uuid:=public.current_organization_id()");
    expect(crm).toContain("insert into public.opportunities");
    expect(crm).toContain("slug='novo_lead'");
    expect(migration).toContain("organization_id=new_organization_id");
    const plans = readFileSync("supabase/migrations/202608280001_platform_plans_entitlements.sql", "utf8");
    expect(plans).toContain("public.has_module_entitlement(p.module)");
  });

  test("records provisioning actor and exposes responsible party in snapshot", () => {
    expect(migration).toContain("provisioned_by uuid references auth.users(id)");
    expect(migration).toContain("'organization_provisioned'");
    expect(migration).toContain("'ownerName',o.primary_contact_name");
    expect(migration).toContain("'createdAt',o.created_at");
  });
});

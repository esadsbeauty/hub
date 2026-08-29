import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { onboardingProgress } from "../src/modules/onboarding/types";

const migration = readFileSync("supabase/migrations/202608300001_organization_post_invite_onboarding.sql", "utf8");

describe("organization post-invite onboarding", () => {
  test("new organizations start pending while existing organizations are completed", () => {
    expect(migration).toContain("select id,true,true,true,true,true,now(),now(),now() from public.organizations");
    expect(migration).toContain("insert into public.organization_onboarding(organization_id)values(new.id)");
    expect(migration).toContain("create trigger initialize_onboarding_on_organization after insert");
  });

  test("RLS and RPCs always derive the tenant from current_organization_id", () => {
    expect(migration).toContain("using(organization_id=public.current_organization_id())");
    expect(migration.match(/tenant uuid:=public\.current_organization_id\(\)/g)?.length).toBe(3);
    expect(migration).not.toMatch(/target_organization_id text/);
    expect(migration).toContain("where id=tenant");
    expect(migration).toContain("where organization_id=tenant");
  });

  test("sensitive updates require settings.manage", () => {
    expect(migration.match(/public\.has_permission\('settings\.manage'\)/g)?.length).toBe(2);
    expect(migration).toContain("settings_manage_required");
    expect(migration).toContain("email',p.email");
    expect(migration).not.toMatch(/update public\.profiles set[^;]*email=/i);
  });

  test("uses the existing default pipeline without creating stages", () => {
    expect(migration).toContain("left join public.pipelines pl on pl.organization_id=o.id and pl.is_default");
    expect(migration).not.toMatch(/insert into public\.(pipelines|pipeline_stages)/i);
  });

  test("detects an existing lead and completes onboarding when all steps are done", () => {
    expect(migration).toContain("exists(select 1 from public.companies c where c.organization_id=target_organization_id and c.deleted_at is null)");
    expect(migration).toContain("first_lead_completed=ob.first_lead_completed or exists");
    expect(migration).toContain("then now()else null end");
    expect(onboardingProgress({ companyProfileCompleted:true,ownerProfileCompleted:true,whatsappCompleted:false,pipelineIntroCompleted:false,firstLeadCompleted:false })).toEqual({ completed:2,total:5,percentage:40 });
  });

  test("frontend reuses the CRM company creation flow", () => {
    const page = readFileSync("src/modules/onboarding/OnboardingPage.tsx", "utf8");
    const crm = readFileSync("src/modules/crm/CrmPage.tsx", "utf8");
    const hooks = readFileSync("src/modules/crm/hooks.ts", "utf8");
    expect(page).toContain('/crm?new=company&quick=1&onboarding=1');
    expect(crm).toContain('searchParams.get("onboarding") === "1"');
    expect(crm).toContain("actions.createCompany.mutateAsync(form)");
    expect(hooks).toContain("invalidateQueries({ queryKey: onboardingKey })");
  });

  test("dashboard redirects once and keeps a dismissible checklist", () => {
    const dashboard = readFileSync("src/modules/dashboard/DashboardPage.tsx", "utf8");
    const card = readFileSync("src/modules/onboarding/OnboardingDashboardCard.tsx", "utf8");
    expect(dashboard).toContain('!onboarding.data.state.introSeenAt');
    expect(card).toContain("Continuar configuração");
    expect(card).toContain('mutate("dismiss")');
    expect(migration).toContain("intro_seen_at=coalesce(intro_seen_at,now())");
  });
});

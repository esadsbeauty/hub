import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const crmHooks = readFileSync("src/modules/crm/hooks.ts", "utf8");
const crmRepository = readFileSync("src/modules/crm/supabase-repository.ts", "utf8");
const analytics = readFileSync("src/modules/analytics/use-analytics.ts", "utf8");
const agenda = readFileSync("src/modules/agenda/hooks.ts", "utf8");
const customers = readFileSync("src/modules/customers/hooks.ts", "utf8");
const onboarding = readFileSync("src/modules/onboarding/hooks.ts", "utf8");
const state = readFileSync("src/shared/state/app-state.tsx", "utf8");
const errors = readFileSync("src/shared/components/feedback/states.tsx", "utf8");

describe("tenant-aware Dashboard data lifecycle", () => {
  test("CRM snapshot and optimistic cache are scoped by active organization", () => {
    expect(crmHooks).toContain('[...crmKeys.all, "snapshot", organizationId]');
    expect(crmHooks).toContain("getQueryData<CrmData>(snapshotKey)");
    expect(crmHooks).toContain("setQueryData<CrmData>(snapshotKey");
    expect(crmHooks).not.toContain("exact: true");
  });

  test("Dashboard analytics derives its key from the loaded tenant snapshot", () => {
    expect(analytics).toContain("crm.data?.organization.id");
    expect(analytics).toContain("analyticsKeys.dashboard(organizationId");
  });

  test("all operational module queries include active organization context", () => {
    expect(agenda).toContain("organizationId,from,to");
    expect(customers).toContain("customerKeys.lists(),organizationId");
    expect(onboarding).toContain("onboardingKey,organizationId");
    expect(state).toContain("queryClient.clear()");
  });

  test("impersonation does not run tenant onboarding side effects", () => {
    expect(onboarding).toContain("!isImpersonating");
  });

  test("development diagnostics identify the failing tenant query without exposing it in UI", () => {
    expect(crmRepository).toContain("import.meta.env.DEV");
    expect(crmRepository).toContain("[CRM tenant query:");
    expect(errors).toContain("Não foi possível consultar os dados desta organização");
    expect(errors).not.toContain("result.error");
  });
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202608310001_organization_subscriptions_billing.sql", "utf8");

describe("platform subscription billing foundation", () => {
  test("separates current subscription from plan history and prevents duplicates", () => {
    expect(migration).toContain("create table if not exists public.organization_subscriptions");
    expect(migration).toContain("organization_subscriptions_one_current_idx");
    expect(migration).toContain("where status<>'cancelled'");
    expect(migration).toContain("sync_subscription_on_organization_plan");
  });
  test("new organizations receive a provider-neutral subscription", () => {
    expect(migration).toContain("create trigger zz_initialize_subscription_on_organization after insert");
    expect(migration).toContain("perform public.create_current_organization_subscription");
    expect(migration).toContain("provider text");
    expect(migration).not.toMatch(/asaas|stripe|mercadopago/i);
  });
  test("backfills existing plans safely without retroactive charges", () => {
    expect(migration).toContain("jsonb_build_object('origin','safe_backfill','retroactive_charge',false)");
    expect(migration).toContain("p.price_cents");
    expect(migration).not.toMatch(/where p\.slug='fundadores'.*legacy/s);
    expect(migration).not.toMatch(/insert into public\.subscription_payments[\s\S]*safe_backfill/);
  });
  test("tenants can read only their own finances and have no write policy", () => {
    expect(migration).toContain("organization_subscriptions_tenant_read");
    expect(migration).toContain("subscription_payments_tenant_read");
    expect(migration.match(/using\(organization_id=public\.current_organization_id\(\)\)/g)?.length).toBe(2);
    expect(migration).not.toMatch(/create policy .* for (insert|update|delete|all)/i);
  });
  test("every financial mutation verifies Platform Admin", () => {
    for (const rpc of ["platform_mark_subscription_paid","platform_change_subscription_due_date","platform_suspend_subscription","platform_reactivate_subscription","platform_cancel_subscription"]) expect(migration).toContain(`function public.${rpc}`);
    expect(migration.match(/if not public\.is_platform_admin\(\)then raise exception 'platform_admin_required'/g)?.length).toBe(6);
    expect(migration).toContain("grant execute on function public.%s to authenticated");
  });
  test("manual payment creates history and advances by calendar month", () => {
    expect(migration).toContain("insert into public.subscription_payments");
    expect(migration).toContain("period_end:=period_start+make_interval(months=>subscription.billing_interval_months)");
    expect(migration).toContain("last_payment_at=paid_time");
    expect(migration).toContain("next_due_at=period_end");
    expect(migration).toContain("if subscription.status='cancelled'then raise exception");
  });
  test("status, cancellation and suspension never delete tenant data", () => {
    expect(migration).toContain("status in('active','pending','past_due','suspended','cancelled')");
    expect(migration).toContain("subscription_effective_status");
    expect(migration).not.toMatch(/delete from public\.(organizations|companies|organization_subscriptions|subscription_payments)/i);
    expect(migration).toContain("cancelled_at=now()");
    expect(migration).toContain("suspended_at=null");
  });
  test("grace period is centralized per subscription", () => {
    expect(migration).toContain("grace_period_days integer not null default 5");
    expect(migration).toContain("make_interval(days=>grace_period_days)");
    expect(migration).toContain("when at_time>grace_ends_at then 'suspended'");
    expect(migration).toContain("when at_time>next_due_at then 'past_due'");
  });
  test("snapshot returns finances and MRR excludes free or non-active subscriptions", () => {
    expect(migration).toContain("'subscription',case when effective.subscription_id is null then null else jsonb_build_object");
    expect(migration).toContain("'daysOverdue'");
    expect(migration).toContain("effective.status='active'and effective.price_cents>0");
    expect(migration).toContain("sum(effective.price_cents/effective.billing_interval_months)filter(where effective.status='active')");
    expect(migration).toContain("candidate.status<>'cancelled'");
  });
});

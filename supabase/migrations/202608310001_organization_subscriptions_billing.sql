-- Provider-neutral SaaS subscriptions and manual payment operations.
create table if not exists public.organization_subscriptions(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null check(status in('active','pending','past_due','suspended','cancelled')),
  billing_mode text not null default 'manual' check(billing_mode in('manual','automatic')),
  payment_method text not null default 'manual',
  price_cents integer not null check(price_cents>=0),
  currency char(3) not null default 'BRL',
  billing_interval_months integer not null default 1 check(billing_interval_months>0),
  grace_period_days integer not null default 5 check(grace_period_days>=0),
  started_at timestamptz not null default now(),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  next_due_at timestamptz not null,
  last_payment_at timestamptz,
  grace_period_ends_at timestamptz not null,
  suspended_at timestamptz,
  cancelled_at timestamptz,
  provider text,
  external_customer_id text,
  external_subscription_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(current_period_end>current_period_start)
);
create unique index if not exists organization_subscriptions_one_current_idx
on public.organization_subscriptions(organization_id)where status<>'cancelled';
create index if not exists organization_subscriptions_status_due_idx on public.organization_subscriptions(status,next_due_at);

create table if not exists public.subscription_payments(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid not null references public.organization_subscriptions(id),
  amount_cents integer not null check(amount_cents>=0),
  currency char(3) not null default 'BRL',
  status text not null default 'paid' check(status in('pending','paid','failed','refunded','cancelled')),
  payment_method text not null default 'manual',
  paid_at timestamptz,
  due_at timestamptz not null,
  provider text,
  external_payment_id text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists subscription_payments_subscription_paid_idx on public.subscription_payments(subscription_id,paid_at desc);

alter table public.organization_subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
create policy organization_subscriptions_tenant_read on public.organization_subscriptions for select to authenticated
using(organization_id=public.current_organization_id());
create policy subscription_payments_tenant_read on public.subscription_payments for select to authenticated
using(organization_id=public.current_organization_id());
-- No tenant write policies: financial mutations are Platform Admin RPCs only.

create or replace function public.create_current_organization_subscription(target_organization_id uuid,target_plan_id uuid,actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare selected_plan public.plans;subscription_id uuid;cycle_start timestamptz:=now();cycle_end timestamptz;months integer;
begin
 if exists(select 1 from public.organization_subscriptions where organization_id=target_organization_id and status<>'cancelled')then
  select id into subscription_id from public.organization_subscriptions where organization_id=target_organization_id and status<>'cancelled';return subscription_id;
 end if;
 select*into selected_plan from public.plans where id=target_plan_id;
 if selected_plan.id is null then raise exception 'invalid_plan';end if;
 months:=case selected_plan.billing_interval when 'yearly'then 12 else 1 end;
 cycle_end:=cycle_start+make_interval(months=>months);
 insert into public.organization_subscriptions(organization_id,plan_id,status,billing_mode,payment_method,price_cents,currency,billing_interval_months,started_at,current_period_start,current_period_end,next_due_at,grace_period_ends_at,metadata)
 values(target_organization_id,selected_plan.id,'active',selected_plan.billing_mode,'manual',selected_plan.price_cents,selected_plan.currency,months,cycle_start,cycle_start,cycle_end,cycle_end,cycle_end+make_interval(days=>5),jsonb_build_object('origin',case when actor_user_id is null then 'automatic'else 'platform_provisioning'end))
 returning id into subscription_id;
 return subscription_id;
end$$;
revoke all on function public.create_current_organization_subscription(uuid,uuid,uuid)from public,anon,authenticated;

-- Existing tenants start a fresh cycle now: no retroactive invoices or debt.
insert into public.organization_subscriptions(organization_id,plan_id,status,billing_mode,payment_method,price_cents,currency,billing_interval_months,started_at,current_period_start,current_period_end,next_due_at,grace_period_ends_at,metadata)
select o.id,p.id,'active',p.billing_mode,'manual',p.price_cents,p.currency,case p.billing_interval when 'yearly'then 12 else 1 end,
 now(),now(),now()+make_interval(months=>case p.billing_interval when 'yearly'then 12 else 1 end),now()+make_interval(months=>case p.billing_interval when 'yearly'then 12 else 1 end),now()+make_interval(months=>case p.billing_interval when 'yearly'then 12 else 1 end,days=>5),jsonb_build_object('origin','safe_backfill','retroactive_charge',false)
from public.organizations o join public.organization_plans op on op.organization_id=o.id and op.status='active'and op.ends_at is null join public.plans p on p.id=op.plan_id
where not exists(select 1 from public.organization_subscriptions s where s.organization_id=o.id and s.status<>'cancelled');

create or replace function public.initialize_organization_subscription()returns trigger language plpgsql security definer set search_path=public as $$
declare active_plan_id uuid;
begin
 select plan_id into active_plan_id from public.organization_plans where organization_id=new.id and status='active'and ends_at is null order by starts_at desc limit 1;
 if active_plan_id is not null then perform public.create_current_organization_subscription(new.id,active_plan_id,null);end if;
 return new;
end$$;
drop trigger if exists zz_initialize_subscription_on_organization on public.organizations;
create trigger zz_initialize_subscription_on_organization after insert on public.organizations for each row execute function public.initialize_organization_subscription();
revoke all on function public.initialize_organization_subscription()from public,anon,authenticated;

create or replace function public.sync_subscription_to_organization_plan()returns trigger language plpgsql security definer set search_path=public as $$
declare selected_plan public.plans;current_subscription public.organization_subscriptions;months integer;
begin
 if new.status<>'active'or new.ends_at is not null then return new;end if;
 select*into selected_plan from public.plans where id=new.plan_id;months:=case selected_plan.billing_interval when 'yearly'then 12 else 1 end;
 select*into current_subscription from public.organization_subscriptions where organization_id=new.organization_id and status<>'cancelled'for update;
 if current_subscription.id is null then perform public.create_current_organization_subscription(new.organization_id,new.plan_id,new.assigned_by);
 else
  update public.organization_subscriptions set plan_id=selected_plan.id,price_cents=selected_plan.price_cents,currency=selected_plan.currency,billing_mode=selected_plan.billing_mode,billing_interval_months=months,updated_at=now()where id=current_subscription.id;
 end if;
 return new;
end$$;
drop trigger if exists sync_subscription_on_organization_plan on public.organization_plans;
create trigger sync_subscription_on_organization_plan after insert or update of plan_id,status,ends_at on public.organization_plans for each row execute function public.sync_subscription_to_organization_plan();
revoke all on function public.sync_subscription_to_organization_plan()from public,anon,authenticated;

create or replace function public.subscription_effective_status(stored_status text,next_due_at timestamptz,grace_ends_at timestamptz,at_time timestamptz default now())returns text
language sql immutable set search_path=public as $$
 select case when stored_status is null then null when stored_status in('cancelled','suspended','pending')then stored_status when at_time>grace_ends_at then 'suspended' when at_time>next_due_at then 'past_due'else 'active'end
$$;
revoke all on function public.subscription_effective_status(text,timestamptz,timestamptz,timestamptz)from public,anon;
grant execute on function public.subscription_effective_status(text,timestamptz,timestamptz,timestamptz)to authenticated;

create or replace function public.platform_mark_subscription_paid(target_subscription_id uuid,payment_notes text default null)returns void language plpgsql security definer set search_path=public as $$
declare subscription public.organization_subscriptions;paid_time timestamptz:=now();period_start timestamptz;period_end timestamptz;
begin
 if not public.is_platform_admin()then raise exception 'platform_admin_required'using errcode='42501';end if;
 select*into subscription from public.organization_subscriptions where id=target_subscription_id for update;
 if subscription.id is null then raise exception 'subscription_not_found';end if;if subscription.status='cancelled'then raise exception 'cancelled_subscription';end if;
 period_start:=greatest(subscription.current_period_end,paid_time);period_end:=period_start+make_interval(months=>subscription.billing_interval_months);
 insert into public.subscription_payments(organization_id,subscription_id,amount_cents,currency,status,payment_method,paid_at,due_at,notes,created_by)
 values(subscription.organization_id,subscription.id,subscription.price_cents,subscription.currency,'paid','manual',paid_time,subscription.next_due_at,nullif(trim(payment_notes),''),auth.uid());
 update public.organization_subscriptions set status='active',last_payment_at=paid_time,current_period_start=period_start,current_period_end=period_end,next_due_at=period_end,grace_period_ends_at=period_end+make_interval(days=>grace_period_days),suspended_at=null,updated_at=now()where id=subscription.id;
end$$;

create or replace function public.platform_change_subscription_due_date(target_subscription_id uuid,new_due_at timestamptz)returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin()then raise exception 'platform_admin_required'using errcode='42501';end if;
 if new_due_at<=now()then raise exception 'future_due_date_required';end if;
 update public.organization_subscriptions set next_due_at=new_due_at,current_period_end=new_due_at,grace_period_ends_at=new_due_at+make_interval(days=>grace_period_days),updated_at=now()where id=target_subscription_id and status<>'cancelled';
 if not found then raise exception 'subscription_not_mutable';end if;
end$$;
create or replace function public.platform_suspend_subscription(target_subscription_id uuid)returns void language plpgsql security definer set search_path=public as $$
begin if not public.is_platform_admin()then raise exception 'platform_admin_required'using errcode='42501';end if;update public.organization_subscriptions set status='suspended',suspended_at=now(),updated_at=now()where id=target_subscription_id and status in('active','pending','past_due');if not found then raise exception 'subscription_not_suspendable';end if;end$$;
create or replace function public.platform_reactivate_subscription(target_subscription_id uuid)returns void language plpgsql security definer set search_path=public as $$
begin if not public.is_platform_admin()then raise exception 'platform_admin_required'using errcode='42501';end if;update public.organization_subscriptions set status='active',suspended_at=null,next_due_at=greatest(next_due_at,now()+interval'1 day'),grace_period_ends_at=greatest(grace_period_ends_at,now()+make_interval(days=>grace_period_days+1)),updated_at=now()where id=target_subscription_id and status in('active','suspended','past_due','pending');if not found then raise exception 'subscription_not_reactivatable';end if;end$$;
create or replace function public.platform_cancel_subscription(target_subscription_id uuid)returns void language plpgsql security definer set search_path=public as $$
begin if not public.is_platform_admin()then raise exception 'platform_admin_required'using errcode='42501';end if;update public.organization_subscriptions set status='cancelled',cancelled_at=now(),updated_at=now()where id=target_subscription_id and status<>'cancelled';if not found then raise exception 'subscription_not_cancellable';end if;end$$;

do $$declare signature text;begin foreach signature in array array['platform_mark_subscription_paid(uuid,text)','platform_change_subscription_due_date(uuid,timestamptz)','platform_suspend_subscription(uuid)','platform_reactivate_subscription(uuid)','platform_cancel_subscription(uuid)']loop execute format('revoke all on function public.%s from public,anon',signature);execute format('grant execute on function public.%s to authenticated',signature);end loop;end$$;

create or replace function public.platform_admin_snapshot()returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_platform_admin()then raise exception 'platform_admin_required'using errcode='42501';end if;
 select jsonb_build_object(
  'plans',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'slug',p.slug,'priceCents',p.price_cents,'billingMode',p.billing_mode,'isActive',p.is_active,'entitlements',(select coalesce(jsonb_agg(pe.module order by pe.module),'[]')from public.plan_entitlements pe where pe.plan_id=p.id and pe.enabled))order by p.price_cents),'[]')from public.plans p),
  'metrics',jsonb_build_object('activeCustomers',count(*)filter(where effective.status='active'and effective.price_cents>0),'mrrCents',coalesce(sum(effective.price_cents/effective.billing_interval_months)filter(where effective.status='active'),0),'pastDue',count(*)filter(where effective.status='past_due'),'suspended',count(*)filter(where effective.status='suspended')),
  'organizations',coalesce(jsonb_agg(jsonb_build_object('id',effective.organization_id,'name',effective.organization_name,'planId',effective.plan_id,'planName',effective.plan_name,'status',effective.plan_status,'startsAt',effective.plan_started_at,'createdAt',effective.organization_created_at,'ownerName',effective.owner_name,'ownerEmail',effective.owner_email,'subscription',case when effective.subscription_id is null then null else jsonb_build_object('id',effective.subscription_id,'status',effective.status,'storedStatus',effective.stored_status,'priceCents',effective.price_cents,'currency',effective.currency,'startedAt',effective.subscription_started_at,'nextDueAt',effective.next_due_at,'lastPaymentAt',effective.last_payment_at,'gracePeriodEndsAt',effective.grace_period_ends_at,'paymentMethod',effective.payment_method,'daysOverdue',case when effective.next_due_at<now()then floor(extract(epoch from(now()-effective.next_due_at))/86400)::integer else 0 end)end)order by effective.organization_name),'[]')
 )into result
 from(select o.id organization_id,o.name organization_name,o.created_at organization_created_at,o.primary_contact_name owner_name,o.primary_contact_email owner_email,p.id plan_id,p.name plan_name,op.status plan_status,op.starts_at plan_started_at,s.id subscription_id,s.status stored_status,public.subscription_effective_status(s.status,s.next_due_at,s.grace_period_ends_at,now())status,s.price_cents,s.currency,s.billing_interval_months,s.started_at subscription_started_at,s.next_due_at,s.last_payment_at,s.grace_period_ends_at,s.payment_method from public.organizations o left join public.organization_plans op on op.organization_id=o.id and op.status='active'and op.ends_at is null left join public.plans p on p.id=op.plan_id left join lateral(select candidate.*from public.organization_subscriptions candidate where candidate.organization_id=o.id order by(candidate.status<>'cancelled')desc,candidate.created_at desc limit 1)s on true)effective;
 return result;
end$$;
revoke all on function public.platform_admin_snapshot()from public,anon;grant execute on function public.platform_admin_snapshot()to authenticated;
notify pgrst,'reload schema';

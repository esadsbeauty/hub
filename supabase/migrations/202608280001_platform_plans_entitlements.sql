-- Platform administration and plan entitlements. Tenant ownership remains organization-scoped.
create table if not exists public.platform_admins(
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create table if not exists public.plans(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  price_cents integer not null check(price_cents>=0),
  currency char(3) not null default 'BRL',
  billing_interval text not null default 'monthly' check(billing_interval in('monthly','yearly')),
  billing_mode text not null default 'manual' check(billing_mode in('manual','automatic')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.plan_entitlements(
  plan_id uuid not null references public.plans(id) on delete cascade,
  module text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(plan_id,module)
);
create table if not exists public.organization_plans(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null default 'active' check(status in('active','inactive','cancelled')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  assigned_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at is null or ends_at>starts_at)
);
create unique index if not exists organization_plans_one_active_idx on public.organization_plans(organization_id) where status='active' and ends_at is null;
create index if not exists organization_plans_lookup_idx on public.organization_plans(organization_id,status,starts_at desc);
create index if not exists plan_entitlements_enabled_idx on public.plan_entitlements(plan_id,module) where enabled;

insert into public.plans(name,slug,price_cents,currency,billing_interval,billing_mode,is_active)
values('Fundadores','fundadores',4990,'BRL','monthly','manual',true)
on conflict(slug) do update set name=excluded.name,price_cents=excluded.price_cents,currency=excluded.currency,billing_interval=excluded.billing_interval,billing_mode='manual',is_active=true,updated_at=now();
-- Technical compatibility plan: it preserves the pre-migration module surface for
-- existing tenants and is not offered for new subscriptions.
insert into public.plans(name,slug,price_cents,currency,billing_interval,billing_mode,is_active)
values('Legacy','legacy',0,'BRL','monthly','manual',false)
on conflict(slug) do update set name=excluded.name,billing_mode='manual',is_active=false,updated_at=now();
insert into public.plan_entitlements(plan_id,module,enabled)
select p.id,m,true from public.plans p cross join unnest(array['dashboard','crm','agenda','customers','finance','marketing','reports','settings','users','roles','audit','blog']) m
where p.slug in('fundadores','legacy') on conflict(plan_id,module) do update set enabled=true;
-- Only organizations that predate this migration exist at this point. Backfill
-- them to legacy without replacing any organization_plan already provisioned.
insert into public.organization_plans(organization_id,plan_id,status,starts_at)
select o.id,p.id,'active',now() from public.organizations o cross join public.plans p
where p.slug='legacy' and not exists(select 1 from public.organization_plans op where op.organization_id=o.id);

create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.platform_admins where user_id=auth.uid())
$$;
create or replace function public.has_module_entitlement(required_module text) returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.organization_plans op join public.plan_entitlements pe on pe.plan_id=op.plan_id
    where op.organization_id=public.current_organization_id() and op.status='active' and op.starts_at<=now()
      and(op.ends_at is null or op.ends_at>now()) and pe.module=required_module and pe.enabled
  )
$$;
-- Effective access always requires both the tenant role permission and its plan module.
create or replace function public.has_permission(required_permission text) returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.organization_members m
    join public.role_permissions rp on rp.role_id=m.role_id
    join public.permissions p on p.id=rp.permission_id
    where m.user_id=auth.uid() and m.status='active' and p.key=required_permission
      and public.has_module_entitlement(p.module)
  )
$$;
revoke all on function public.is_platform_admin() from public,anon;
grant execute on function public.is_platform_admin() to authenticated;
revoke all on function public.has_module_entitlement(text) from public,anon;
grant execute on function public.has_module_entitlement(text) to authenticated;

create or replace function public.current_authorization() returns jsonb language sql stable security definer set search_path=public as $$
with membership as(
 select o.id organization_id,o.name organization_name,r.slug role,m.status
 from public.organization_members m join public.organizations o on o.id=m.organization_id join public.roles r on r.id=m.role_id
 where m.user_id=auth.uid() order by(m.status='active')desc limit 1
), effective as(
 select coalesce(jsonb_agg(distinct p.key order by p.key)filter(where p.key is not null),'[]') permissions
 from membership x join public.organization_members m on m.organization_id=x.organization_id and m.user_id=auth.uid()
 left join public.role_permissions rp on rp.role_id=m.role_id left join public.permissions p on p.id=rp.permission_id
 where x.status='active' and public.has_module_entitlement(p.module)
), entitled as(
 select coalesce(jsonb_agg(distinct pe.module order by pe.module)filter(where pe.module is not null),'[]') entitlements
 from membership x left join public.organization_plans op on op.organization_id=x.organization_id and op.status='active' and op.starts_at<=now() and(op.ends_at is null or op.ends_at>now())
 left join public.plan_entitlements pe on pe.plan_id=op.plan_id and pe.enabled
)
select jsonb_build_object('organization_id',coalesce(x.organization_id::text,''),'organization_name',coalesce(x.organization_name,''),'role',coalesce(x.role,'reader'),'status',coalesce(x.status,'unlinked'),'permissions',e.permissions,'entitlements',n.entitlements,'is_platform_admin',public.is_platform_admin())
from effective e cross join entitled n left join membership x on true
$$;
revoke all on function public.current_authorization() from public,anon;
grant execute on function public.current_authorization() to authenticated;

create or replace function public.platform_admin_snapshot() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'platform_admin_required' using errcode='42501';end if;
 select jsonb_build_object(
  'plans',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'slug',p.slug,'priceCents',p.price_cents,'billingMode',p.billing_mode,'isActive',p.is_active,'entitlements',(select coalesce(jsonb_agg(pe.module order by pe.module),'[]')from public.plan_entitlements pe where pe.plan_id=p.id and pe.enabled))order by p.price_cents),'[]')from public.plans p),
  'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'planId',p.id,'planName',p.name,'status',op.status,'startsAt',op.starts_at)order by o.name),'[]')from public.organizations o left join public.organization_plans op on op.organization_id=o.id and op.status='active' and op.ends_at is null left join public.plans p on p.id=op.plan_id)
 )into result;
 return result;
end$$;
create or replace function public.platform_assign_organization_plan(target_organization_id uuid,target_plan_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'platform_admin_required' using errcode='42501';end if;
 if not exists(select 1 from public.organizations where id=target_organization_id)or not exists(select 1 from public.plans where id=target_plan_id and is_active)then raise exception 'invalid_organization_or_plan';end if;
 update public.organization_plans set status='inactive',ends_at=coalesce(ends_at,now()),updated_at=now() where organization_id=target_organization_id and status='active' and ends_at is null;
 insert into public.organization_plans(organization_id,plan_id,status,assigned_by)values(target_organization_id,target_plan_id,'active',auth.uid());
end$$;
revoke all on function public.platform_admin_snapshot() from public,anon;
grant execute on function public.platform_admin_snapshot() to authenticated;
revoke all on function public.platform_assign_organization_plan(uuid,uuid) from public,anon;
grant execute on function public.platform_assign_organization_plan(uuid,uuid) to authenticated;

create or replace function public.assign_default_organization_plan() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.organization_plans(organization_id,plan_id,status)select new.id,id,'active'from public.plans where slug='fundadores' and is_active limit 1;
 return new;
end$$;
drop trigger if exists assign_default_plan_on_organization on public.organizations;
create trigger assign_default_plan_on_organization after insert on public.organizations for each row execute function public.assign_default_organization_plan();
revoke all on function public.assign_default_organization_plan() from public,anon,authenticated;

alter table public.platform_admins enable row level security;
alter table public.plans enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.organization_plans enable row level security;
create policy platform_admins_self_read on public.platform_admins for select to authenticated using(user_id=auth.uid());
create policy plans_tenant_read on public.plans for select to authenticated using(public.current_organization_id()is not null or public.is_platform_admin());
create policy plan_entitlements_tenant_read on public.plan_entitlements for select to authenticated using(public.current_organization_id()is not null or public.is_platform_admin());
create policy organization_plans_tenant_read on public.organization_plans for select to authenticated using(organization_id=public.current_organization_id()or public.is_platform_admin());

notify pgrst,'reload schema';

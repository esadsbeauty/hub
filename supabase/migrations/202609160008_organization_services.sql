-- Organization-level service catalog for B2C Beauty.
-- Each tenant owns its own editable list of services.
-- Existing B2C/B2B organizations are untouched.
-- B2C Beauty organizations receive the starter catalog only when they have no services.

create table if not exists public.organization_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  default_price numeric(12,2),
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organization_services_name_not_blank
    check (length(trim(name)) > 0),

  constraint organization_services_default_price_nonnegative
    check (default_price is null or default_price >= 0),

  constraint organization_services_position_nonnegative
    check (position >= 0),

  constraint organization_services_org_name_unique
    unique (organization_id, name)
);

create index if not exists organization_services_org_active_position_idx
  on public.organization_services (organization_id, is_active, position, name);


alter table public.organization_services enable row level security;


drop policy if exists organization_services_select_tenant
  on public.organization_services;

create policy organization_services_select_tenant
on public.organization_services
for select
to authenticated
using (
  organization_id = public.current_organization_id()
);


drop policy if exists organization_services_insert_manager
  on public.organization_services;

create policy organization_services_insert_manager
on public.organization_services
for insert
to authenticated
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_current_business_mode()
);


drop policy if exists organization_services_update_manager
  on public.organization_services;

create policy organization_services_update_manager
on public.organization_services
for update
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.can_manage_current_business_mode()
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_current_business_mode()
);


drop policy if exists organization_services_delete_manager
  on public.organization_services;

create policy organization_services_delete_manager
on public.organization_services
for delete
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.can_manage_current_business_mode()
);


create or replace function public.seed_b2c_beauty_services(
  target_organization_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if target_organization_id is null then
    raise exception 'organization_required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organizations
    where id = target_organization_id
      and business_mode = 'b2c_beauty'
  ) then
    return 0;
  end if;

  -- Do not overwrite or mix with a catalog the organization already customized.
  if exists (
    select 1
    from public.organization_services
    where organization_id = target_organization_id
  ) then
    return 0;
  end if;

  insert into public.organization_services (
    organization_id,
    name,
    default_price,
    is_active,
    position
  )
  values
    (target_organization_id, 'Limpeza de pele', null, true, 0),
    (target_organization_id, 'Botox', null, true, 1),
    (target_organization_id, 'Preenchimento labial', null, true, 2),
    (target_organization_id, 'Preenchimento facial', null, true, 3),
    (target_organization_id, 'Bioestimulador de colágeno', null, true, 4),
    (target_organization_id, 'Skinbooster', null, true, 5),
    (target_organization_id, 'Peeling', null, true, 6),
    (target_organization_id, 'Microagulhamento', null, true, 7),
    (target_organization_id, 'Harmonização facial', null, true, 8),
    (target_organization_id, 'Depilação a laser', null, true, 9)
  on conflict (organization_id, name) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end
$$;

revoke all on function public.seed_b2c_beauty_services(uuid)
from public, anon, authenticated;


create or replace function public.seed_b2c_beauty_services_after_mode_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.business_mode = 'b2c_beauty'
     and old.business_mode is distinct from new.business_mode then
    perform public.seed_b2c_beauty_services(new.id);
  end if;

  return new;
end
$$;

drop trigger if exists organizations_seed_b2c_beauty_services
  on public.organizations;

create trigger organizations_seed_b2c_beauty_services
after update of business_mode
on public.organizations
for each row
execute function public.seed_b2c_beauty_services_after_mode_change();


-- Backfill only organizations that are already B2C Beauty and still have no catalog.
do $$
declare
  organization_record record;
begin
  for organization_record in
    select id
    from public.organizations
    where business_mode = 'b2c_beauty'
  loop
    perform public.seed_b2c_beauty_services(organization_record.id);
  end loop;
end
$$;


notify pgrst, 'reload schema';

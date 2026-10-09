
-- Grant cross-organization platform access to every active owner/admin
-- of the ESADS Beauty base organization.
create or replace function public.sync_esads_platform_admin_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_organization_id uuid;
  v_is_eligible boolean;
begin
  v_user_id := coalesce(new.user_id, old.user_id);
  v_organization_id := coalesce(new.organization_id, old.organization_id);

  if v_organization_id <> 'c6ee7876-c88b-4419-abba-b2ed4cc54257'::uuid then
    return coalesce(new, old);
  end if;

  select exists(
    select 1
    from public.organization_members m
    join public.roles r on r.id = m.role_id
    where m.user_id = v_user_id
      and m.organization_id = 'c6ee7876-c88b-4419-abba-b2ed4cc54257'::uuid
      and m.status = 'active'
      and r.slug in ('owner', 'admin')
  )
  into v_is_eligible;

  if v_is_eligible then
    insert into public.platform_admins(user_id, created_by)
    values(v_user_id, coalesce(auth.uid(), v_user_id))
    on conflict(user_id) do nothing;
  else
    delete from public.platform_admin_tenant_context
    where platform_admin_user_id = v_user_id;

    delete from public.platform_admins
    where user_id = v_user_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_esads_platform_admin_membership_trigger
on public.organization_members;

create trigger sync_esads_platform_admin_membership_trigger
after insert or update of role_id, status, organization_id or delete
on public.organization_members
for each row
execute function public.sync_esads_platform_admin_membership();

-- Backfill current active ESADS Beauty owners/admins.
insert into public.platform_admins(user_id, created_by)
select
  m.user_id,
  '5fb4d67f-a56e-4c6d-8573-4693cd6e1509'::uuid
from public.organization_members m
join public.roles r on r.id = m.role_id
where m.organization_id = 'c6ee7876-c88b-4419-abba-b2ed4cc54257'::uuid
  and m.status = 'active'
  and r.slug in ('owner', 'admin')
on conflict(user_id) do nothing;

revoke all on function public.sync_esads_platform_admin_membership() from public, anon, authenticated;
grant execute on function public.sync_esads_platform_admin_membership() to service_role;

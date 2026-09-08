-- Add B2C Beauty as a third tenant business mode without changing existing organizations.

alter table public.organizations
  drop constraint if exists organizations_business_mode_check;

alter table public.organizations
  add constraint organizations_business_mode_check
  check (business_mode in ('b2c','b2b','b2c_beauty'));

create or replace function public.update_organization_business_mode(next_mode text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  tenant uuid := public.current_organization_id();
  previous_mode text;
begin
  if tenant is null then
    raise exception 'organization_required' using errcode='42501';
  end if;

  if not public.can_manage_current_business_mode() then
    raise exception 'access_denied' using errcode='42501';
  end if;

  if next_mode not in ('b2c','b2b','b2c_beauty') then
    raise exception 'invalid_business_mode' using errcode='22023';
  end if;

  select business_mode
    into previous_mode
  from public.organizations
  where id=tenant
  for update;

  if previous_mode is null then
    raise exception 'organization_not_found' using errcode='P0002';
  end if;

  if previous_mode=next_mode then
    return next_mode;
  end if;

  update public.organizations
  set business_mode=next_mode,
      updated_at=now()
  where id=tenant;

  perform public.write_audit_log(
    'business_mode_updated',
    'organization',
    tenant,
    'settings',
    jsonb_build_object('business_mode',previous_mode),
    jsonb_build_object('business_mode',next_mode)
  );

  return next_mode;
end
$$;

revoke all on function public.update_organization_business_mode(text) from public,anon;
grant execute on function public.update_organization_business_mode(text) to authenticated;

notify pgrst,'reload schema';

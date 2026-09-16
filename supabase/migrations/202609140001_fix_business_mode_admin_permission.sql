-- Restore the intended administrative permission for every system or tenant
-- owner/admin role. This is additive and does not change tenant business data.
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
join public.permissions p on p.key='settings.manage'
where r.slug in('owner','admin')
on conflict do nothing;

create or replace function public.update_organization_business_mode(next_mode text)
returns text language plpgsql security definer set search_path=public as $$
declare
  tenant uuid:=public.current_organization_id();
  previous_mode text;
  tenant_administrator boolean:=false;
begin
  if tenant is null then raise exception 'organization_required' using errcode='42501';end if;

  select exists(
    select 1
    from public.organization_members m
    join public.roles r on r.id=m.role_id
    where m.organization_id=tenant
      and m.user_id=auth.uid()
      and m.status='active'
      and r.slug in('owner','admin')
  ) into tenant_administrator;

  if not public.is_platform_admin()
    and not tenant_administrator
    and not public.has_permission('settings.manage') then
    raise exception 'settings_manage_required' using errcode='42501';
  end if;
  if next_mode not in ('b2c','b2b') then raise exception 'invalid_business_mode' using errcode='22023';end if;

  select business_mode into previous_mode
  from public.organizations where id=tenant for update;
  if previous_mode is null then raise exception 'organization_not_found' using errcode='P0002';end if;

  update public.organizations set business_mode=next_mode,updated_at=now() where id=tenant;
  perform public.write_audit_log('business_mode_updated','organization',tenant,'settings',jsonb_build_object('business_mode',previous_mode),jsonb_build_object('business_mode',next_mode));
  return next_mode;
end$$;

revoke all on function public.update_organization_business_mode(text) from public,anon;
grant execute on function public.update_organization_business_mode(text) to authenticated;

notify pgrst,'reload schema';

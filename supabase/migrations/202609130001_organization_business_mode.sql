-- Additive presentation preference. Existing tenant data and pipelines remain untouched.
alter table public.organizations
  add column if not exists business_mode text not null default 'b2b'
  check (business_mode in ('b2c','b2b'));

create or replace function public.current_business_mode()
returns text language plpgsql stable security definer set search_path=public as $$
declare tenant uuid:=public.current_organization_id(); mode text;
begin
  if tenant is null then raise exception 'organization_required' using errcode='42501';end if;
  select business_mode into mode from public.organizations where id=tenant;
  return coalesce(mode,'b2b');
end$$;

create or replace function public.update_organization_business_mode(next_mode text)
returns text language plpgsql security definer set search_path=public as $$
declare tenant uuid:=public.current_organization_id(); previous_mode text;
begin
  if tenant is null or (not public.has_permission('settings.manage') and not public.is_platform_admin()) then
    raise exception 'settings_manage_required' using errcode='42501';
  end if;
  if next_mode not in ('b2c','b2b') then raise exception 'invalid_business_mode' using errcode='22023';end if;
  select business_mode into previous_mode from public.organizations where id=tenant for update;
  if previous_mode is null then raise exception 'organization_not_found' using errcode='P0002';end if;
  update public.organizations set business_mode=next_mode,updated_at=now() where id=tenant;
  perform public.write_audit_log('business_mode_updated','organization',tenant,'settings',jsonb_build_object('business_mode',previous_mode),jsonb_build_object('business_mode',next_mode));
  return next_mode;
end$$;

revoke all on function public.current_business_mode(),public.update_organization_business_mode(text) from public,anon;
grant execute on function public.current_business_mode(),public.update_organization_business_mode(text) to authenticated;

-- Platform Admin impersonation remains narrowly scoped; settings are enabled only
-- so the selected tenant's presentation mode can be read and changed deliberately.
create or replace function public.has_permission(required_permission text)
returns boolean language sql stable security definer set search_path=public as $$
  select case when public.is_platform_admin() and public.current_organization_id() is distinct from public.base_organization_id() then
    required_permission=any(array['dashboard.view','crm.view','crm.manage','crm.opportunity.move','crm.opportunity.close','agenda.view','customers.view','customers.manage','marketing.view','reports.view','blog.view','settings.view','settings.manage']::text[])
    and exists(select 1 from public.permissions p where p.key=required_permission and public.has_module_entitlement(p.module))
  else exists(select 1 from public.organization_members m join public.role_permissions rp on rp.role_id=m.role_id join public.permissions p on p.id=rp.permission_id where m.user_id=auth.uid() and m.status='active' and p.key=required_permission and public.has_module_entitlement(p.module)) end
$$;

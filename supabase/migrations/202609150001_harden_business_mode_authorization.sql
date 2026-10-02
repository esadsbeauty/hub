-- Business mode is a tenant setting. Resolve its authorization directly from the
-- active membership instead of routing it through the entitlement-aware generic
-- has_permission() helper, whose purpose is module access.
create or replace function public.can_manage_current_business_mode()
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or exists(
    select 1
    from public.organization_members m
    join public.roles r on r.id=m.role_id
    left join public.role_permissions rp on rp.role_id=r.id
    left join public.permissions p on p.id=rp.permission_id and p.key='settings.manage'
    where m.organization_id=public.current_organization_id()
      and m.user_id=auth.uid()
      and m.status='active'
      and (r.slug in('owner','admin') or p.id is not null)
  )
$$;

create or replace function public.update_organization_business_mode(next_mode text)
returns text language plpgsql security definer set search_path=public as $$
declare tenant uuid:=public.current_organization_id();previous_mode text;
begin
  if tenant is null then raise exception 'organization_required' using errcode='42501';end if;
  if not public.can_manage_current_business_mode() then raise exception 'access_denied' using errcode='42501';end if;
  if next_mode not in ('b2c','b2b') then raise exception 'invalid_business_mode' using errcode='22023';end if;

  select business_mode into previous_mode from public.organizations where id=tenant for update;
  if previous_mode is null then raise exception 'organization_not_found' using errcode='P0002';end if;
  if previous_mode=next_mode then return next_mode;end if;

  update public.organizations set business_mode=next_mode,updated_at=now() where id=tenant;
  perform public.write_audit_log(
    'business_mode_updated','organization',tenant,'settings',
    jsonb_build_object('business_mode',previous_mode),
    jsonb_build_object('business_mode',next_mode)
  );
  return next_mode;
end$$;

revoke all on function public.can_manage_current_business_mode() from public,anon,authenticated;
revoke all on function public.update_organization_business_mode(text) from public,anon;
grant execute on function public.update_organization_business_mode(text) to authenticated;

notify pgrst,'reload schema';

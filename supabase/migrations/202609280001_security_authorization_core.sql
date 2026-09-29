-- =========================================================
-- SECURITY: autorização sempre vinculada ao tenant atual
-- =========================================================

create or replace function public.has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    case
      when public.is_platform_admin()
        and public.current_organization_id()
            is distinct from public.base_organization_id()
      then
        required_permission = any(
          array[
            'dashboard.view',
            'crm.view',
            'crm.manage',
            'crm.opportunity.move',
            'crm.opportunity.close',
            'agenda.view',
            'customers.view',
            'customers.manage',
            'finance.view',
            'finance.manage',
            'finance.transactions.reverse',
            'marketing.view',
            'reports.view',
            'blog.view',
            'settings.view',
            'settings.manage'
          ]::text[]
        )
        and exists (
          select 1
          from public.permissions p
          where p.key = required_permission
            and public.has_module_entitlement(p.module)
        )

      else exists (
        select 1
        from public.organization_members m
        join public.role_permissions rp
          on rp.role_id = m.role_id
        join public.permissions p
          on p.id = rp.permission_id
        where m.user_id = auth.uid()
          and m.organization_id = public.current_organization_id()
          and m.status = 'active'
          and p.key = required_permission
          and public.has_module_entitlement(p.module)
      )
    end
$function$;


create or replace function public.active_tenant_actor()
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  select jsonb_build_object(
    'id', p.id,
    'organization_id', public.current_organization_id(),
    'name', p.name,
    'email', p.email,
    'avatar_url', p.avatar_url,
    'role', coalesce(r.slug, p.role::text),
    'created_at', p.created_at,
    'updated_at', p.updated_at
  )
  from public.profiles p
  left join public.organization_members m
    on m.user_id = p.id
   and m.organization_id = public.current_organization_id()
   and m.status = 'active'
  left join public.roles r
    on r.id = m.role_id
  where p.id = auth.uid()
$function$;


create or replace function public.change_member_role(
  target_member_id uuid,
  target_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  target public.organization_members;
  actor_role text;
  old_role public.roles;
  new_role public.roles;
begin
  if not public.has_permission('users.manage') then
    raise exception 'access_denied';
  end if;

  select r.slug
  into actor_role
  from public.organization_members m
  join public.roles r on r.id = m.role_id
  where m.user_id = auth.uid()
    and m.organization_id = public.current_organization_id()
    and m.status = 'active'
  limit 1;

  select *
  into target
  from public.organization_members
  where id = target_member_id
    and organization_id = public.current_organization_id()
  for update;

  if not found or target.user_id = auth.uid() then
    raise exception 'self_role_change_denied';
  end if;

  select *
  into old_role
  from public.roles
  where id = target.role_id;

  select *
  into new_role
  from public.roles
  where id = target_role_id
    and slug <> 'owner'
    and (
      organization_id is null
      or organization_id = target.organization_id
    );

  if new_role.id is null then
    raise exception 'invalid_role';
  end if;

  if new_role.slug = 'admin'
     and actor_role <> 'owner' then
    raise exception 'owner_required_for_admin_promotion';
  end if;

  update public.organization_members
  set role_id = target_role_id,
      updated_at = now()
  where id = target.id;

  perform public.write_audit_log(
    'user_role_changed',
    'organization_member',
    target.id,
    'users',
    jsonb_build_object('role', old_role.slug),
    jsonb_build_object('role', new_role.slug)
  );
end
$function$;

notify pgrst, 'reload schema';
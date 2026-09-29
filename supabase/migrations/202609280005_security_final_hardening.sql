-- Final security hardening
-- Keeps database migrations aligned with the security changes validated in production.

create or replace function public.current_authorization()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  active_id uuid := public.current_organization_id();
  base_id uuid := public.base_organization_id();
  admin boolean := public.is_platform_admin();
  result jsonb;
begin
  if admin and active_id is distinct from base_id then
    select jsonb_build_object(
      'organization_id', o.id,
      'organization_name', o.name,
      'base_organization_id', base_id,
      'base_organization_name', (
        select name
        from public.organizations
        where id = base_id
      ),
      'role', 'admin',
      'status', 'active',
      'is_platform_admin', true,
      'is_impersonating', true,
      'permissions', (
        select coalesce(
          jsonb_agg(p.key order by p.key),
          '[]'::jsonb
        )
        from public.permissions p
        where public.has_permission(p.key)
      ),
      'entitlements', (
        select coalesce(
          jsonb_agg(distinct pe.module order by pe.module),
          '[]'::jsonb
        )
        from public.organization_plans op
        join public.plan_entitlements pe
          on pe.plan_id = op.plan_id
         and pe.enabled
        where op.organization_id = o.id
          and op.status = 'active'
          and op.starts_at <= now()
          and (op.ends_at is null or op.ends_at > now())
      ),
      'organizations', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', x.id,
              'name', x.name,
              'slug', x.slug,
              'type', x.organization_type
            )
            order by x.name
          ),
          '[]'::jsonb
        )
        from public.organizations x
      )
    )
    into result
    from public.organizations o
    where o.id = active_id;

  else
    with membership as (
      select
        o.id as organization_id,
        o.name as organization_name,
        r.slug as role,
        m.status
      from public.organization_members m
      join public.organizations o
        on o.id = m.organization_id
      join public.roles r
        on r.id = m.role_id
      where m.user_id = auth.uid()
        and m.organization_id = active_id
      limit 1
    ),
    effective as (
      select coalesce(
        jsonb_agg(distinct p.key order by p.key)
          filter (where p.key is not null),
        '[]'::jsonb
      ) as permissions
      from membership x
      join public.organization_members m
        on m.organization_id = x.organization_id
       and m.user_id = auth.uid()
      left join public.role_permissions rp
        on rp.role_id = m.role_id
      left join public.permissions p
        on p.id = rp.permission_id
      where x.status = 'active'
        and public.has_module_entitlement(p.module)
    ),
    entitled as (
      select coalesce(
        jsonb_agg(distinct pe.module order by pe.module)
          filter (where pe.module is not null),
        '[]'::jsonb
      ) as entitlements
      from membership x
      left join public.organization_plans op
        on op.organization_id = x.organization_id
       and op.status = 'active'
       and op.starts_at <= now()
       and (op.ends_at is null or op.ends_at > now())
      left join public.plan_entitlements pe
        on pe.plan_id = op.plan_id
       and pe.enabled
    )
    select jsonb_build_object(
      'organization_id', coalesce(x.organization_id::text, ''),
      'organization_name', coalesce(x.organization_name, ''),
      'base_organization_id', coalesce(x.organization_id::text, ''),
      'base_organization_name', coalesce(x.organization_name, ''),
      'role', coalesce(x.role, 'reader'),
      'status', coalesce(x.status, 'unlinked'),
      'permissions', e.permissions,
      'entitlements', n.entitlements,
      'is_platform_admin', admin,
      'is_impersonating', false,
      'organizations',
        case
          when admin then (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'id', o.id,
                  'name', o.name,
                  'slug', o.slug,
                  'type', o.organization_type
                )
                order by o.name
              ),
              '[]'::jsonb
            )
            from public.organizations o
          )
          else '[]'::jsonb
        end
    )
    into result
    from effective e
    cross join entitled n
    left join membership x on true;
  end if;

  return result;
end
$function$;


-- Remove unsafe table privileges from anonymous users.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'revoke all privileges on table %I.%I from anon',
      r.schemaname,
      r.tablename
    );

    execute format(
      'revoke truncate, trigger, references on table %I.%I from authenticated',
      r.schemaname,
      r.tablename
    );
  end loop;
end
$$;

-- Only published blog content needs direct anonymous table read.
grant select on table public.blog_posts to anon;
grant select on table public.blog_categories to anon;


-- Internal / trigger functions must not be directly callable by clients.
revoke execute on function public.audit_blog_post()
from public, anon, authenticated;

revoke execute on function public.bootstrap_default_pipeline()
from public, anon, authenticated;

revoke execute on function public.create_default_pipeline(uuid)
from public, anon, authenticated;

revoke execute on function public.handle_new_user()
from public, anon, authenticated;

revoke execute on function public.prepare_blog_post()
from public, anon, authenticated;

revoke execute on function public.preserve_marketing_first_touch()
from public, anon, authenticated;

revoke execute on function public.preserve_marketing_touch_boundaries()
from public, anon, authenticated;

revoke execute on function public.register_crm_entity_activity()
from public, anon, authenticated;

revoke execute on function public.register_financial_entry_activity()
from public, anon, authenticated;

grant execute on function public.create_default_pipeline(uuid)
to service_role;

-- Required by the authenticated settings flow.
grant execute on function public.can_manage_current_business_mode()
to authenticated;

notify pgrst, 'reload schema';
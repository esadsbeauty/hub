-- db-audit: reviewed-destructive platform-admin-context-row-only
create table public.platform_admin_tenant_context(
  platform_admin_user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  switched_at timestamptz not null default now()
);

alter table public.platform_admin_tenant_context enable row level security;

create or replace function public.base_organization_id()
returns uuid language sql stable security definer set search_path=public as $$
  select organization_id from public.organization_members
  where user_id=auth.uid() and status='active'
  order by joined_at nulls last,created_at limit 1
$$;

create or replace function public.current_organization_id()
returns uuid language sql stable security definer set search_path=public as $$
  select case when public.is_platform_admin() then
    coalesce((select organization_id from public.platform_admin_tenant_context where platform_admin_user_id=auth.uid()),public.base_organization_id())
  else public.base_organization_id() end
$$;

create or replace function public.platform_switch_organization(target_organization_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare previous_id uuid:=public.current_organization_id();base_id uuid:=public.base_organization_id();target public.organizations;
begin
  if not public.is_platform_admin() then raise exception 'platform_admin_required' using errcode='42501';end if;
  select * into target from public.organizations where id=target_organization_id;
  if target.id is null then raise exception 'organization_not_found';end if;
  if target.id=base_id then
    delete from public.platform_admin_tenant_context where platform_admin_user_id=auth.uid();
  else
    insert into public.platform_admin_tenant_context(platform_admin_user_id,organization_id,switched_at)
    values(auth.uid(),target.id,now()) on conflict(platform_admin_user_id) do update set organization_id=excluded.organization_id,switched_at=excluded.switched_at;
  end if;
  insert into public.audit_logs(organization_id,user_id,action,entity_type,entity_id,module,new_values,metadata)
  values(target.id,auth.uid(),'platform_tenant_context_switched','organization',target.id,'platform',jsonb_build_object('organization_id',target.id,'organization_name',target.name),jsonb_build_object('platform_admin_user_id',auth.uid(),'previous_organization_id',previous_id,'base_organization_id',base_id));
  return jsonb_build_object('organizationId',target.id,'organizationName',target.name,'isImpersonating',target.id<>base_id);
end$$;

create or replace function public.platform_clear_tenant_context()
returns void language plpgsql security definer set search_path=public as $$
declare previous_id uuid; base_id uuid:=public.base_organization_id();
begin
  if not public.is_platform_admin() then return;end if;
  delete from public.platform_admin_tenant_context where platform_admin_user_id=auth.uid() returning organization_id into previous_id;
  if previous_id is not null and base_id is not null then
    insert into public.audit_logs(organization_id,user_id,action,entity_type,entity_id,module,new_values,metadata)
    values(base_id,auth.uid(),'platform_tenant_context_cleared','organization',base_id,'platform',jsonb_build_object('organization_id',base_id),jsonb_build_object('platform_admin_user_id',auth.uid(),'previous_organization_id',previous_id));
  end if;
end$$;

create or replace function public.has_permission(required_permission text)
returns boolean language sql stable security definer set search_path=public as $$
  select case when public.is_platform_admin() and public.current_organization_id() is distinct from public.base_organization_id() then
    required_permission=any(array['dashboard.view','crm.view','crm.manage','crm.opportunity.move','crm.opportunity.close','agenda.view','customers.view','customers.manage','marketing.view','reports.view','blog.view']::text[])
    and exists(select 1 from public.permissions p where p.key=required_permission and public.has_module_entitlement(p.module))
  else exists(select 1 from public.organization_members m join public.role_permissions rp on rp.role_id=m.role_id join public.permissions p on p.id=rp.permission_id where m.user_id=auth.uid() and m.status='active' and p.key=required_permission and public.has_module_entitlement(p.module)) end
$$;

create or replace function public.current_authorization()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare active_id uuid:=public.current_organization_id();base_id uuid:=public.base_organization_id();admin boolean:=public.is_platform_admin();result jsonb;
begin
  if admin and active_id is distinct from base_id then
    select jsonb_build_object(
      'organization_id',o.id,'organization_name',o.name,'base_organization_id',base_id,'base_organization_name',(select name from public.organizations where id=base_id),
      'role','admin','status','active','is_platform_admin',true,'is_impersonating',true,
      'permissions',(select coalesce(jsonb_agg(p.key order by p.key),'[]') from public.permissions p where public.has_permission(p.key)),
      'entitlements',(select coalesce(jsonb_agg(distinct pe.module order by pe.module),'[]') from public.organization_plans op join public.plan_entitlements pe on pe.plan_id=op.plan_id and pe.enabled where op.organization_id=o.id and op.status='active' and op.starts_at<=now() and(op.ends_at is null or op.ends_at>now())),
      'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'slug',x.slug,'type',x.organization_type) order by x.name),'[]') from public.organizations x)
    ) into result from public.organizations o where o.id=active_id;
  else
    with membership as(select o.id organization_id,o.name organization_name,r.slug role,m.status from public.organization_members m join public.organizations o on o.id=m.organization_id join public.roles r on r.id=m.role_id where m.user_id=auth.uid() order by(m.status='active')desc limit 1),effective as(select coalesce(jsonb_agg(distinct p.key order by p.key)filter(where p.key is not null),'[]') permissions from membership x join public.organization_members m on m.organization_id=x.organization_id and m.user_id=auth.uid() left join public.role_permissions rp on rp.role_id=m.role_id left join public.permissions p on p.id=rp.permission_id where x.status='active' and public.has_module_entitlement(p.module)),entitled as(select coalesce(jsonb_agg(distinct pe.module order by pe.module)filter(where pe.module is not null),'[]') entitlements from membership x left join public.organization_plans op on op.organization_id=x.organization_id and op.status='active' and op.starts_at<=now() and(op.ends_at is null or op.ends_at>now()) left join public.plan_entitlements pe on pe.plan_id=op.plan_id and pe.enabled)
    select jsonb_build_object('organization_id',coalesce(x.organization_id::text,''),'organization_name',coalesce(x.organization_name,''),'base_organization_id',coalesce(x.organization_id::text,''),'base_organization_name',coalesce(x.organization_name,''),'role',coalesce(x.role,'reader'),'status',coalesce(x.status,'unlinked'),'permissions',e.permissions,'entitlements',n.entitlements,'is_platform_admin',admin,'is_impersonating',false,'organizations',case when admin then(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug,'type',o.organization_type)order by o.name),'[]')from public.organizations o)else'[]'::jsonb end) into result from effective e cross join entitled n left join membership x on true;
  end if;
  return result;
end$$;

create or replace function public.active_tenant_actor()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('id',p.id,'organization_id',public.current_organization_id(),'name',p.name,'email',p.email,'avatar_url',p.avatar_url,'role',p.role,'created_at',p.created_at,'updated_at',p.updated_at) from public.profiles p where p.id=auth.uid()
$$;

revoke all on table public.platform_admin_tenant_context from public,anon,authenticated;
revoke all on function public.base_organization_id(),public.platform_switch_organization(uuid),public.platform_clear_tenant_context(),public.active_tenant_actor() from public,anon;
grant execute on function public.base_organization_id(),public.platform_switch_organization(uuid),public.platform_clear_tenant_context(),public.active_tenant_actor() to authenticated;

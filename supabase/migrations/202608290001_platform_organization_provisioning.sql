-- Atomic tenant provisioning finalized by a service-role Edge Function after Auth invitation.
alter table public.organizations
  add column if not exists primary_contact_name text,
  add column if not exists primary_contact_email text,
  add column if not exists primary_contact_whatsapp text,
  add column if not exists provisioned_by uuid references auth.users(id);

create or replace function public.platform_provision_organization(
  actor_user_id uuid,
  owner_user_id uuid,
  organization_name text,
  owner_name text,
  owner_email text,
  owner_whatsapp text,
  selected_plan_id uuid default null,
  pipeline_name text default 'Pipeline Comercial'
) returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  normalized_email text:=lower(trim(owner_email));
  clean_org_name text:=trim(organization_name);
  clean_owner_name text:=trim(owner_name);
  clean_pipeline_name text:=coalesce(nullif(trim(pipeline_name),''),'Pipeline Comercial');
  target_plan public.plans;
  owner_role_id uuid;
  new_organization_id uuid;
  new_membership_id uuid;
  default_pipeline_id uuid;
  generated_slug text;
begin
  if actor_user_id is null or not exists(select 1 from public.platform_admins where user_id=actor_user_id) then
    raise exception 'platform_admin_required' using errcode='42501';
  end if;
  if clean_org_name='' or clean_owner_name='' or normalized_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_provisioning_input';
  end if;
  if owner_user_id is null or not exists(select 1 from auth.users where id=owner_user_id and lower(email)=normalized_email) then
    raise exception 'owner_auth_user_invalid';
  end if;
  if exists(select 1 from public.platform_admins where user_id=owner_user_id) then raise exception 'owner_cannot_be_platform_admin';end if;
  -- Auth invitations run the generic signup bootstrap. Only its inactive placeholder
  -- membership may exist; an established user can never be moved across tenants.
  if exists(select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id
    where m.user_id=owner_user_id and(m.status not in('pending','inactive')or o.slug<>'esads-beauty')) then
    raise exception 'owner_already_linked';
  end if;

  if selected_plan_id is null then
    select * into target_plan from public.plans where slug='fundadores' and is_active;
  else
    select * into target_plan from public.plans where id=selected_plan_id and is_active;
  end if;
  if target_plan.id is null or target_plan.slug='legacy' then raise exception 'invalid_plan';end if;
  select id into owner_role_id from public.roles where organization_id is null and slug='owner';
  if owner_role_id is null then raise exception 'owner_role_not_found';end if;

  generated_slug:=trim(both '-' from lower(regexp_replace(unaccent(clean_org_name),'[^a-zA-Z0-9]+','-','g')));
  if generated_slug='' then generated_slug:='organizacao';end if;
  generated_slug:=generated_slug||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8);

  insert into public.organizations(name,slug,primary_contact_name,primary_contact_email,primary_contact_whatsapp,provisioned_by)
  values(clean_org_name,generated_slug,clean_owner_name,normalized_email,nullif(trim(owner_whatsapp),''),actor_user_id)
  returning id into new_organization_id;

  -- The existing organization triggers create Fundadores + the canonical ten-stage pipeline.
  select id into default_pipeline_id from public.pipelines where organization_id=new_organization_id and is_default for update;
  if default_pipeline_id is null then raise exception 'default_pipeline_not_created';end if;
  update public.pipelines set name=clean_pipeline_name,updated_at=now() where id=default_pipeline_id;

  if target_plan.slug<>'fundadores' then
    update public.organization_plans set status='inactive',ends_at=coalesce(ends_at,now()),updated_at=now()
    where organization_id=new_organization_id and status='active' and ends_at is null;
    insert into public.organization_plans(organization_id,plan_id,status,assigned_by)
    values(new_organization_id,target_plan.id,'active',actor_user_id);
  else
    update public.organization_plans set assigned_by=actor_user_id,updated_at=now()
    where organization_id=new_organization_id and plan_id=target_plan.id and status='active' and ends_at is null;
  end if;

  update public.profiles set organization_id=new_organization_id,name=clean_owner_name,email=normalized_email,role='admin',updated_at=now()
  where id=owner_user_id;
  if not found then raise exception 'owner_profile_not_created';end if;
  update public.organization_members set organization_id=new_organization_id,role_id=owner_role_id,status='invited',invited_by=actor_user_id,updated_at=now()
  where user_id=owner_user_id and status in('pending','inactive') returning id into new_membership_id;
  if new_membership_id is null then
    insert into public.organization_members(organization_id,user_id,role_id,status,invited_by)
    values(new_organization_id,owner_user_id,owner_role_id,'invited',actor_user_id)
    returning id into new_membership_id;
  end if;

  insert into public.audit_logs(organization_id,user_id,action,entity_type,entity_id,module,new_values,metadata)
  values(new_organization_id,actor_user_id,'organization_provisioned','organization',new_organization_id,'platform',
    jsonb_build_object('plan',target_plan.slug,'owner_user_id',owner_user_id,'membership_id',new_membership_id,'pipeline_id',default_pipeline_id),
    jsonb_build_object('owner_email',normalized_email));

  return jsonb_build_object('organizationId',new_organization_id,'membershipId',new_membership_id,'pipelineId',default_pipeline_id,'planId',target_plan.id,'ownerUserId',owner_user_id);
end$$;
revoke all on function public.platform_provision_organization(uuid,uuid,text,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.platform_provision_organization(uuid,uuid,text,text,text,text,uuid,text) to service_role;

create or replace function public.platform_admin_snapshot() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'platform_admin_required' using errcode='42501';end if;
 select jsonb_build_object(
  'plans',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'slug',p.slug,'priceCents',p.price_cents,'billingMode',p.billing_mode,'isActive',p.is_active,'entitlements',(select coalesce(jsonb_agg(pe.module order by pe.module),'[]')from public.plan_entitlements pe where pe.plan_id=p.id and pe.enabled))order by p.price_cents),'[]')from public.plans p),
  'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'planId',p.id,'planName',p.name,'status',op.status,'startsAt',op.starts_at,'createdAt',o.created_at,'ownerName',o.primary_contact_name,'ownerEmail',o.primary_contact_email)order by o.name),'[]')from public.organizations o left join public.organization_plans op on op.organization_id=o.id and op.status='active' and op.ends_at is null left join public.plans p on p.id=op.plan_id)
 )into result;
 return result;
end$$;
revoke all on function public.platform_admin_snapshot() from public,anon;
grant execute on function public.platform_admin_snapshot() to authenticated;

notify pgrst,'reload schema';

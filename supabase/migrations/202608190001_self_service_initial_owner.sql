-- Let the sole authenticated user bootstrap the initial Owner without recreating Auth data.
-- The claim is atomic, derives identity from auth.uid() and closes permanently after an Owner exists.

drop function if exists public.claim_initial_owner(uuid,text);

create or replace function public.initial_owner_bootstrap_status()
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
declare
  current_user_id uuid:=auth.uid();
  target_org public.organizations;
  auth_user_count integer;
  active_member_count integer;
  owner_count integer;
begin
  if current_user_id is null then raise exception 'authentication_required'; end if;
  select * into target_org from public.organizations where slug='esads-beauty';
  select count(*) into auth_user_count from auth.users;
  if target_org.id is null then
    return jsonb_build_object('available',true,'eligible',auth_user_count=1,'organizationName','ESADS Beauty');
  end if;
  select count(*) into active_member_count from public.organization_members where organization_id=target_org.id and status='active';
  select count(*) into owner_count from public.organization_members m join public.roles r on r.id=m.role_id where m.organization_id=target_org.id and r.slug='owner';
  return jsonb_build_object(
    'available',active_member_count=0 and owner_count=0,
    'eligible',active_member_count=0 and owner_count=0 and auth_user_count=1,
    'organizationName',target_org.name
  );
end $$;
revoke all on function public.initial_owner_bootstrap_status() from public,anon;
grant execute on function public.initial_owner_bootstrap_status() to authenticated;

create or replace function public.claim_initial_owner(target_name text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare
  current_user_id uuid:=auth.uid();
  current_email text;
  metadata_name text;
  target_org_id uuid;
  owner_role_id uuid;
  member_id uuid;
  auth_user_count integer;
  profile_name text;
begin
  if current_user_id is null then raise exception 'authentication_required'; end if;
  perform pg_advisory_xact_lock(hashtext('esads-beauty-initial-owner'));

  select email,raw_user_meta_data->>'name' into current_email,metadata_name from auth.users where id=current_user_id;
  if current_email is null then raise exception 'auth_user_not_found'; end if;
  select count(*) into auth_user_count from auth.users;
  if auth_user_count<>1 then raise exception 'initial_owner_requires_single_auth_user'; end if;

  insert into public.organizations(name,slug) values('ESADS Beauty','esads-beauty')
  on conflict(slug) do update set updated_at=now()
  returning id into target_org_id;
  perform 1 from public.organizations where id=target_org_id for update;

  if exists(select 1 from public.organization_members where organization_id=target_org_id and status='active')
     or exists(select 1 from public.organization_members m join public.roles r on r.id=m.role_id where m.organization_id=target_org_id and r.slug='owner') then
    raise exception 'initial_owner_already_claimed';
  end if;

  select id into owner_role_id from public.roles where organization_id is null and slug='owner';
  if owner_role_id is null then raise exception 'owner_role_not_found'; end if;
  insert into public.role_permissions(role_id,permission_id)
  select owner_role_id,id from public.permissions on conflict do nothing;

  profile_name:=coalesce(nullif(trim(target_name),''),nullif(trim(metadata_name),''),split_part(current_email,'@',1));
  insert into public.profiles(id,organization_id,name,email,role)
  values(current_user_id,target_org_id,profile_name,lower(current_email),'admin'::public.profile_role)
  on conflict(id) do update set organization_id=excluded.organization_id,name=excluded.name,email=excluded.email,role='admin'::public.profile_role,updated_at=now();

  insert into public.organization_members(organization_id,user_id,role_id,status,joined_at)
  values(target_org_id,current_user_id,owner_role_id,'active',now())
  on conflict(organization_id,user_id) do update set role_id=excluded.role_id,status='active',joined_at=coalesce(public.organization_members.joined_at,now()),updated_at=now()
  returning id into member_id;

  insert into public.audit_logs(organization_id,user_id,action,entity_type,entity_id,module,new_values)
  values(target_org_id,current_user_id,'initial_owner_claimed','organization_member',member_id,'users',jsonb_build_object('role','owner','status','active'));

  return jsonb_build_object('memberId',member_id,'organizationId',target_org_id,'role','owner','status','active');
end $$;
revoke all on function public.claim_initial_owner(text) from public,anon;
grant execute on function public.claim_initial_owner(text) to authenticated;

-- Controlled public registration: one atomic initial Owner, subsequent users pending approval.
alter table public.organization_members
  drop constraint if exists organization_members_status_check;
alter table public.organization_members
  add constraint organization_members_status_check
  check (status in ('pending','invited','active','suspended','inactive'));
alter table public.organization_members
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare org_id uuid; reader_role uuid; member_id uuid; profile_name text;
begin
  select id into org_id from public.organizations where slug='esads-beauty';
  if org_id is null then
    insert into public.organizations(name,slug) values('ESADS Beauty','esads-beauty')
    on conflict(slug) do update set updated_at=now() returning id into org_id;
  end if;
  select id into reader_role from public.roles where organization_id is null and slug='reader';
  if reader_role is null then raise exception 'reader_role_not_found'; end if;
  profile_name:=coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),split_part(coalesce(new.email,''),'@',1));
  insert into public.profiles(id,organization_id,name,email,role)
  values(new.id,org_id,profile_name,lower(coalesce(new.email,'')),'member')
  on conflict(id) do update set name=excluded.name,email=excluded.email,updated_at=now();
  insert into public.organization_members(organization_id,user_id,role_id,status)
  values(org_id,new.id,reader_role,'pending')
  on conflict(organization_id,user_id) do nothing returning id into member_id;
  if member_id is not null then
    insert into public.audit_logs(organization_id,user_id,action,entity_type,entity_id,module,new_values)
    values(org_id,new.id,'user_registered','organization_member',member_id,'users',jsonb_build_object('status','pending')),
          (org_id,new.id,'user_access_requested','organization_member',member_id,'users',jsonb_build_object('status','pending'));
  end if;
  return new;
end $$;

create or replace function public.complete_registration()
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare current_user_id uuid:=auth.uid(); initial_user_id uuid; org_id uuid; owner_role_id uuid; reader_role_id uuid; member public.organization_members; owner_exists boolean; current_email text; profile_name text;
begin
  if current_user_id is null then raise exception 'authentication_required'; end if;
  perform pg_advisory_xact_lock(hashtext('esads-beauty-initial-owner'));
  insert into public.organizations(name,slug) values('ESADS Beauty','esads-beauty')
  on conflict(slug) do update set updated_at=now() returning id into org_id;
  select id into owner_role_id from public.roles where organization_id is null and slug='owner';
  select id into reader_role_id from public.roles where organization_id is null and slug='reader';
  if owner_role_id is null or reader_role_id is null then raise exception 'registration_roles_not_found'; end if;
  select email,coalesce(nullif(trim(raw_user_meta_data->>'name'),''),split_part(coalesce(email,''),'@',1)) into current_email,profile_name from auth.users where id=current_user_id;
  if current_email is null then raise exception 'auth_user_not_found'; end if;
  insert into public.profiles(id,organization_id,name,email,role) values(current_user_id,org_id,profile_name,lower(current_email),'member')
  on conflict(id) do update set name=excluded.name,email=excluded.email,updated_at=now();
  select * into member from public.organization_members where organization_id=org_id and user_id=current_user_id for update;
  if member.id is not null and (member.status in ('active','invited','suspended') or (member.status='inactive' and member.approved_by is not null)) then
    return jsonb_build_object('status',member.status,'role',(select slug from public.roles where id=member.role_id));
  end if;
  select exists(select 1 from public.organization_members m join public.roles r on r.id=m.role_id where m.organization_id=org_id and m.status='active' and r.slug='owner') into owner_exists;
  select id into initial_user_id from auth.users order by created_at,id limit 1;
  if not owner_exists and current_user_id=initial_user_id then
    insert into public.role_permissions(role_id,permission_id) select owner_role_id,id from public.permissions on conflict do nothing;
    insert into public.organization_members(organization_id,user_id,role_id,status,joined_at,approved_at,approved_by)
    values(org_id,current_user_id,owner_role_id,'active',now(),now(),current_user_id)
    on conflict(organization_id,user_id) do update set role_id=excluded.role_id,status='active',joined_at=coalesce(public.organization_members.joined_at,now()),approved_at=now(),approved_by=current_user_id,updated_at=now()
    returning * into member;
    update public.profiles set role='admin',updated_at=now() where id=current_user_id;
    insert into public.audit_logs(organization_id,user_id,action,entity_type,entity_id,module,new_values)
    values(org_id,current_user_id,'initial_owner_claimed','organization_member',member.id,'users',jsonb_build_object('role','owner','status','active'));
    return jsonb_build_object('status','active','role','owner');
  end if;
  insert into public.organization_members(organization_id,user_id,role_id,status)
  values(org_id,current_user_id,reader_role_id,'pending')
  on conflict(organization_id,user_id) do update set role_id=reader_role_id,status=case when public.organization_members.status='inactive' and public.organization_members.approved_by is null then 'pending' else public.organization_members.status end,updated_at=now()
  returning * into member;
  return jsonb_build_object('status',member.status,'role','reader');
end $$;
revoke all on function public.complete_registration() from public,anon;
grant execute on function public.complete_registration() to authenticated;

create or replace function public.approve_access_request(target_member_id uuid,target_role_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare target public.organization_members; selected_role public.roles;
begin
  if not public.has_permission('users.manage') then raise exception 'access_denied'; end if;
  select * into target from public.organization_members where id=target_member_id and organization_id=public.current_organization_id() and status='pending' for update;
  if target.id is null then raise exception 'pending_request_not_found'; end if;
  select * into selected_role from public.roles where id=target_role_id and slug<>'owner' and (organization_id is null or organization_id=target.organization_id);
  if selected_role.id is null then raise exception 'invalid_approval_role'; end if;
  update public.organization_members set role_id=selected_role.id,status='active',joined_at=now(),approved_at=now(),approved_by=auth.uid(),updated_at=now() where id=target.id;
  perform public.write_audit_log('user_approved','organization_member',target.id,'users',jsonb_build_object('status','pending'),jsonb_build_object('status','active','role',selected_role.slug));
  perform public.write_audit_log('user_role_assigned','organization_member',target.id,'users','{}',jsonb_build_object('role',selected_role.slug));
end $$;

create or replace function public.reject_access_request(target_member_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare target public.organization_members;
begin
  if not public.has_permission('users.manage') then raise exception 'access_denied'; end if;
  select * into target from public.organization_members where id=target_member_id and organization_id=public.current_organization_id() and status='pending' for update;
  if target.id is null then raise exception 'pending_request_not_found'; end if;
  update public.organization_members set status='inactive',approved_at=null,approved_by=auth.uid(),updated_at=now() where id=target.id;
  perform public.write_audit_log('user_rejected','organization_member',target.id,'users',jsonb_build_object('status','pending'),jsonb_build_object('status','inactive'));
end $$;
revoke all on function public.approve_access_request(uuid,uuid) from public,anon;
revoke all on function public.reject_access_request(uuid) from public,anon;
grant execute on function public.approve_access_request(uuid,uuid) to authenticated;
grant execute on function public.reject_access_request(uuid) to authenticated;

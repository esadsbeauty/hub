-- Secure initial owner bootstrap and recoverable invitation lifecycle.
-- Existing profiles, memberships, roles and business records are preserved.

create or replace function public.claim_initial_owner(target_user_id uuid, target_name text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare target_org uuid; owner_role uuid; member_id uuid; target_email text;
begin
  perform pg_advisory_xact_lock(hashtext('esads-beauty-initial-owner'));
  select id into target_org from public.organizations where slug='esads-beauty' for update;
  if target_org is null then raise exception 'organization_not_found'; end if;
  if exists(select 1 from public.organization_members where organization_id=target_org and status='active')
     or exists(select 1 from public.organization_members m join public.roles r on r.id=m.role_id where m.organization_id=target_org and r.slug='owner') then
    raise exception 'initial_owner_already_claimed';
  end if;
  select email into target_email from auth.users where id=target_user_id;
  if target_email is null then raise exception 'auth_user_not_found'; end if;
  select id into owner_role from public.roles where organization_id is null and slug='owner';
  if owner_role is null then raise exception 'owner_role_not_found'; end if;
  update public.profiles set name=coalesce(nullif(trim(target_name),''),name),updated_at=now() where id=target_user_id;
  insert into public.organization_members(organization_id,user_id,role_id,status,joined_at)
  values(target_org,target_user_id,owner_role,'active',now())
  on conflict(organization_id,user_id) do update set role_id=excluded.role_id,status='active',joined_at=coalesce(public.organization_members.joined_at,now()),updated_at=now()
  returning id into member_id;
  insert into public.audit_logs(organization_id,user_id,action,entity_type,entity_id,module,new_values)
  values(target_org,target_user_id,'initial_owner_claimed','organization_member',member_id,'users',jsonb_build_object('role','owner','status','active','email',lower(target_email)));
  return member_id;
end $$;
revoke all on function public.claim_initial_owner(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_initial_owner(uuid,text) to service_role;

create or replace function public.manage_member_invitation(actor_user_id uuid,target_user_id uuid,target_role_id uuid,target_action text)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor_member public.organization_members; requested_role public.roles; target_member public.organization_members; member_id uuid; audit_action text;
begin
  if target_action not in('invite','resend','cancel') then raise exception 'invalid_invitation_action'; end if;
  select m.* into actor_member from public.organization_members m
  where m.user_id=actor_user_id and m.status='active'
  and exists(select 1 from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=m.role_id and p.key='users.manage')
  order by m.joined_at nulls last limit 1;
  if actor_member.id is null then raise exception 'access_denied'; end if;
  select * into requested_role from public.roles where id=target_role_id and slug<>'owner' and (organization_id is null or organization_id=actor_member.organization_id);
  if requested_role.id is null then raise exception 'invalid_role'; end if;
  select * into target_member from public.organization_members where organization_id=actor_member.organization_id and user_id=target_user_id for update;
  if target_member.status='active' then raise exception 'member_already_active'; end if;
  if target_action='cancel' then
    if target_member.id is null or target_member.status<>'invited' then raise exception 'invitation_not_pending'; end if;
    update public.organization_members set status='inactive',updated_at=now() where id=target_member.id returning id into member_id;
    audit_action:='invite_cancelled';
  else
    insert into public.organization_members(organization_id,user_id,role_id,status,invited_by)
    values(actor_member.organization_id,target_user_id,target_role_id,'invited',actor_user_id)
    on conflict(organization_id,user_id) do update set role_id=excluded.role_id,status='invited',invited_by=actor_user_id,updated_at=now()
    returning id into member_id;
    audit_action:=case when target_action='resend' then 'invite_resent' else 'user_invited' end;
  end if;
  insert into public.audit_logs(organization_id,user_id,action,entity_type,entity_id,module,new_values,metadata)
  values(actor_member.organization_id,actor_user_id,audit_action,'organization_member',member_id,'users',jsonb_build_object('role',requested_role.slug,'status',case when target_action='cancel' then 'inactive' else 'invited' end),jsonb_build_object('target_user_id',target_user_id));
  return member_id;
end $$;
revoke all on function public.manage_member_invitation(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.manage_member_invitation(uuid,uuid,uuid,text) to service_role;

create or replace function public.accept_own_invitation() returns void language plpgsql security definer set search_path=public as $$
declare member_id uuid;
begin
 update public.organization_members set status='active',joined_at=coalesce(joined_at,now()),updated_at=now()
 where user_id=auth.uid() and status='invited' returning id into member_id;
 if member_id is not null then perform public.write_audit_log('user_activated','organization_member',member_id,'users'); end if;
end $$;
revoke all on function public.accept_own_invitation() from public,anon;grant execute on function public.accept_own_invitation() to authenticated;

-- Common user-management flow can never assign Owner; Admin promotion is Owner-only.
create or replace function public.change_member_role(target_member_id uuid,target_role_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare target public.organization_members; actor_role text; old_role public.roles; new_role public.roles;
begin
 if not public.has_permission('users.manage') then raise exception 'access_denied';end if;
 select r.slug into actor_role from public.organization_members m join public.roles r on r.id=m.role_id where m.user_id=auth.uid() and m.status='active' order by m.joined_at nulls last limit 1;
 select * into target from public.organization_members where id=target_member_id and organization_id=public.current_organization_id() for update;
 if not found or target.user_id=auth.uid() then raise exception 'self_role_change_denied';end if;
 select * into old_role from public.roles where id=target.role_id;
 select * into new_role from public.roles where id=target_role_id and slug<>'owner' and (organization_id is null or organization_id=target.organization_id);
 if new_role.id is null then raise exception 'invalid_role';end if;
 if new_role.slug='admin' and actor_role<>'owner' then raise exception 'owner_required_for_admin_promotion';end if;
 update public.organization_members set role_id=target_role_id,updated_at=now() where id=target.id;
 perform public.write_audit_log('user_role_changed','organization_member',target.id,'users',jsonb_build_object('role',old_role.slug),jsonb_build_object('role',new_role.slug));
end $$;
revoke all on function public.change_member_role(uuid,uuid) from public,anon;grant execute on function public.change_member_role(uuid,uuid) to authenticated;

create or replace function public.change_member_status(target_member_id uuid,target_status text) returns void language plpgsql security definer set search_path=public as $$
declare target public.organization_members; target_role public.roles; action_name text;
begin
 if not public.has_permission('users.manage') or target_status not in('active','suspended','inactive') then raise exception 'access_denied';end if;
 select * into target from public.organization_members where id=target_member_id and organization_id=public.current_organization_id() for update;
 if not found or target.user_id=auth.uid() then raise exception 'self_status_change_denied';end if;
 select * into target_role from public.roles where id=target.role_id;
 if target_role.slug='owner' then raise exception 'owner_access_protected';end if;
 update public.organization_members set status=target_status,joined_at=case when target_status='active' then coalesce(joined_at,now()) else joined_at end,updated_at=now() where id=target.id;
 action_name:=case target_status when 'suspended' then 'user_suspended' when 'active' then 'user_reactivated' else 'user_deactivated' end;
 perform public.write_audit_log(action_name,'organization_member',target.id,'users',jsonb_build_object('status',target.status),jsonb_build_object('status',target_status));
end $$;
revoke all on function public.change_member_status(uuid,text) from public,anon;grant execute on function public.change_member_status(uuid,text) to authenticated;

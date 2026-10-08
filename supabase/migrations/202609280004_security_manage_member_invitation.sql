-- =========================================================
-- SECURITY: vincular manage_member_invitation ao tenant
-- explicitamente autorizado pela Edge Function
-- =========================================================

drop function if exists public.manage_member_invitation(
  uuid,
  uuid,
  uuid,
  text
);

create or replace function public.manage_member_invitation(
  actor_user_id uuid,
  actor_organization_id uuid,
  target_user_id uuid,
  target_role_id uuid,
  target_action text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  actor_member public.organization_members;
  requested_role public.roles;
  target_member public.organization_members;
  member_id uuid;
  audit_action text;
begin
  if target_action not in ('invite', 'resend', 'cancel') then
    raise exception 'invalid_invitation_action';
  end if;

  select m.*
  into actor_member
  from public.organization_members m
  where m.user_id = actor_user_id
    and m.organization_id = actor_organization_id
    and m.status = 'active'
    and exists (
      select 1
      from public.role_permissions rp
      join public.permissions p
        on p.id = rp.permission_id
      where rp.role_id = m.role_id
        and p.key = 'users.manage'
    )
  limit 1;

  if actor_member.id is null then
    raise exception 'access_denied';
  end if;

  select *
  into requested_role
  from public.roles
  where id = target_role_id
    and slug <> 'owner'
    and (
      organization_id is null
      or organization_id = actor_member.organization_id
    );

  if requested_role.id is null then
    raise exception 'invalid_role';
  end if;

  select *
  into target_member
  from public.organization_members
  where organization_id = actor_member.organization_id
    and user_id = target_user_id
  for update;

  if target_member.status = 'active' then
    raise exception 'member_already_active';
  end if;

  if target_action = 'cancel' then
    if target_member.id is null
       or target_member.status <> 'invited' then
      raise exception 'invitation_not_pending';
    end if;

    update public.organization_members
    set
      status = 'inactive',
      updated_at = now()
    where id = target_member.id
    returning id into member_id;

    audit_action := 'invite_cancelled';
  else
    insert into public.organization_members (
      organization_id,
      user_id,
      role_id,
      status,
      invited_by
    )
    values (
      actor_member.organization_id,
      target_user_id,
      target_role_id,
      'invited',
      actor_user_id
    )
    on conflict (organization_id, user_id)
    do update set
      role_id = excluded.role_id,
      status = 'invited',
      invited_by = actor_user_id,
      updated_at = now()
    returning id into member_id;

    audit_action :=
      case
        when target_action = 'resend'
          then 'invite_resent'
        else 'user_invited'
      end;
  end if;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    entity_type,
    entity_id,
    module,
    new_values,
    metadata
  )
  values (
    actor_member.organization_id,
    actor_user_id,
    audit_action,
    'organization_member',
    member_id,
    'users',
    jsonb_build_object(
      'role',
      requested_role.slug,
      'status',
      case
        when target_action = 'cancel'
          then 'inactive'
        else 'invited'
      end
    ),
    jsonb_build_object(
      'target_user_id',
      target_user_id
    )
  );

  return member_id;
end;
$function$;

revoke all
on function public.manage_member_invitation(
  uuid,
  uuid,
  uuid,
  uuid,
  text
)
from public, anon, authenticated;

grant execute
on function public.manage_member_invitation(
  uuid,
  uuid,
  uuid,
  uuid,
  text
)
to service_role;

notify pgrst, 'reload schema';

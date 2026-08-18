-- Real-auth rollout: principal owner, immutable owner access and useful sign-in metadata.
insert into public.roles(name,slug,is_system)
select 'Administrador Principal','owner',true
where not exists(select 1 from public.roles where organization_id is null and slug='owner');
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.slug='owner' on conflict do nothing;

-- Preserve every member and promote one existing active administrator per organization.
with candidates as (
 select distinct on(m.organization_id) m.id
 from public.organization_members m join public.roles r on r.id=m.role_id
 where m.status='active' and r.slug='admin'
 and not exists(select 1 from public.organization_members om join public.roles orole on orole.id=om.role_id where om.organization_id=m.organization_id and om.status='active' and orole.slug='owner')
 order by m.organization_id,m.joined_at nulls last,m.created_at,m.id
)
update public.organization_members m set role_id=(select id from public.roles where organization_id is null and slug='owner'),updated_at=now()
from candidates c where m.id=c.id;

create or replace function public.governance_snapshot(audit_limit integer default 50,audit_offset integer default 0) returns jsonb language plpgsql security definer set search_path=public as $$
declare org_id uuid:=public.current_organization_id(); result jsonb;
begin
 if org_id is null or not public.has_permission('settings.view') then raise exception 'access_denied';end if;
 select jsonb_build_object(
 'organization',jsonb_build_object('id',o.id,'name',o.name,'timezone',o.timezone,'currency',o.currency,'locale',o.locale),
 'members',case when public.has_permission('users.view') then (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'userId',m.user_id,'name',p.name,'email',p.email,'roleId',r.id,'roleName',r.name,'roleSlug',r.slug,'status',m.status,'joinedAt',m.joined_at,'lastSignInAt',u.last_sign_in_at,'createdAt',m.created_at) order by p.name),'[]') from public.organization_members m join public.profiles p on p.id=m.user_id join public.roles r on r.id=m.role_id left join auth.users u on u.id=m.user_id where m.organization_id=org_id) else '[]'::jsonb end,
 'roles',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'slug',r.slug,'permissions',(select coalesce(jsonb_agg(pe.key order by pe.key),'[]') from public.role_permissions rp join public.permissions pe on pe.id=rp.permission_id where rp.role_id=r.id)) order by case when r.slug='owner' then 0 else 1 end,r.name),'[]') from public.roles r where r.organization_id is null or r.organization_id=org_id),
 'audits',case when public.has_permission('audit.view') then (select coalesce(jsonb_agg(row_data order by created_at desc),'[]') from (select a.created_at,jsonb_build_object('id',a.id,'userId',a.user_id,'userName',p.name,'action',a.action,'entityType',a.entity_type,'entityId',a.entity_id,'module',a.module,'oldValues',a.old_values,'newValues',a.new_values,'metadata',a.metadata,'createdAt',a.created_at) row_data from public.audit_logs a left join public.profiles p on p.id=a.user_id where a.organization_id=org_id order by a.created_at desc limit least(greatest(audit_limit,1),100) offset greatest(audit_offset,0)) q) else '[]'::jsonb end) into result from public.organizations o where o.id=org_id;
 return result;
end $$;
revoke all on function public.governance_snapshot(integer,integer) from public,anon;grant execute on function public.governance_snapshot(integer,integer) to authenticated;

create or replace function public.prevent_owner_membership_change() returns trigger language plpgsql security definer set search_path=public as $$
declare old_slug text; new_slug text;
begin
 select slug into old_slug from public.roles where id=old.role_id;
 select slug into new_slug from public.roles where id=new.role_id;
 if old_slug='owner' and (new_slug<>'owner' or new.status<>'active') then raise exception 'owner_access_protected';end if;
 return new;
end $$;
drop trigger if exists protect_owner_membership on public.organization_members;
create trigger protect_owner_membership before update of role_id,status on public.organization_members for each row execute function public.prevent_owner_membership_change();
revoke all on function public.prevent_owner_membership_change() from public,anon,authenticated;

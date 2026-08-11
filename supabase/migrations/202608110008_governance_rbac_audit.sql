-- Additive RBAC and audit foundation. Existing profiles and business ownership are preserved.
alter table public.organizations add column if not exists timezone text not null default 'America/Sao_Paulo', add column if not exists currency char(3) not null default 'BRL', add column if not exists locale text not null default 'pt-BR';

create table if not exists public.permissions(
  id uuid primary key default gen_random_uuid(), key text not null unique, name text not null,
  description text not null, module text not null, created_at timestamptz not null default now()
);
create table if not exists public.roles(
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
  name text not null, slug text not null, is_system boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique nulls not distinct(organization_id, slug)
);
create table if not exists public.role_permissions(
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key(role_id, permission_id)
);
create table if not exists public.organization_members(
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.profiles(id), role_id uuid not null references public.roles(id),
  status text not null default 'active' check(status in('invited','active','suspended','inactive')),
  joined_at timestamptz, invited_by uuid references public.profiles(id), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(organization_id,user_id)
);
create table if not exists public.audit_logs(
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  user_id uuid references public.profiles(id), action text not null, entity_type text not null, entity_id uuid,
  module text not null, old_values jsonb not null default '{}', new_values jsonb not null default '{}',
  metadata jsonb not null default '{}', ip_address inet, user_agent text, created_at timestamptz not null default now()
);
create index if not exists organization_members_user_status_idx on public.organization_members(user_id,status);
create index if not exists audit_logs_org_created_idx on public.audit_logs(organization_id,created_at desc);
create index if not exists audit_logs_org_module_action_idx on public.audit_logs(organization_id,module,action,created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(organization_id,entity_type,entity_id);

insert into public.permissions(key,name,description,module) values
('dashboard.view','Visualizar dashboard','Acessar a visão executiva','dashboard'),('crm.view','Visualizar CRM','Consultar dados comerciais','crm'),('crm.manage','Gerenciar CRM','Criar e editar registros comerciais','crm'),('crm.opportunity.move','Mover oportunidades','Alterar etapas do pipeline','crm'),('crm.opportunity.close','Fechar oportunidades','Marcar oportunidades como ganhas ou perdidas','crm'),('crm.settings.manage','Configurar CRM','Gerenciar pipeline e parâmetros comerciais','crm'),('agenda.view','Visualizar agenda','Consultar agenda operacional','agenda'),('customers.view','Visualizar clientes','Consultar customer success','customers'),('customers.manage','Gerenciar clientes','Alterar serviços, contratos e onboarding','customers'),('finance.view','Visualizar financeiro','Consultar informações financeiras','finance'),('finance.manage','Gerenciar financeiro','Gerenciar contas a receber e pagar','finance'),('finance.transactions.reverse','Estornar transações','Executar estornos financeiros','finance'),('finance.settings.manage','Configurar financeiro','Gerenciar contas, categorias e centros de custo','finance'),('marketing.view','Visualizar marketing','Consultar analytics de marketing','marketing'),('marketing.manage','Gerenciar marketing','Gerenciar origens, campanhas e investimento','marketing'),('reports.view','Visualizar relatórios','Acessar relatórios gerenciais','reports'),('settings.view','Visualizar configurações','Acessar configurações permitidas','settings'),('settings.manage','Gerenciar organização','Alterar configurações institucionais','settings'),('users.view','Visualizar usuários','Consultar membros da organização','users'),('users.manage','Gerenciar usuários','Alterar acesso e papel de membros','users'),('roles.manage','Gerenciar papéis','Alterar papéis e permissões','roles'),('audit.view','Visualizar auditoria','Consultar logs de auditoria','audit')
on conflict(key) do update set name=excluded.name,description=excluded.description,module=excluded.module;

insert into public.roles(name,slug,is_system) values ('Administrador','admin',true),('Gestor','manager',true),('Comercial','sales',true),('Operacional','operations',true),('Financeiro','financial',true),('Marketing','marketing',true),('Leitura','reader',true) on conflict(organization_id,slug) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where r.slug='admin' on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on
 (r.slug='manager' and p.key=any(array['dashboard.view','crm.view','crm.manage','crm.opportunity.move','crm.opportunity.close','agenda.view','customers.view','customers.manage','reports.view','settings.view','users.view'])) or
 (r.slug='sales' and p.key=any(array['dashboard.view','crm.view','crm.manage','crm.opportunity.move','crm.opportunity.close','agenda.view','customers.view'])) or
 (r.slug='operations' and p.key=any(array['dashboard.view','crm.view','agenda.view','customers.view','customers.manage'])) or
 (r.slug='financial' and p.key=any(array['dashboard.view','finance.view','finance.manage','finance.transactions.reverse','finance.settings.manage','reports.view'])) or
 (r.slug='marketing' and p.key=any(array['dashboard.view','marketing.view','marketing.manage','crm.view','reports.view'])) or
 (r.slug='reader' and p.key=any(array['dashboard.view','crm.view','agenda.view','customers.view','reports.view']))
on conflict do nothing;

insert into public.organization_members(organization_id,user_id,role_id,status,joined_at)
select p.organization_id,p.id,r.id,'active',p.created_at from public.profiles p join public.roles r on r.organization_id is null and r.slug=case p.role::text when 'admin' then 'admin' when 'manager' then 'manager' when 'sales' then 'sales' when 'financial' then 'financial' else 'reader' end
on conflict(organization_id,user_id) do nothing;

create or replace function public.current_organization_id() returns uuid language sql stable security definer set search_path=public as $$
  select organization_id from public.organization_members where user_id=auth.uid() and status='active' order by joined_at nulls last,created_at limit 1
$$;
create or replace function public.has_permission(required_permission text) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.organization_members m join public.role_permissions rp on rp.role_id=m.role_id join public.permissions p on p.id=rp.permission_id where m.user_id=auth.uid() and m.status='active' and p.key=required_permission)
$$;
revoke all on function public.current_organization_id() from public,anon; grant execute on function public.current_organization_id() to authenticated;
revoke all on function public.has_permission(text) from public,anon; grant execute on function public.has_permission(text) to authenticated;

alter table public.permissions enable row level security; alter table public.roles enable row level security; alter table public.role_permissions enable row level security; alter table public.organization_members enable row level security; alter table public.audit_logs enable row level security;
create policy permissions_active_read on public.permissions for select to authenticated using(public.current_organization_id() is not null);
create policy roles_active_read on public.roles for select to authenticated using(public.current_organization_id() is not null and (organization_id is null or organization_id=public.current_organization_id()));
create policy role_permissions_active_read on public.role_permissions for select to authenticated using(exists(select 1 from public.roles r where r.id=role_id and (r.organization_id is null or r.organization_id=public.current_organization_id())));
create policy members_read on public.organization_members for select to authenticated using(organization_id=public.current_organization_id() and (user_id=auth.uid() or public.has_permission('users.view')));
create policy audit_read on public.audit_logs for select to authenticated using(organization_id=public.current_organization_id() and public.has_permission('audit.view'));

create or replace function public.write_audit_log(target_action text,target_entity_type text,target_entity_id uuid,target_module text,previous_values jsonb default '{}',next_values jsonb default '{}',context_metadata jsonb default '{}') returns uuid language plpgsql security definer set search_path=public as $$
declare log_id uuid; org_id uuid:=public.current_organization_id(); sensitive text[]:=array['password','token','access_token','refresh_token','secret','service_role_key','cvv']; key text;
begin
  if org_id is null then raise exception 'access_denied'; end if;
  foreach key in array sensitive loop previous_values:=previous_values-key;next_values:=next_values-key;context_metadata:=context_metadata-key;end loop;
  insert into public.audit_logs(organization_id,user_id,action,entity_type,entity_id,module,old_values,new_values,metadata) values(org_id,auth.uid(),target_action,target_entity_type,target_entity_id,target_module,coalesce(previous_values,'{}'),coalesce(next_values,'{}'),coalesce(context_metadata,'{}')) returning id into log_id;
  return log_id;
end $$;
revoke all on function public.write_audit_log(text,text,uuid,text,jsonb,jsonb,jsonb) from public,anon,authenticated;

create or replace function public.current_authorization() returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object('organization_id',o.id,'organization_name',o.name,'role',r.slug,'status',m.status,'permissions',coalesce(jsonb_agg(p.key order by p.key) filter(where p.key is not null),'[]')) from public.organization_members m join public.organizations o on o.id=m.organization_id join public.roles r on r.id=m.role_id left join public.role_permissions rp on rp.role_id=r.id left join public.permissions p on p.id=rp.permission_id where m.user_id=auth.uid() group by o.id,o.name,r.slug,m.status order by (m.status='active') desc limit 1
$$;
revoke all on function public.current_authorization() from public,anon;grant execute on function public.current_authorization() to authenticated;
create or replace function public.accept_own_invitation() returns void language plpgsql security definer set search_path=public as $$ declare member_id uuid;begin update public.organization_members set status='active',joined_at=coalesce(joined_at,now()),updated_at=now() where user_id=auth.uid() and status='invited' returning id into member_id;if member_id is not null then perform public.write_audit_log('invitation_accepted','organization_member',member_id,'users');end if;end $$;
revoke all on function public.accept_own_invitation() from public,anon;grant execute on function public.accept_own_invitation() to authenticated;

create or replace function public.governance_snapshot(audit_limit integer default 50,audit_offset integer default 0) returns jsonb language plpgsql security definer set search_path=public as $$
declare org_id uuid:=public.current_organization_id(); result jsonb;
begin
 if org_id is null or not public.has_permission('settings.view') then raise exception 'access_denied';end if;
 select jsonb_build_object(
 'organization',jsonb_build_object('id',o.id,'name',o.name,'timezone',o.timezone,'currency',o.currency,'locale',o.locale),
 'members',case when public.has_permission('users.view') then (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'userId',m.user_id,'name',p.name,'email',p.email,'roleId',r.id,'roleName',r.name,'roleSlug',r.slug,'status',m.status,'joinedAt',m.joined_at,'createdAt',m.created_at) order by p.name),'[]') from public.organization_members m join public.profiles p on p.id=m.user_id join public.roles r on r.id=m.role_id where m.organization_id=org_id) else '[]'::jsonb end,
 'roles',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'slug',r.slug,'permissions',(select coalesce(jsonb_agg(pe.key order by pe.key),'[]') from public.role_permissions rp join public.permissions pe on pe.id=rp.permission_id where rp.role_id=r.id)) order by r.name),'[]') from public.roles r where r.organization_id is null or r.organization_id=org_id),
 'audits',case when public.has_permission('audit.view') then (select coalesce(jsonb_agg(row_data order by created_at desc),'[]') from (select a.created_at,jsonb_build_object('id',a.id,'userId',a.user_id,'userName',p.name,'action',a.action,'entityType',a.entity_type,'entityId',a.entity_id,'module',a.module,'oldValues',a.old_values,'newValues',a.new_values,'metadata',a.metadata,'createdAt',a.created_at) row_data from public.audit_logs a left join public.profiles p on p.id=a.user_id where a.organization_id=org_id order by a.created_at desc limit least(greatest(audit_limit,1),100) offset greatest(audit_offset,0)) q) else '[]'::jsonb end) into result from public.organizations o where o.id=org_id;
 return result;
end $$;
revoke all on function public.governance_snapshot(integer,integer) from public,anon;grant execute on function public.governance_snapshot(integer,integer) to authenticated;

create or replace function public.change_member_role(target_member_id uuid,target_role_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare target public.organization_members; old_role public.roles; new_role public.roles; active_admins integer;
begin
 if not public.has_permission('users.manage') then raise exception 'access_denied';end if;
 select * into target from public.organization_members where id=target_member_id and organization_id=public.current_organization_id() for update;
 if not found or target.user_id=auth.uid() then raise exception 'self_role_change_denied';end if;
 select * into old_role from public.roles where id=target.role_id;select * into new_role from public.roles where id=target_role_id and (organization_id is null or organization_id=target.organization_id);
 if new_role.id is null then raise exception 'invalid_role';end if;
 if old_role.slug='admin' and new_role.slug<>'admin' then select count(*) into active_admins from public.organization_members m join public.roles r on r.id=m.role_id where m.organization_id=target.organization_id and m.status='active' and r.slug='admin';if active_admins<=1 then raise exception 'last_admin_required';end if;end if;
 update public.organization_members set role_id=target_role_id,updated_at=now() where id=target.id;
 perform public.write_audit_log('role_changed','organization_member',target.id,'users',jsonb_build_object('role',old_role.slug),jsonb_build_object('role',new_role.slug));
end $$;
create or replace function public.change_member_status(target_member_id uuid,target_status text) returns void language plpgsql security definer set search_path=public as $$
declare target public.organization_members; target_role public.roles; active_admins integer;
begin
 if not public.has_permission('users.manage') or target_status not in('active','suspended','inactive') then raise exception 'access_denied';end if;
 select * into target from public.organization_members where id=target_member_id and organization_id=public.current_organization_id() for update;if not found or target.user_id=auth.uid() then raise exception 'self_status_change_denied';end if;
 select * into target_role from public.roles where id=target.role_id;
 if target.status='active' and target_status<>'active' and target_role.slug='admin' then select count(*) into active_admins from public.organization_members m join public.roles r on r.id=m.role_id where m.organization_id=target.organization_id and m.status='active' and r.slug='admin';if active_admins<=1 then raise exception 'last_admin_required';end if;end if;
 update public.organization_members set status=target_status,joined_at=case when target_status='active' then coalesce(joined_at,now()) else joined_at end,updated_at=now() where id=target.id;
 perform public.write_audit_log(case when target_status='suspended' then 'user_suspended' else 'user_status_changed' end,'organization_member',target.id,'users',jsonb_build_object('status',target.status),jsonb_build_object('status',target_status));
end $$;
create or replace function public.update_organization_settings(settings_data jsonb) returns void language plpgsql security definer set search_path=public as $$
declare org public.organizations;
begin
 if not public.has_permission('settings.manage') then raise exception 'access_denied';end if;select * into org from public.organizations where id=public.current_organization_id() for update;
 update public.organizations set name=coalesce(nullif(settings_data->>'name',''),name),timezone=coalesce(nullif(settings_data->>'timezone',''),timezone),currency=coalesce(nullif(settings_data->>'currency',''),currency),locale=coalesce(nullif(settings_data->>'locale',''),locale),updated_at=now() where id=org.id;
 perform public.write_audit_log('settings_updated','organization',org.id,'settings',jsonb_build_object('name',org.name,'timezone',org.timezone,'currency',org.currency,'locale',org.locale),settings_data);
end $$;
revoke all on function public.change_member_role(uuid,uuid) from public,anon;grant execute on function public.change_member_role(uuid,uuid) to authenticated;
revoke all on function public.change_member_status(uuid,text) from public,anon;grant execute on function public.change_member_status(uuid,text) to authenticated;
revoke all on function public.update_organization_settings(jsonb) from public,anon;grant execute on function public.update_organization_settings(jsonb) to authenticated;
create or replace function public.write_invitation_audit(invited_user_id uuid,invited_role_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin if not public.has_permission('users.manage') then raise exception 'access_denied';end if;perform public.write_audit_log('user_invited','organization_member',null,'users','{}',jsonb_build_object('user_id',invited_user_id,'role_id',invited_role_id));end $$;
revoke all on function public.write_invitation_audit(uuid,uuid) from public,anon;grant execute on function public.write_invitation_audit(uuid,uuid) to authenticated;

-- Finance is protected in the database, not only hidden in navigation.
do $$ declare n text;begin foreach n in array array['financial_accounts','financial_categories','cost_centers','recurrence_rules','receivables','payables','financial_transactions','payment_allocations'] loop execute format('drop policy if exists organization_isolation on public.%I',n);execute format('create policy finance_read on public.%I for select to authenticated using(organization_id=public.current_organization_id() and public.has_permission(''finance.view''))',n);execute format('create policy finance_manage on public.%I for all to authenticated using(organization_id=public.current_organization_id() and public.has_permission(''finance.manage'')) with check(organization_id=public.current_organization_id() and public.has_permission(''finance.manage''))',n);end loop;end $$;
-- Reverse remains a separate privilege even for users who can manage entries.
create or replace function public.assert_financial_reversal_permission() returns trigger language plpgsql set search_path=public as $$ begin if new.reversed_at is distinct from old.reversed_at and not public.has_permission('finance.transactions.reverse') then raise exception 'access_denied';end if;return new;end $$;
drop trigger if exists financial_reversal_permission on public.financial_transactions;create trigger financial_reversal_permission before update of reversed_at on public.financial_transactions for each row execute function public.assert_financial_reversal_permission();

create or replace function public.reverse_financial_transaction(target_transaction_id uuid) returns void language plpgsql security invoker set search_path=public as $$
declare tx public.financial_transactions;alloc public.payment_allocations;
begin
 if not public.has_permission('finance.transactions.reverse') then raise exception 'access_denied';end if;
 select * into tx from public.financial_transactions where id=target_transaction_id and organization_id=public.current_organization_id() for update;if tx.id is null or tx.reversed_at is not null then raise exception 'transaction_not_reversible';end if;
 update public.financial_transactions set reversed_at=now(),reversed_by=auth.uid() where id=tx.id;
 for alloc in select * from public.payment_allocations where transaction_id=tx.id loop if alloc.receivable_id is not null then update public.receivables set status=case when exists(select 1 from public.payment_allocations pa join public.financial_transactions ft on ft.id=pa.transaction_id where pa.receivable_id=alloc.receivable_id and ft.id<>tx.id and ft.reversed_at is null) then 'partially_paid' else 'pending' end where id=alloc.receivable_id;else update public.payables set status=case when exists(select 1 from public.payment_allocations pa join public.financial_transactions ft on ft.id=pa.transaction_id where pa.payable_id=alloc.payable_id and ft.id<>tx.id and ft.reversed_at is null) then 'partially_paid' else 'pending' end where id=alloc.payable_id;end if;end loop;
 perform public.write_audit_log('payment_reversed','financial_transaction',tx.id,'finance',jsonb_build_object('reversed_at',tx.reversed_at,'amount',tx.amount),jsonb_build_object('reversed_at',now(),'amount',tx.amount));
end $$;

do $$ declare n text;begin foreach n in array array['marketing_sources','marketing_campaigns','marketing_ad_groups','marketing_ads','lead_acquisitions','marketing_spend','marketing_connections'] loop execute format('drop policy if exists organization_isolation on public.%I',n);execute format('create policy marketing_read on public.%I for select to authenticated using(organization_id=public.current_organization_id() and public.has_permission(''marketing.view''))',n);execute format('create policy marketing_manage on public.%I for all to authenticated using(organization_id=public.current_organization_id() and public.has_permission(''marketing.manage'')) with check(organization_id=public.current_organization_id() and public.has_permission(''marketing.manage''))',n);end loop;end $$;

-- New public signups are not administrators. An admin invitation backend must activate membership explicitly.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ declare org_id uuid;reader_role uuid;begin select id into org_id from public.organizations where slug='esads-beauty';insert into public.profiles(id,organization_id,name,email,role) values(new.id,org_id,coalesce(new.raw_user_meta_data->>'name',split_part(coalesce(new.email,''),'@',1)),coalesce(new.email,''),'member');select id into reader_role from public.roles where organization_id is null and slug='reader';insert into public.organization_members(organization_id,user_id,role_id,status) values(org_id,new.id,reader_role,'inactive');return new;end $$;

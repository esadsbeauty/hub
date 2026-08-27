-- Phase 1 SaaS hardening: explicit active tenant, tenant-scoped RBAC and relational guards.
create table public.user_active_organizations(
  user_id uuid primary key references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  updated_at timestamptz not null default now(),
  foreign key(organization_id,user_id) references public.organization_members(organization_id,user_id) on delete cascade
);
alter table public.user_active_organizations enable row level security;
create policy active_organization_own_read on public.user_active_organizations for select to authenticated using(user_id=auth.uid());

-- Existing installations use profiles.organization_id as their explicit legacy tenant.
insert into public.user_active_organizations(user_id,organization_id)
select p.id,p.organization_id from public.profiles p join public.organization_members m on m.user_id=p.id and m.organization_id=p.organization_id and m.status='active'
on conflict(user_id) do update set organization_id=excluded.organization_id,updated_at=now();

create or replace function public.current_organization_id() returns uuid language sql stable security definer set search_path=public as $$
 select a.organization_id from public.user_active_organizations a join public.organization_members m on m.organization_id=a.organization_id and m.user_id=a.user_id and m.status='active' where a.user_id=auth.uid()
$$;
create or replace function public.has_permission(required_permission text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organization_members m join public.role_permissions rp on rp.role_id=m.role_id join public.permissions p on p.id=rp.permission_id where m.user_id=auth.uid() and m.organization_id=public.current_organization_id() and m.status='active' and p.key=required_permission)
$$;
create or replace function public.set_active_organization(target_organization_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.organization_members where user_id=auth.uid() and organization_id=target_organization_id and status='active') then raise exception 'active_membership_required' using errcode='42501';end if;
 insert into public.user_active_organizations(user_id,organization_id)values(auth.uid(),target_organization_id) on conflict(user_id)do update set organization_id=excluded.organization_id,updated_at=now();
end$$;
create or replace function public.current_authorization() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('organization_id',o.id,'organization_name',o.name,'role',r.slug,'status',m.status,'permissions',coalesce(jsonb_agg(p.key order by p.key)filter(where p.key is not null),'[]')) from public.organization_members m join public.organizations o on o.id=m.organization_id join public.roles r on r.id=m.role_id left join public.role_permissions rp on rp.role_id=r.id left join public.permissions p on p.id=rp.permission_id where m.user_id=auth.uid() and m.organization_id=public.current_organization_id() and m.status='active' group by o.id,o.name,r.slug,m.status
$$;
revoke all on function public.current_organization_id() from public,anon;grant execute on function public.current_organization_id()to authenticated,service_role;
revoke all on function public.has_permission(text)from public,anon;grant execute on function public.has_permission(text)to authenticated,service_role;
revoke all on function public.set_active_organization(uuid)from public,anon;grant execute on function public.set_active_organization(uuid)to authenticated;
revoke all on function public.current_authorization()from public,anon;grant execute on function public.current_authorization()to authenticated;

-- Automatically establish context only when there is exactly one active membership.
create or replace function public.sync_unambiguous_active_organization()returns trigger language plpgsql security definer set search_path=public as $$
declare active_count integer;only_org uuid;
begin
 select count(*)into active_count from public.organization_members where user_id=new.user_id and status='active';
 if active_count=1 then select organization_id into only_org from public.organization_members where user_id=new.user_id and status='active';insert into public.user_active_organizations(user_id,organization_id)values(new.user_id,only_org)on conflict(user_id)do update set organization_id=excluded.organization_id,updated_at=now();
 elsif active_count=0 then delete from public.user_active_organizations where user_id=new.user_id;
 elsif not exists(select 1 from public.user_active_organizations a join public.organization_members m on m.user_id=a.user_id and m.organization_id=a.organization_id and m.status='active' where a.user_id=new.user_id)then delete from public.user_active_organizations where user_id=new.user_id;end if;
 return new;
end$$;
drop trigger if exists sync_unambiguous_active_organization on public.organization_members;
create trigger sync_unambiguous_active_organization after insert or update of status on public.organization_members for each row execute function public.sync_unambiguous_active_organization();
revoke all on function public.sync_unambiguous_active_organization()from public,anon,authenticated;

-- Agenda gets an explicit write permission.
insert into public.permissions(key,name,description,module)values('agenda.manage','Gerenciar agenda','Criar, reagendar, concluir e cancelar compromissos','agenda')on conflict(key)do update set name=excluded.name,description=excluded.description,module=excluded.module;
insert into public.role_permissions(role_id,permission_id)select r.id,p.id from public.roles r join public.permissions p on p.key='agenda.manage' where r.slug in('owner','admin','manager','sales','operations')on conflict do nothing;

-- Replace broad tenant-only policies with operation-specific RBAC.
drop policy if exists profiles_member on public.profiles;
create policy profiles_tenant_read on public.profiles for select to authenticated using(id=auth.uid() or exists(select 1 from public.organization_members m where m.user_id=profiles.id and m.organization_id=public.current_organization_id() and m.status='active'));
drop policy if exists companies_member on public.companies;drop policy if exists contacts_member on public.contacts;drop policy if exists pipelines_member on public.pipelines;drop policy if exists stages_member on public.pipeline_stages;drop policy if exists opportunities_member on public.opportunities;drop policy if exists activities_member on public.activities;drop policy if exists tasks_member on public.tasks;drop policy if exists notes_member on public.notes;drop policy if exists opportunity_stage_history_member on public.opportunity_stage_history;
create policy companies_read on public.companies for select to authenticated using(organization_id=public.current_organization_id() and public.has_permission('crm.view'));
create policy companies_manage on public.companies for all to authenticated using(organization_id=public.current_organization_id() and public.has_permission('crm.manage'))with check(organization_id=public.current_organization_id() and public.has_permission('crm.manage'));
create policy contacts_read on public.contacts for select to authenticated using(organization_id=public.current_organization_id() and public.has_permission('crm.view'));
create policy contacts_manage on public.contacts for all to authenticated using(organization_id=public.current_organization_id() and public.has_permission('crm.manage'))with check(organization_id=public.current_organization_id() and public.has_permission('crm.manage'));
create policy pipelines_read on public.pipelines for select to authenticated using(organization_id=public.current_organization_id() and public.has_permission('crm.view'));
create policy pipelines_manage on public.pipelines for all to authenticated using(organization_id=public.current_organization_id() and public.has_permission('crm.settings.manage'))with check(organization_id=public.current_organization_id() and public.has_permission('crm.settings.manage'));
create policy stages_read on public.pipeline_stages for select to authenticated using(exists(select 1 from public.pipelines p where p.id=pipeline_id and p.organization_id=public.current_organization_id() and public.has_permission('crm.view')));
create policy stages_manage on public.pipeline_stages for all to authenticated using(exists(select 1 from public.pipelines p where p.id=pipeline_id and p.organization_id=public.current_organization_id() and public.has_permission('crm.settings.manage')))with check(exists(select 1 from public.pipelines p where p.id=pipeline_id and p.organization_id=public.current_organization_id() and public.has_permission('crm.settings.manage')));
create policy opportunities_read on public.opportunities for select to authenticated using(organization_id=public.current_organization_id() and public.has_permission('crm.view'));
create policy opportunities_insert on public.opportunities for insert to authenticated with check(organization_id=public.current_organization_id() and public.has_permission('crm.manage'));
create policy opportunities_update on public.opportunities for update to authenticated using(organization_id=public.current_organization_id() and (public.has_permission('crm.manage')or public.has_permission('crm.opportunity.move')or public.has_permission('crm.opportunity.close')))with check(organization_id=public.current_organization_id());
create policy activities_read on public.activities for select to authenticated using(organization_id=public.current_organization_id() and public.has_permission('crm.view'));
create policy activities_insert on public.activities for insert to authenticated with check(organization_id=public.current_organization_id() and (public.has_permission('crm.manage')or public.has_permission('agenda.manage')));
create policy tasks_read on public.tasks for select to authenticated using(organization_id=public.current_organization_id() and public.has_permission('agenda.view'));
create policy tasks_manage on public.tasks for all to authenticated using(organization_id=public.current_organization_id() and public.has_permission('agenda.manage'))with check(organization_id=public.current_organization_id() and public.has_permission('agenda.manage'));
create policy notes_read on public.notes for select to authenticated using(organization_id=public.current_organization_id() and public.has_permission('crm.view'));
create policy notes_manage on public.notes for all to authenticated using(organization_id=public.current_organization_id() and public.has_permission('crm.manage'))with check(organization_id=public.current_organization_id() and public.has_permission('crm.manage'));
create policy opportunity_history_read on public.opportunity_stage_history for select to authenticated using(organization_id=public.current_organization_id() and public.has_permission('crm.view'));

-- UPDATE policies cannot express column-level transition rules; enforce them in a trigger too.
create or replace function public.authorize_opportunity_update()returns trigger language plpgsql set search_path=public as $$
declare terminal boolean;
begin
 if new.organization_id<>old.organization_id then raise exception 'organization_immutable' using errcode='42501';end if;
 select coalesce(is_won or is_lost,false)into terminal from public.pipeline_stages where id=new.stage_id and pipeline_id=new.pipeline_id;
 if (new.status is distinct from old.status or terminal)and not public.has_permission('crm.opportunity.close')then raise exception 'crm.opportunity.close_required' using errcode='42501';
 elsif (new.stage_id is distinct from old.stage_id or new.pipeline_id is distinct from old.pipeline_id)and not public.has_permission('crm.opportunity.move')then raise exception 'crm.opportunity.move_required' using errcode='42501';
 elsif (to_jsonb(new)-array['stage_id','pipeline_id','status','won_at','lost_at','probability','updated_at'])is distinct from(to_jsonb(old)-array['stage_id','pipeline_id','status','won_at','lost_at','probability','updated_at'])and not public.has_permission('crm.manage')then raise exception 'crm.manage_required' using errcode='42501';end if;
 return new;
end$$;
drop trigger if exists authorize_opportunity_update on public.opportunities;
create trigger authorize_opportunity_update before update on public.opportunities for each row execute function public.authorize_opportunity_update();
revoke all on function public.authorize_opportunity_update()from public,anon,authenticated;

-- Post-sales policies are also split by operation.
do $$declare n text;begin foreach n in array array['customer_accounts','services','customer_services','onboardings','onboarding_steps','contracts']loop execute format('drop policy if exists organization_isolation on public.%I',n);execute format('create policy customers_read on public.%I for select to authenticated using(organization_id=public.current_organization_id() and public.has_permission(''customers.view''))',n);execute format('create policy customers_manage on public.%I for all to authenticated using(organization_id=public.current_organization_id() and public.has_permission(''customers.manage'')) with check(organization_id=public.current_organization_id() and public.has_permission(''customers.manage''))',n);end loop;end$$;
drop policy if exists organization_isolation on public.contract_services;
create policy contract_services_read on public.contract_services for select to authenticated using(exists(select 1 from public.contracts c where c.id=contract_id and c.organization_id=public.current_organization_id() and public.has_permission('customers.view')));
create policy contract_services_manage on public.contract_services for all to authenticated using(exists(select 1 from public.contracts c where c.id=contract_id and c.organization_id=public.current_organization_id() and public.has_permission('customers.manage')))with check(exists(select 1 from public.contracts c where c.id=contract_id and c.organization_id=public.current_organization_id() and public.has_permission('customers.manage')));

-- The close-won transaction may create post-sales data, but only for the validated active tenant.
create or replace function public.activate_customer_from_won_opportunity(target_opportunity_id uuid,closed_value numeric)returns public.customer_accounts language plpgsql security definer set search_path=public as $$
declare tenant uuid:=public.current_organization_id();o public.opportunities;account public.customer_accounts;won_stage public.pipeline_stages;
begin
 if tenant is null or not public.has_permission('crm.opportunity.close')then raise exception 'access_denied' using errcode='42501';end if;
 if closed_value is null or closed_value<=0 then raise exception 'closed_value_required' using errcode='23514';end if;
 select * into o from public.opportunities where id=target_opportunity_id and organization_id=tenant for update;
 if o.id is null then raise exception 'opportunity_not_found';end if;
 select * into won_stage from public.pipeline_stages where pipeline_id=o.pipeline_id and is_won order by position,id limit 1;
 if won_stage.id is null then raise exception 'won_stage_not_found';end if;
 update public.opportunities set value=round(closed_value,2),stage_id=won_stage.id,probability=100,status='won',won_at=coalesce(won_at,now()),lost_at=null,updated_at=now()where id=o.id and organization_id=tenant returning*into o;
 update public.companies set lifecycle_stage='customer',updated_at=now()where id=o.company_id and organization_id=tenant;
 insert into public.customer_accounts(organization_id,company_id,status,client_since,owner_id,success_owner_id,source_opportunity_id)values(tenant,o.company_id,'onboarding',coalesce(o.won_at,now()),o.owner_id,o.owner_id,o.id)on conflict(organization_id,company_id)do update set status=case when customer_accounts.status in('cancelled','inactive')then'onboarding'else customer_accounts.status end,cancelled_at=null,source_opportunity_id=o.id,updated_at=now()returning*into account;
 insert into public.activities(organization_id,company_id,opportunity_id,user_id,type,title,description,metadata)select tenant,o.company_id,o.id,auth.uid(),'customer_created','Relacionamento de cliente ativado','A venda ganhou continuidade no pós-venda',jsonb_build_object('customer_account_id',account.id,'closed_value',o.value)where not exists(select 1 from public.activities where opportunity_id=o.id and organization_id=tenant and type='customer_created');
 return account;
end$$;
revoke all on function public.activate_customer_from_won_opportunity(uuid,numeric)from public,anon;
grant execute on function public.activate_customer_from_won_opportunity(uuid,numeric)to authenticated;

-- Validate every tenant-owned reference before it can reach privileged triggers.
create or replace function public.assert_reference_tenant(entity_name text,target_id uuid,expected_organization uuid)returns void language plpgsql security definer set search_path=public as $$
declare actual uuid;
begin
 if target_id is null then return;end if;
 if entity_name='pipeline_stages'then select p.organization_id into actual from public.pipeline_stages s join public.pipelines p on p.id=s.pipeline_id where s.id=target_id;
 else execute format('select organization_id from public.%I where id=$1',entity_name)into actual using target_id;end if;
 if actual is null or actual<>expected_organization then raise exception 'cross_tenant_reference:%',entity_name using errcode='23514';end if;
end$$;
create or replace function public.enforce_tenant_relations()returns trigger language plpgsql security definer set search_path=public as $$
declare v jsonb:=to_jsonb(new);org uuid:=(v->>'organization_id')::uuid;t text:=tg_table_name;
begin
 if org is null then raise exception 'organization_required' using errcode='23514';end if;
 if t in('contacts','opportunities','activities','tasks','notes','customer_accounts','receivables','lead_acquisitions')then perform public.assert_reference_tenant('companies',nullif(v->>'company_id','')::uuid,org);end if;
 if t='lead_acquisitions'then perform public.assert_reference_tenant('contacts',nullif(v->>'contact_id','')::uuid,org);perform public.assert_reference_tenant('marketing_sources',nullif(v->>'source_id','')::uuid,org);end if;
 if t in('opportunities','activities','tasks','notes','opportunity_stage_history','customer_accounts','customer_services','onboardings','contracts','receivables','lead_acquisitions')then perform public.assert_reference_tenant('opportunities',nullif(coalesce(v->>'opportunity_id',v->>'source_opportunity_id'),'')::uuid,org);end if;
 if t='opportunities'then perform public.assert_reference_tenant('pipelines',(v->>'pipeline_id')::uuid,org);perform public.assert_reference_tenant('pipeline_stages',(v->>'stage_id')::uuid,org);if not exists(select 1 from public.pipeline_stages where id=(v->>'stage_id')::uuid and pipeline_id=(v->>'pipeline_id')::uuid)then raise exception 'stage_pipeline_mismatch' using errcode='23514';end if;end if;
 if t='opportunity_stage_history'then perform public.assert_reference_tenant('pipeline_stages',nullif(v->>'from_stage_id','')::uuid,org);perform public.assert_reference_tenant('pipeline_stages',(v->>'to_stage_id')::uuid,org);end if;
 if t='customer_services'then perform public.assert_reference_tenant('customer_accounts',(v->>'customer_account_id')::uuid,org);perform public.assert_reference_tenant('services',(v->>'service_id')::uuid,org);end if;
 if t='onboardings'then perform public.assert_reference_tenant('customer_accounts',(v->>'customer_account_id')::uuid,org);perform public.assert_reference_tenant('customer_services',nullif(v->>'customer_service_id','')::uuid,org);end if;
 if t='onboarding_steps'then perform public.assert_reference_tenant('onboardings',(v->>'onboarding_id')::uuid,org);perform public.assert_reference_tenant('tasks',nullif(v->>'task_id','')::uuid,org);end if;
 if t='contracts'then perform public.assert_reference_tenant('customer_accounts',(v->>'customer_account_id')::uuid,org);end if;
 if t in('recurrence_rules','receivables')then perform public.assert_reference_tenant('customer_accounts',nullif(v->>'customer_account_id','')::uuid,org);perform public.assert_reference_tenant('contracts',nullif(v->>'contract_id','')::uuid,org);perform public.assert_reference_tenant('customer_services',nullif(v->>'customer_service_id','')::uuid,org);end if;
 if t='financial_categories'then perform public.assert_reference_tenant('financial_categories',nullif(v->>'parent_id','')::uuid,org);end if;
 if t in('recurrence_rules','receivables','payables')then perform public.assert_reference_tenant('financial_categories',nullif(v->>'category_id','')::uuid,org);perform public.assert_reference_tenant('cost_centers',nullif(v->>'cost_center_id','')::uuid,org);end if;
 if t in('receivables','payables')then perform public.assert_reference_tenant('recurrence_rules',nullif(v->>'recurrence_rule_id','')::uuid,org);end if;
 if t='payables'then perform public.assert_reference_tenant('financial_accounts',nullif(v->>'financial_account_id','')::uuid,org);end if;
 if t='financial_transactions'then perform public.assert_reference_tenant('financial_accounts',(v->>'financial_account_id')::uuid,org);perform public.assert_reference_tenant('financial_transactions',nullif(v->>'reversal_of_id','')::uuid,org);end if;
 if t='payment_allocations'then perform public.assert_reference_tenant('financial_transactions',(v->>'transaction_id')::uuid,org);perform public.assert_reference_tenant('receivables',nullif(v->>'receivable_id','')::uuid,org);perform public.assert_reference_tenant('payables',nullif(v->>'payable_id','')::uuid,org);end if;
 if t in('marketing_campaigns','marketing_spend')then perform public.assert_reference_tenant('marketing_sources',nullif(v->>'source_id','')::uuid,org);end if;
 if t in('marketing_ad_groups','marketing_ads','lead_acquisitions','marketing_spend')then perform public.assert_reference_tenant('marketing_campaigns',nullif(v->>'campaign_id','')::uuid,org);end if;
 if t in('marketing_ads','lead_acquisitions','marketing_spend')then perform public.assert_reference_tenant('marketing_ad_groups',nullif(v->>'ad_group_id','')::uuid,org);end if;
 if t in('lead_acquisitions','marketing_spend')then perform public.assert_reference_tenant('marketing_ads',nullif(v->>'ad_id','')::uuid,org);end if;
 return new;
end$$;
do $$declare n text;begin foreach n in array array['contacts','opportunities','activities','tasks','notes','opportunity_stage_history','customer_accounts','customer_services','onboardings','onboarding_steps','contracts','financial_categories','recurrence_rules','receivables','payables','financial_transactions','payment_allocations','marketing_campaigns','marketing_ad_groups','marketing_ads','lead_acquisitions','marketing_spend']loop execute format('drop trigger if exists enforce_tenant_relations on public.%I',n);execute format('create trigger enforce_tenant_relations before insert or update on public.%I for each row execute function public.enforce_tenant_relations()',n);end loop;end$$;
create or replace function public.enforce_contract_service_tenant()returns trigger language plpgsql security definer set search_path=public as $$declare contract_org uuid;service_org uuid;begin select organization_id into contract_org from public.contracts where id=new.contract_id;select organization_id into service_org from public.customer_services where id=new.customer_service_id;if contract_org is null or service_org is null or contract_org<>service_org then raise exception 'cross_tenant_reference:contract_services' using errcode='23514';end if;return new;end$$;
drop trigger if exists enforce_contract_service_tenant on public.contract_services;create trigger enforce_contract_service_tenant before insert or update on public.contract_services for each row execute function public.enforce_contract_service_tenant();

-- Parent writes from privileged triggers must include the originating tenant.
create or replace function public.touch_company_last_interaction()returns trigger language plpgsql security definer set search_path=public as $$begin if new.company_id is not null then update public.companies set last_interaction_at=new.created_at where id=new.company_id and organization_id=new.organization_id;end if;return new;end$$;
create or replace function public.sync_company_lifecycle_from_opportunity()returns trigger language plpgsql security definer set search_path=public as $$begin if new.status='won'and old.status is distinct from'won'then update public.companies set lifecycle_stage='customer'where id=new.company_id and organization_id=new.organization_id and deleted_at is null;end if;return new;end$$;

-- Trigger helpers and tenant-parameterized bootstrap functions are never public RPCs.
revoke all on function public.assert_reference_tenant(text,uuid,uuid)from public,anon,authenticated;
revoke all on function public.enforce_tenant_relations()from public,anon,authenticated;
revoke all on function public.enforce_contract_service_tenant()from public,anon,authenticated;
revoke all on function public.touch_company_last_interaction()from public,anon,authenticated;
revoke all on function public.sync_company_lifecycle_from_opportunity()from public,anon,authenticated;
revoke all on function public.create_default_pipeline(uuid)from public,anon,authenticated;
-- PostgreSQL grants EXECUTE to PUBLIC by default. Remove that implicit grant from every
-- privileged public-schema function while preserving explicit authenticated/anon grants.
do $$declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.prosecdef loop execute format('revoke execute on function %s from public',f.signature);end loop;end$$;
notify pgrst,'reload schema';

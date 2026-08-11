-- Post-sales foundation. Additive and idempotent: no company or CRM data is copied/deleted.
create table if not exists public.customer_accounts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  company_id uuid not null references public.companies(id), status text not null default 'onboarding' check (status in ('onboarding','active','paused','cancelled','inactive')),
  client_since timestamptz not null default now(), owner_id uuid references public.profiles(id), success_owner_id uuid references public.profiles(id),
  source_opportunity_id uuid references public.opportunities(id), cancellation_reason text, cancellation_notes text, cancelled_at timestamptz, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id, company_id)
);
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), name text not null, description text, category text,
  default_price numeric(14,2) check (default_price is null or default_price >= 0), billing_type text not null default 'custom' check (billing_type in ('one_time','recurring','custom')),
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id, name)
);
create table if not exists public.customer_services (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), customer_account_id uuid not null references public.customer_accounts(id),
  service_id uuid not null references public.services(id), source_opportunity_id uuid references public.opportunities(id), status text not null default 'pending' check (status in ('pending','active','paused','completed','cancelled')),
  start_date date, end_date date, agreed_price numeric(14,2) check (agreed_price is null or agreed_price >= 0), billing_type text not null check (billing_type in ('one_time','recurring','custom')),
  billing_interval text not null default 'custom' check (billing_interval in ('monthly','quarterly','yearly','one_time','custom')), owner_id uuid references public.profiles(id), notes text,
  cancelled_at timestamptz, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (end_date is null or start_date is null or end_date >= start_date)
);
create table if not exists public.onboardings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), customer_account_id uuid not null references public.customer_accounts(id),
  customer_service_id uuid references public.customer_services(id), source_opportunity_id uuid references public.opportunities(id), title text not null,
  status text not null default 'not_started' check (status in ('not_started','in_progress','blocked','completed','cancelled')), owner_id uuid references public.profiles(id),
  started_at timestamptz, due_at timestamptz, completed_at timestamptz, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.onboarding_steps (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), onboarding_id uuid not null references public.onboardings(id), task_id uuid unique references public.tasks(id),
  title text not null, description text, position integer not null check (position > 0), status text not null default 'pending' check (status in ('pending','in_progress','completed','blocked','cancelled')),
  assigned_to uuid references public.profiles(id), due_at timestamptz, completed_at timestamptz, blocked_by text check (blocked_by is null or blocked_by in ('internal','client','external')), blocked_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (onboarding_id, position)
);
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), customer_account_id uuid not null references public.customer_accounts(id), source_opportunity_id uuid references public.opportunities(id),
  title text not null, status text not null default 'draft' check (status in ('draft','sent','signed','active','expired','cancelled')), contract_number text not null,
  start_date date not null, end_date date, signed_at timestamptz, value numeric(14,2) check (value is null or value >= 0), billing_type text not null check (billing_type in ('one_time','recurring','custom')),
  billing_interval text not null default 'custom' check (billing_interval in ('monthly','quarterly','yearly','one_time','custom')), auto_renew boolean not null default false, notice_days integer not null default 30 check (notice_days >= 0),
  owner_id uuid references public.profiles(id), notes text, cancelled_at timestamptz, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, contract_number), check (end_date is null or end_date >= start_date)
);
create table if not exists public.contract_services (
  contract_id uuid not null references public.contracts(id) on delete cascade, customer_service_id uuid not null references public.customer_services(id), primary key (contract_id, customer_service_id)
);

create index if not exists customer_accounts_org_status_idx on public.customer_accounts(organization_id,status);
create index if not exists customer_services_account_status_idx on public.customer_services(customer_account_id,status) where deleted_at is null;
create index if not exists customer_services_source_idx on public.customer_services(source_opportunity_id);
create index if not exists onboardings_account_status_idx on public.onboardings(customer_account_id,status) where deleted_at is null;
create index if not exists onboarding_steps_due_idx on public.onboarding_steps(organization_id,due_at) where status not in ('completed','cancelled');
create index if not exists contracts_account_status_idx on public.contracts(customer_account_id,status) where deleted_at is null;
create index if not exists contracts_end_date_idx on public.contracts(organization_id,end_date) where deleted_at is null and status not in ('expired','cancelled');

do $$ declare table_name text; begin
  foreach table_name in array array['customer_accounts','services','customer_services','onboardings','onboarding_steps','contracts'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I',table_name,table_name);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',table_name,table_name);
  end loop;
end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['customer_accounts','services','customer_services','onboardings','onboarding_steps','contracts'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists organization_isolation on public.%I', table_name);
    execute format('create policy organization_isolation on public.%I for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id())', table_name);
  end loop;
end $$;
alter table public.contract_services enable row level security;
drop policy if exists organization_isolation on public.contract_services;
create policy organization_isolation on public.contract_services for all using (exists (select 1 from public.contracts c where c.id=contract_id and c.organization_id=public.current_organization_id())) with check (exists (select 1 from public.contracts c where c.id=contract_id and c.organization_id=public.current_organization_id()));

-- Preserve historical won opportunities by creating one durable relationship per company.
insert into public.customer_accounts (organization_id,company_id,status,client_since,owner_id,success_owner_id,source_opportunity_id)
select distinct on (o.organization_id,o.company_id) o.organization_id,o.company_id,'onboarding',coalesce(o.won_at,o.updated_at),o.owner_id,o.owner_id,o.id
from public.opportunities o where o.status='won' and o.deleted_at is null order by o.organization_id,o.company_id,coalesce(o.won_at,o.updated_at)
on conflict (organization_id,company_id) do nothing;

create or replace function public.activate_customer_from_won_opportunity(target_opportunity_id uuid) returns public.customer_accounts language plpgsql security invoker set search_path=public as $$
declare o public.opportunities; account public.customer_accounts; won_stage public.pipeline_stages;
begin
  select * into o from public.opportunities where id=target_opportunity_id and organization_id=public.current_organization_id() for update;
  if o.id is null then raise exception 'opportunity_not_found'; end if;
  select * into won_stage from public.pipeline_stages where pipeline_id=o.pipeline_id and is_won limit 1;
  if won_stage.id is null then raise exception 'won_stage_not_found'; end if;
  update public.opportunities set stage_id=won_stage.id,probability=100,status='won', won_at=coalesce(won_at,now()), lost_at=null, updated_at=now() where id=o.id returning * into o;
  update public.companies set lifecycle_stage='customer',updated_at=now() where id=o.company_id;
  insert into public.customer_accounts(organization_id,company_id,status,client_since,owner_id,success_owner_id,source_opportunity_id)
  values(o.organization_id,o.company_id,'onboarding',coalesce(o.won_at,now()),o.owner_id,o.owner_id,o.id)
  on conflict(organization_id,company_id) do update set status=case when customer_accounts.status in ('cancelled','inactive') then 'onboarding' else customer_accounts.status end,cancelled_at=null,updated_at=now()
  returning * into account;
  insert into public.activities(organization_id,company_id,opportunity_id,user_id,type,title,description,metadata)
  select o.organization_id,o.company_id,o.id,auth.uid(),'customer_created','Relacionamento de cliente ativado','A venda ganhou continuidade no pós-venda',jsonb_build_object('customer_account_id',account.id)
  where not exists(select 1 from public.activities where opportunity_id=o.id and type='customer_created');
  return account;
end $$;

create or replace function public.complete_onboarding_step(target_step_id uuid) returns public.onboarding_steps language plpgsql security invoker set search_path=public as $$
declare step public.onboarding_steps; ob public.onboardings; account public.customer_accounts;
begin
  update public.onboarding_steps set status='completed',completed_at=now(),updated_at=now() where id=target_step_id and organization_id=public.current_organization_id() returning * into step;
  if step.id is null then raise exception 'step_not_found'; end if;
  if step.task_id is not null then perform public.complete_task(step.task_id); end if;
  select * into ob from public.onboardings where id=step.onboarding_id;
  select * into account from public.customer_accounts where id=ob.customer_account_id;
  if not exists(select 1 from public.onboarding_steps where onboarding_id=ob.id and status not in ('completed','cancelled')) then
    update public.onboardings set status='completed',completed_at=now(),updated_at=now() where id=ob.id;
    update public.customer_accounts set status='active',updated_at=now() where id=account.id and status='onboarding';
  end if;
  insert into public.activities(organization_id,company_id,opportunity_id,user_id,type,title,description,metadata) values(step.organization_id,account.company_id,ob.source_opportunity_id,auth.uid(),'onboarding_step_completed','Etapa de onboarding concluída',step.title,jsonb_build_object('onboarding_id',ob.id,'step_id',step.id));
  return step;
end $$;

grant execute on function public.activate_customer_from_won_opportunity(uuid) to authenticated;
grant execute on function public.complete_onboarding_step(uuid) to authenticated;

create or replace function public.register_post_sales_activity() returns trigger language plpgsql security definer set search_path=public as $$
declare company uuid; opportunity uuid; event_type text; event_title text;
begin
  if tg_table_name='customer_services' then select ca.company_id into company from public.customer_accounts ca where ca.id=new.customer_account_id; opportunity:=new.source_opportunity_id; event_type:=case when new.status='cancelled' then 'service_cancelled' when new.status='paused' then 'service_paused' else 'service_started' end; event_title:=case when new.status='cancelled' then 'Serviço cancelado' when new.status='paused' then 'Serviço pausado' else 'Serviço contratado' end;
  elsif tg_table_name='onboardings' then select ca.company_id into company from public.customer_accounts ca where ca.id=new.customer_account_id; opportunity:=new.source_opportunity_id; event_type:='onboarding_started'; event_title:='Onboarding iniciado';
  elsif tg_table_name='contracts' then select ca.company_id into company from public.customer_accounts ca where ca.id=new.customer_account_id; opportunity:=new.source_opportunity_id; event_type:=case when new.status='cancelled' then 'contract_cancelled' when new.status in ('signed','active') then 'contract_signed' else 'contract_created' end; event_title:=case when new.status='cancelled' then 'Contrato cancelado' when new.status in ('signed','active') then 'Contrato assinado' else 'Contrato criado' end;
  else select company_id into company from public.customer_accounts where id=new.id; event_type:='customer_cancelled'; event_title:='Relacionamento de cliente cancelado'; end if;
  insert into public.activities(organization_id,company_id,opportunity_id,user_id,type,title,description,metadata) values(new.organization_id,company,opportunity,auth.uid(),event_type,event_title,event_title,jsonb_build_object('record_id',new.id));
  return new;
end $$;
drop trigger if exists customer_services_activity on public.customer_services;
create trigger customer_services_activity after insert or update of status on public.customer_services for each row execute function public.register_post_sales_activity();
drop trigger if exists onboardings_activity on public.onboardings;
create trigger onboardings_activity after insert on public.onboardings for each row execute function public.register_post_sales_activity();
drop trigger if exists contracts_activity on public.contracts;
create trigger contracts_activity after insert or update of status on public.contracts for each row execute function public.register_post_sales_activity();
drop trigger if exists customer_accounts_cancel_activity on public.customer_accounts;
create trigger customer_accounts_cancel_activity after update of status on public.customer_accounts for each row when (new.status='cancelled' and old.status is distinct from new.status) execute function public.register_post_sales_activity();

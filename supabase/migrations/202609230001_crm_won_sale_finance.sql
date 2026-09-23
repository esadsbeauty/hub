-- CRM won sale -> service + financial receipt
-- Permite recebimentos originados do CRM sem obrigar conta financeira.

-- ============================================================
-- 1. TRANSAÇÕES PODEM FICAR SEM CONTA DEFINIDA
-- ============================================================

alter table public.financial_transactions
  alter column financial_account_id drop not null;


-- ============================================================
-- 2. AJUSTA VALIDAÇÃO DE TENANT DA TRANSAÇÃO
-- ============================================================

create or replace function public.assert_financial_transaction_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_org uuid;
begin
  if new.organization_id <> public.current_organization_id() then
    raise exception 'access_denied'
      using errcode = '42501';
  end if;

  if new.financial_account_id is not null then
    select organization_id
      into account_org
    from public.financial_accounts
    where id = new.financial_account_id;

    if account_org is distinct from new.organization_id then
      raise exception 'cross_tenant_account'
        using errcode = '42501';
    end if;
  end if;

  return new;
end
$$;


-- ============================================================
-- 3. REGISTRO DA VENDA DO CRM
-- ============================================================

create table if not exists public.crm_sales (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  opportunity_id uuid not null
    references public.opportunities(id),

  company_id uuid not null
    references public.companies(id),

  total_amount numeric(14,2) not null
    check (total_amount > 0),

  sold_at timestamptz not null default now(),

  payment_method text
    check (
      payment_method is null
      or payment_method in (
        'pix',
        'bank_transfer',
        'boleto',
        'credit_card',
        'debit_card',
        'cash',
        'other'
      )
    ),

  notes text,

  created_by uuid not null default auth.uid()
    references public.profiles(id),

  created_at timestamptz not null default now(),

  unique (organization_id, opportunity_id)
);


-- ============================================================
-- 4. SERVIÇOS DA VENDA
-- Preparado para futuramente vender vários serviços.
-- ============================================================

create table if not exists public.crm_sale_items (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  sale_id uuid not null
    references public.crm_sales(id) on delete cascade,

  service_id uuid not null
    references public.organization_services(id),

  service_name text not null,

  amount numeric(14,2) not null
    check (amount > 0),

  created_at timestamptz not null default now()
);


create index if not exists crm_sales_org_date_idx
  on public.crm_sales (organization_id, sold_at desc);

create index if not exists crm_sale_items_sale_idx
  on public.crm_sale_items (sale_id);


-- ============================================================
-- 5. RLS
-- ============================================================

alter table public.crm_sales enable row level security;
alter table public.crm_sale_items enable row level security;


drop policy if exists crm_sales_tenant
  on public.crm_sales;

create policy crm_sales_tenant
on public.crm_sales
for all
to authenticated
using (
  organization_id = public.current_organization_id()
)
with check (
  organization_id = public.current_organization_id()
);


drop policy if exists crm_sale_items_tenant
  on public.crm_sale_items;

create policy crm_sale_items_tenant
on public.crm_sale_items
for all
to authenticated
using (
  organization_id = public.current_organization_id()
)
with check (
  organization_id = public.current_organization_id()
);


-- ============================================================
-- 6. VÍNCULO DA RECEITA À VENDA
-- ============================================================

alter table public.receivables
  add column if not exists source_sale_id uuid
    references public.crm_sales(id);

create unique index if not exists receivables_source_sale_unique
  on public.receivables (organization_id, source_sale_id)
  where source_sale_id is not null;


-- ============================================================
-- 7. FECHAMENTO ATÔMICO DA VENDA
-- ============================================================

create or replace function public.close_opportunity_with_sale(
  target_opportunity_id uuid,
  target_service_id uuid,
  sale_amount numeric,
  sale_date timestamptz,
  sale_payment_method text default null,
  sale_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  org uuid := public.current_organization_id();

  opp public.opportunities;
  service_record public.organization_services;
  account_record public.customer_accounts;

  sale_id uuid;
  receivable_id uuid;
  transaction_id uuid;

  won_stage public.pipeline_stages;

  income_category_id uuid;
begin

  if sale_amount is null or sale_amount <= 0 then
    raise exception 'invalid_sale_amount';
  end if;

  select *
    into opp
  from public.opportunities
  where id = target_opportunity_id
    and organization_id = org
    and deleted_at is null
  for update;

  if opp.id is null then
    raise exception 'opportunity_not_found';
  end if;

  if opp.status = 'won' then
    raise exception 'opportunity_already_won';
  end if;


  select *
    into service_record
  from public.organization_services
  where id = target_service_id
    and organization_id = org
    and is_active = true;

  if service_record.id is null then
    raise exception 'service_not_found';
  end if;


  select *
    into won_stage
  from public.pipeline_stages
  where pipeline_id = opp.pipeline_id
    and is_won = true
  limit 1;

  if won_stage.id is null then
    raise exception 'won_stage_not_found';
  end if;


  -- ----------------------------------------------------------
  -- Marca oportunidade como ganha
  -- ----------------------------------------------------------

  update public.opportunities
  set
    stage_id = won_stage.id,
    probability = 100,
    value = sale_amount,
    status = 'won',
    won_at = coalesce(sale_date, now()),
    lost_at = null,
    updated_at = now()
  where id = opp.id;


  -- ----------------------------------------------------------
  -- Converte lead em cliente
  -- ----------------------------------------------------------

  update public.companies
  set
    lifecycle_stage = 'customer',
    updated_at = now()
  where id = opp.company_id;


  insert into public.customer_accounts (
    organization_id,
    company_id,
    status,
    client_since,
    owner_id,
    success_owner_id,
    source_opportunity_id
  )
  values (
    org,
    opp.company_id,
    'onboarding',
    coalesce(sale_date, now()),
    opp.owner_id,
    opp.owner_id,
    opp.id
  )
  on conflict (organization_id, company_id)
  do update set
    status = case
      when customer_accounts.status in ('cancelled', 'inactive')
        then 'onboarding'
      else customer_accounts.status
    end,
    cancelled_at = null,
    updated_at = now()
  returning *
    into account_record;


  -- ----------------------------------------------------------
  -- Cria venda
  -- ----------------------------------------------------------

  insert into public.crm_sales (
    organization_id,
    opportunity_id,
    company_id,
    total_amount,
    sold_at,
    payment_method,
    notes
  )
  values (
    org,
    opp.id,
    opp.company_id,
    sale_amount,
    coalesce(sale_date, now()),
    sale_payment_method,
    sale_notes
  )
  returning id into sale_id;


  insert into public.crm_sale_items (
    organization_id,
    sale_id,
    service_id,
    service_name,
    amount
  )
  values (
    org,
    sale_id,
    service_record.id,
    service_record.name,
    sale_amount
  );


  -- ----------------------------------------------------------
  -- Categoria financeira
  -- ----------------------------------------------------------

  select id
    into income_category_id
  from public.financial_categories
  where organization_id = org
    and type = 'income'
    and is_active = true
  order by
    case
      when lower(name) = 'procedimentos' then 0
      else 1
    end,
    created_at
  limit 1;


  -- ----------------------------------------------------------
  -- Conta a receber já liquidada
  -- ----------------------------------------------------------

  insert into public.receivables (
    organization_id,
    customer_account_id,
    company_id,
    source_opportunity_id,
    source_sale_id,
    description,
    category_id,
    competence_date,
    due_date,
    original_amount,
    status,
    payment_method,
    notes
  )
  values (
    org,
    account_record.id,
    opp.company_id,
    opp.id,
    sale_id,
    service_record.name,
    income_category_id,
    coalesce(sale_date, now())::date,
    coalesce(sale_date, now())::date,
    sale_amount,
    'paid',
    sale_payment_method,
    sale_notes
  )
  returning id into receivable_id;


  -- ----------------------------------------------------------
  -- Entrada financeira SEM conta obrigatória
  -- ----------------------------------------------------------

  insert into public.financial_transactions (
    organization_id,
    financial_account_id,
    type,
    amount,
    occurred_at,
    description,
    payment_method,
    reference,
    created_by
  )
  values (
    org,
    null,
    'income',
    sale_amount,
    coalesce(sale_date, now()),
    service_record.name,
    sale_payment_method,
    'crm-sale:' || sale_id::text,
    auth.uid()
  )
  returning id into transaction_id;


  insert into public.payment_allocations (
    organization_id,
    transaction_id,
    receivable_id,
    amount
  )
  values (
    org,
    transaction_id,
    receivable_id,
    sale_amount
  );


  insert into public.activities (
    organization_id,
    company_id,
    opportunity_id,
    user_id,
    type,
    title,
    description,
    metadata
  )
  values (
    org,
    opp.company_id,
    opp.id,
    auth.uid(),
    'deal_won',
    'Venda fechada',
    service_record.name || ' — R$ ' || sale_amount::text,
    jsonb_build_object(
      'sale_id', sale_id,
      'service_id', service_record.id,
      'service_name', service_record.name,
      'amount', sale_amount,
      'receivable_id', receivable_id,
      'transaction_id', transaction_id
    )
  );


  return sale_id;
end
$$;


grant execute on function public.close_opportunity_with_sale(
  uuid,
  uuid,
  numeric,
  timestamptz,
  text,
  text
)
to authenticated;


notify pgrst, 'reload schema';
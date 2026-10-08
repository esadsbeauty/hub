-- =========================================================
-- CRM opportunity -> receivable forecast
-- =========================================================

-- Uma oportunidade pode possuir apenas uma previsão financeira ativa.
-- Histórico paid/cancelled continua preservado.
create unique index if not exists receivables_source_opportunity_pending_unique
on public.receivables (
  organization_id,
  source_opportunity_id
)
where source_opportunity_id is not null
  and source_sale_id is null
  and status = 'pending'
  and deleted_at is null;


-- =========================================================
-- Sincroniza oportunidade aberta com previsão financeira
-- =========================================================

create or replace function public.sync_opportunity_receivable_forecast()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  forecast_date date;
begin
  -- Fechamento ganho é tratado atomicamente pela
  -- close_opportunity_with_sale().
  if new.status = 'won' then
    return new;
  end if;

  forecast_date := coalesce(new.expected_close_date, current_date);


  -- -------------------------------------------------------
  -- Perdida, excluída ou sem valor:
  -- cancela somente previsões ainda não liquidadas.
  -- -------------------------------------------------------

  if new.deleted_at is not null
     or new.status = 'lost'
     or coalesce(new.value, 0) <= 0
  then

    update public.receivables
    set
      status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now()),
      updated_at = now()
    where organization_id = new.organization_id
      and source_opportunity_id = new.id
      and source_sale_id is null
      and status in ('pending', 'cancelled')
      and deleted_at is null;

    return new;
  end if;


  -- -------------------------------------------------------
  -- Oportunidade aberta com valor:
  -- cria ou atualiza a previsão.
  -- -------------------------------------------------------

  if new.status = 'open'
     and new.deleted_at is null
     and new.value > 0
  then

    -- Primeiro atualiza a previsão ativa, se ela já existir.
    update public.receivables
    set
      company_id = new.company_id,
      description = new.title,
      competence_date = forecast_date,
      due_date = forecast_date,
      original_amount = new.value,
      discount_amount = 0,
      interest_amount = 0,
      penalty_amount = 0,
      status = 'pending',
      cancelled_at = null,
      updated_at = now()
    where organization_id = new.organization_id
      and source_opportunity_id = new.id
      and source_sale_id is null
      and status = 'pending'
      and deleted_at is null;

    -- Se não existe previsão ativa, tenta reutilizar uma previsão
    -- cancelada que nunca recebeu nenhum pagamento.
    if not found then

      update public.receivables
      set
        company_id = new.company_id,
        description = new.title,
        competence_date = forecast_date,
        due_date = forecast_date,
        original_amount = new.value,
        discount_amount = 0,
        interest_amount = 0,
        penalty_amount = 0,
        status = 'pending',
        cancelled_at = null,
        updated_at = now()
      where id = (
        select r.id
        from public.receivables r
        where r.organization_id = new.organization_id
          and r.source_opportunity_id = new.id
          and r.source_sale_id is null
          and r.status = 'cancelled'
          and r.deleted_at is null
          and not exists (
            select 1
            from public.payment_allocations pa
            where pa.receivable_id = r.id
          )
        order by r.updated_at desc, r.created_at desc
        limit 1
      );

    end if;

    -- Se também não havia uma cancelada reutilizável,
    -- cria uma nova previsão.
    if not found then

      insert into public.receivables (
        organization_id,
        company_id,
        source_opportunity_id,
        description,
        competence_date,
        due_date,
        original_amount,
        status,
        created_by
      )
      values (
        new.organization_id,
        new.company_id,
        new.id,
        new.title,
        forecast_date,
        forecast_date,
        new.value,
        'pending',
        new.created_by
      );

    end if;

  end if;

  return new;
end
$function$;


drop trigger if exists opportunities_receivable_forecast_sync
on public.opportunities;

create trigger opportunities_receivable_forecast_sync
after insert or update
on public.opportunities
for each row
execute function public.sync_opportunity_receivable_forecast();


-- Função de trigger: não deve ser chamada diretamente pelo cliente.
revoke execute
on function public.sync_opportunity_receivable_forecast()
from public, anon, authenticated;

grant execute
on function public.sync_opportunity_receivable_forecast()
to service_role;


-- =========================================================
-- Fechar venda:
-- reutiliza a previsão existente em vez de duplicar recebível
-- =========================================================

create or replace function public.close_opportunity_with_sale(
  target_opportunity_id uuid,
  target_service_id uuid,
  sale_amount numeric,
  sale_date timestamp with time zone,
  sale_payment_method text default null,
  sale_notes text default null
)
returns uuid
language plpgsql
set search_path = public
as $function$
declare
  org uuid := public.current_organization_id();

  opp public.opportunities;
  service_record public.organization_services;
  account_record public.customer_accounts;
  existing_receivable public.receivables;

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


  -- -------------------------------------------------------
  -- Marca oportunidade como ganha
  -- -------------------------------------------------------

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


  -- -------------------------------------------------------
  -- Converte lead em cliente
  -- -------------------------------------------------------

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
  do update
  set
    status = case
      when customer_accounts.status in ('cancelled', 'inactive')
        then 'onboarding'
      else customer_accounts.status
    end,
    cancelled_at = null,
    updated_at = now()
  returning *
  into account_record;


  -- -------------------------------------------------------
  -- Cria venda
  -- -------------------------------------------------------

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
  returning id
  into sale_id;


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


  -- -------------------------------------------------------
  -- Categoria financeira
  -- -------------------------------------------------------

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


  -- -------------------------------------------------------
  -- Procura previsão existente
  -- -------------------------------------------------------

  -- Não permite uma segunda liquidação da mesma oportunidade.
  if exists (
    select 1
    from public.receivables r
    where r.organization_id = org
      and r.source_opportunity_id = opp.id
      and r.deleted_at is null
      and (
        r.source_sale_id is not null
        or r.status in ('paid', 'partially_paid')
      )
  ) then
    raise exception 'opportunity_receivable_already_settled';
  end if;

  -- Procura primeiro a previsão pending.
  -- Uma cancelada só pode ser reutilizada se nunca teve pagamento.
  select r.*
  into existing_receivable
  from public.receivables r
  where r.organization_id = org
    and r.source_opportunity_id = opp.id
    and r.source_sale_id is null
    and r.deleted_at is null
    and r.status in ('pending', 'cancelled')
    and not exists (
      select 1
      from public.payment_allocations pa
      where pa.receivable_id = r.id
    )
  order by
    case when r.status = 'pending' then 0 else 1 end,
    r.updated_at desc,
    r.created_at desc
  limit 1
  for update;


  -- -------------------------------------------------------
  -- Se já existe previsão, transforma a MESMA em recebida
  -- -------------------------------------------------------

  if existing_receivable.id is not null then


    update public.receivables
    set
      customer_account_id = account_record.id,
      company_id = opp.company_id,
      source_sale_id = sale_id,
      description = service_record.name,
      category_id = income_category_id,
      competence_date = coalesce(sale_date, now())::date,
      due_date = coalesce(sale_date, now())::date,
      original_amount = sale_amount,
      discount_amount = 0,
      interest_amount = 0,
      penalty_amount = 0,
      status = 'paid',
      payment_method = sale_payment_method,
      notes = sale_notes,
      cancelled_at = null,
      updated_at = now()
    where id = existing_receivable.id
    returning id
    into receivable_id;


  -- -------------------------------------------------------
  -- Sem previsão anterior: mantém comportamento existente
  -- -------------------------------------------------------

  else

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
    returning id
    into receivable_id;

  end if;


  -- -------------------------------------------------------
  -- Entrada financeira SEM conta obrigatória
  -- -------------------------------------------------------

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
  returning id
  into transaction_id;


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
$function$;


notify pgrst, 'reload schema';
-- Fix Financeiro 1.0 tenant validation triggers.
-- Receivables, payables and recurrence_rules have different columns,
-- so each table gets its own validation function.

create or replace function public.assert_receivable_tenant_links()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  linked_org uuid;
begin
  if new.organization_id <> public.current_organization_id() then
    raise exception 'access_denied'
      using errcode = '42501';
  end if;

  if new.category_id is not null then
    select organization_id
      into linked_org
      from public.financial_categories
     where id = new.category_id;

    if linked_org is distinct from new.organization_id then
      raise exception 'cross_tenant_category'
        using errcode = '42501';
    end if;
  end if;

  if new.financial_account_id is not null then
    select organization_id
      into linked_org
      from public.financial_accounts
     where id = new.financial_account_id;

    if linked_org is distinct from new.organization_id then
      raise exception 'cross_tenant_account'
        using errcode = '42501';
    end if;
  end if;

  if new.company_id is not null then
    select organization_id
      into linked_org
      from public.companies
     where id = new.company_id;

    if linked_org is distinct from new.organization_id then
      raise exception 'cross_tenant_company'
        using errcode = '42501';
    end if;
  end if;

  if new.source_opportunity_id is not null then
    select organization_id
      into linked_org
      from public.opportunities
     where id = new.source_opportunity_id;

    if linked_org is distinct from new.organization_id then
      raise exception 'cross_tenant_opportunity'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;


create or replace function public.assert_payable_tenant_links()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  linked_org uuid;
begin
  if new.organization_id <> public.current_organization_id() then
    raise exception 'access_denied'
      using errcode = '42501';
  end if;

  if new.category_id is not null then
    select organization_id
      into linked_org
      from public.financial_categories
     where id = new.category_id;

    if linked_org is distinct from new.organization_id then
      raise exception 'cross_tenant_category'
        using errcode = '42501';
    end if;
  end if;

  if new.financial_account_id is not null then
    select organization_id
      into linked_org
      from public.financial_accounts
     where id = new.financial_account_id;

    if linked_org is distinct from new.organization_id then
      raise exception 'cross_tenant_account'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;


create or replace function public.assert_recurrence_rule_tenant_links()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  linked_org uuid;
begin
  if new.organization_id <> public.current_organization_id() then
    raise exception 'access_denied'
      using errcode = '42501';
  end if;

  if new.category_id is not null then
    select organization_id
      into linked_org
      from public.financial_categories
     where id = new.category_id;

    if linked_org is distinct from new.organization_id then
      raise exception 'cross_tenant_category'
        using errcode = '42501';
    end if;
  end if;

  if new.financial_account_id is not null then
    select organization_id
      into linked_org
      from public.financial_accounts
     where id = new.financial_account_id;

    if linked_org is distinct from new.organization_id then
      raise exception 'cross_tenant_account'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;


drop trigger if exists receivables_tenant_links
  on public.receivables;

create trigger receivables_tenant_links
before insert or update
on public.receivables
for each row
execute function public.assert_receivable_tenant_links();


drop trigger if exists payables_tenant_links
  on public.payables;

create trigger payables_tenant_links
before insert or update
on public.payables
for each row
execute function public.assert_payable_tenant_links();


drop trigger if exists recurrence_rules_tenant_links
  on public.recurrence_rules;

create trigger recurrence_rules_tenant_links
before insert or update
on public.recurrence_rules
for each row
execute function public.assert_recurrence_rule_tenant_links();


drop function if exists public.assert_financial_entry_tenant();
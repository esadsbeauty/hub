-- Finance 1.0 evolves the existing financial domain without duplicating ledgers.
alter table public.financial_accounts drop constraint if exists financial_accounts_type_check;
alter table public.financial_accounts add constraint financial_accounts_type_check check(type in('bank','checking','digital','savings','cash','digital_wallet','other'));
alter table public.receivables add column if not exists financial_account_id uuid references public.financial_accounts(id),add column if not exists installment_number integer,add column if not exists installment_total integer,add column if not exists installment_group_id uuid;
alter table public.payables add column if not exists installment_number integer,add column if not exists installment_total integer,add column if not exists installment_group_id uuid;
alter table public.recurrence_rules add column if not exists financial_account_id uuid references public.financial_accounts(id);
alter table public.receivables add constraint receivables_installment_valid check((installment_number is null and installment_total is null and installment_group_id is null)or(installment_number between 1 and installment_total and installment_group_id is not null));
alter table public.payables add constraint payables_installment_valid check((installment_number is null and installment_total is null and installment_group_id is null)or(installment_number between 1 and installment_total and installment_group_id is not null));
create index if not exists receivables_installment_group_idx on public.receivables(organization_id,installment_group_id) where installment_group_id is not null;
create index if not exists payables_installment_group_idx on public.payables(organization_id,installment_group_id) where installment_group_id is not null;

create or replace function public.assert_financial_entry_tenant() returns trigger language plpgsql security definer set search_path=public as $$
declare linked_org uuid;
begin
 if new.organization_id<>public.current_organization_id() then raise exception 'access_denied' using errcode='42501';end if;
 if new.category_id is not null then select organization_id into linked_org from public.financial_categories where id=new.category_id;if linked_org is distinct from new.organization_id then raise exception 'cross_tenant_category' using errcode='42501';end if;end if;
 if new.financial_account_id is not null then select organization_id into linked_org from public.financial_accounts where id=new.financial_account_id;if linked_org is distinct from new.organization_id then raise exception 'cross_tenant_account' using errcode='42501';end if;end if;
 if tg_table_name='receivables' and new.company_id is not null then select organization_id into linked_org from public.companies where id=new.company_id;if linked_org is distinct from new.organization_id then raise exception 'cross_tenant_company' using errcode='42501';end if;end if;
 if tg_table_name='receivables' and new.source_opportunity_id is not null then select organization_id into linked_org from public.opportunities where id=new.source_opportunity_id;if linked_org is distinct from new.organization_id then raise exception 'cross_tenant_opportunity' using errcode='42501';end if;end if;
 return new;
end$$;
drop trigger if exists receivables_tenant_links on public.receivables;create trigger receivables_tenant_links before insert or update on public.receivables for each row execute function public.assert_financial_entry_tenant();
drop trigger if exists payables_tenant_links on public.payables;create trigger payables_tenant_links before insert or update on public.payables for each row execute function public.assert_financial_entry_tenant();
drop trigger if exists recurrence_rules_tenant_links on public.recurrence_rules;create trigger recurrence_rules_tenant_links before insert or update on public.recurrence_rules for each row execute function public.assert_financial_entry_tenant();
create or replace function public.assert_financial_transaction_tenant() returns trigger language plpgsql security definer set search_path=public as $$
declare account_org uuid;begin if new.organization_id<>public.current_organization_id() then raise exception 'access_denied' using errcode='42501';end if;select organization_id into account_org from public.financial_accounts where id=new.financial_account_id;if account_org is distinct from new.organization_id then raise exception 'cross_tenant_account' using errcode='42501';end if;return new;end$$;
drop trigger if exists financial_transactions_tenant_links on public.financial_transactions;create trigger financial_transactions_tenant_links before insert or update on public.financial_transactions for each row execute function public.assert_financial_transaction_tenant();

create or replace function public.assert_financial_allocation_tenant() returns trigger language plpgsql security definer set search_path=public as $$
declare linked_org uuid;
begin
 if new.organization_id<>public.current_organization_id() then raise exception 'access_denied' using errcode='42501';end if;
 select organization_id into linked_org from public.financial_transactions where id=new.transaction_id;if linked_org is distinct from new.organization_id then raise exception 'cross_tenant_transaction' using errcode='42501';end if;
 if new.receivable_id is not null then select organization_id into linked_org from public.receivables where id=new.receivable_id;else select organization_id into linked_org from public.payables where id=new.payable_id;end if;
 if linked_org is distinct from new.organization_id then raise exception 'cross_tenant_financial_entry' using errcode='42501';end if;return new;
end$$;
drop trigger if exists payment_allocations_tenant_links on public.payment_allocations;create trigger payment_allocations_tenant_links before insert or update on public.payment_allocations for each row execute function public.assert_financial_allocation_tenant();

create or replace function public.assert_financial_category_parent() returns trigger language plpgsql security definer set search_path=public as $$
declare parent_org uuid;parent_type text;begin if new.parent_id is null then return new;end if;select organization_id,type into parent_org,parent_type from public.financial_categories where id=new.parent_id;if parent_org is distinct from new.organization_id or parent_type is distinct from new.type then raise exception 'invalid_category_parent' using errcode='42501';end if;return new;end$$;
drop trigger if exists financial_categories_tenant_parent on public.financial_categories;create trigger financial_categories_tenant_parent before insert or update on public.financial_categories for each row execute function public.assert_financial_category_parent();

create or replace function public.assert_settled_entry_edit() returns trigger language plpgsql security definer set search_path=public as $$
declare allocated numeric;next_net numeric:=new.original_amount-new.discount_amount+new.interest_amount+new.penalty_amount;
begin
 if tg_table_name='receivables' then select coalesce(sum(pa.amount),0) into allocated from public.payment_allocations pa join public.financial_transactions ft on ft.id=pa.transaction_id and ft.reversed_at is null where pa.receivable_id=old.id;
 else select coalesce(sum(pa.amount),0) into allocated from public.payment_allocations pa join public.financial_transactions ft on ft.id=pa.transaction_id and ft.reversed_at is null where pa.payable_id=old.id;end if;
 if next_net<allocated then raise exception 'amount_below_settled_total' using errcode='23514';end if;return new;
end$$;
drop trigger if exists receivables_settled_edit on public.receivables;create trigger receivables_settled_edit before update of original_amount,discount_amount,interest_amount,penalty_amount on public.receivables for each row execute function public.assert_settled_entry_edit();
drop trigger if exists payables_settled_edit on public.payables;create trigger payables_settled_edit before update of original_amount,discount_amount,interest_amount,penalty_amount on public.payables for each row execute function public.assert_settled_entry_edit();

create or replace function public.seed_financial_categories(target_organization_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 insert into public.financial_categories(organization_id,name,type,dre_group)
 select target_organization_id,x.name,x.type,x.dre_group from(values
 ('Procedimentos','income','gross_revenue'),('Consultas','income','gross_revenue'),('Produtos','income','gross_revenue'),('Pacotes','income','gross_revenue'),('Outros','income','other_income'),
 ('Aluguel','expense','operating_expense'),('Funcionários','expense','operating_expense'),('Marketing','expense','operating_expense'),('Tráfego pago','expense','operating_expense'),('Produtos e insumos','expense','direct_cost'),('Equipamentos','expense','operating_expense'),('Impostos','expense','deduction'),('Software','expense','operating_expense'),('Água','expense','operating_expense'),('Energia','expense','operating_expense'),('Outros','expense','other_expense'))x(name,type,dre_group)
 on conflict(organization_id,type,name) do nothing;
end$$;
select public.seed_financial_categories(id) from public.organizations;
create or replace function public.seed_new_organization_finance() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.seed_financial_categories(new.id);return new;end$$;
drop trigger if exists seed_new_organization_finance on public.organizations;create trigger seed_new_organization_finance after insert on public.organizations for each row execute function public.seed_new_organization_finance();

-- Platform impersonation remains an allow-list and gains only the existing finance permissions.
create or replace function public.has_permission(required_permission text) returns boolean language sql stable security definer set search_path=public as $$
 select case when public.is_platform_admin() and public.current_organization_id() is distinct from public.base_organization_id() then required_permission=any(array['dashboard.view','crm.view','crm.manage','crm.opportunity.move','crm.opportunity.close','agenda.view','customers.view','customers.manage','finance.view','finance.manage','finance.transactions.reverse','marketing.view','reports.view','blog.view','settings.view','settings.manage']::text[]) and exists(select 1 from public.permissions p where p.key=required_permission and public.has_module_entitlement(p.module)) else exists(select 1 from public.organization_members m join public.role_permissions rp on rp.role_id=m.role_id join public.permissions p on p.id=rp.permission_id where m.user_id=auth.uid() and m.status='active' and p.key=required_permission and public.has_module_entitlement(p.module)) end
$$;

revoke all on function public.assert_financial_entry_tenant(),public.assert_financial_transaction_tenant(),public.assert_financial_allocation_tenant(),public.assert_financial_category_parent(),public.assert_settled_entry_edit(),public.seed_financial_categories(uuid),public.seed_new_organization_finance() from public,anon,authenticated;
notify pgrst,'reload schema';

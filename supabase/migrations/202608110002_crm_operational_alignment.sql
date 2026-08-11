-- Alinha campos já usados pela experiência do CRM sem remover dados existentes.
alter table public.companies
  add column if not exists facebook text,
  add column if not exists website text,
  add column if not exists zip_code text,
  add column if not exists address text,
  add column if not exists address_number text,
  add column if not exists complement text,
  add column if not exists district text,
  add column if not exists responsible_name text,
  add column if not exists responsible_role text,
  add column if not exists employees integer check (employees is null or employees >= 0),
  add column if not exists business_area text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists last_interaction_at timestamptz;

alter table public.contacts
  add column if not exists linkedin text,
  add column if not exists birth_date date,
  add column if not exists notes text,
  add column if not exists is_financial boolean not null default false,
  add column if not exists is_commercial boolean not null default true,
  add column if not exists status text not null default 'ativo';

alter table public.contacts
  drop constraint if exists contacts_status_check;
alter table public.contacts
  add constraint contacts_status_check check (status in ('ativo', 'inativo')) not valid;

create index if not exists companies_search_fields_idx
  on public.companies(organization_id, lower(name)) where deleted_at is null;
create index if not exists companies_temperature_priority_idx
  on public.companies(organization_id, temperature, priority) where deleted_at is null;
create index if not exists contacts_primary_idx
  on public.contacts(company_id, is_primary) where deleted_at is null;

-- Garante apenas um contato principal ativo por empresa.
with ranked_primary_contacts as (
  select id, row_number() over (partition by company_id order by created_at, id) as position
  from public.contacts
  where is_primary and deleted_at is null
)
update public.contacts
set is_primary = false
where id in (select id from ranked_primary_contacts where position > 1);

create unique index if not exists contacts_one_primary_per_company
  on public.contacts(company_id) where is_primary and deleted_at is null;

create or replace function public.set_primary_contact(target_contact_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_company_id uuid;
begin
  select company_id into target_company_id
  from public.contacts
  where id = target_contact_id and deleted_at is null;

  if target_company_id is null then
    raise exception 'Contato não encontrado';
  end if;

  update public.contacts
    set is_primary = false
    where company_id = target_company_id and is_primary and deleted_at is null;
  update public.contacts
    set is_primary = true
    where id = target_contact_id;
end
$$;

create or replace function public.register_note_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activities(
    organization_id, company_id, opportunity_id, user_id,
    type, title, description
  ) values (
    new.organization_id, new.company_id, new.opportunity_id, new.created_by,
    'note_created', 'Observação criada', new.body
  );
  return new;
end
$$;

drop trigger if exists notes_create_activity on public.notes;
create trigger notes_create_activity
  after insert on public.notes
  for each row execute function public.register_note_activity();

create or replace function public.register_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activities(
      organization_id, company_id, opportunity_id, user_id,
      type, title, description
    ) values (
      new.organization_id, new.company_id, new.opportunity_id, new.created_by,
      case when new.type = 'follow_up' then 'followup_created' else 'task_created' end,
      case when new.type = 'follow_up' then 'Follow-up criado' else 'Tarefa criada' end,
      new.title
    );
  elsif new.status = 'completed' and old.status is distinct from 'completed' then
    insert into public.activities(
      organization_id, company_id, opportunity_id, user_id,
      type, title, description
    ) values (
      new.organization_id, new.company_id, new.opportunity_id, auth.uid(),
      case when new.type = 'follow_up' then 'followup_completed' else 'task_completed' end,
      case when new.type = 'follow_up' then 'Follow-up concluído' else 'Tarefa concluída' end,
      new.title
    );
  end if;
  return new;
end
$$;

drop trigger if exists tasks_create_activity on public.tasks;
create trigger tasks_create_activity
  after insert on public.tasks
  for each row execute function public.register_task_activity();
drop trigger if exists tasks_complete_activity on public.tasks;
create trigger tasks_complete_activity
  after update of status on public.tasks
  for each row execute function public.register_task_activity();

-- Novos usuários não recebem privilégios administrativos automaticamente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  esads_organization_id uuid;
begin
  select id into esads_organization_id
  from public.organizations
  where slug = 'esads-beauty';

  insert into public.profiles(id, organization_id, name, email, role)
  values (
    new.id,
    esads_organization_id,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, ''),
    'member'
  );
  return new;
end
$$;

create or replace function public.register_crm_entity_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'companies' then
    if tg_op = 'UPDATE' and pg_trigger_depth() > 1 then
      return new;
    end if;
    insert into public.activities(
      organization_id, company_id, user_id, type, title, description, metadata
    ) values (
      new.organization_id, new.id, coalesce(auth.uid(), new.created_by),
      case when tg_op = 'INSERT' then 'company_created' else 'company_updated' end,
      case when tg_op = 'INSERT' then 'Empresa criada'
           when new.owner_id is distinct from old.owner_id then 'Responsável alterado'
           else 'Empresa atualizada' end,
      new.name,
      case when tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id
           then jsonb_build_object('from_owner_id', old.owner_id, 'to_owner_id', new.owner_id)
           else '{}'::jsonb end
    );
  elsif tg_table_name = 'contacts' and tg_op = 'INSERT' then
    insert into public.activities(
      organization_id, company_id, user_id, type, title, description
    ) values (
      new.organization_id, new.company_id, auth.uid(),
      'contact_created', 'Contato criado', new.name
    );
  elsif tg_table_name = 'opportunities' and tg_op = 'INSERT' then
    insert into public.activities(
      organization_id, company_id, opportunity_id, user_id,
      type, title, description, metadata
    ) values (
      new.organization_id, new.company_id, new.id, coalesce(auth.uid(), new.created_by),
      'opportunity_created', 'Oportunidade criada', new.title,
      jsonb_build_object('value', new.value)
    );
  end if;
  return new;
end
$$;

drop trigger if exists companies_create_activity on public.companies;
create trigger companies_create_activity after insert on public.companies
  for each row execute function public.register_crm_entity_activity();
drop trigger if exists companies_update_activity on public.companies;
create trigger companies_update_activity after update on public.companies
  for each row execute function public.register_crm_entity_activity();
drop trigger if exists contacts_create_activity on public.contacts;
create trigger contacts_create_activity after insert on public.contacts
  for each row execute function public.register_crm_entity_activity();
drop trigger if exists opportunities_create_activity on public.opportunities;
create trigger opportunities_create_activity after insert on public.opportunities
  for each row execute function public.register_crm_entity_activity();

create or replace function public.touch_company_last_interaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.company_id is not null then
    update public.companies
      set last_interaction_at = new.created_at
      where id = new.company_id;
  end if;
  return new;
end
$$;

drop trigger if exists activities_touch_company on public.activities;
create trigger activities_touch_company
  after insert on public.activities
  for each row execute function public.touch_company_last_interaction();

create or replace function public.create_company_with_primary_contact(
  company_data jsonb,
  contact_data jsonb default null
)
returns public.companies
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_company public.companies;
  current_profile public.profiles;
begin
  select * into current_profile
  from public.profiles
  where id = auth.uid();

  if current_profile.id is null then
    raise exception 'Perfil autenticado não encontrado';
  end if;

  insert into public.companies(
    organization_id, name, legal_name, cnpj, phone, whatsapp, instagram,
    facebook, website, email, zip_code, address, address_number, complement,
    district, city, state, responsible_name, responsible_role, employees,
    business_area, source, temperature, priority, notes, tags,
    owner_id, created_by
  ) values (
    current_profile.organization_id,
    company_data->>'name', nullif(company_data->>'legal_name', ''),
    nullif(company_data->>'cnpj', ''), nullif(company_data->>'phone', ''),
    nullif(company_data->>'whatsapp', ''), nullif(company_data->>'instagram', ''),
    nullif(company_data->>'facebook', ''), nullif(company_data->>'website', ''),
    nullif(company_data->>'email', ''), nullif(company_data->>'zip_code', ''),
    nullif(company_data->>'address', ''), nullif(company_data->>'address_number', ''),
    nullif(company_data->>'complement', ''), nullif(company_data->>'district', ''),
    nullif(company_data->>'city', ''), nullif(company_data->>'state', ''),
    nullif(company_data->>'responsible_name', ''), nullif(company_data->>'responsible_role', ''),
    nullif(company_data->>'employees', '')::integer,
    nullif(company_data->>'business_area', ''), nullif(company_data->>'source', ''),
    coalesce((company_data->>'temperature')::public.temperature_level, 'morno'),
    coalesce((company_data->>'priority')::public.priority_level, 'media'),
    nullif(company_data->>'notes', ''),
    coalesce(array(select jsonb_array_elements_text(company_data->'tags')), '{}'),
    current_profile.id, current_profile.id
  ) returning * into new_company;

  if contact_data is not null and nullif(contact_data->>'name', '') is not null then
    insert into public.contacts(
      organization_id, company_id, name, role, phone, whatsapp, email,
      instagram, is_primary, is_commercial
    ) values (
      current_profile.organization_id, new_company.id, contact_data->>'name',
      nullif(contact_data->>'role', ''), nullif(contact_data->>'phone', ''),
      nullif(contact_data->>'whatsapp', ''), nullif(contact_data->>'email', ''),
      nullif(contact_data->>'instagram', ''), true, true
    );
  end if;

  return new_company;
end
$$;

create or replace function public.sync_company_lifecycle_from_opportunity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'won' and old.status is distinct from 'won' then
    update public.companies
      set lifecycle_stage = 'customer'
      where id = new.company_id and deleted_at is null;
  end if;
  return new;
end
$$;

drop trigger if exists opportunities_sync_company_lifecycle on public.opportunities;
create trigger opportunities_sync_company_lifecycle
  after update of status on public.opportunities
  for each row execute function public.sync_company_lifecycle_from_opportunity();

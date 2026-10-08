-- db-audit: additive prospecting foundation
-- Cria a base do módulo Prospecção sem alterar CRM, WhatsApp ou Assistente Comercial.

create table if not exists public.organization_features (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  source text not null default 'manual' check (source in ('manual','plan','trial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, feature_key)
);

create index if not exists organization_features_enabled_idx
  on public.organization_features (organization_id, feature_key)
  where enabled;

create table if not exists public.prospecting_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  source_type text not null default 'csv' check (source_type in ('csv','paste')),
  total_leads integer not null default 0 check (total_leads >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospecting_lists_org_created_idx
  on public.prospecting_lists (organization_id, created_at desc);

create table if not exists public.prospecting_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  list_id uuid not null references public.prospecting_lists(id) on delete cascade,

  name text not null,
  whatsapp text not null,
  instagram text,
  city text,
  business_type text,
  notes text,

  generated_message text,
  message_edited boolean not null default false,
  message_generated_at timestamptz,
  message_opened_at timestamptz,

  status text not null default 'new'
    check (status in (
      'new',
      'message_sent',
      'replied',
      'in_conversation',
      'opportunity',
      'not_interested'
    )),

  crm_company_id uuid references public.companies(id) on delete set null,
  crm_opportunity_id uuid references public.opportunities(id) on delete set null,
  converted_at timestamptz,

  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospecting_leads_org_list_idx
  on public.prospecting_leads (organization_id, list_id);

create index if not exists prospecting_leads_org_status_idx
  on public.prospecting_leads (organization_id, status);

create index if not exists prospecting_leads_whatsapp_idx
  on public.prospecting_leads (organization_id, whatsapp);

alter table public.organization_features enable row level security;
alter table public.prospecting_lists enable row level security;
alter table public.prospecting_leads enable row level security;

drop policy if exists organization_features_tenant_read on public.organization_features;
create policy organization_features_tenant_read
  on public.organization_features
  for select
  to authenticated
  using (
    organization_id = public.current_organization_id()
    or public.is_platform_admin()
  );

drop policy if exists prospecting_lists_tenant_read on public.prospecting_lists;
create policy prospecting_lists_tenant_read
  on public.prospecting_lists
  for select
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and exists (
      select 1
      from public.organization_features f
      where f.organization_id = public.current_organization_id()
        and f.feature_key = 'prospecting_agent'
        and f.enabled = true
    )
  );

drop policy if exists prospecting_lists_tenant_insert on public.prospecting_lists;
create policy prospecting_lists_tenant_insert
  on public.prospecting_lists
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and created_by = auth.uid()
    and exists (
      select 1
      from public.organization_features f
      where f.organization_id = public.current_organization_id()
        and f.feature_key = 'prospecting_agent'
        and f.enabled = true
    )
  );

drop policy if exists prospecting_lists_tenant_update on public.prospecting_lists;
create policy prospecting_lists_tenant_update
  on public.prospecting_lists
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and exists (
      select 1
      from public.organization_features f
      where f.organization_id = public.current_organization_id()
        and f.feature_key = 'prospecting_agent'
        and f.enabled = true
    )
  )
  with check (
    organization_id = public.current_organization_id()
  );

drop policy if exists prospecting_lists_tenant_delete on public.prospecting_lists;
create policy prospecting_lists_tenant_delete
  on public.prospecting_lists
  for delete
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and exists (
      select 1
      from public.organization_features f
      where f.organization_id = public.current_organization_id()
        and f.feature_key = 'prospecting_agent'
        and f.enabled = true
    )
  );

drop policy if exists prospecting_leads_tenant_read on public.prospecting_leads;
create policy prospecting_leads_tenant_read
  on public.prospecting_leads
  for select
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and exists (
      select 1
      from public.organization_features f
      where f.organization_id = public.current_organization_id()
        and f.feature_key = 'prospecting_agent'
        and f.enabled = true
    )
  );

drop policy if exists prospecting_leads_tenant_insert on public.prospecting_leads;
create policy prospecting_leads_tenant_insert
  on public.prospecting_leads
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and created_by = auth.uid()
    and exists (
      select 1
      from public.organization_features f
      where f.organization_id = public.current_organization_id()
        and f.feature_key = 'prospecting_agent'
        and f.enabled = true
    )
  );

drop policy if exists prospecting_leads_tenant_update on public.prospecting_leads;
create policy prospecting_leads_tenant_update
  on public.prospecting_leads
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and exists (
      select 1
      from public.organization_features f
      where f.organization_id = public.current_organization_id()
        and f.feature_key = 'prospecting_agent'
        and f.enabled = true
    )
  )
  with check (
    organization_id = public.current_organization_id()
  );

drop policy if exists prospecting_leads_tenant_delete on public.prospecting_leads;
create policy prospecting_leads_tenant_delete
  on public.prospecting_leads
  for delete
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and exists (
      select 1
      from public.organization_features f
      where f.organization_id = public.current_organization_id()
        and f.feature_key = 'prospecting_agent'
        and f.enabled = true
    )
  );

insert into public.organization_features (
  organization_id,
  feature_key,
  enabled,
  source
)
values (
  'c6ee7876-c88b-4419-abba-b2ed4cc54257',
  'prospecting_agent',
  true,
  'manual'
)
on conflict (organization_id, feature_key)
do update set
  enabled = excluded.enabled,
  source = excluded.source,
  updated_at = now();

notify pgrst, 'reload schema';

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone_number_id text not null,
  waba_id text,
  display_phone_number text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint whatsapp_connections_org_phone_unique
    unique (organization_id, phone_number_id),

  constraint whatsapp_connections_phone_unique
    unique (phone_number_id)
);

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,

  wa_id text not null,
  contact_name text,
  status text not null default 'open',
  assigned_user_id uuid references public.profiles(id) on delete set null,

  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint whatsapp_conversations_org_wa_unique
    unique (organization_id, wa_id)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,

  external_message_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null,
  text_body text,

  message_timestamp timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),

  constraint whatsapp_messages_external_unique
    unique (external_message_id)
);

create index if not exists whatsapp_connections_organization_idx
  on public.whatsapp_connections (organization_id);

create index if not exists whatsapp_conversations_organization_idx
  on public.whatsapp_conversations (organization_id);

create index if not exists whatsapp_conversations_last_message_idx
  on public.whatsapp_conversations (organization_id, last_message_at desc);

create index if not exists whatsapp_messages_conversation_idx
  on public.whatsapp_messages (conversation_id, message_timestamp);

alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;

-- =========================================================
-- WHATSAPP CONNECTIONS
-- Todos os membros da organização podem visualizar.
-- Somente Platform Admin, Owner ou Admin podem gerenciar.
-- =========================================================

create policy whatsapp_connections_select
on public.whatsapp_connections
for select
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = whatsapp_connections.organization_id
      and om.user_id = auth.uid()
  )
);

create policy whatsapp_connections_manage
on public.whatsapp_connections
for all
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members om
    join public.roles r
      on r.id = om.role_id
    where om.organization_id = whatsapp_connections.organization_id
      and om.user_id = auth.uid()
      and r.slug in ('owner', 'admin')
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members om
    join public.roles r
      on r.id = om.role_id
    where om.organization_id = whatsapp_connections.organization_id
      and om.user_id = auth.uid()
      and r.slug in ('owner', 'admin')
  )
);


-- =========================================================
-- WHATSAPP CONVERSATIONS
-- Todos os membros da organização podem acessar e trabalhar.
-- =========================================================

create policy whatsapp_conversations_select
on public.whatsapp_conversations
for select
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = whatsapp_conversations.organization_id
      and om.user_id = auth.uid()
  )
);

create policy whatsapp_conversations_manage
on public.whatsapp_conversations
for all
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = whatsapp_conversations.organization_id
      and om.user_id = auth.uid()
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = whatsapp_conversations.organization_id
      and om.user_id = auth.uid()
  )
);


-- =========================================================
-- WHATSAPP MESSAGES
-- Todos os membros da organização podem visualizar e responder.
-- =========================================================

create policy whatsapp_messages_select
on public.whatsapp_messages
for select
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = whatsapp_messages.organization_id
      and om.user_id = auth.uid()
  )
);

create policy whatsapp_messages_manage
on public.whatsapp_messages
for all
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = whatsapp_messages.organization_id
      and om.user_id = auth.uid()
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = whatsapp_messages.organization_id
      and om.user_id = auth.uid()
  )
);
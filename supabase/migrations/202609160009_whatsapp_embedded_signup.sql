alter table if exists public.whatsapp_connections
  add column if not exists waba_id text,
  add column if not exists display_phone_number text,
  add column if not exists verified_name text,
  add column if not exists connected_at timestamptz,
  add column if not exists disconnected_at timestamptz;

create unique index if not exists whatsapp_connections_active_org_unique
  on public.whatsapp_connections (organization_id)
  where status = 'active';

create table if not exists public.whatsapp_connection_secrets (
  connection_id uuid primary key references public.whatsapp_connections(id) on delete cascade,
  access_token text not null,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_connection_secrets enable row level security;

drop trigger if exists whatsapp_connection_secrets_updated_at
  on public.whatsapp_connection_secrets;

create trigger whatsapp_connection_secrets_updated_at
before update on public.whatsapp_connection_secrets
for each row execute function public.set_updated_at();

create index if not exists whatsapp_connections_org_status_idx
  on public.whatsapp_connections (organization_id, status);

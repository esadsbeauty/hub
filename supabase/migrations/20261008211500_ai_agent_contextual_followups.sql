-- Follow-ups automáticos e contextuais da Assistente Comercial.
-- Regras iniciais:
-- - máximo de 2 follow-ups por rodada de silêncio;
-- - máximo de 3 follow-ups nas últimas 24h por conversa;
-- - somente dentro da janela de 24h desde a última mensagem do lead;
-- - bloqueio de envio entre 22:00 e 06:00;
-- - qualquer nova mensagem do lead cancela a rodada pendente.

create table if not exists public.ai_agent_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  agent_id uuid not null
    references public.ai_agents(id) on delete cascade,
  ai_conversation_id uuid not null
    references public.ai_agent_conversations(id) on delete cascade,
  whatsapp_conversation_id uuid not null
    references public.whatsapp_conversations(id) on delete cascade,

  round_key text not null,
  sequence smallint not null check (sequence between 1 and 2),

  source_lead_message_at timestamptz not null,
  source_ai_message_at timestamptz not null,
  due_at timestamptz not null,

  status text not null default 'pending'
    check (status in ('pending','processing','sent','cancelled','expired','failed')),

  generated_message text,
  sent_at timestamptz,
  cancelled_at timestamptz,
  error_message text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (ai_conversation_id, round_key, sequence)
);

create index if not exists ai_agent_followups_due_idx
  on public.ai_agent_followups (due_at)
  where status = 'pending';

create index if not exists ai_agent_followups_conversation_idx
  on public.ai_agent_followups (
    ai_conversation_id,
    created_at desc
  );

alter table public.ai_agent_followups enable row level security;

drop policy if exists ai_agent_followups_select
  on public.ai_agent_followups;

create policy ai_agent_followups_select
on public.ai_agent_followups
for select
to authenticated
using (
  organization_id = public.current_organization_id()
  or public.is_platform_admin()
);

revoke all on table public.ai_agent_followups from anon;

-- Habilita a capacidade apenas nas duas organizações já configuradas/testadas.
update public.ai_agents
set
  capabilities =
    coalesce(capabilities, '{}'::jsonb)
    || '{"follow_up_leads": true}'::jsonb,
  behavior_config =
    coalesce(behavior_config, '{}'::jsonb)
    || '{
      "followup_timezone": "America/Sao_Paulo",
      "followup_quiet_start_hour": 22,
      "followup_quiet_end_hour": 6,
      "followup_max_per_round": 2,
      "followup_max_per_24h": 3,
      "followup_first_min_minutes": 120,
      "followup_first_max_minutes": 180,
      "followup_second_min_minutes": 360,
      "followup_second_max_minutes": 480
    }'::jsonb,
  updated_at = now()
where organization_id in (
  'c6ee7876-c88b-4419-abba-b2ed4cc54257',
  '49120337-151b-437b-84fd-22263c8dc2fa'
);

notify pgrst, 'reload schema';

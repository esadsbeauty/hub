alter table public.ai_agent_conversations
add column if not exists round_started_at timestamptz;

update public.ai_agent_conversations
set round_started_at = coalesce(round_started_at, created_at)
where round_started_at is null;

comment on column public.ai_agent_conversations.round_started_at is
  'Início da rodada atual da Assistente Comercial. Mensagens anteriores a este instante não devem influenciar qualificação, score ou handoff da rodada atual.';

-- =========================================================
-- AI Agent MVP Foundation
-- =========================================================

create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  name text not null,
  is_enabled boolean not null default false,

  objective text not null,

  tone text not null default 'profissional, leve, consultivo e direto',

  welcome_message text,

  qualification_questions jsonb not null default '[]'::jsonb,

  handoff_rules jsonb not null default '[]'::jsonb,

  business_context jsonb not null default '{}'::jsonb,

  crm_config jsonb not null default '{}'::jsonb,

  system_prompt text,

  model_provider text not null default 'openai',
  model_name text,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id)
);


create table if not exists public.ai_agent_conversations (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  agent_id uuid not null
    references public.ai_agents(id)
    on delete cascade,

  whatsapp_conversation_id uuid,

  company_id uuid references public.companies(id),
  opportunity_id uuid references public.opportunities(id),

  status text not null default 'active'
    check (
      status in (
        'active',
        'qualified',
        'handoff',
        'paused',
        'closed'
      )
    ),

  qualification_data jsonb not null default '{}'::jsonb,

  qualification_score integer
    check (
      qualification_score is null
      or qualification_score between 0 and 100
    ),

  summary text,

  handoff_reason text,

  last_ai_message_at timestamptz,
  last_lead_message_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists ai_agent_conversations_org_idx
on public.ai_agent_conversations (
  organization_id,
  status
);


create index if not exists ai_agent_conversations_whatsapp_idx
on public.ai_agent_conversations (
  organization_id,
  whatsapp_conversation_id
)
where whatsapp_conversation_id is not null;


create table if not exists public.ai_agent_runs (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  agent_id uuid not null
    references public.ai_agents(id)
    on delete cascade,

  conversation_id uuid not null
    references public.ai_agent_conversations(id)
    on delete cascade,

  input_message text,

  output_message text,

  model_provider text,
  model_name text,

  status text not null default 'processing'
    check (
      status in (
        'processing',
        'completed',
        'failed',
        'handoff'
      )
    ),

  error_message text,

  metadata jsonb not null default '{}'::jsonb,

  started_at timestamptz not null default now(),
  completed_at timestamptz,

  created_at timestamptz not null default now()
);


create index if not exists ai_agent_runs_conversation_idx
on public.ai_agent_runs (
  conversation_id,
  created_at desc
);


create table if not exists public.ai_agent_actions (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  agent_id uuid not null
    references public.ai_agents(id)
    on delete cascade,

  conversation_id uuid not null
    references public.ai_agent_conversations(id)
    on delete cascade,

  run_id uuid references public.ai_agent_runs(id)
    on delete set null,

  action_type text not null,

  payload jsonb not null default '{}'::jsonb,

  status text not null default 'completed'
    check (
      status in (
        'pending',
        'completed',
        'failed'
      )
    ),

  created_at timestamptz not null default now()
);


create index if not exists ai_agent_actions_conversation_idx
on public.ai_agent_actions (
  conversation_id,
  created_at desc
);


-- =========================================================
-- RLS
-- =========================================================

alter table public.ai_agents enable row level security;
alter table public.ai_agent_conversations enable row level security;
alter table public.ai_agent_runs enable row level security;
alter table public.ai_agent_actions enable row level security;


create policy ai_agents_select
on public.ai_agents
for select
to authenticated
using (
  organization_id = public.current_organization_id()
);


create policy ai_agents_manage
on public.ai_agents
for all
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('settings.manage')
)
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('settings.manage')
);


create policy ai_agent_conversations_select
on public.ai_agent_conversations
for select
to authenticated
using (
  organization_id = public.current_organization_id()
);


create policy ai_agent_runs_select
on public.ai_agent_runs
for select
to authenticated
using (
  organization_id = public.current_organization_id()
);


create policy ai_agent_actions_select
on public.ai_agent_actions
for select
to authenticated
using (
  organization_id = public.current_organization_id()
);


-- Escrita operacional fica para o backend/service role.
revoke all on table public.ai_agent_conversations from anon;
revoke all on table public.ai_agent_runs from anon;
revoke all on table public.ai_agent_actions from anon;
revoke all on table public.ai_agents from anon;


-- =========================================================
-- ESADS Beauty - configuração inicial
-- =========================================================

insert into public.ai_agents (
  organization_id,
  name,
  is_enabled,
  objective,
  tone,
  welcome_message,
  qualification_questions,
  handoff_rules,
  business_context,
  crm_config,
  system_prompt
)
values (
  'c6ee7876-c88b-4419-abba-b2ed4cc54257',
  'Regina',
  false,

  'Qualificar leads de profissionais e clínicas de estética e conduzir os leads com melhor aderência para uma reunião com a equipe da ESADS Beauty.',

  'profissional, leve, consultivo, humano e direto',

  'Oi! Tudo bem? Sou a Regina, assistente virtual da ESADS Beauty 😊 Posso te fazer algumas perguntas rápidas para entender melhor o seu negócio e ver como podemos te ajudar?',

  '[
    {
      "key": "main_service",
      "question": "Qual serviço ou procedimento você mais quer vender hoje?"
    },
    {
      "key": "lead_source",
      "question": "Como novas clientes chegam até você atualmente?"
    },
    {
      "key": "paid_traffic",
      "question": "Você investe em anúncios hoje ou já investiu anteriormente?"
    },
    {
      "key": "main_challenge",
      "question": "Hoje, qual é a sua maior dificuldade: gerar procura, transformar conversas em agendamentos ou acompanhar os leads?"
    },
    {
      "key": "weekly_clients",
      "question": "Em média, quantas novas clientes você atende por semana?"
    }
  ]'::jsonb,

  '[
    "Lead pediu para agendar uma reunião",
    "Lead pediu para falar com uma pessoa da equipe",
    "Lead apresentou uma objeção comercial complexa",
    "Lead fez uma pergunta que a IA não consegue responder com segurança",
    "Lead demonstrou intenção clara de contratar",
    "Lead solicitou uma proposta específica"
  ]'::jsonb,

  '{
    "business_name": "ESADS Beauty",
    "segment": "marketing, CRM e estrutura comercial para estética",
    "target_audience": "profissionais, clínicas e negócios do segmento de estética",
    "main_problem": "melhorar a geração, organização, acompanhamento e conversão de leads",
    "method": "Atrair, Qualificar, Organizar, Acompanhar e Vender"
  }'::jsonb,

  '{
    "create_or_update_lead": true,
    "create_or_update_opportunity": true,
    "initial_stage": "Novo Lead",
    "register_summary": true,
    "handoff_to_human": true
  }'::jsonb,

  'Você é a Regina, assistente virtual da ESADS Beauty.

Seu objetivo principal é conversar com leads do segmento de estética, entender o cenário atual do negócio, qualificar a oportunidade e conduzir leads com boa aderência para uma conversa com a equipe da ESADS Beauty.

Converse de forma natural. Faça uma pergunta por vez. Não transforme a conversa em um questionário.

Busque entender principalmente:
- qual serviço ou procedimento o lead deseja vender mais;
- como chegam novos clientes atualmente;
- se já investe ou investiu em tráfego pago;
- qual é a principal dificuldade comercial;
- quantas novas clientes atende aproximadamente por semana.

Não pressione o lead e não invente informações.

Quando identificar interesse claro em conversar com a equipe, pedir reunião, solicitar proposta específica, pedir atendimento humano ou quando não tiver segurança na resposta, sinalize handoff para uma pessoa da equipe.

Seu papel não é fechar a venda sozinho. Seu papel é qualificar, organizar as informações e facilitar a continuidade do atendimento humano.'
)
on conflict (organization_id)
do update set
  name = excluded.name,
  objective = excluded.objective,
  tone = excluded.tone,
  welcome_message = excluded.welcome_message,
  qualification_questions = excluded.qualification_questions,
  handoff_rules = excluded.handoff_rules,
  business_context = excluded.business_context,
  crm_config = excluded.crm_config,
  system_prompt = excluded.system_prompt,
  updated_at = now();


notify pgrst, 'reload schema';
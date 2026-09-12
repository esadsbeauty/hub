-- Customize only the established ESADS Beauty organization pipeline for an outbound prospecting cadence.
-- Existing opportunities are remapped before the redundant legacy stage is deactivated; no history is deleted.
alter table public.pipeline_stages add column if not exists is_active boolean not null default true;

do $$
declare
  target_org uuid;
  target_pipeline uuid;
  proposal_stage uuid;
  negotiation_stage uuid;
begin
  select id into target_org from public.organizations where slug='esads-beauty' limit 1;
  if target_org is null then raise exception 'esads_organization_not_found'; end if;
  select id into target_pipeline from public.pipelines where organization_id=target_org and is_default=true order by created_at,id limit 1;
  if target_pipeline is null then raise exception 'esads_default_pipeline_not_found'; end if;

  -- Free the operational positions without touching another tenant or deleting a referenced stage.
  update public.pipeline_stages set position=position+100,updated_at=now() where pipeline_id=target_pipeline;

  update public.pipeline_stages set name='Novo Lead',slug='novo_lead',position=0,probability=5,is_won=false,is_lost=false,is_active=true,updated_at=now() where pipeline_id=target_pipeline and slug='novo_lead';
  update public.pipeline_stages set name='A Contatar',slug='a_contatar',position=1,probability=10,is_won=false,is_lost=false,is_active=true,updated_at=now() where pipeline_id=target_pipeline and slug='pesquisado';
  update public.pipeline_stages set name='D1 · Primeiro Contato',slug='d1_primeiro_contato',position=2,probability=15,is_won=false,is_lost=false,is_active=true,updated_at=now() where pipeline_id=target_pipeline and slug='primeiro_contato';
  update public.pipeline_stages set name='D2 · Follow-up',slug='d2_follow_up',position=3,probability=20,is_won=false,is_lost=false,is_active=true,updated_at=now() where pipeline_id=target_pipeline and slug='aguardando_resposta';
  update public.pipeline_stages set name='Respondeu',slug='respondeu',position=9,probability=55,is_won=false,is_lost=false,is_active=true,updated_at=now() where pipeline_id=target_pipeline and slug='em_conversa';
  update public.pipeline_stages set name='Reunião Agendada',slug='reuniao_agendada',position=10,probability=70,is_won=false,is_lost=false,is_active=true,updated_at=now() where pipeline_id=target_pipeline and slug='reuniao_agendada';
  update public.pipeline_stages set name='Proposta / Negociação',slug='proposta_negociacao',position=11,probability=85,is_won=false,is_lost=false,is_active=true,updated_at=now() where pipeline_id=target_pipeline and slug='proposta_enviada' returning id into proposal_stage;
  select id into negotiation_stage from public.pipeline_stages where pipeline_id=target_pipeline and slug='negociacao';
  if proposal_stage is null or negotiation_stage is null then raise exception 'esads_legacy_stage_mapping_incomplete'; end if;

  -- The existing stage-change trigger preserves audit history and emits the normal timeline event.
  update public.opportunities set stage_id=proposal_stage,probability=85,updated_at=now() where organization_id=target_org and pipeline_id=target_pipeline and stage_id=negotiation_stage;
  update public.pipeline_stages set is_active=false,position=(select coalesce(max(position),99)+1 from public.pipeline_stages where pipeline_id=target_pipeline and id<>negotiation_stage),updated_at=now() where id=negotiation_stage;
  update public.pipeline_stages set name='Cliente Fechado',slug='cliente_fechado',position=12,probability=100,is_won=true,is_lost=false,is_active=true,updated_at=now() where pipeline_id=target_pipeline and slug='cliente_fechado';
  update public.pipeline_stages set name='Perdido',slug='perdido',position=13,probability=0,is_won=false,is_lost=true,is_active=true,updated_at=now() where pipeline_id=target_pipeline and slug='perdido';

  insert into public.pipeline_stages(pipeline_id,name,slug,position,probability,is_won,is_lost,is_active) values
    (target_pipeline,'D3 · Aquecimento','d3_aquecimento',4,25,false,false,true),
    (target_pipeline,'D4 · Prova / Case','d4_prova_case',5,30,false,false,true),
    (target_pipeline,'D5 · Outro Canal','d5_outro_canal',6,35,false,false,true),
    (target_pipeline,'D6 · Reforço','d6_reforco',7,40,false,false,true),
    (target_pipeline,'D7 · Último Contato','d7_ultimo_contato',8,45,false,false,true)
  on conflict(pipeline_id,slug) do update set name=excluded.name,position=excluded.position,probability=excluded.probability,is_won=excluded.is_won,is_lost=excluded.is_lost,is_active=true,updated_at=now();

  update public.opportunities o set probability=s.probability,updated_at=now() from public.pipeline_stages s where o.organization_id=target_org and o.pipeline_id=target_pipeline and o.stage_id=s.id and o.probability is distinct from s.probability;
  update public.pipelines set description='Cadência comercial de prospecção da ESADS Beauty',updated_at=now() where id=target_pipeline;
end $$;

-- Fix reversible B2C/B2C Beauty switching when the organization already has
-- another default pipeline.
-- The partial unique constraint pipelines_one_default_per_org can reject a
-- single UPDATE that flips one row true while another row is still true.
-- We now clear the current default first, then enable the target pipeline.

create or replace function public.ensure_b2c_beauty_pipeline(target_organization_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  beauty_pipeline uuid;
  stage_novo_lead uuid;
  stage_em_atendimento uuid;
  stage_agendado uuid;
  stage_compareceu uuid;
  stage_follow_up uuid;
  stage_fechou uuid;
  stage_perdido uuid;
begin
  if target_organization_id is null then
    raise exception 'organization_required' using errcode='22023';
  end if;

  if not exists (
    select 1
    from public.organizations
    where id = target_organization_id
  ) then
    raise exception 'organization_not_found' using errcode='P0002';
  end if;

  select p.id
    into beauty_pipeline
  from public.pipelines p
  where p.organization_id = target_organization_id
    and p.name = 'Pipeline Beauty'
  order by p.is_default desc, p.created_at asc
  limit 1;

  if beauty_pipeline is null then
    insert into public.pipelines(
      organization_id,
      name,
      description,
      is_default
    )
    values(
      target_organization_id,
      'Pipeline Beauty',
      'Pipeline comercial para estética e beleza',
      false
    )
    returning id into beauty_pipeline;
  end if;

  update public.pipeline_stages
  set position = position + 1000,
      updated_at = now()
  where pipeline_id = beauty_pipeline
    and position < 1000;

  insert into public.pipeline_stages(
    pipeline_id,
    name,
    slug,
    position,
    probability,
    is_won,
    is_lost,
    is_active
  )
  values
    (beauty_pipeline,'Novo Lead','novo_lead',0,10,false,false,true),
    (beauty_pipeline,'Em atendimento','em_atendimento',1,30,false,false,true),
    (beauty_pipeline,'Agendado','agendado',2,60,false,false,true),
    (beauty_pipeline,'Compareceu','compareceu',3,75,false,false,true),
    (beauty_pipeline,'Follow-up','follow_up',4,85,false,false,true),
    (beauty_pipeline,'Fechou','fechou',5,100,true,false,true),
    (beauty_pipeline,'Perdido','perdido',6,0,false,true,true)
  on conflict (pipeline_id, slug) do update
  set name = excluded.name,
      position = excluded.position,
      probability = excluded.probability,
      is_won = excluded.is_won,
      is_lost = excluded.is_lost,
      is_active = true,
      updated_at = now();

  update public.pipeline_stages
  set is_active = false,
      updated_at = now()
  where pipeline_id = beauty_pipeline
    and slug not in (
      'novo_lead',
      'em_atendimento',
      'agendado',
      'compareceu',
      'follow_up',
      'fechou',
      'perdido'
    );

  select id into stage_novo_lead
  from public.pipeline_stages
  where pipeline_id=beauty_pipeline and slug='novo_lead';

  select id into stage_em_atendimento
  from public.pipeline_stages
  where pipeline_id=beauty_pipeline and slug='em_atendimento';

  select id into stage_agendado
  from public.pipeline_stages
  where pipeline_id=beauty_pipeline and slug='agendado';

  select id into stage_compareceu
  from public.pipeline_stages
  where pipeline_id=beauty_pipeline and slug='compareceu';

  select id into stage_follow_up
  from public.pipeline_stages
  where pipeline_id=beauty_pipeline and slug='follow_up';

  select id into stage_fechou
  from public.pipeline_stages
  where pipeline_id=beauty_pipeline and slug='fechou';

  select id into stage_perdido
  from public.pipeline_stages
  where pipeline_id=beauty_pipeline and slug='perdido';

  -- Important: two-step default switch avoids the partial unique constraint race.
  update public.pipelines
  set is_default = false,
      updated_at = now()
  where organization_id = target_organization_id
    and is_default = true
    and id <> beauty_pipeline;

  update public.pipelines
  set is_default = true,
      updated_at = now()
  where id = beauty_pipeline
    and organization_id = target_organization_id;

  update public.opportunities o
  set pipeline_id = beauty_pipeline,
      stage_id = case
        when o.status = 'won' or old_stage.is_won then stage_fechou
        when o.status = 'lost' or old_stage.is_lost then stage_perdido
        when old_stage.slug in ('novo_lead','pesquisado','a_contatar') then stage_novo_lead
        when old_stage.slug in (
          'primeiro_contato',
          'd1_primeiro_contato',
          'aguardando_resposta',
          'em_conversa',
          'respondeu'
        ) then stage_em_atendimento
        when old_stage.slug in ('reuniao_agendada','agendado') then stage_agendado
        when old_stage.slug = 'compareceu' then stage_compareceu
        when old_stage.slug in (
          'd2_follow_up',
          'follow_up',
          'proposta_enviada',
          'proposta_negociacao',
          'negociacao'
        ) then stage_follow_up
        when old_stage.slug in ('cliente_fechado','fechou') then stage_fechou
        when old_stage.slug = 'perdido' then stage_perdido
        else stage_em_atendimento
      end,
      probability = case
        when o.status = 'won' or old_stage.is_won then 100
        when o.status = 'lost' or old_stage.is_lost then 0
        when old_stage.slug in ('novo_lead','pesquisado','a_contatar') then 10
        when old_stage.slug in (
          'primeiro_contato',
          'd1_primeiro_contato',
          'aguardando_resposta',
          'em_conversa',
          'respondeu'
        ) then 30
        when old_stage.slug in ('reuniao_agendada','agendado') then 60
        when old_stage.slug = 'compareceu' then 75
        when old_stage.slug in (
          'd2_follow_up',
          'follow_up',
          'proposta_enviada',
          'proposta_negociacao',
          'negociacao'
        ) then 85
        when old_stage.slug in ('cliente_fechado','fechou') then 100
        when old_stage.slug = 'perdido' then 0
        else 30
      end,
      updated_at = now()
  from public.pipeline_stages old_stage
  where o.organization_id = target_organization_id
    and o.stage_id = old_stage.id
    and o.pipeline_id <> beauty_pipeline;

  return beauty_pipeline;
end
$$;

revoke all on function public.ensure_b2c_beauty_pipeline(uuid)
from public,anon,authenticated;


create or replace function public.ensure_b2c_standard_pipeline(target_organization_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  standard_pipeline uuid;
  beauty_pipeline uuid;
  stage_novo_lead uuid;
  stage_em_conversa uuid;
  stage_reuniao_agendada uuid;
  stage_aguardando_resposta uuid;
  stage_proposta_enviada uuid;
  stage_cliente_fechado uuid;
  stage_perdido uuid;
begin
  if target_organization_id is null then
    raise exception 'organization_required' using errcode='22023';
  end if;

  select p.id
    into standard_pipeline
  from public.pipelines p
  where p.organization_id = target_organization_id
    and p.name <> 'Pipeline Beauty'
  order by
    case when p.name = 'Pipeline Comercial' then 0 else 1 end,
    p.created_at,
    p.id
  limit 1;

  if standard_pipeline is null then
    raise exception 'standard_pipeline_not_found' using errcode='P0002';
  end if;

  select p.id
    into beauty_pipeline
  from public.pipelines p
  where p.organization_id = target_organization_id
    and p.name = 'Pipeline Beauty'
  order by p.created_at, p.id
  limit 1;

  select id into stage_novo_lead
  from public.pipeline_stages
  where pipeline_id=standard_pipeline and slug='novo_lead'
  order by position,id limit 1;

  select id into stage_em_conversa
  from public.pipeline_stages
  where pipeline_id=standard_pipeline and slug='em_conversa'
  order by position,id limit 1;

  select id into stage_reuniao_agendada
  from public.pipeline_stages
  where pipeline_id=standard_pipeline and slug='reuniao_agendada'
  order by position,id limit 1;

  select id into stage_aguardando_resposta
  from public.pipeline_stages
  where pipeline_id=standard_pipeline and slug='aguardando_resposta'
  order by position,id limit 1;

  select id into stage_proposta_enviada
  from public.pipeline_stages
  where pipeline_id=standard_pipeline and slug='proposta_enviada'
  order by position,id limit 1;

  select id into stage_cliente_fechado
  from public.pipeline_stages
  where pipeline_id=standard_pipeline and slug='cliente_fechado'
  order by position,id limit 1;

  select id into stage_perdido
  from public.pipeline_stages
  where pipeline_id=standard_pipeline and slug='perdido'
  order by position,id limit 1;

  if stage_novo_lead is null
     or stage_em_conversa is null
     or stage_reuniao_agendada is null
     or stage_aguardando_resposta is null
     or stage_proposta_enviada is null
     or stage_cliente_fechado is null
     or stage_perdido is null then
    raise exception 'standard_pipeline_stages_missing' using errcode='P0002';
  end if;

  -- Important: clear the Beauty/default row first, then enable the standard row.
  update public.pipelines
  set is_default = false,
      updated_at = now()
  where organization_id = target_organization_id
    and is_default = true
    and id <> standard_pipeline;

  update public.pipelines
  set is_default = true,
      updated_at = now()
  where id = standard_pipeline
    and organization_id = target_organization_id;

  if beauty_pipeline is not null then
    update public.opportunities o
    set pipeline_id = standard_pipeline,
        stage_id = case
          when o.status = 'won' or old_stage.is_won then stage_cliente_fechado
          when o.status = 'lost' or old_stage.is_lost then stage_perdido
          when old_stage.slug = 'novo_lead' then stage_novo_lead
          when old_stage.slug = 'em_atendimento' then stage_em_conversa
          when old_stage.slug = 'agendado' then stage_reuniao_agendada
          when old_stage.slug = 'compareceu' then stage_proposta_enviada
          when old_stage.slug = 'follow_up' then stage_aguardando_resposta
          when old_stage.slug = 'fechou' then stage_cliente_fechado
          when old_stage.slug = 'perdido' then stage_perdido
          else stage_em_conversa
        end,
        probability = case
          when o.status = 'won' or old_stage.is_won then 100
          when o.status = 'lost' or old_stage.is_lost then 0
          when old_stage.slug = 'novo_lead' then 10
          when old_stage.slug = 'em_atendimento' then 35
          when old_stage.slug = 'agendado' then 50
          when old_stage.slug = 'compareceu' then 65
          when old_stage.slug = 'follow_up' then 25
          when old_stage.slug = 'fechou' then 100
          when old_stage.slug = 'perdido' then 0
          else 35
        end,
        updated_at = now()
    from public.pipeline_stages old_stage
    where o.organization_id = target_organization_id
      and o.pipeline_id = beauty_pipeline
      and o.stage_id = old_stage.id;
  end if;

  return standard_pipeline;
end
$$;

revoke all on function public.ensure_b2c_standard_pipeline(uuid)
from public,anon,authenticated;

notify pgrst,'reload schema';

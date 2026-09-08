-- B2C Beauty: create and activate a beauty-specific CRM pipeline when the tenant
-- changes its business mode to b2c_beauty. Existing B2B/B2C tenants are untouched.

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

  -- Move any pre-existing positions out of the way before normalizing the
  -- seven Beauty stages. This keeps the operation idempotent.
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

  -- Keep any unexpected extra stage from appearing in the Beauty pipeline.
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

  -- Make Beauty the default pipeline for this tenant.
  update public.pipelines
  set is_default = (id = beauty_pipeline),
      updated_at = now()
  where organization_id = target_organization_id;

  -- Move existing opportunities into the Beauty pipeline without deleting any
  -- lead. Closed states are preserved first; open legacy stages are mapped to
  -- the closest Beauty stage.
  update public.opportunities o
  set pipeline_id = beauty_pipeline,
      stage_id = case
        when o.status = 'won' or old_stage.is_won then stage_fechou
        when o.status = 'lost' or old_stage.is_lost then stage_perdido

        when old_stage.slug in ('novo_lead','pesquisado','a_contatar')
          then stage_novo_lead

        when old_stage.slug in (
          'primeiro_contato',
          'd1_primeiro_contato',
          'aguardando_resposta',
          'em_conversa',
          'respondeu'
        )
          then stage_em_atendimento

        when old_stage.slug in ('reuniao_agendada','agendado')
          then stage_agendado

        when old_stage.slug in ('compareceu')
          then stage_compareceu

        when old_stage.slug in (
          'd2_follow_up',
          'follow_up',
          'proposta_enviada',
          'proposta_negociacao',
          'negociacao'
        )
          then stage_follow_up

        when old_stage.slug in ('cliente_fechado','fechou')
          then stage_fechou

        when old_stage.slug = 'perdido'
          then stage_perdido

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
from public, anon, authenticated;


create or replace function public.update_organization_business_mode(next_mode text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  tenant uuid := public.current_organization_id();
  previous_mode text;
begin
  if tenant is null then
    raise exception 'organization_required' using errcode='42501';
  end if;

  if not public.can_manage_current_business_mode() then
    raise exception 'access_denied' using errcode='42501';
  end if;

  if next_mode not in ('b2c','b2b','b2c_beauty') then
    raise exception 'invalid_business_mode' using errcode='22023';
  end if;

  select business_mode
    into previous_mode
  from public.organizations
  where id=tenant
  for update;

  if previous_mode is null then
    raise exception 'organization_not_found' using errcode='P0002';
  end if;

  if previous_mode = next_mode then
    if next_mode = 'b2c_beauty' then
      perform public.ensure_b2c_beauty_pipeline(tenant);
    end if;
    return next_mode;
  end if;

  update public.organizations
  set business_mode=next_mode,
      updated_at=now()
  where id=tenant;

  if next_mode = 'b2c_beauty' then
    perform public.ensure_b2c_beauty_pipeline(tenant);
  end if;

  perform public.write_audit_log(
    'business_mode_updated',
    'organization',
    tenant,
    'settings',
    jsonb_build_object('business_mode',previous_mode),
    jsonb_build_object('business_mode',next_mode)
  );

  return next_mode;
end
$$;

revoke all on function public.update_organization_business_mode(text)
from public,anon;

grant execute on function public.update_organization_business_mode(text)
to authenticated;

notify pgrst,'reload schema';

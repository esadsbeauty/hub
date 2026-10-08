-- Make business-mode switching reversible between standard B2C and B2C Beauty.
-- B2C Beauty => Pipeline Beauty is default.
-- B2C => original non-Beauty commercial pipeline is default.
-- Existing opportunities are remapped; nothing is deleted.

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

  update public.pipelines
  set is_default = (id = standard_pipeline),
      updated_at = now()
  where organization_id = target_organization_id;

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

  -- Re-apply the correct default pipeline even when the mode value itself
  -- is already unchanged. This also repairs tenants affected by the old logic.
  if next_mode = 'b2c_beauty' then
    perform public.ensure_b2c_beauty_pipeline(tenant);
  elsif next_mode = 'b2c' then
    perform public.ensure_b2c_standard_pipeline(tenant);
  end if;

  if previous_mode = next_mode then
    return next_mode;
  end if;

  update public.organizations
  set business_mode=next_mode,
      updated_at=now()
  where id=tenant;

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

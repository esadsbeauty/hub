-- Customizable CRM pipeline stages per organization.
--
-- This migration keeps the Beauty pipeline bootstrap idempotent without
-- resetting tenant customizations, and exposes tenant-scoped RPCs for stage
-- administration.

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
    select 1 from public.organizations where id=target_organization_id
  ) then
    raise exception 'organization_not_found' using errcode='P0002';
  end if;

  select p.id into beauty_pipeline
  from public.pipelines p
  where p.organization_id=target_organization_id
    and p.name='Pipeline Beauty'
  order by p.is_default desc,p.created_at asc
  limit 1;

  if beauty_pipeline is null then
    insert into public.pipelines(organization_id,name,description,is_default)
    values(
      target_organization_id,
      'Pipeline Beauty',
      'Pipeline comercial para estética e beleza',
      false
    )
    returning id into beauty_pipeline;
  end if;

  -- Only create canonical stages that do not exist yet. Existing names,
  -- probability, position and active state are preserved.
  insert into public.pipeline_stages(
    pipeline_id,name,slug,position,probability,is_won,is_lost,is_active
  )
  values
    (beauty_pipeline,'Novo Lead','novo_lead',0,10,false,false,true),
    (beauty_pipeline,'Em atendimento','em_atendimento',1,30,false,false,true),
    (beauty_pipeline,'Agendado','agendado',2,60,false,false,true),
    (beauty_pipeline,'Compareceu','compareceu',3,75,false,false,true),
    (beauty_pipeline,'Follow-up','follow_up',4,85,false,false,true),
    (beauty_pipeline,'Fechou','fechou',5,100,true,false,true),
    (beauty_pipeline,'Perdido','perdido',6,0,false,true,true)
  on conflict (pipeline_id,slug) do nothing;

  select id into stage_novo_lead from public.pipeline_stages
  where pipeline_id=beauty_pipeline and slug='novo_lead';
  select id into stage_em_atendimento from public.pipeline_stages
  where pipeline_id=beauty_pipeline and slug='em_atendimento';
  select id into stage_agendado from public.pipeline_stages
  where pipeline_id=beauty_pipeline and slug='agendado';
  select id into stage_compareceu from public.pipeline_stages
  where pipeline_id=beauty_pipeline and slug='compareceu';
  select id into stage_follow_up from public.pipeline_stages
  where pipeline_id=beauty_pipeline and slug='follow_up';
  select id into stage_fechou from public.pipeline_stages
  where pipeline_id=beauty_pipeline and slug='fechou';
  select id into stage_perdido from public.pipeline_stages
  where pipeline_id=beauty_pipeline and slug='perdido';

  update public.pipelines
  set is_default=false,updated_at=now()
  where organization_id=target_organization_id
    and is_default=true
    and id<>beauty_pipeline;

  update public.pipelines
  set is_default=true,updated_at=now()
  where id=beauty_pipeline
    and organization_id=target_organization_id;

  -- Keep the existing business-mode switch behavior. This only affects
  -- opportunities that are still in a different pipeline.
  update public.opportunities o
  set pipeline_id=beauty_pipeline,
      stage_id=case
        when o.status='won' or old_stage.is_won then stage_fechou
        when o.status='lost' or old_stage.is_lost then stage_perdido
        when old_stage.slug in ('novo_lead','pesquisado','a_contatar') then stage_novo_lead
        when old_stage.slug in ('primeiro_contato','d1_primeiro_contato','aguardando_resposta','em_conversa','respondeu') then stage_em_atendimento
        when old_stage.slug in ('reuniao_agendada','agendado') then stage_agendado
        when old_stage.slug='compareceu' then stage_compareceu
        when old_stage.slug in ('d2_follow_up','follow_up','proposta_enviada','proposta_negociacao','negociacao') then stage_follow_up
        when old_stage.slug in ('cliente_fechado','fechou') then stage_fechou
        when old_stage.slug='perdido' then stage_perdido
        else stage_em_atendimento
      end,
      probability=case
        when o.status='won' or old_stage.is_won then 100
        when o.status='lost' or old_stage.is_lost then 0
        when old_stage.slug in ('novo_lead','pesquisado','a_contatar') then 10
        when old_stage.slug in ('primeiro_contato','d1_primeiro_contato','aguardando_resposta','em_conversa','respondeu') then 30
        when old_stage.slug in ('reuniao_agendada','agendado') then 60
        when old_stage.slug='compareceu' then 75
        when old_stage.slug in ('d2_follow_up','follow_up','proposta_enviada','proposta_negociacao','negociacao') then 85
        when old_stage.slug in ('cliente_fechado','fechou') then 100
        when old_stage.slug='perdido' then 0
        else 30
      end,
      updated_at=now()
  from public.pipeline_stages old_stage
  where o.organization_id=target_organization_id
    and o.stage_id=old_stage.id
    and o.pipeline_id<>beauty_pipeline;

  return beauty_pipeline;
end
$$;

revoke all on function public.ensure_b2c_beauty_pipeline(uuid)
from public,anon,authenticated;


create or replace function public.create_pipeline_stage(
  target_pipeline_id uuid,
  stage_name text,
  stage_probability numeric default 0
)
returns public.pipeline_stages
language plpgsql
security definer
set search_path=public
as $$
declare
  tenant uuid:=public.current_organization_id();
  next_position integer;
  generated_slug text;
  created_stage public.pipeline_stages;
begin
  if tenant is null then
    raise exception 'organization_required' using errcode='42501';
  end if;
  if not public.can_manage_current_business_mode() then
    raise exception 'access_denied' using errcode='42501';
  end if;
  if stage_name is null or btrim(stage_name)='' then
    raise exception 'stage_name_required' using errcode='22023';
  end if;
  if stage_probability<0 or stage_probability>100 then
    raise exception 'invalid_probability' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.pipelines p
    where p.id=target_pipeline_id and p.organization_id=tenant
  ) then
    raise exception 'pipeline_not_found' using errcode='P0002';
  end if;

  select coalesce(max(ps.position),-1)+1 into next_position
  from public.pipeline_stages ps
  where ps.pipeline_id=target_pipeline_id;

  generated_slug:='custom_'||substr(replace(gen_random_uuid()::text,'-',''),1,12);

  insert into public.pipeline_stages(
    pipeline_id,name,slug,position,probability,is_won,is_lost,is_active
  ) values(
    target_pipeline_id,btrim(stage_name),generated_slug,next_position,
    stage_probability,false,false,true
  ) returning * into created_stage;

  return created_stage;
end
$$;

revoke all on function public.create_pipeline_stage(uuid,text,numeric)
from public,anon;
grant execute on function public.create_pipeline_stage(uuid,text,numeric)
to authenticated;


create or replace function public.update_pipeline_stage(
  target_stage_id uuid,
  stage_name text default null,
  stage_probability numeric default null
)
returns public.pipeline_stages
language plpgsql
security definer
set search_path=public
as $$
declare
  tenant uuid:=public.current_organization_id();
  updated_stage public.pipeline_stages;
begin
  if tenant is null then
    raise exception 'organization_required' using errcode='42501';
  end if;
  if not public.can_manage_current_business_mode() then
    raise exception 'access_denied' using errcode='42501';
  end if;
  if stage_name is not null and btrim(stage_name)='' then
    raise exception 'stage_name_required' using errcode='22023';
  end if;
  if stage_probability is not null and (stage_probability<0 or stage_probability>100) then
    raise exception 'invalid_probability' using errcode='22023';
  end if;

  update public.pipeline_stages ps
  set name=coalesce(nullif(btrim(stage_name),''),ps.name),
      probability=coalesce(stage_probability,ps.probability),
      updated_at=now()
  from public.pipelines p
  where ps.id=target_stage_id
    and p.id=ps.pipeline_id
    and p.organization_id=tenant
  returning ps.* into updated_stage;

  if updated_stage.id is null then
    raise exception 'stage_not_found' using errcode='P0002';
  end if;
  return updated_stage;
end
$$;

revoke all on function public.update_pipeline_stage(uuid,text,numeric)
from public,anon;
grant execute on function public.update_pipeline_stage(uuid,text,numeric)
to authenticated;


create or replace function public.reorder_pipeline_stages(
  target_pipeline_id uuid,
  ordered_stage_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  tenant uuid:=public.current_organization_id();
  active_count integer;
  provided_count integer;
  matching_count integer;
  stage_id uuid;
  idx integer:=0;
begin
  if tenant is null then
    raise exception 'organization_required' using errcode='42501';
  end if;
  if not public.can_manage_current_business_mode() then
    raise exception 'access_denied' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.pipelines p
    where p.id=target_pipeline_id and p.organization_id=tenant
  ) then
    raise exception 'pipeline_not_found' using errcode='P0002';
  end if;
  if ordered_stage_ids is null or cardinality(ordered_stage_ids)=0 then
    raise exception 'stage_order_required' using errcode='22023';
  end if;

  select count(*) into active_count
  from public.pipeline_stages ps
  where ps.pipeline_id=target_pipeline_id and ps.is_active=true;

  select count(distinct value) into provided_count
  from unnest(ordered_stage_ids) value;

  select count(*) into matching_count
  from public.pipeline_stages ps
  where ps.pipeline_id=target_pipeline_id
    and ps.is_active=true
    and ps.id=any(ordered_stage_ids);

  if provided_count<>cardinality(ordered_stage_ids)
     or matching_count<>active_count
     or cardinality(ordered_stage_ids)<>active_count then
    raise exception 'invalid_stage_order' using errcode='22023';
  end if;

  -- Move every stage away first so a unique (pipeline_id,position) constraint
  -- cannot collide with active or archived stages.
  update public.pipeline_stages
  set position=position+100000,updated_at=now()
  where pipeline_id=target_pipeline_id;

  foreach stage_id in array ordered_stage_ids loop
    update public.pipeline_stages
    set position=idx,updated_at=now()
    where id=stage_id and pipeline_id=target_pipeline_id and is_active=true;
    idx:=idx+1;
  end loop;

  -- Archived stages stay out of the visible sequence.
  with archived as (
    select ps.id,row_number() over(order by ps.position,ps.created_at,ps.id)-1 as rn
    from public.pipeline_stages ps
    where ps.pipeline_id=target_pipeline_id and ps.is_active=false
  )
  update public.pipeline_stages ps
  set position=10000+archived.rn,updated_at=now()
  from archived
  where ps.id=archived.id;
end
$$;

revoke all on function public.reorder_pipeline_stages(uuid,uuid[])
from public,anon;
grant execute on function public.reorder_pipeline_stages(uuid,uuid[])
to authenticated;


create or replace function public.archive_pipeline_stage(target_stage_id uuid)
returns public.pipeline_stages
language plpgsql
security definer
set search_path=public
as $$
declare
  tenant uuid:=public.current_organization_id();
  current_stage public.pipeline_stages;
  archived_stage public.pipeline_stages;
  active_ids uuid[];
begin
  if tenant is null then
    raise exception 'organization_required' using errcode='42501';
  end if;
  if not public.can_manage_current_business_mode() then
    raise exception 'access_denied' using errcode='42501';
  end if;

  select ps.* into current_stage
  from public.pipeline_stages ps
  join public.pipelines p on p.id=ps.pipeline_id
  where ps.id=target_stage_id and p.organization_id=tenant
  for update of ps;

  if current_stage.id is null then
    raise exception 'stage_not_found' using errcode='P0002';
  end if;
  if current_stage.is_won or current_stage.is_lost then
    raise exception 'protected_stage' using errcode='22023';
  end if;
  if exists(
    select 1 from public.opportunities o
    where o.organization_id=tenant
      and o.stage_id=target_stage_id
      and o.deleted_at is null
      and o.status<>'archived'
  ) then
    raise exception 'stage_has_opportunities' using errcode='23503';
  end if;

  update public.pipeline_stages
  set is_active=false,updated_at=now()
  where id=target_stage_id
  returning * into archived_stage;

  select array_agg(ps.id order by ps.position,ps.created_at,ps.id)
  into active_ids
  from public.pipeline_stages ps
  where ps.pipeline_id=current_stage.pipeline_id and ps.is_active=true;

  if active_ids is not null and cardinality(active_ids)>0 then
    perform public.reorder_pipeline_stages(current_stage.pipeline_id,active_ids);
  end if;

  return archived_stage;
end
$$;

revoke all on function public.archive_pipeline_stage(uuid)
from public,anon;
grant execute on function public.archive_pipeline_stage(uuid)
to authenticated;

notify pgrst,'reload schema';

-- ESADS Beauty: etapa inicial aguardando atendimento da Assistente Comercial.
-- Todo lead novo de tráfego pago entra na etapa configurada como
-- awaiting_qualification_stage_id. Para a organização principal, essa etapa
-- passa a se chamar "Aguardando atendimento".
--
-- Importante:
-- - não move oportunidades já existentes;
-- - não empurra leads em andamento para trás;
-- - prospecção já usa awaiting_qualification_stage_id e permanece alinhada;
-- - tráfego pago deixa de depender do slug fixo "novo_lead".

do $$
declare
  v_org_id uuid := 'c6ee7876-c88b-4419-abba-b2ed4cc54257';
  v_awaiting_stage_id uuid;
begin
  select nullif(
    trim(a.crm_config ->> 'awaiting_qualification_stage_id'),
    ''
  )::uuid
  into v_awaiting_stage_id
  from public.ai_agents a
  where a.organization_id = v_org_id
  order by a.updated_at desc
  limit 1;

  if v_awaiting_stage_id is null then
    raise exception 'esads_awaiting_stage_not_configured';
  end if;

  update public.pipeline_stages
  set
    name = 'Aguardando atendimento',
    updated_at = now()
  where id = v_awaiting_stage_id
    and is_active = true;
end $$;


create or replace function public.upsert_paid_traffic_lead(
  p_organization_id uuid,
  p_name text,
  p_whatsapp text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_company_id uuid;
  v_opportunity_id uuid;
  v_pipeline_id uuid;
  v_stage_id uuid;
  v_created_by uuid;
  v_company_created boolean := false;
  v_opportunity_created boolean := false;
  v_crm_config jsonb;
begin
  v_phone := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');

  if v_phone = '' then
    raise exception 'WhatsApp inválido';
  end if;

  v_created_by := '5fb4d67f-a56e-4c6d-8573-4693cd6e1509';

  select c.id
  into v_company_id
  from public.companies c
  where c.organization_id = p_organization_id
    and c.deleted_at is null
    and (
      regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g') = v_phone
      or
      regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_phone
    )
  order by c.created_at asc
  limit 1;

  if v_company_id is null then
    insert into public.companies (
      organization_id,
      name,
      whatsapp,
      source,
      tags,
      lifecycle_stage,
      created_by,
      last_interaction_at
    )
    values (
      p_organization_id,
      coalesce(nullif(trim(p_name), ''), v_phone),
      v_phone,
      'Tráfego Pago',
      array['Tráfego'],
      'lead',
      v_created_by,
      now()
    )
    returning id into v_company_id;

    v_company_created := true;
  else
    update public.companies
    set
      source = 'Tráfego Pago',
      tags = case
        when 'Tráfego' = any(tags) then tags
        else array_append(coalesce(tags, '{}'::text[]), 'Tráfego')
      end,
      last_interaction_at = now(),
      updated_at = now()
    where id = v_company_id;
  end if;

  -- A etapa inicial vem da configuração da Assistente Comercial.
  select a.crm_config
  into v_crm_config
  from public.ai_agents a
  where a.organization_id = p_organization_id
    and a.is_enabled = true
  order by a.updated_at desc
  limit 1;

  begin
    v_stage_id := nullif(
      trim(v_crm_config ->> 'awaiting_qualification_stage_id'),
      ''
    )::uuid;
  exception when others then
    v_stage_id := null;
  end;

  if v_stage_id is not null then
    select ps.pipeline_id
    into v_pipeline_id
    from public.pipeline_stages ps
    join public.pipelines p
      on p.id = ps.pipeline_id
    where ps.id = v_stage_id
      and ps.is_active = true
      and ps.is_won = false
      and ps.is_lost = false
      and p.organization_id = p_organization_id
    limit 1;
  end if;

  -- Fallback seguro: primeira etapa ativa do pipeline padrão.
  if v_pipeline_id is null or v_stage_id is null then
    select p.id
    into v_pipeline_id
    from public.pipelines p
    where p.organization_id = p_organization_id
      and p.is_default = true
    order by p.created_at asc
    limit 1;

    if v_pipeline_id is null then
      raise exception 'Pipeline padrão não encontrado';
    end if;

    select ps.id
    into v_stage_id
    from public.pipeline_stages ps
    where ps.pipeline_id = v_pipeline_id
      and ps.is_active = true
      and ps.is_won = false
      and ps.is_lost = false
    order by ps.position asc, ps.created_at asc
    limit 1;
  end if;

  if v_stage_id is null then
    raise exception 'Estágio inicial não encontrado';
  end if;

  -- Reaproveita oportunidade aberta sem alterar sua etapa.
  select o.id
  into v_opportunity_id
  from public.opportunities o
  where o.organization_id = p_organization_id
    and o.company_id = v_company_id
    and o.status = 'open'
    and o.deleted_at is null
  order by o.created_at desc
  limit 1;

  if v_opportunity_id is null then
    insert into public.opportunities (
      organization_id,
      company_id,
      pipeline_id,
      stage_id,
      title,
      source,
      status,
      created_by
    )
    values (
      p_organization_id,
      v_company_id,
      v_pipeline_id,
      v_stage_id,
      coalesce(nullif(trim(p_name), ''), 'Lead WhatsApp'),
      'Tráfego Pago',
      'open',
      v_created_by
    )
    returning id into v_opportunity_id;

    v_opportunity_created := true;
  end if;

  return jsonb_build_object(
    'company_id', v_company_id,
    'opportunity_id', v_opportunity_id,
    'company_created', v_company_created,
    'opportunity_created', v_opportunity_created,
    'pipeline_id', v_pipeline_id,
    'stage_id', v_stage_id
  );
end;
$$;

revoke execute on function public.upsert_paid_traffic_lead(uuid, text, text)
from public, anon, authenticated;

grant execute on function public.upsert_paid_traffic_lead(uuid, text, text)
to service_role;

notify pgrst, 'reload schema';

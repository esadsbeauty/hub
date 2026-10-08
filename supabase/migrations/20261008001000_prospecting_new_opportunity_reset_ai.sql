-- Ajuste da conversão Prospecção -> CRM.
-- 1) Reaproveita a empresa, mas NÃO reaproveita oportunidade antiga.
-- 2) Cada nova rodada de prospecção ganha sua própria oportunidade.
-- 3) Zera somente o estado interno de qualificação da IA; o histórico do WhatsApp é preservado.

create or replace function public.convert_prospecting_reply_to_crm(
  p_organization_id uuid,
  p_whatsapp_conversation_id uuid,
  p_wa_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.prospecting_leads%rowtype;
  v_conversation public.whatsapp_conversations%rowtype;

  v_agent_id uuid;
  v_agent_created_by uuid;
  v_crm_config jsonb;

  v_awaiting_stage_id uuid;
  v_pipeline_id uuid;
  v_awaiting_position integer;
  v_awaiting_probability numeric;

  v_company_id uuid;
  v_opportunity_id uuid;
  v_company_created boolean := false;
  v_opportunity_created boolean := false;
  v_stage_changed boolean := false;

  v_phone_key text;
  v_now timestamptz := now();
begin
  -- Recurso precisa estar habilitado para a organização.
  if not exists (
    select 1
    from public.organization_features f
    where f.organization_id = p_organization_id
      and f.feature_key = 'prospecting_agent'
      and f.enabled = true
  ) then
    return jsonb_build_object(
      'ok', true,
      'converted', false,
      'reason', 'feature_disabled'
    );
  end if;

  select wc.*
  into v_conversation
  from public.whatsapp_conversations wc
  where wc.id = p_whatsapp_conversation_id
    and wc.organization_id = p_organization_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'converted', false,
      'reason', 'whatsapp_conversation_not_found'
    );
  end if;

  v_phone_key := public.prospecting_phone_match_key(
    coalesce(nullif(p_wa_id, ''), v_conversation.wa_id)
  );

  if v_phone_key = '' then
    return jsonb_build_object(
      'ok', true,
      'converted', false,
      'reason', 'phone_missing'
    );
  end if;

  -- Só converte leads que já tiveram a abordagem aberta/enviada e ainda
  -- pertencem ao fluxo de prospecção.
  select pl.*
  into v_lead
  from public.prospecting_leads pl
  where pl.organization_id = p_organization_id
    and pl.status in ('message_sent', 'replied', 'in_conversation')
    and public.prospecting_phone_match_key(pl.whatsapp) = v_phone_key
  order by
    pl.message_opened_at desc nulls last,
    pl.updated_at desc,
    pl.created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'converted', false,
      'reason', 'prospecting_lead_not_found'
    );
  end if;

  -- A etapa de entrada no CRM vem da configuração do Assistente Comercial,
  -- evitando IDs hardcoded por organização.
  select
    a.id,
    a.created_by,
    a.crm_config
  into
    v_agent_id,
    v_agent_created_by,
    v_crm_config
  from public.ai_agents a
  where a.organization_id = p_organization_id
    and a.is_enabled = true
  order by a.updated_at desc
  limit 1;

  if v_agent_id is null then
    return jsonb_build_object(
      'ok', false,
      'converted', false,
      'reason', 'ai_agent_not_configured'
    );
  end if;

  begin
    v_awaiting_stage_id := nullif(
      trim(v_crm_config ->> 'awaiting_qualification_stage_id'),
      ''
    )::uuid;
  exception when others then
    v_awaiting_stage_id := null;
  end;

  if v_awaiting_stage_id is null then
    return jsonb_build_object(
      'ok', false,
      'converted', false,
      'reason', 'awaiting_stage_not_configured'
    );
  end if;

  select
    ps.pipeline_id,
    ps.position,
    ps.probability
  into
    v_pipeline_id,
    v_awaiting_position,
    v_awaiting_probability
  from public.pipeline_stages ps
  where ps.id = v_awaiting_stage_id
    and ps.is_active = true
    and ps.is_won = false
    and ps.is_lost = false;

  if v_pipeline_id is null then
    return jsonb_build_object(
      'ok', false,
      'converted', false,
      'reason', 'awaiting_stage_invalid'
    );
  end if;

  -- 1) Reaproveita empresa já ligada à conversa/lead.
  v_company_id := coalesce(
    v_conversation.company_id,
    v_lead.crm_company_id
  );

  if v_company_id is not null and not exists (
    select 1
    from public.companies c
    where c.id = v_company_id
      and c.organization_id = p_organization_id
      and c.deleted_at is null
  ) then
    v_company_id := null;
  end if;

  -- 2) Reaproveita empresa existente pelo WhatsApp/telefone equivalente.
  if v_company_id is null then
    select c.id
    into v_company_id
    from public.companies c
    where c.organization_id = p_organization_id
      and c.deleted_at is null
      and (
        public.prospecting_phone_match_key(c.whatsapp) = v_phone_key
        or public.prospecting_phone_match_key(c.phone) = v_phone_key
      )
    order by c.updated_at desc, c.created_at desc
    limit 1;
  end if;

  -- 3) Cria empresa somente se ainda não houver uma correspondente.
  if v_company_id is null then
    insert into public.companies (
      organization_id,
      name,
      whatsapp,
      source,
      business_area,
      notes,
      created_by,
      last_interaction_at
    )
    values (
      p_organization_id,
      coalesce(nullif(trim(v_lead.name), ''), 'Lead Prospecção'),
      nullif(regexp_replace(coalesce(v_lead.whatsapp, p_wa_id, ''), '\\D', '', 'g'), ''),
      'Prospecção',
      nullif(trim(v_lead.business_type), ''),
      nullif(trim(v_lead.notes), ''),
      coalesce(v_lead.created_by, v_agent_created_by),
      v_now
    )
    returning id into v_company_id;

    v_company_created := true;
  else
    update public.companies
    set
      last_interaction_at = v_now,
      business_area = coalesce(
        nullif(trim(business_area), ''),
        nullif(trim(v_lead.business_type), '')
      ),
      updated_at = v_now
    where id = v_company_id
      and organization_id = p_organization_id;
  end if;

  -- Cada NOVA rodada de Prospecção cria uma nova oportunidade.
  -- Só reaproveitamos crm_opportunity_id do próprio lead para tornar a
  -- conversão idempotente caso o mesmo webhook seja processado novamente.
  v_opportunity_id := v_lead.crm_opportunity_id;

  if v_opportunity_id is not null and not exists (
    select 1
    from public.opportunities o
    where o.id = v_opportunity_id
      and o.organization_id = p_organization_id
      and o.company_id = v_company_id
      and o.status = 'open'
      and o.deleted_at is null
  ) then
    v_opportunity_id := null;
  end if;

  if v_opportunity_id is null then
    insert into public.opportunities (
      organization_id,
      company_id,
      pipeline_id,
      stage_id,
      title,
      description,
      value,
      probability,
      source,
      status,
      created_by,
      stage_entered_at
    )
    values (
      p_organization_id,
      v_company_id,
      v_pipeline_id,
      v_awaiting_stage_id,
      'Prospecção - ' || coalesce(nullif(trim(v_lead.name), ''), 'Novo lead'),
      nullif(trim(v_lead.notes), ''),
      0,
      coalesce(v_awaiting_probability, 0),
      'Prospecção',
      'open',
      coalesce(v_lead.created_by, v_agent_created_by),
      v_now
    )
    returning id into v_opportunity_id;

    v_opportunity_created := true;
  else
    -- Reprocessamento da mesma conversão: mantém a oportunidade do próprio lead.
    update public.opportunities
    set updated_at = v_now
    where id = v_opportunity_id
      and organization_id = p_organization_id;
  end if;

  -- O WhatsApp passa a apontar para a NOVA oportunidade desta prospecção.
  update public.whatsapp_conversations
  set
    company_id = v_company_id,
    opportunity_id = v_opportunity_id,
    updated_at = v_now
  where id = p_whatsapp_conversation_id
    and organization_id = p_organization_id;

  -- Inicia uma nova rodada comercial para a mesma conversa.
  -- Preservamos o histórico real do WhatsApp, mas zeramos o estado interno
  -- de qualificação para que dados de uma oportunidade antiga não façam a
  -- Assistente pular diretamente para Qualificado.
  update public.ai_agent_conversations
  set
    company_id = v_company_id,
    opportunity_id = v_opportunity_id,
    status = 'active',
    qualification_data = '{}'::jsonb,
    qualification_score = 0,
    summary = null,
    handoff_reason = null,
    last_ai_message_at = null,
    updated_at = v_now
  where organization_id = p_organization_id
    and whatsapp_conversation_id = p_whatsapp_conversation_id;

  update public.prospecting_leads
  set
    status = 'opportunity',
    crm_company_id = v_company_id,
    crm_opportunity_id = v_opportunity_id,
    converted_at = coalesce(converted_at, v_now),
    updated_at = v_now
  where id = v_lead.id;

  return jsonb_build_object(
    'ok', true,
    'converted', true,
    'prospecting_lead_id', v_lead.id,
    'company_id', v_company_id,
    'company_created', v_company_created,
    'opportunity_id', v_opportunity_id,
    'opportunity_created', v_opportunity_created,
    'pipeline_id', v_pipeline_id,
    'stage_id', v_awaiting_stage_id,
    'stage_changed', v_stage_changed
  );
end;
$$;


revoke all on function public.convert_prospecting_reply_to_crm(uuid, uuid, text) from public;
grant execute on function public.convert_prospecting_reply_to_crm(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';

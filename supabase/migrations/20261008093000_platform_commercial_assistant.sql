-- Platform management for the Commercial Assistant.
-- Idempotent: reuses existing stages and personalized agents.

create or replace function public.platform_commercial_assistant_details(
  target_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'platform_admin_required' using errcode='42501';
  end if;

  if not exists(select 1 from public.organizations where id=target_organization_id) then
    raise exception 'organization_not_found' using errcode='P0002';
  end if;

  select jsonb_build_object(
    'enabled', coalesce((
      select f.enabled
      from public.organization_features f
      where f.organization_id=target_organization_id
        and f.feature_key='ai_commercial_assistant'
    ), false),
    'source', (
      select f.source
      from public.organization_features f
      where f.organization_id=target_organization_id
        and f.feature_key='ai_commercial_assistant'
    ),
    'agent', (
      select jsonb_build_object(
        'id',a.id,
        'name',a.name,
        'isEnabled',a.is_enabled,
        'crmConfig',a.crm_config
      )
      from public.ai_agents a
      where a.organization_id=target_organization_id
      limit 1
    ),
    'pipelines', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',p.id,
          'name',p.name,
          'isDefault',p.is_default,
          'stages',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id',ps.id,
                'name',ps.name,
                'slug',ps.slug,
                'position',ps.position,
                'isWon',ps.is_won,
                'isLost',ps.is_lost
              )
              order by ps.position,ps.created_at
            )
            from public.pipeline_stages ps
            where ps.pipeline_id=p.id
              and ps.is_active=true
          ),'[]'::jsonb)
        )
        order by p.is_default desc,p.created_at
      )
      from public.pipelines p
      where p.organization_id=target_organization_id
    ),'[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.platform_configure_commercial_assistant(
  target_organization_id uuid,
  target_pipeline_id uuid,
  desired_enabled boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_agent public.ai_agents%rowtype;
  v_pipeline_id uuid;
  v_new_lead uuid;
  v_in_service uuid;
  v_human uuid;
  v_scheduled uuid;
  v_max_position integer;
  v_stage_id uuid;
  v_idx integer:=0;
  v_crm_config jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'platform_admin_required' using errcode='42501';
  end if;

  if not exists(select 1 from public.organizations where id=target_organization_id) then
    raise exception 'organization_not_found' using errcode='P0002';
  end if;

  if desired_enabled is false then
    insert into public.organization_features(organization_id,feature_key,enabled,source,updated_at)
    values(target_organization_id,'ai_commercial_assistant',false,'manual',now())
    on conflict(organization_id,feature_key) do update
      set enabled=false,source='manual',updated_at=now();

    update public.ai_agents
    set is_enabled=false,updated_at=now()
    where organization_id=target_organization_id;

    insert into public.audit_logs(organization_id,user_id,action,entity_type,entity_id,module,new_values)
    values(
      target_organization_id,auth.uid(),'commercial_assistant_disabled',
      'organization',target_organization_id,'platform',
      jsonb_build_object('enabled',false)
    );

    return public.platform_commercial_assistant_details(target_organization_id);
  end if;

  v_pipeline_id:=target_pipeline_id;

  if v_pipeline_id is not null and not exists(
    select 1 from public.pipelines p
    where p.id=v_pipeline_id
      and p.organization_id=target_organization_id
  ) then
    raise exception 'pipeline_not_found' using errcode='P0002';
  end if;

  if v_pipeline_id is null then
    select p.id into v_pipeline_id
    from public.pipelines p
    where p.organization_id=target_organization_id
    order by p.is_default desc,p.created_at asc
    limit 1;
  end if;

  if v_pipeline_id is null then
    insert into public.pipelines(
      organization_id,name,description,is_default
    )
    values(
      target_organization_id,
      'Pipeline Beauty',
      'Pipeline comercial padrão para atendimento e vendas',
      true
    )
    returning id into v_pipeline_id;
  end if;

  -- Reuse canonical stages by slug or name.
  select ps.id into v_new_lead
  from public.pipeline_stages ps
  where ps.pipeline_id=v_pipeline_id and ps.is_active=true
    and (ps.slug='novo_lead' or lower(trim(ps.name))='novo lead')
  order by (ps.slug='novo_lead') desc,ps.position limit 1;

  select ps.id into v_in_service
  from public.pipeline_stages ps
  where ps.pipeline_id=v_pipeline_id and ps.is_active=true
    and (ps.slug='em_atendimento' or lower(trim(ps.name))='em atendimento')
  order by (ps.slug='em_atendimento') desc,ps.position limit 1;

  select ps.id into v_human
  from public.pipeline_stages ps
  where ps.pipeline_id=v_pipeline_id and ps.is_active=true
    and (ps.slug='atendimento_humano' or lower(trim(ps.name))='atendimento humano')
  order by (ps.slug='atendimento_humano') desc,ps.position limit 1;

  select ps.id into v_scheduled
  from public.pipeline_stages ps
  where ps.pipeline_id=v_pipeline_id and ps.is_active=true
    and (ps.slug='agendado' or lower(trim(ps.name))='agendado')
  order by (ps.slug='agendado') desc,ps.position limit 1;

  select coalesce(max(position),-1) into v_max_position
  from public.pipeline_stages where pipeline_id=v_pipeline_id;

  if v_new_lead is null then
    v_max_position:=v_max_position+1;
    insert into public.pipeline_stages(pipeline_id,name,slug,position,probability,is_won,is_lost,is_active)
    values(v_pipeline_id,'Novo Lead','novo_lead',v_max_position,10,false,false,true)
    returning id into v_new_lead;
  end if;

  if v_in_service is null then
    v_max_position:=v_max_position+1;
    insert into public.pipeline_stages(pipeline_id,name,slug,position,probability,is_won,is_lost,is_active)
    values(v_pipeline_id,'Em atendimento','em_atendimento',v_max_position,30,false,false,true)
    returning id into v_in_service;
  end if;

  if v_human is null then
    v_max_position:=v_max_position+1;
    insert into public.pipeline_stages(pipeline_id,name,slug,position,probability,is_won,is_lost,is_active)
    values(v_pipeline_id,'Atendimento humano','atendimento_humano',v_max_position,45,false,false,true)
    returning id into v_human;
  end if;

  if v_scheduled is null then
    v_max_position:=v_max_position+1;
    insert into public.pipeline_stages(pipeline_id,name,slug,position,probability,is_won,is_lost,is_active)
    values(v_pipeline_id,'Agendado','agendado',v_max_position,60,false,false,true)
    returning id into v_scheduled;
  end if;

  -- Canonical stages first; all existing stages keep their relative order.
  update public.pipeline_stages
  set position=position+100000,updated_at=now()
  where pipeline_id=v_pipeline_id;

  foreach v_stage_id in array array[v_new_lead,v_in_service,v_human,v_scheduled] loop
    update public.pipeline_stages set position=v_idx,updated_at=now()
    where id=v_stage_id;
    v_idx:=v_idx+1;
  end loop;

  for v_stage_id in
    select ps.id
    from public.pipeline_stages ps
    where ps.pipeline_id=v_pipeline_id
      and ps.is_active=true
      and ps.id<>all(array[v_new_lead,v_in_service,v_human,v_scheduled])
    order by ps.position,ps.created_at,ps.id
  loop
    update public.pipeline_stages set position=v_idx,updated_at=now()
    where id=v_stage_id;
    v_idx:=v_idx+1;
  end loop;

  -- Archived stages stay outside the visible order.
  with archived as (
    select ps.id,row_number() over(order by ps.position,ps.created_at,ps.id)-1 rn
    from public.pipeline_stages ps
    where ps.pipeline_id=v_pipeline_id and ps.is_active=false
  )
  update public.pipeline_stages ps
  set position=10000+archived.rn,updated_at=now()
  from archived where ps.id=archived.id;

  v_crm_config:=jsonb_build_object(
    'pipeline_id',v_pipeline_id,
    'awaiting_qualification_stage_id',v_new_lead,
    'qualification_stage_id',v_in_service,
    'qualified_stage_id',v_human,
    'scheduled_stage_id',v_scheduled
  );

  select * into v_agent
  from public.ai_agents
  where organization_id=target_organization_id
  limit 1;

  if v_agent.id is null then
    insert into public.ai_agents(
      organization_id,name,is_enabled,objective,tone,welcome_message,
      qualification_questions,handoff_rules,business_context,crm_config,
      system_prompt,created_by
    )
    values(
      target_organization_id,
      'Assistente',
      true,
      'Conduzir o primeiro atendimento, qualificar o lead e encaminhar para atendimento humano quando necessário.',
      'acolhedor, profissional, humano e objetivo',
      'Olá! Tudo bem? 😊 Faço parte da equipe. Como posso te ajudar?',
      '[]'::jsonb,
      '["Pedido explícito de atendimento humano","Intenção de agendamento que dependa de confirmação da equipe","Dúvida clínica ou técnica que exija um profissional","Reclamação, intercorrência ou situação sensível"]'::jsonb,
      '{}'::jsonb,
      v_crm_config,
      'Conduza o primeiro atendimento de forma natural. Faça uma pergunta principal por vez. Não invente preços, horários, disponibilidade ou informações clínicas. Quando houver necessidade real de uma pessoa da equipe, faça handoff.',
      auth.uid()
    )
    returning * into v_agent;
  else
    update public.ai_agents
    set is_enabled=true,
        crm_config=coalesce(crm_config,'{}'::jsonb)||v_crm_config,
        created_by=coalesce(created_by,auth.uid()),
        updated_at=now()
    where id=v_agent.id
    returning * into v_agent;
  end if;

  insert into public.organization_features(organization_id,feature_key,enabled,source,updated_at)
  values(target_organization_id,'ai_commercial_assistant',true,'manual',now())
  on conflict(organization_id,feature_key) do update
    set enabled=true,source='manual',updated_at=now();

  insert into public.audit_logs(organization_id,user_id,action,entity_type,entity_id,module,new_values)
  values(
    target_organization_id,auth.uid(),'commercial_assistant_configured',
    'organization',target_organization_id,'platform',
    jsonb_build_object(
      'enabled',true,'agent_id',v_agent.id,'crm_config',v_crm_config
    )
  );

  return public.platform_commercial_assistant_details(target_organization_id);
end;
$$;

revoke all on function public.platform_commercial_assistant_details(uuid) from public,anon;
revoke all on function public.platform_configure_commercial_assistant(uuid,uuid,boolean) from public,anon;
grant execute on function public.platform_commercial_assistant_details(uuid) to authenticated;
grant execute on function public.platform_configure_commercial_assistant(uuid,uuid,boolean) to authenticated;

-- CRM sync now always follows each tenant's configured pipeline/stages.
create or replace function public.sync_ai_agent_crm(p_ai_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.ai_agent_conversations%rowtype;
  w public.whatsapp_conversations%rowtype;
  a public.ai_agents%rowtype;
  company_id uuid;
  opportunity_id uuid;
  pipeline_id uuid;
  initial_stage_id uuid;
  service_stage_id uuid;
  human_stage_id uuid;
  target_stage_id uuid;
  current_position integer;
  target_position integer;
  actor_id uuid;
  contact_name text;
  phone text;
  main_service text;
  lead_source text;
  title text;
begin
  select * into c from public.ai_agent_conversations where id=p_ai_conversation_id;
  if c.id is null then raise exception 'AI conversation not found'; end if;

  select * into w
  from public.whatsapp_conversations
  where id=c.whatsapp_conversation_id and organization_id=c.organization_id;
  if w.id is null then
    return jsonb_build_object('ok',false,'reason','whatsapp_conversation_missing');
  end if;

  select * into a
  from public.ai_agents
  where id=c.agent_id and organization_id=c.organization_id;
  if a.id is null then raise exception 'AI agent not found'; end if;

  actor_id:=a.created_by;
  if actor_id is null then raise exception 'AI agent created_by is required for CRM synchronization'; end if;

  pipeline_id:=nullif(a.crm_config->>'pipeline_id','')::uuid;
  initial_stage_id:=nullif(a.crm_config->>'awaiting_qualification_stage_id','')::uuid;
  service_stage_id:=nullif(a.crm_config->>'qualification_stage_id','')::uuid;
  human_stage_id:=nullif(a.crm_config->>'qualified_stage_id','')::uuid;

  if pipeline_id is null or initial_stage_id is null or service_stage_id is null or human_stage_id is null then
    raise exception 'AI agent CRM routing is incomplete';
  end if;

  if not exists(select 1 from public.pipelines p where p.id=pipeline_id and p.organization_id=c.organization_id) then
    raise exception 'Configured CRM pipeline not found';
  end if;

  contact_name:=nullif(trim(w.contact_name),'');
  phone:=regexp_replace(coalesce(w.wa_id,''),'\D','','g');
  main_service:=nullif(trim(c.qualification_data->>'main_service'),'');
  lead_source:=nullif(trim(c.qualification_data->>'lead_source'),'');

  company_id:=coalesce(c.company_id,w.company_id);

  if company_id is null and phone<>'' then
    select x.id into company_id
    from public.companies x
    where x.organization_id=c.organization_id
      and x.deleted_at is null
      and regexp_replace(coalesce(x.whatsapp,''),'\D','','g')=phone
    order by x.updated_at desc limit 1;
  end if;

  if company_id is null then
    insert into public.companies(
      organization_id,name,whatsapp,source,business_area,notes,created_by,last_interaction_at
    ) values(
      c.organization_id,
      coalesce(contact_name,nullif(phone,''),'Lead WhatsApp'),
      nullif(phone,''),coalesce(lead_source,'WhatsApp'),
      nullif(trim(c.qualification_data->>'business_type'),''),
      c.summary,actor_id,coalesce(c.last_lead_message_at,now())
    ) returning id into company_id;
  else
    update public.companies
    set last_interaction_at=coalesce(c.last_lead_message_at,last_interaction_at,now()),
        source=coalesce(lead_source,source),
        updated_at=now()
    where id=company_id and organization_id=c.organization_id;
  end if;

  opportunity_id:=coalesce(c.opportunity_id,w.opportunity_id);

  if opportunity_id is null then
    select o.id into opportunity_id
    from public.opportunities o
    where o.organization_id=c.organization_id
      and o.company_id=company_id
      and o.status='open'
      and o.deleted_at is null
    order by o.updated_at desc limit 1;
  end if;

  title:=case when main_service is not null
    then main_service||' - '||coalesce(contact_name,'Lead WhatsApp')
    else 'Lead WhatsApp - '||coalesce(contact_name,nullif(phone,''),'Novo lead') end;

  if opportunity_id is null then
    insert into public.opportunities(
      organization_id,company_id,pipeline_id,stage_id,title,description,
      value,probability,source,status,created_by
    ) values(
      c.organization_id,company_id,pipeline_id,initial_stage_id,title,c.summary,
      0,0,coalesce(lead_source,'WhatsApp'),'open',actor_id
    ) returning id into opportunity_id;
  else
    update public.opportunities
    set description=coalesce(c.summary,description),
        source=coalesce(lead_source,source),
        updated_at=now()
    where id=opportunity_id and organization_id=c.organization_id and status='open';
  end if;

  target_stage_id:=case when c.status='handoff' then human_stage_id else service_stage_id end;

  select ps.position into target_position
  from public.pipeline_stages ps
  where ps.id=target_stage_id and ps.pipeline_id=pipeline_id and ps.is_active=true;

  select ps.position into current_position
  from public.opportunities o
  join public.pipeline_stages ps on ps.id=o.stage_id
  where o.id=opportunity_id and o.organization_id=c.organization_id;

  if target_position is not null
     and (current_position is null or current_position<=target_position) then
    update public.opportunities
    set stage_id=target_stage_id,stage_entered_at=now(),updated_at=now()
    where id=opportunity_id
      and organization_id=c.organization_id
      and status='open'
      and stage_id is distinct from target_stage_id;
  end if;

  update public.ai_agent_conversations
  set company_id=company_id,opportunity_id=opportunity_id,updated_at=now()
  where id=c.id;

  update public.whatsapp_conversations
  set company_id=company_id,opportunity_id=opportunity_id,updated_at=now()
  where id=w.id and organization_id=c.organization_id;

  return jsonb_build_object(
    'ok',true,
    'company_id',company_id,
    'opportunity_id',opportunity_id,
    'pipeline_id',pipeline_id,
    'stage_id',target_stage_id
  );
end;
$$;

revoke all on function public.sync_ai_agent_crm(uuid) from public,anon,authenticated;
grant execute on function public.sync_ai_agent_crm(uuid) to service_role;

notify pgrst,'reload schema';

create or replace function public.sync_ai_agent_crm(
  p_ai_conversation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ai_conversation public.ai_agent_conversations%rowtype;
  v_whatsapp_conversation public.whatsapp_conversations%rowtype;

  v_agent_created_by uuid;

  v_company_id uuid;
  v_opportunity_id uuid;

  v_pipeline_id uuid;
  v_stage_id uuid;

  v_contact_name text;
  v_whatsapp text;
  v_main_service text;
  v_source text;
  v_title text;

  v_company_created boolean := false;
  v_opportunity_created boolean := false;
begin
  select *
  into v_ai_conversation
  from public.ai_agent_conversations
  where id = p_ai_conversation_id;

  if not found then
    raise exception 'AI conversation not found';
  end if;

  if v_ai_conversation.whatsapp_conversation_id is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'whatsapp_conversation_missing'
    );
  end if;

  select *
  into v_whatsapp_conversation
  from public.whatsapp_conversations
  where id = v_ai_conversation.whatsapp_conversation_id
    and organization_id = v_ai_conversation.organization_id;

  if not found then
    raise exception 'WhatsApp conversation not found';
  end if;

  select created_by
  into v_agent_created_by
  from public.ai_agents
  where id = v_ai_conversation.agent_id
    and organization_id = v_ai_conversation.organization_id;

  if v_agent_created_by is null then
    raise exception 'AI agent created_by is required for CRM synchronization';
  end if;

  v_contact_name :=
    nullif(trim(v_whatsapp_conversation.contact_name), '');

  v_whatsapp :=
    regexp_replace(
      coalesce(v_whatsapp_conversation.wa_id, ''),
      '\D',
      '',
      'g'
    );

  v_main_service :=
    nullif(
      trim(
        v_ai_conversation.qualification_data
          ->> 'main_service'
      ),
      ''
    );

  v_source :=
    nullif(
      trim(
        v_ai_conversation.qualification_data
          ->> 'lead_source'
      ),
      ''
    );

  v_company_id :=
    coalesce(
      v_ai_conversation.company_id,
      v_whatsapp_conversation.company_id
    );

  if v_company_id is null and v_whatsapp <> '' then
    select c.id
    into v_company_id
    from public.companies c
    where c.organization_id =
      v_ai_conversation.organization_id
      and c.deleted_at is null
      and regexp_replace(
        coalesce(c.whatsapp, ''),
        '\D',
        '',
        'g'
      ) = v_whatsapp
    order by c.updated_at desc
    limit 1;
  end if;

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
      v_ai_conversation.organization_id,
      coalesce(
        v_contact_name,
        nullif(v_whatsapp, ''),
        'Lead WhatsApp'
      ),
      nullif(v_whatsapp, ''),
      coalesce(
        v_source,
        'WhatsApp'
      ),
      nullif(
        trim(
          v_ai_conversation.qualification_data
            ->> 'business_type'
        ),
        ''
      ),
      v_ai_conversation.summary,
      v_agent_created_by,
      coalesce(
        v_ai_conversation.last_lead_message_at,
        now()
      )
    )
    returning id
    into v_company_id;

    v_company_created := true;
  else
    update public.companies
    set
      last_interaction_at =
        coalesce(
          v_ai_conversation.last_lead_message_at,
          last_interaction_at,
          now()
        ),
      source =
        coalesce(
          v_source,
          source
        ),
      business_area =
        coalesce(
          nullif(
            trim(
              v_ai_conversation.qualification_data
                ->> 'business_type'
            ),
            ''
          ),
          business_area
        ),
      updated_at = now()
    where id = v_company_id
      and organization_id =
        v_ai_conversation.organization_id;
  end if;

  select p.id
  into v_pipeline_id
  from public.pipelines p
  where p.organization_id =
    v_ai_conversation.organization_id
  order by
    p.is_default desc,
    p.created_at asc
  limit 1;

  if v_pipeline_id is null then
    raise exception 'No CRM pipeline found for organization';
  end if;

  select ps.id
  into v_stage_id
  from public.pipeline_stages ps
  where ps.pipeline_id = v_pipeline_id
    and ps.is_active = true
    and ps.is_won = false
    and ps.is_lost = false
  order by ps.position asc
  limit 1;

  if v_stage_id is null then
    raise exception 'No active CRM stage found for pipeline';
  end if;

  v_opportunity_id :=
    coalesce(
      v_ai_conversation.opportunity_id,
      v_whatsapp_conversation.opportunity_id
    );

  if v_opportunity_id is null then
    select o.id
    into v_opportunity_id
    from public.opportunities o
    where o.organization_id =
      v_ai_conversation.organization_id
      and o.company_id = v_company_id
      and o.status = 'open'
      and o.deleted_at is null
    order by o.updated_at desc
    limit 1;
  end if;

  v_title :=
    case
      when v_main_service is not null
        then v_main_service || ' - ' ||
          coalesce(
            v_contact_name,
            'Lead WhatsApp'
          )
      else
        'Lead WhatsApp - ' ||
        coalesce(
          v_contact_name,
          nullif(v_whatsapp, ''),
          'Novo lead'
        )
    end;

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
      created_by
    )
    values (
      v_ai_conversation.organization_id,
      v_company_id,
      v_pipeline_id,
      v_stage_id,
      v_title,
      v_ai_conversation.summary,
      0,
      0,
      coalesce(v_source, 'WhatsApp'),
      'open',
      v_agent_created_by
    )
    returning id
    into v_opportunity_id;

    v_opportunity_created := true;
  else
    update public.opportunities
    set
      description =
        coalesce(
          v_ai_conversation.summary,
          description
        ),
      source =
        coalesce(
          v_source,
          source
        ),
      updated_at = now()
    where id = v_opportunity_id
      and organization_id =
        v_ai_conversation.organization_id
      and status = 'open';
  end if;

  update public.ai_agent_conversations
  set
    company_id = v_company_id,
    opportunity_id = v_opportunity_id,
    updated_at = now()
  where id = v_ai_conversation.id;

  update public.whatsapp_conversations
  set
    company_id = v_company_id,
    opportunity_id = v_opportunity_id,
    updated_at = now()
  where id = v_whatsapp_conversation.id
    and organization_id =
      v_ai_conversation.organization_id;

  return jsonb_build_object(
    'ok', true,
    'company_id', v_company_id,
    'company_created', v_company_created,
    'opportunity_id', v_opportunity_id,
    'opportunity_created', v_opportunity_created,
    'pipeline_id', v_pipeline_id,
    'stage_id', v_stage_id
  );
end;
$$;

revoke all
on function public.sync_ai_agent_crm(uuid)
from public, anon, authenticated;

grant execute
on function public.sync_ai_agent_crm(uuid)
to service_role;
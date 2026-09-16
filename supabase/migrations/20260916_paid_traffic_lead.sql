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
        else array_append(tags, 'Tráfego')
      end,
      last_interaction_at = now(),
      updated_at = now()
    where id = v_company_id;
  end if;

  select p.id
  into v_pipeline_id
  from public.pipelines p
  where p.organization_id = p_organization_id
    and p.is_default = true
  limit 1;

  if v_pipeline_id is null then
    raise exception 'Pipeline padrão não encontrado';
  end if;

  select ps.id
  into v_stage_id
  from public.pipeline_stages ps
  where ps.pipeline_id = v_pipeline_id
    and ps.slug = 'novo_lead'
    and coalesce(ps.is_active, true) = true
  order by ps.position asc
  limit 1;

  if v_stage_id is null then
    raise exception 'Estágio Novo Lead não encontrado';
  end if;

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
    'opportunity_created', v_opportunity_created
  );
end;
$$;

revoke execute on function public.upsert_paid_traffic_lead(uuid, text, text)
from public, anon, authenticated;

grant execute on function public.upsert_paid_traffic_lead(uuid, text, text)
to service_role;
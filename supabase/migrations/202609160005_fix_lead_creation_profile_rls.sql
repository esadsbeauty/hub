-- Fix lead creation for the active tenant.
-- The previous function tried to SELECT the authenticated user's profile while
-- running as SECURITY INVOKER. In organizations using the newer membership
-- model, RLS can hide that profile row and raise authenticated_profile_not_found.
-- We already have the authenticated user id from auth.uid(), so use it directly.

create or replace function public.create_company_with_primary_contact(
  company_data jsonb,
  contact_data jsonb default null
)
returns public.companies
language plpgsql
security invoker
set search_path = public
as $$
declare
  tenant uuid := public.current_organization_id();
  current_user_id uuid := auth.uid();
  new_company public.companies;
  default_pipeline public.pipelines;
  initial_stage public.pipeline_stages;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;

  if tenant is null then
    raise exception 'organization_required' using errcode='42501';
  end if;

  select *
  into default_pipeline
  from public.pipelines
  where organization_id = tenant
    and is_default = true
  order by created_at, id
  limit 1;

  if default_pipeline.id is null then
    raise exception 'default_pipeline_not_found' using errcode='P0002';
  end if;

  select *
  into initial_stage
  from public.pipeline_stages
  where pipeline_id = default_pipeline.id
    and (slug = 'novo_lead' or lower(name) = 'novo lead')
    and coalesce(is_active, true) = true
  order by position, id
  limit 1;

  if initial_stage.id is null then
    raise exception 'initial_stage_not_found' using errcode='P0002';
  end if;

  insert into public.companies(
    organization_id,
    name,
    legal_name,
    cnpj,
    phone,
    whatsapp,
    instagram,
    facebook,
    website,
    email,
    zip_code,
    address,
    address_number,
    complement,
    district,
    city,
    state,
    responsible_name,
    responsible_role,
    employees,
    business_area,
    source,
    temperature,
    priority,
    notes,
    tags,
    owner_id,
    created_by
  )
  values (
    tenant,
    company_data->>'name',
    nullif(company_data->>'legal_name',''),
    nullif(company_data->>'cnpj',''),
    nullif(company_data->>'phone',''),
    nullif(company_data->>'whatsapp',''),
    nullif(company_data->>'instagram',''),
    nullif(company_data->>'facebook',''),
    nullif(company_data->>'website',''),
    nullif(company_data->>'email',''),
    nullif(company_data->>'zip_code',''),
    nullif(company_data->>'address',''),
    nullif(company_data->>'address_number',''),
    nullif(company_data->>'complement',''),
    nullif(company_data->>'district',''),
    nullif(company_data->>'city',''),
    nullif(company_data->>'state',''),
    nullif(company_data->>'responsible_name',''),
    nullif(company_data->>'responsible_role',''),
    nullif(company_data->>'employees','')::integer,
    nullif(company_data->>'business_area',''),
    nullif(company_data->>'source',''),
    coalesce((company_data->>'temperature')::public.temperature_level,'morno'),
    coalesce((company_data->>'priority')::public.priority_level,'media'),
    nullif(company_data->>'notes',''),
    coalesce(array(select jsonb_array_elements_text(company_data->'tags')),'{}'),
    current_user_id,
    current_user_id
  )
  returning * into new_company;

  if contact_data is not null
    and nullif(contact_data->>'name','') is not null
  then
    insert into public.contacts(
      organization_id,
      company_id,
      name,
      role,
      phone,
      whatsapp,
      email,
      instagram,
      is_primary,
      is_commercial
    )
    values(
      tenant,
      new_company.id,
      contact_data->>'name',
      nullif(contact_data->>'role',''),
      nullif(contact_data->>'phone',''),
      nullif(contact_data->>'whatsapp',''),
      nullif(contact_data->>'email',''),
      nullif(contact_data->>'instagram',''),
      true,
      true
    );
  end if;

  insert into public.opportunities(
    organization_id,
    company_id,
    pipeline_id,
    stage_id,
    title,
    value,
    probability,
    owner_id,
    status,
    created_by
  )
  values(
    tenant,
    new_company.id,
    default_pipeline.id,
    initial_stage.id,
    new_company.name,
    0,
    initial_stage.probability,
    current_user_id,
    'open',
    current_user_id
  );

  return new_company;
end
$$;

revoke all on function public.create_company_with_primary_contact(jsonb,jsonb)
from public,anon;

grant execute on function public.create_company_with_primary_contact(jsonb,jsonb)
to authenticated;

notify pgrst,'reload schema';

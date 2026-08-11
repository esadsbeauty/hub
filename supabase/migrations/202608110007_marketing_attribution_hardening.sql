-- Harden acquisition history without replacing CRM companies or legacy source values.
alter table public.lead_acquisitions
  add column if not exists provider text,
  add column if not exists external_event_id text,
  add column if not exists is_last_touch boolean not null default false,
  add column if not exists created_by uuid references public.profiles(id) default auth.uid();

create unique index if not exists lead_acquisitions_external_event_unique
  on public.lead_acquisitions(organization_id, provider, external_event_id)
  where provider is not null and external_event_id is not null;
create unique index if not exists lead_acquisitions_one_last_touch
  on public.lead_acquisitions(company_id) where is_last_touch;

-- Existing history is preserved; only the deterministic first/last markers are repaired.
with ranked as (
  select id,
    row_number() over(partition by company_id order by captured_at, created_at, id) as first_rank,
    row_number() over(partition by company_id order by captured_at desc, created_at desc, id desc) as last_rank
  from public.lead_acquisitions
)
update public.lead_acquisitions a
set is_first_touch = ranked.first_rank = 1,
    is_last_touch = ranked.last_rank = 1
from ranked where ranked.id = a.id;

create or replace function public.preserve_marketing_touch_boundaries() returns trigger
language plpgsql set search_path=public as $$
begin
  -- A transaction-scoped company lock prevents concurrent webhook deliveries from
  -- producing two first/last touchpoints.
  perform pg_advisory_xact_lock(hashtextextended(new.company_id::text, 0));
  new.is_first_touch := not exists(
    select 1 from public.lead_acquisitions where company_id = new.company_id and is_first_touch
  );
  update public.lead_acquisitions set is_last_touch = false
    where company_id = new.company_id and is_last_touch;
  new.is_last_touch := true;
  return new;
end $$;

drop trigger if exists lead_acquisitions_first_touch on public.lead_acquisitions;
create trigger lead_acquisitions_touch_boundaries before insert on public.lead_acquisitions
for each row execute function public.preserve_marketing_touch_boundaries();

create or replace function public.capture_lead_acquisition(acquisition_data jsonb)
returns public.lead_acquisitions language plpgsql security invoker set search_path=public as $$
declare
  result public.lead_acquisitions;
  target_organization uuid := public.current_organization_id();
  event_provider text := nullif(acquisition_data->>'provider', '');
  event_id text := nullif(acquisition_data->>'external_event_id', '');
begin
  if target_organization is null then raise exception 'organization_not_found'; end if;

  if event_provider is not null and event_id is not null then
    select * into result from public.lead_acquisitions
      where organization_id = target_organization and provider = event_provider and external_event_id = event_id;
    if found then return result; end if;
  end if;

  insert into public.lead_acquisitions(
    organization_id, company_id, contact_id, opportunity_id, source_id, campaign_id, ad_group_id, ad_id,
    provider, external_event_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    landing_page, referrer, gclid, fbclid, utm_id, captured_at, metadata
  ) values (
    target_organization, (acquisition_data->>'company_id')::uuid, nullif(acquisition_data->>'contact_id','')::uuid,
    nullif(acquisition_data->>'opportunity_id','')::uuid, nullif(acquisition_data->>'source_id','')::uuid,
    nullif(acquisition_data->>'campaign_id','')::uuid, nullif(acquisition_data->>'ad_group_id','')::uuid,
    nullif(acquisition_data->>'ad_id','')::uuid, event_provider, event_id, acquisition_data->>'utm_source',
    acquisition_data->>'utm_medium', acquisition_data->>'utm_campaign', acquisition_data->>'utm_content',
    acquisition_data->>'utm_term', acquisition_data->>'landing_page', acquisition_data->>'referrer',
    acquisition_data->>'gclid', acquisition_data->>'fbclid', acquisition_data->>'utm_id',
    coalesce((acquisition_data->>'captured_at')::timestamptz, now()), coalesce(acquisition_data->'metadata','{}'::jsonb)
  ) returning * into result;
  return result;
exception when unique_violation then
  if event_provider is not null and event_id is not null then
    select * into result from public.lead_acquisitions
      where organization_id = target_organization and provider = event_provider and external_event_id = event_id;
    if found then return result; end if;
  end if;
  raise;
end $$;

grant execute on function public.capture_lead_acquisition(jsonb) to authenticated;
comment on function public.capture_lead_acquisition(jsonb) is
  'Idempotent acquisition capture. External credentials are never accepted or stored.';

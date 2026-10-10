
-- Keep the commercial-assistant entitlement and agent defaults aligned.
-- Existing enabled agents are preserved by backfilling the feature flag.
insert into public.organization_features (
  organization_id,
  feature_key,
  enabled,
  source,
  updated_at
)
select
  a.organization_id,
  'ai_commercial_assistant',
  true,
  'manual',
  now()
from public.ai_agents a
where a.is_enabled = true
on conflict (organization_id, feature_key) do nothing;

create or replace function public.apply_commercial_assistant_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.feature_key <> 'ai_commercial_assistant' then
    return new;
  end if;

  if new.enabled = true then
    update public.ai_agents
    set
      capabilities =
        jsonb_build_object('follow_up_leads', true)
        || coalesce(capabilities, '{}'::jsonb),
      behavior_config =
        jsonb_build_object(
          'followup_first_min_minutes', 120,
          'followup_first_max_minutes', 180,
          'followup_second_min_minutes', 360,
          'followup_second_max_minutes', 480,
          'followup_max_per_round', 2,
          'followup_max_per_24h', 3,
          'followup_timezone', 'America/Sao_Paulo',
          'followup_quiet_start_hour', 22,
          'followup_quiet_end_hour', 6
        )
        || coalesce(behavior_config, '{}'::jsonb),
      updated_at = now()
    where organization_id = new.organization_id;
  else
    update public.ai_agents
    set
      is_enabled = false,
      updated_at = now()
    where organization_id = new.organization_id;
  end if;

  return new;
end;
$$;

drop trigger if exists apply_commercial_assistant_defaults_trigger
on public.organization_features;

create trigger apply_commercial_assistant_defaults_trigger
after insert or update of enabled
on public.organization_features
for each row
when (new.feature_key = 'ai_commercial_assistant')
execute function public.apply_commercial_assistant_defaults();

-- Apply defaults once to currently entitled organizations without overwriting
-- any value already customized in behavior_config/capabilities.
update public.ai_agents a
set
  capabilities =
    jsonb_build_object('follow_up_leads', true)
    || coalesce(a.capabilities, '{}'::jsonb),
  behavior_config =
    jsonb_build_object(
      'followup_first_min_minutes', 120,
      'followup_first_max_minutes', 180,
      'followup_second_min_minutes', 360,
      'followup_second_max_minutes', 480,
      'followup_max_per_round', 2,
      'followup_max_per_24h', 3,
      'followup_timezone', 'America/Sao_Paulo',
      'followup_quiet_start_hour', 22,
      'followup_quiet_end_hour', 6
    )
    || coalesce(a.behavior_config, '{}'::jsonb),
  updated_at = now()
where exists (
  select 1
  from public.organization_features f
  where f.organization_id = a.organization_id
    and f.feature_key = 'ai_commercial_assistant'
    and f.enabled = true
);

revoke all on function public.apply_commercial_assistant_defaults() from public, anon, authenticated;
grant execute on function public.apply_commercial_assistant_defaults() to service_role;

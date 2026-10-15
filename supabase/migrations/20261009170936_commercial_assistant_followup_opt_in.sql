
-- Automatic follow-up remains opt-in per organization.
-- Preserve the two organizations already validated in production and keep
-- newly entitled/test tenants disabled until explicitly enabled.
update public.ai_agents
set capabilities =
  coalesce(capabilities, '{}'::jsonb)
  || jsonb_build_object('follow_up_leads', false),
  updated_at = now()
where organization_id in (
  'd7974851-bf9d-44d6-b0c1-c2c20f053db5'::uuid,
  'c4a4b1fe-7a50-4301-ac8b-c1bb147744d4'::uuid
);

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
        jsonb_build_object('follow_up_leads', false)
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

revoke all on function public.apply_commercial_assistant_defaults() from public, anon, authenticated;
grant execute on function public.apply_commercial_assistant_defaults() to service_role;

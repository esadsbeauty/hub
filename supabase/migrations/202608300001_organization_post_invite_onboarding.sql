-- Organization-scoped onboarding for tenants provisioned after this migration.
alter table public.organizations
  add column if not exists business_whatsapp text,
  add column if not exists city text,
  add column if not exists state char(2),
  add column if not exists instagram text;

create table if not exists public.organization_onboarding(
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  company_profile_completed boolean not null default false,
  owner_profile_completed boolean not null default false,
  whatsapp_completed boolean not null default false,
  pipeline_intro_completed boolean not null default false,
  first_lead_completed boolean not null default false,
  intro_seen_at timestamptz,
  completed_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.organization_onboarding enable row level security;
create policy organization_onboarding_tenant_read on public.organization_onboarding for select to authenticated
using(organization_id=public.current_organization_id());
-- Writes use tenant-safe RPCs so organization_id never comes from the browser.

-- Organizations that already exist are compatible and never forced through onboarding.
insert into public.organization_onboarding(
  organization_id,company_profile_completed,owner_profile_completed,whatsapp_completed,
  pipeline_intro_completed,first_lead_completed,intro_seen_at,completed_at,dismissed_at
)
select id,true,true,true,true,true,now(),now(),now() from public.organizations
on conflict(organization_id)do nothing;

create or replace function public.initialize_organization_onboarding() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 insert into public.organization_onboarding(organization_id)values(new.id)on conflict(organization_id)do nothing;
 return new;
end$$;
drop trigger if exists initialize_onboarding_on_organization on public.organizations;
create trigger initialize_onboarding_on_organization after insert on public.organizations
for each row execute function public.initialize_organization_onboarding();
revoke all on function public.initialize_organization_onboarding()from public,anon,authenticated;

create or replace function public.refresh_organization_onboarding(target_organization_id uuid) returns public.organization_onboarding
language plpgsql security definer set search_path=public as $$
declare state public.organization_onboarding;
begin
 update public.organization_onboarding ob set
  first_lead_completed=ob.first_lead_completed or exists(select 1 from public.companies c where c.organization_id=target_organization_id and c.deleted_at is null),
  completed_at=case when ob.completed_at is not null then ob.completed_at
    when ob.company_profile_completed and ob.owner_profile_completed and ob.whatsapp_completed and ob.pipeline_intro_completed
      and(ob.first_lead_completed or exists(select 1 from public.companies c where c.organization_id=target_organization_id and c.deleted_at is null))then now()else null end,
  updated_at=now()
 where ob.organization_id=target_organization_id returning*into state;
 return state;
end$$;
revoke all on function public.refresh_organization_onboarding(uuid)from public,anon,authenticated;

create or replace function public.organization_onboarding_snapshot()returns jsonb
language plpgsql security definer set search_path=public as $$
declare tenant uuid:=public.current_organization_id();state public.organization_onboarding;result jsonb;
begin
 if tenant is null then raise exception 'active_membership_required'using errcode='42501';end if;
 select*into state from public.refresh_organization_onboarding(tenant);
 if state.organization_id is null then raise exception 'onboarding_not_available';end if;
 select jsonb_build_object(
  'organization',jsonb_build_object('name',o.name,'whatsapp',coalesce(o.business_whatsapp,o.primary_contact_whatsapp),'city',o.city,'state',o.state,'instagram',o.instagram),
  'owner',jsonb_build_object('name',p.name,'email',p.email,'whatsapp',o.primary_contact_whatsapp),
  'pipeline',jsonb_build_object('id',pl.id,'name',pl.name,'stages',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'position',s.position,'isWon',s.is_won,'isLost',s.is_lost)order by s.position)from public.pipeline_stages s where s.pipeline_id=pl.id),'[]')),
  'state',jsonb_build_object('companyProfileCompleted',state.company_profile_completed,'ownerProfileCompleted',state.owner_profile_completed,'whatsappCompleted',state.whatsapp_completed,'pipelineIntroCompleted',state.pipeline_intro_completed,'firstLeadCompleted',state.first_lead_completed,'introSeenAt',state.intro_seen_at,'completedAt',state.completed_at,'dismissedAt',state.dismissed_at)
 )into result from public.organizations o join public.profiles p on p.id=auth.uid()
 left join public.pipelines pl on pl.organization_id=o.id and pl.is_default where o.id=tenant;
 return result;
end$$;
revoke all on function public.organization_onboarding_snapshot()from public,anon;
grant execute on function public.organization_onboarding_snapshot()to authenticated;

create or replace function public.update_organization_onboarding_profile(target_section text,profile_data jsonb)returns jsonb
language plpgsql security definer set search_path=public as $$
declare tenant uuid:=public.current_organization_id();clean_state text;
begin
 if tenant is null or not public.has_permission('settings.manage')then raise exception 'settings_manage_required'using errcode='42501';end if;
 if target_section='company' then
  clean_state:=upper(nullif(trim(profile_data->>'state'),''));
  if nullif(trim(profile_data->>'name'),'')is null or(clean_state is not null and clean_state!~'^[A-Z]{2}$')then raise exception 'invalid_company_profile';end if;
  update public.organizations set name=trim(profile_data->>'name'),city=nullif(trim(profile_data->>'city'),''),state=clean_state,instagram=nullif(trim(profile_data->>'instagram'),''),updated_at=now()where id=tenant;
  update public.organization_onboarding set company_profile_completed=true,updated_at=now()where organization_id=tenant;
 elsif target_section='whatsapp' then
  if nullif(trim(profile_data->>'whatsapp'),'')is null then raise exception 'whatsapp_required';end if;
  update public.organizations set business_whatsapp=trim(profile_data->>'whatsapp'),primary_contact_whatsapp=coalesce(primary_contact_whatsapp,trim(profile_data->>'whatsapp')),updated_at=now()where id=tenant;
  update public.organization_onboarding set whatsapp_completed=true,updated_at=now()where organization_id=tenant;
 elsif target_section='owner' then
  if nullif(trim(profile_data->>'name'),'')is null then raise exception 'owner_name_required';end if;
  update public.profiles set name=trim(profile_data->>'name'),updated_at=now()where id=auth.uid()and organization_id=tenant;
  update public.organizations set primary_contact_name=trim(profile_data->>'name'),primary_contact_whatsapp=coalesce(nullif(trim(profile_data->>'whatsapp'),''),primary_contact_whatsapp),updated_at=now()where id=tenant;
  update public.organization_onboarding set owner_profile_completed=true,updated_at=now()where organization_id=tenant;
 else raise exception 'invalid_onboarding_section';end if;
 return public.organization_onboarding_snapshot();
end$$;
revoke all on function public.update_organization_onboarding_profile(text,jsonb)from public,anon;
grant execute on function public.update_organization_onboarding_profile(text,jsonb)to authenticated;

create or replace function public.complete_organization_onboarding_step(target_step text)returns jsonb
language plpgsql security definer set search_path=public as $$
declare tenant uuid:=public.current_organization_id();
begin
 if tenant is null or not public.has_permission('settings.manage')then raise exception 'settings_manage_required'using errcode='42501';end if;
 if target_step='pipeline_intro' then update public.organization_onboarding set pipeline_intro_completed=true,updated_at=now()where organization_id=tenant;
 elsif target_step='intro_seen' then update public.organization_onboarding set intro_seen_at=coalesce(intro_seen_at,now()),updated_at=now()where organization_id=tenant;
 elsif target_step='dismiss' then
  if not exists(select 1 from public.organization_onboarding where organization_id=tenant and completed_at is not null)then raise exception 'onboarding_not_complete';end if;
  update public.organization_onboarding set dismissed_at=now(),updated_at=now()where organization_id=tenant;
 else raise exception 'invalid_onboarding_step';end if;
 perform public.refresh_organization_onboarding(tenant);
 return public.organization_onboarding_snapshot();
end$$;
revoke all on function public.complete_organization_onboarding_step(text)from public,anon;
grant execute on function public.complete_organization_onboarding_step(text)to authenticated;

notify pgrst,'reload schema';

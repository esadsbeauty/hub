-- Internal calendar blocks complement CRM tasks; existing follow-ups, meetings and tasks remain canonical in public.tasks.
create table if not exists public.calendar_events(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id)on delete cascade,
 title text not null,type text not null check(type in('focus_block','content','personal')),description text,
 start_at timestamptz not null,end_at timestamptz not null,all_day boolean not null default false,
 responsible_user_id uuid not null references public.profiles(id),company_id uuid references public.companies(id),contact_id uuid references public.contacts(id),opportunity_id uuid references public.opportunities(id),
 recurrence text not null default'none'check(recurrence in('none','daily','weekly','weekdays','monthly')),recurrence_days smallint[] not null default'{}'check(recurrence_days<@array[0,1,2,3,4,5,6]::smallint[]),recurrence_until date,
 status text not null default'active'check(status in('active','completed','cancelled')),
 external_provider text,external_calendar_id text,external_event_id text,external_sync_status text not null default'not_connected'check(external_sync_status in('not_connected','pending','synced','error')),external_updated_at timestamptz,
 created_by uuid not null default auth.uid()references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(end_at>start_at),check(recurrence<>'weekdays'or cardinality(recurrence_days)>0)
);
create index if not exists calendar_events_org_range_idx on public.calendar_events(organization_id,start_at,end_at);
create index if not exists calendar_events_responsible_range_idx on public.calendar_events(organization_id,responsible_user_id,start_at,end_at);
create unique index if not exists calendar_events_external_unique on public.calendar_events(organization_id,external_provider,external_calendar_id,external_event_id)where external_provider is not null and external_calendar_id is not null and external_event_id is not null;
alter table public.calendar_events enable row level security;
create policy calendar_events_tenant_read on public.calendar_events for select to authenticated using(organization_id=public.current_organization_id()and public.has_permission('agenda.view'));

create or replace function public.calendar_agenda_range(range_start timestamptz,range_end timestamptz,responsible_filter uuid default null)returns jsonb
language plpgsql security definer set search_path=public as $$
declare tenant uuid:=public.current_organization_id();zone text;result jsonb;
begin
 if tenant is null or not public.has_permission('agenda.view')then raise exception'access_denied'using errcode='42501';end if;
 if range_end<=range_start or range_end-range_start>interval'62 days'then raise exception'invalid_calendar_range'using errcode='22023';end if;
 select timezone into zone from public.organizations where id=tenant;
 with days as(select generate_series(date_trunc('day',range_start at time zone zone),date_trunc('day',(range_end-interval'1 microsecond')at time zone zone),interval'1 day')::date day),
 internal_occurrences as(
  select e.id,e.organization_id,'internal'::text source,e.type,e.title,e.description,e.status,e.responsible_user_id,
   ((d.day+(e.start_at at time zone zone)::time)at time zone zone)start_at,
   ((d.day+(e.start_at at time zone zone)::time)at time zone zone)+(e.end_at-e.start_at)end_at,e.all_day,e.company_id,e.contact_id,e.opportunity_id,e.recurrence,null::text priority,e.external_provider,e.external_sync_status
  from public.calendar_events e cross join days d where e.organization_id=tenant and e.status<>'cancelled'and(responsible_filter is null or e.responsible_user_id=responsible_filter)and d.day>=((e.start_at at time zone zone)::date)and(e.recurrence_until is null or d.day<=e.recurrence_until)and(
   (e.recurrence='none'and d.day=(e.start_at at time zone zone)::date)or e.recurrence='daily'or(e.recurrence='weekly'and extract(dow from d.day)=extract(dow from e.start_at at time zone zone))or(e.recurrence='weekdays'and extract(dow from d.day)::smallint=any(e.recurrence_days))or(e.recurrence='monthly'and extract(day from d.day)=extract(day from e.start_at at time zone zone)))
 ),crm_events as(
  select t.id,t.organization_id,'crm_task'::text source,t.type::text,t.title,t.description,t.status::text,t.assigned_to responsible_user_id,t.due_at start_at,t.due_at+make_interval(mins=>coalesce(t.duration_minutes,30))end_at,false all_day,t.company_id,null::uuid contact_id,t.opportunity_id,'none'::text recurrence,t.priority::text priority,null::text external_provider,'not_connected'::text external_sync_status
  from public.tasks t where t.organization_id=tenant and t.deleted_at is null and t.due_at>=range_start and t.due_at<range_end and(responsible_filter is null or t.assigned_to=responsible_filter)
 ),combined as(select*from internal_occurrences where start_at<range_end and end_at>range_start union all select*from crm_events)
 select jsonb_build_object('timezone',zone,'events',coalesce(jsonb_agg(jsonb_build_object('id',id,'organizationId',organization_id,'source',source,'type',type,'title',title,'description',description,'status',status,'responsibleId',responsible_user_id,'startAt',start_at,'endAt',end_at,'allDay',all_day,'companyId',company_id,'contactId',contact_id,'opportunityId',opportunity_id,'recurrence',recurrence,'priority',priority,'externalProvider',external_provider,'externalSyncStatus',external_sync_status)order by start_at),'[]'))into result from combined;
 return result;
end$$;

create or replace function public.upsert_calendar_event(event_data jsonb,allow_conflict boolean default false)returns jsonb
language plpgsql security definer set search_path=public as $$
declare tenant uuid:=public.current_organization_id();actor uuid:=auth.uid();event_id uuid:=nullif(event_data->>'id','')::uuid;responsible uuid:=coalesce(nullif(event_data->>'responsibleUserId','')::uuid,actor);starts timestamptz:=(event_data->>'startAt')::timestamptz;ends timestamptz:=(event_data->>'endAt')::timestamptz;has_conflict boolean;changed public.calendar_events;
begin
 if tenant is null or actor is null or not public.has_permission('agenda.view')then raise exception'access_denied'using errcode='42501';end if;
 if not exists(select 1 from public.organization_members where organization_id=tenant and user_id=responsible and status='active')then raise exception'invalid_calendar_responsible'using errcode='22023';end if;
 if responsible<>actor and not public.has_permission('crm.manage')then raise exception'team_calendar_manage_required'using errcode='42501';end if;
 if ends<=starts then raise exception'invalid_calendar_interval'using errcode='22023';end if;
 select exists(select 1 from public.calendar_events e where e.organization_id=tenant and e.responsible_user_id=responsible and e.status='active'and e.id is distinct from event_id and e.start_at<ends and e.end_at>starts)or exists(select 1 from public.tasks t where t.organization_id=tenant and t.assigned_to=responsible and t.status='pending'and t.deleted_at is null and t.due_at<ends and t.due_at+make_interval(mins=>coalesce(t.duration_minutes,30))>starts)into has_conflict;
 if has_conflict and not allow_conflict then return jsonb_build_object('conflict',true);end if;
 if event_id is null then insert into public.calendar_events(organization_id,title,type,description,start_at,end_at,all_day,responsible_user_id,company_id,contact_id,opportunity_id,recurrence,recurrence_days,recurrence_until,created_by)values(tenant,trim(event_data->>'title'),event_data->>'type',nullif(trim(event_data->>'description'),''),starts,ends,coalesce((event_data->>'allDay')::boolean,false),responsible,nullif(event_data->>'companyId','')::uuid,nullif(event_data->>'contactId','')::uuid,nullif(event_data->>'opportunityId','')::uuid,coalesce(event_data->>'recurrence','none'),coalesce(array(select jsonb_array_elements_text(coalesce(event_data->'recurrenceDays','[]'))::smallint),'{}'),nullif(event_data->>'recurrenceUntil','')::date,actor)returning*into changed;
 else update public.calendar_events set title=trim(event_data->>'title'),type=event_data->>'type',description=nullif(trim(event_data->>'description'),''),start_at=starts,end_at=ends,responsible_user_id=responsible,company_id=nullif(event_data->>'companyId','')::uuid,contact_id=nullif(event_data->>'contactId','')::uuid,opportunity_id=nullif(event_data->>'opportunityId','')::uuid,recurrence=coalesce(event_data->>'recurrence','none'),recurrence_days=coalesce(array(select jsonb_array_elements_text(coalesce(event_data->'recurrenceDays','[]'))::smallint),'{}'),recurrence_until=nullif(event_data->>'recurrenceUntil','')::date,updated_at=now()where id=event_id and organization_id=tenant and(created_by=actor or public.has_permission('crm.manage'))returning*into changed;end if;
 if changed.id is null then raise exception'calendar_event_not_found'using errcode='P0002';end if;return jsonb_build_object('conflict',has_conflict,'event',to_jsonb(changed));
end$$;

create or replace function public.set_calendar_event_status(target_event_id uuid,next_status text)returns void language plpgsql security definer set search_path=public as $$
declare tenant uuid:=public.current_organization_id();actor uuid:=auth.uid();begin if tenant is null or not public.has_permission('agenda.view')then raise exception'access_denied'using errcode='42501';end if;if next_status not in('active','completed','cancelled')then raise exception'invalid_calendar_status';end if;update public.calendar_events set status=next_status,updated_at=now()where id=target_event_id and organization_id=tenant and(created_by=actor or public.has_permission('crm.manage'));if not found then raise exception'calendar_event_not_found';end if;end$$;
revoke all on function public.calendar_agenda_range(timestamptz,timestamptz,uuid),public.upsert_calendar_event(jsonb,boolean),public.set_calendar_event_status(uuid,text)from public,anon;
grant execute on function public.calendar_agenda_range(timestamptz,timestamptz,uuid),public.upsert_calendar_event(jsonb,boolean),public.set_calendar_event_status(uuid,text)to authenticated;

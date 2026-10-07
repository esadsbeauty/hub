-- Render every internal/CRM source in the requested organization timezone, including statuses used by Agenda filters.
create or replace function public.calendar_agenda_range(range_start timestamptz,range_end timestamptz,responsible_filter uuid default null)returns jsonb
language plpgsql security definer set search_path=public as $$
declare tenant uuid:=public.current_organization_id();zone text;result jsonb;
begin
 if tenant is null or not public.has_permission('agenda.view')then raise exception'access_denied'using errcode='42501';end if;
 if range_end<=range_start or range_end-range_start>interval'122 days'then raise exception'invalid_calendar_range'using errcode='22023';end if;
 select timezone into zone from public.organizations where id=tenant;
 with days as(select generate_series(date_trunc('day',range_start at time zone zone),date_trunc('day',(range_end-interval'1 microsecond')at time zone zone),interval'1 day')::date day),
 internal_occurrences as(
  select e.id,e.organization_id,'internal'::text source,e.type,e.title,e.description,e.status,e.responsible_user_id,
   ((d.day+(e.start_at at time zone zone)::time)at time zone zone)start_at,
   ((d.day+(e.start_at at time zone zone)::time)at time zone zone)+(e.end_at-e.start_at)end_at,e.all_day,e.company_id,e.contact_id,e.opportunity_id,e.recurrence,null::text priority,e.external_provider,e.external_sync_status
  from public.calendar_events e cross join days d where e.organization_id=tenant and(responsible_filter is null or e.responsible_user_id=responsible_filter)and d.day>=((e.start_at at time zone zone)::date)and(e.recurrence_until is null or d.day<=e.recurrence_until)and(
   (e.recurrence='none'and d.day=(e.start_at at time zone zone)::date)or e.recurrence='daily'or(e.recurrence='weekly'and extract(dow from d.day)=extract(dow from e.start_at at time zone zone))or(e.recurrence='weekdays'and extract(dow from d.day)::smallint=any(e.recurrence_days))or(e.recurrence='monthly'and extract(day from d.day)=extract(day from e.start_at at time zone zone)))
 ),crm_events as(
  select t.id,t.organization_id,'crm_task'::text source,t.type::text,t.title,t.description,t.status::text,t.assigned_to responsible_user_id,t.due_at start_at,t.due_at+make_interval(mins=>coalesce(t.duration_minutes,30))end_at,false all_day,t.company_id,null::uuid contact_id,t.opportunity_id,'none'::text recurrence,t.priority::text priority,null::text external_provider,'not_connected'::text external_sync_status
  from public.tasks t where t.organization_id=tenant and t.deleted_at is null and t.due_at>=range_start and t.due_at<range_end and(responsible_filter is null or t.assigned_to=responsible_filter)
 ),combined as(select*from internal_occurrences where start_at<range_end and end_at>range_start union all select*from crm_events)
 select jsonb_build_object('timezone',zone,'events',coalesce(jsonb_agg(jsonb_build_object('id',id,'organizationId',organization_id,'source',source,'type',type,'title',title,'description',description,'status',status,'responsibleId',responsible_user_id,'startAt',start_at,'endAt',end_at,'allDay',all_day,'companyId',company_id,'contactId',contact_id,'opportunityId',opportunity_id,'recurrence',recurrence,'priority',priority,'externalProvider',external_provider,'externalSyncStatus',external_sync_status)order by start_at),'[]'))into result from combined;
 return result;
end$$;
revoke all on function public.calendar_agenda_range(timestamptz,timestamptz,uuid)from public,anon;
grant execute on function public.calendar_agenda_range(timestamptz,timestamptz,uuid)to authenticated;

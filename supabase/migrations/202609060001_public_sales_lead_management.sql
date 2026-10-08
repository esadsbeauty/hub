-- Platform-only commercial follow-up for leads captured by /sistema.
alter table public.public_sales_leads
  add column if not exists notes text,
  add column if not exists last_contacted_at timestamptz;

alter table public.public_sales_leads drop constraint if exists public_sales_leads_status_check;
update public.public_sales_leads set status=case status when 'qualified' then 'conversation' when 'discarded' then 'lost' else status end
where status in('qualified','discarded');
alter table public.public_sales_leads add constraint public_sales_leads_status_check
  check(status in('new','contacted','conversation','meeting','customer','lost'));

create index if not exists public_sales_leads_updated_idx on public.public_sales_leads(updated_at desc);
create index if not exists public_sales_leads_source_campaign_idx on public.public_sales_leads(utm_source,utm_campaign);

create or replace function public.platform_public_sales_leads_page(filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare page_size integer:=least(greatest(coalesce((filters->>'pageSize')::integer,20),1),50);
 page_number integer:=greatest(coalesce((filters->>'page')::integer,1),1); result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'platform_admin_required' using errcode='42501';end if;
 with filtered as(
  select l.* from public.public_sales_leads l where
   (coalesce(filters->>'status','')='' or l.status=filters->>'status') and
   (coalesce(filters->>'source','')='' or coalesce(l.utm_source,'')=filters->>'source') and
   (coalesce(filters->>'campaign','')='' or coalesce(l.utm_campaign,'')=filters->>'campaign') and
   (coalesce(filters->>'query','')='' or concat_ws(' ',l.name,l.whatsapp,l.email,l.business_name) ilike '%'||trim(filters->>'query')||'%') and
   (coalesce(filters->>'period','')='' or l.created_at>=now()-case filters->>'period' when '7' then interval '7 days' when '30' then interval '30 days' else interval '100 years' end)
 ), ordered as(
  select * from filtered order by
   case when filters->>'sort'='oldest' then created_at end asc,
   case when filters->>'sort'='updated' then updated_at end desc,
   case when coalesce(filters->>'sort','newest')='newest' then created_at end desc,id desc
  limit page_size offset (page_number-1)*page_size
 )
 select jsonb_build_object(
  'items',coalesce((select jsonb_agg(to_jsonb(o)) from ordered o),'[]'::jsonb),
  'total',(select count(*) from filtered),
  'page',page_number,'pageSize',page_size,
  'metrics',jsonb_build_object('total',(select count(*) from public.public_sales_leads),'new',(select count(*) from public.public_sales_leads where status='new'),'contacted',(select count(*) from public.public_sales_leads where status='contacted'),'meeting',(select count(*) from public.public_sales_leads where status='meeting'),'customer',(select count(*) from public.public_sales_leads where status='customer'),'lost',(select count(*) from public.public_sales_leads where status='lost'),'last7Days',(select count(*) from public.public_sales_leads where created_at>=now()-interval '7 days'),'last30Days',(select count(*) from public.public_sales_leads where created_at>=now()-interval '30 days')),
  'sources',coalesce((select jsonb_agg(value order by value) from(select distinct utm_source value from public.public_sales_leads where utm_source is not null and utm_source<>'')s),'[]'::jsonb),
  'campaigns',coalesce((select jsonb_agg(value order by value) from(select distinct utm_campaign value from public.public_sales_leads where utm_campaign is not null and utm_campaign<>'')c),'[]'::jsonb)
 ) into result;
 return result;
end$$;

create or replace function public.platform_update_public_sales_lead(target_lead_id uuid,new_status text,new_notes text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare changed public.public_sales_leads;
begin
 if not public.is_platform_admin() then raise exception 'platform_admin_required' using errcode='42501';end if;
 if new_status not in('new','contacted','conversation','meeting','customer','lost') then raise exception 'invalid_sales_lead_status' using errcode='22023';end if;
 update public.public_sales_leads set status=new_status,notes=nullif(trim(new_notes),''),
  last_contacted_at=case when new_status in('contacted','conversation','meeting','customer') then coalesce(last_contacted_at,now()) else last_contacted_at end,
  updated_at=now() where id=target_lead_id returning * into changed;
 if changed.id is null then raise exception 'sales_lead_not_found' using errcode='P0002';end if;
 return to_jsonb(changed);
end$$;

revoke all on function public.platform_public_sales_leads_page(jsonb) from public;
revoke all on function public.platform_update_public_sales_lead(uuid,text,text) from public;
grant execute on function public.platform_public_sales_leads_page(jsonb) to authenticated;
grant execute on function public.platform_update_public_sales_lead(uuid,text,text) to authenticated;

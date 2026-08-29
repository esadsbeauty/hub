-- Public sales-interest inbox. It is intentionally separate from tenant CRM and never provisions a tenant, plan, subscription or payment.
create table if not exists public.public_sales_leads(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), idempotency_key uuid not null,
 name text not null, whatsapp text not null, email text not null, business_name text not null, source text not null default 'sistema',
 utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text, fbclid text, landing_url text, referrer text,
 status text not null default 'new' check(status in('new','contacted','qualified','discarded')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,idempotency_key)
);
create index if not exists public_sales_leads_inbox_idx on public.public_sales_leads(organization_id,status,created_at desc);
alter table public.public_sales_leads enable row level security;
drop policy if exists platform_admin_sales_leads_read on public.public_sales_leads;
create policy platform_admin_sales_leads_read on public.public_sales_leads for select to authenticated using(public.is_platform_admin());

create or replace function public.submit_public_sales_lead(lead_data jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare destination uuid;lead_id uuid;idem uuid;digits text;normalized_email text;
begin
 if coalesce(lead_data->>'website','')<>'' then raise exception 'invalid_submission' using errcode='22023';end if;
 digits:=regexp_replace(coalesce(lead_data->>'whatsapp',''),'\D','','g');normalized_email:=lower(trim(coalesce(lead_data->>'email','')));
 if length(trim(coalesce(lead_data->>'name','')))<2 or length(trim(coalesce(lead_data->>'businessName','')))<2 or length(digits)<10 or normalized_email!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_contact' using errcode='22023';end if;
 idem:=(lead_data->>'idempotency_key')::uuid;perform pg_advisory_xact_lock(hashtextextended(idem::text,0));
 select id into destination from public.organizations where slug='esads-beauty' limit 1;if destination is null then raise exception 'sales_destination_not_configured' using errcode='P0002';end if;
 select id into lead_id from public.public_sales_leads where organization_id=destination and idempotency_key=idem;if lead_id is not null then return jsonb_build_object('id',lead_id);end if;
 if exists(select 1 from public.public_sales_leads where organization_id=destination and(whatsapp=digits or email=normalized_email)and created_at>now()-interval'60 seconds')then raise exception 'rate_limited' using errcode='42900';end if;
 insert into public.public_sales_leads(organization_id,idempotency_key,name,whatsapp,email,business_name,utm_source,utm_medium,utm_campaign,utm_content,utm_term,fbclid,landing_url,referrer)
 values(destination,idem,trim(lead_data->>'name'),digits,normalized_email,trim(lead_data->>'businessName'),lead_data#>>'{attribution,utm_source}',lead_data#>>'{attribution,utm_medium}',lead_data#>>'{attribution,utm_campaign}',lead_data#>>'{attribution,utm_content}',lead_data#>>'{attribution,utm_term}',lead_data#>>'{attribution,fbclid}',nullif(lead_data->>'landing_url',''),nullif(lead_data->>'referrer',''))returning id into lead_id;
 return jsonb_build_object('id',lead_id);
end$$;
revoke all on function public.submit_public_sales_lead(jsonb)from public;grant execute on function public.submit_public_sales_lead(jsonb)to anon,authenticated;

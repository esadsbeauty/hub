-- Provider-neutral external charges, webhook idempotency and shared payment domain.
create table if not exists public.billing_charges(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id)on delete cascade,
 subscription_id uuid not null references public.organization_subscriptions(id),provider text not null,
 idempotency_key text not null,external_payment_id text,amount_cents integer not null check(amount_cents>=0),currency char(3)not null,
 status text not null check(status in('creating','pending','paid','overdue','refunded','cancelled','failed','needs_review')),
 due_at timestamptz not null,paid_at timestamptz,payment_method text not null,invoice_url text,pix_payload text,pix_qr_code text,pix_expires_at timestamptz,
 request_token uuid not null default gen_random_uuid(),error_message text,provider_metadata jsonb not null default'{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(provider,idempotency_key),unique(provider,external_payment_id)
);
create index if not exists billing_charges_tenant_created_idx on public.billing_charges(organization_id,created_at desc);
create table if not exists public.payment_provider_events(
 id uuid primary key default gen_random_uuid(),provider text not null,external_event_id text not null,event_type text not null,external_payment_id text,
 received_at timestamptz not null default now(),processed_at timestamptz,processing_status text not null check(processing_status in('processing','processed','failed','ignored','needs_review')),
 error_message text,sanitized_payload jsonb not null default'{}',unique(provider,external_event_id)
);
create unique index if not exists subscription_payments_provider_payment_unique on public.subscription_payments(provider,external_payment_id)where external_payment_id is not null;
alter table public.billing_charges enable row level security;alter table public.payment_provider_events enable row level security;
create policy billing_charges_tenant_read on public.billing_charges for select to authenticated using(organization_id=public.current_organization_id());
-- Provider events have no tenant policy; they are available only through Platform Admin/backend RPCs.

create or replace function public.platform_prepare_billing_charge(target_subscription_id uuid,target_provider text default'asaas')returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.organization_subscriptions;o public.organizations;p public.plans;c public.billing_charges;key text;
begin
 if not public.is_platform_admin()then raise exception'platform_admin_required'using errcode='42501';end if;
 select*into s from public.organization_subscriptions where id=target_subscription_id and status<>'cancelled'for update;
 if s.id is null then raise exception'subscription_not_billable';end if;select*into p from public.plans where id=s.plan_id;
 if p.slug='legacy'or s.price_cents=0 then raise exception'free_plan_not_billable';end if;select*into o from public.organizations where id=s.organization_id;
 key:=s.id::text||':'||s.next_due_at::date::text||':'||lower(target_provider);
 select*into c from public.billing_charges where provider=lower(target_provider)and idempotency_key=key for update;
 if c.id is not null and c.external_payment_id is not null then return jsonb_build_object('existing',true,'chargeId',c.id);end if;
 if c.id is not null and c.status='creating'and c.updated_at>now()-interval'2 minutes'then return jsonb_build_object('processing',true,'chargeId',c.id);end if;
 if c.id is null then insert into public.billing_charges(organization_id,subscription_id,provider,idempotency_key,amount_cents,currency,status,due_at,payment_method)
  values(s.organization_id,s.id,lower(target_provider),key,s.price_cents,s.currency,'creating',s.next_due_at,'pix')returning*into c;
 else update public.billing_charges set status='creating',request_token=gen_random_uuid(),error_message=null,updated_at=now()where id=c.id returning*into c;end if;
 return jsonb_build_object('existing',false,'processing',false,'chargeId',c.id,'requestToken',c.request_token,'subscriptionId',s.id,'amountCents',s.price_cents,'currency',s.currency,'dueDate',s.next_due_at::date,'externalCustomerId',s.external_customer_id,'customer',jsonb_build_object('name',o.name,'email',o.primary_contact_email,'phone',coalesce(o.primary_contact_whatsapp,o.business_whatsapp)));
end$$;
revoke all on function public.platform_prepare_billing_charge(uuid,text)from public,anon;grant execute on function public.platform_prepare_billing_charge(uuid,text)to authenticated;

create or replace function public.platform_record_external_customer(target_subscription_id uuid,target_provider text,target_external_customer_id text)returns void language plpgsql security definer set search_path=public as $$begin if not public.is_platform_admin()then raise exception'platform_admin_required'using errcode='42501';end if;update public.organization_subscriptions set provider=lower(target_provider),external_customer_id=coalesce(external_customer_id,target_external_customer_id),updated_at=now()where id=target_subscription_id and status<>'cancelled';if not found then raise exception'subscription_not_billable';end if;end$$;
revoke all on function public.platform_record_external_customer(uuid,text,text)from public,anon;grant execute on function public.platform_record_external_customer(uuid,text,text)to authenticated;

create or replace function public.platform_finalize_billing_charge(target_charge_id uuid,target_request_token uuid,external_data jsonb)returns void
language plpgsql security definer set search_path=public as $$
declare c public.billing_charges;
begin if not public.is_platform_admin()then raise exception'platform_admin_required'using errcode='42501';end if;
 select*into c from public.billing_charges where id=target_charge_id and request_token=target_request_token for update;if c.id is null then raise exception'invalid_charge_attempt';end if;
 update public.billing_charges set external_payment_id=external_data->>'externalPaymentId',status='pending',invoice_url=nullif(external_data->>'invoiceUrl',''),pix_payload=nullif(external_data->>'pixPayload',''),pix_qr_code=nullif(external_data->>'pixQrCode',''),pix_expires_at=nullif(external_data->>'pixExpiresAt','')::timestamptz,provider_metadata=jsonb_strip_nulls(jsonb_build_object('providerStatus',external_data->>'providerStatus')),updated_at=now()where id=c.id;
 update public.organization_subscriptions set provider=c.provider,external_customer_id=coalesce(external_customer_id,nullif(external_data->>'externalCustomerId','')),updated_at=now()where id=c.subscription_id;
end$$;
create or replace function public.platform_sync_billing_charge(target_subscription_id uuid,external_data jsonb)returns void language plpgsql security definer set search_path=public as $$
declare c public.billing_charges;provider_status text;internal_status text;
begin if not public.is_platform_admin()then raise exception'platform_admin_required'using errcode='42501';end if;
 select*into c from public.billing_charges where subscription_id=target_subscription_id and external_payment_id=external_data->>'externalPaymentId'order by created_at desc limit 1 for update;if c.id is null then raise exception'charge_not_found';end if;
 provider_status:=external_data->>'providerStatus';internal_status:=case when provider_status in('RECEIVED','CONFIRMED','RECEIVED_IN_CASH')then'paid'when provider_status='OVERDUE'then'overdue'when provider_status in('REFUNDED','REFUND_REQUESTED')then'refunded'when provider_status in('DELETED','DELETED_BY_USER')then'cancelled'else'pending'end;
 update public.billing_charges set status=internal_status,invoice_url=coalesce(nullif(external_data->>'invoiceUrl',''),invoice_url),pix_payload=coalesce(nullif(external_data->>'pixPayload',''),pix_payload),pix_qr_code=coalesce(nullif(external_data->>'pixQrCode',''),pix_qr_code),pix_expires_at=coalesce(nullif(external_data->>'pixExpiresAt','')::timestamptz,pix_expires_at),provider_metadata=jsonb_strip_nulls(jsonb_build_object('providerStatus',provider_status)),updated_at=now()where id=c.id;
end$$;
revoke all on function public.platform_sync_billing_charge(uuid,jsonb)from public,anon;grant execute on function public.platform_sync_billing_charge(uuid,jsonb)to authenticated;

create or replace function public.platform_fail_billing_charge(target_charge_id uuid,target_request_token uuid,safe_error text)returns void language plpgsql security definer set search_path=public as $$begin if not public.is_platform_admin()then raise exception'platform_admin_required'using errcode='42501';end if;update public.billing_charges set status='failed',error_message=left(safe_error,300),updated_at=now()where id=target_charge_id and request_token=target_request_token;end$$;
revoke all on function public.platform_finalize_billing_charge(uuid,uuid,jsonb)from public,anon;grant execute on function public.platform_finalize_billing_charge(uuid,uuid,jsonb)to authenticated;
revoke all on function public.platform_fail_billing_charge(uuid,uuid,text)from public,anon;grant execute on function public.platform_fail_billing_charge(uuid,uuid,text)to authenticated;

create or replace function public.apply_confirmed_subscription_payment(target_subscription_id uuid,target_charge_id uuid,confirmed_at timestamptz,confirmed_amount_cents integer,confirmed_currency text,confirmed_method text,confirmed_due_at timestamptz,confirmed_provider text,confirmed_external_payment_id text,actor_user_id uuid default null)returns void
language plpgsql security definer set search_path=public as $$
declare c public.billing_charges;s public.organization_subscriptions;payment_id uuid;period_start timestamptz;period_end timestamptz;
begin select*into s from public.organization_subscriptions where id=target_subscription_id for update;if s.id is null then raise exception'subscription_not_found';end if;
 if confirmed_amount_cents<>s.price_cents or confirmed_currency<>s.currency then raise exception'payment_amount_mismatch';end if;
 if target_charge_id is not null then select*into c from public.billing_charges where id=target_charge_id and subscription_id=s.id for update;if c.id is null or c.amount_cents<>confirmed_amount_cents or c.currency<>confirmed_currency then raise exception'charge_payment_mismatch';end if;end if;
 insert into public.subscription_payments(organization_id,subscription_id,amount_cents,currency,status,payment_method,paid_at,due_at,provider,external_payment_id,created_by,created_at)
 values(s.organization_id,s.id,confirmed_amount_cents,confirmed_currency,'paid',confirmed_method,confirmed_at,confirmed_due_at,confirmed_provider,confirmed_external_payment_id,actor_user_id,now())on conflict(provider,external_payment_id)where external_payment_id is not null do nothing returning id into payment_id;
 if payment_id is null then if target_charge_id is not null then update public.billing_charges set status='paid',paid_at=coalesce(paid_at,confirmed_at),updated_at=now()where id=target_charge_id;end if;return;end if;
 if target_charge_id is not null then update public.billing_charges set status='paid',paid_at=confirmed_at,updated_at=now()where id=target_charge_id;end if;
 if s.status<>'cancelled'then period_start:=greatest(s.current_period_end,confirmed_at);period_end:=period_start+make_interval(months=>s.billing_interval_months);
  update public.organization_subscriptions set status='active',last_payment_at=greatest(coalesce(last_payment_at,'epoch'),confirmed_at),current_period_start=period_start,current_period_end=period_end,next_due_at=period_end,grace_period_ends_at=period_end+make_interval(days=>grace_period_days),suspended_at=null,updated_at=now()where id=s.id;end if;
end$$;
revoke all on function public.apply_confirmed_subscription_payment(uuid,uuid,timestamptz,integer,text,text,timestamptz,text,text,uuid)from public,anon,authenticated;

create or replace function public.platform_mark_subscription_paid(target_subscription_id uuid,payment_notes text default null)returns void language plpgsql security definer set search_path=public as $$
declare s public.organization_subscriptions;
begin if not public.is_platform_admin()then raise exception'platform_admin_required'using errcode='42501';end if;select*into s from public.organization_subscriptions where id=target_subscription_id;if s.id is null then raise exception'subscription_not_found';end if;if s.status='cancelled'then raise exception'cancelled_subscription';end if;
 perform public.apply_confirmed_subscription_payment(s.id,null,now(),s.price_cents,s.currency,'manual',s.next_due_at,'manual',null,auth.uid());
 if payment_notes is not null then update public.subscription_payments set notes=nullif(trim(payment_notes),'')where id=(select id from public.subscription_payments where subscription_id=s.id and provider='manual'order by created_at desc limit 1);end if;
end$$;
revoke all on function public.platform_mark_subscription_paid(uuid,text)from public,anon;grant execute on function public.platform_mark_subscription_paid(uuid,text)to authenticated;

create or replace function public.process_payment_provider_event(target_provider text,target_event_id text,target_event_type text,target_external_payment_id text,event_amount_cents integer,event_paid_at timestamptz,safe_payload jsonb)returns jsonb
language plpgsql security definer set search_path=public as $$
declare e public.payment_provider_events;c public.billing_charges;mapped_status text;
begin
 insert into public.payment_provider_events(provider,external_event_id,event_type,external_payment_id,processing_status,sanitized_payload)values(lower(target_provider),target_event_id,target_event_type,target_external_payment_id,'processing',coalesce(safe_payload,'{}'))
 on conflict(provider,external_event_id)do update set processing_status=case when public.payment_provider_events.processing_status='processed'then'processed'else'processing'end,error_message=null
 returning*into e;if e.processing_status='processed'then return jsonb_build_object('duplicate',true,'processingStatus','processed');end if;
 begin
  select*into c from public.billing_charges where provider=lower(target_provider)and external_payment_id=target_external_payment_id for update;if c.id is null then raise exception'unknown_external_payment';end if;
  if target_event_type in('PAYMENT_RECEIVED','PAYMENT_CONFIRMED')then
   if event_amount_cents is null or event_amount_cents<>c.amount_cents then update public.billing_charges set status='needs_review',error_message='payment_amount_mismatch',updated_at=now()where id=c.id;update public.payment_provider_events set processing_status='needs_review',error_message='payment_amount_mismatch',processed_at=now()where id=e.id;return jsonb_build_object('duplicate',false,'processingStatus','needs_review');end if;
   perform public.apply_confirmed_subscription_payment(c.subscription_id,c.id,coalesce(event_paid_at,now()),event_amount_cents,c.currency,c.payment_method,c.due_at,c.provider,c.external_payment_id,null);
  elsif target_event_type='PAYMENT_OVERDUE'then update public.billing_charges set status='overdue',updated_at=now()where id=c.id;update public.organization_subscriptions set status='past_due',updated_at=now()where id=c.subscription_id and status in('active','pending');
  elsif target_event_type='PAYMENT_REFUNDED'then update public.billing_charges set status='refunded',updated_at=now()where id=c.id;update public.subscription_payments set status='refunded'where provider=c.provider and external_payment_id=c.external_payment_id;
  elsif target_event_type in('PAYMENT_DELETED')then update public.billing_charges set status='cancelled',updated_at=now()where id=c.id;
  elsif target_event_type='PAYMENT_CREATED'then update public.billing_charges set status='pending',updated_at=now()where id=c.id;
  else update public.payment_provider_events set processing_status='ignored',processed_at=now()where id=e.id;return jsonb_build_object('duplicate',false,'processingStatus','ignored');end if;
  update public.payment_provider_events set processing_status='processed',processed_at=now()where id=e.id;return jsonb_build_object('duplicate',false,'processingStatus','processed');
 exception when others then update public.payment_provider_events set processing_status='failed',error_message=left(sqlerrm,300)where id=e.id;return jsonb_build_object('duplicate',false,'processingStatus','failed');end;
end$$;
revoke all on function public.process_payment_provider_event(text,text,text,text,integer,timestamptz,jsonb)from public,anon,authenticated;grant execute on function public.process_payment_provider_event(text,text,text,text,integer,timestamptz,jsonb)to service_role;

create or replace function public.current_billing_snapshot()returns jsonb language plpgsql stable security definer set search_path=public as $$
declare tenant uuid:=public.current_organization_id();result jsonb;
begin if tenant is null then raise exception'active_membership_required'using errcode='42501';end if;
 select jsonb_build_object('subscription',jsonb_build_object('id',s.id,'planName',p.name,'status',case when p.slug='legacy'and s.price_cents=0 then'active'else public.subscription_effective_status(s.status,s.next_due_at,s.grace_period_ends_at,now())end,'priceCents',s.price_cents,'currency',s.currency,'nextDueAt',s.next_due_at,'paymentMethod',s.payment_method),'charge',case when c.id is null then null else jsonb_build_object('id',c.id,'provider',c.provider,'status',c.status,'amountCents',c.amount_cents,'currency',c.currency,'dueAt',c.due_at,'paymentMethod',c.payment_method,'invoiceUrl',c.invoice_url,'pixPayload',c.pix_payload,'pixQrCode',c.pix_qr_code,'pixExpiresAt',c.pix_expires_at)end)into result
 from public.organization_subscriptions s join public.plans p on p.id=s.plan_id left join lateral(select x.*from public.billing_charges x where x.subscription_id=s.id order by x.created_at desc limit 1)c on true where s.organization_id=tenant order by(s.status<>'cancelled')desc,s.created_at desc limit 1;return result;
end$$;
revoke all on function public.current_billing_snapshot()from public,anon;grant execute on function public.current_billing_snapshot()to authenticated;

-- Extend Platform Admin snapshot without changing existing keys.
create or replace function public.platform_billing_charge_snapshot(target_subscription_id uuid)returns jsonb language sql stable security definer set search_path=public as $$select case when public.is_platform_admin()then(select to_jsonb(c)-'pix_payload'-'pix_qr_code'from public.billing_charges c where c.subscription_id=target_subscription_id order by c.created_at desc limit 1)else null end$$;
revoke all on function public.platform_billing_charge_snapshot(uuid)from public,anon;grant execute on function public.platform_billing_charge_snapshot(uuid)to authenticated;
notify pgrst,'reload schema';

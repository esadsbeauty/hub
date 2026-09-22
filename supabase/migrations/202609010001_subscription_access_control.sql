-- Tenant-safe source of truth for controlled subscription access.
create or replace function public.current_subscription_access()returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare tenant uuid:=public.current_organization_id();subscription public.organization_subscriptions;plan public.plans;effective_status text;overdue_days integer:=0;
begin
 if public.is_platform_admin()then
  return jsonb_build_object('status','active','persistedStatus','active','isBlocked',false,'isPlatformAdmin',true,'daysOverdue',0);
 end if;
 if tenant is null then raise exception 'active_membership_required'using errcode='42501';end if;
 select s.*into subscription from public.organization_subscriptions s where s.organization_id=tenant order by(s.status<>'cancelled')desc,s.created_at desc limit 1;
 if subscription.id is null then raise exception 'subscription_not_found'using errcode='42501';end if;
 select p.*into plan from public.plans p where p.id=subscription.plan_id;
 -- Legacy is a non-billable compatibility plan and never ages into delinquency.
 effective_status:=case when plan.slug='legacy'and subscription.price_cents=0 then 'active'
  else public.subscription_effective_status(subscription.status,subscription.next_due_at,subscription.grace_period_ends_at,now())end;
 if subscription.next_due_at<now()then overdue_days:=floor(extract(epoch from(now()-subscription.next_due_at))/86400)::integer;end if;
 return jsonb_build_object('status',effective_status,'persistedStatus',subscription.status,'isBlocked',effective_status in('suspended','cancelled'),'isPlatformAdmin',false,'planName',plan.name,'priceCents',subscription.price_cents,'nextDueAt',subscription.next_due_at,'gracePeriodEndsAt',subscription.grace_period_ends_at,'daysOverdue',overdue_days);
end$$;
revoke all on function public.current_subscription_access()from public,anon;
grant execute on function public.current_subscription_access()to authenticated;
notify pgrst,'reload schema';

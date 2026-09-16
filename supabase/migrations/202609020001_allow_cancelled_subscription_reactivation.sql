-- Allow Platform Admin to reopen a cancelled subscription without losing history.
create or replace function public.platform_reactivate_subscription(target_subscription_id uuid)returns void
language plpgsql security definer set search_path=public as $$
declare subscription public.organization_subscriptions;cycle_start timestamptz:=now();cycle_end timestamptz;
begin
 if not public.is_platform_admin()then raise exception 'platform_admin_required'using errcode='42501';end if;
 select*into subscription from public.organization_subscriptions where id=target_subscription_id for update;
 if subscription.id is null then raise exception 'subscription_not_found';end if;
 if subscription.status not in('suspended','past_due','pending','cancelled')then raise exception 'subscription_not_reactivatable';end if;
 if subscription.status='cancelled'and exists(
  select 1 from public.organization_subscriptions current
  where current.organization_id=subscription.organization_id and current.id<>subscription.id and current.status<>'cancelled'
 )then raise exception 'organization_already_has_current_subscription';end if;
 if subscription.status='cancelled'then
  cycle_end:=cycle_start+make_interval(months=>subscription.billing_interval_months);
  update public.organization_subscriptions set status='active',cancelled_at=null,suspended_at=null,
   current_period_start=cycle_start,current_period_end=cycle_end,next_due_at=cycle_end,
   grace_period_ends_at=cycle_end+make_interval(days=>subscription.grace_period_days),updated_at=now()
  where id=subscription.id;
 else
  update public.organization_subscriptions set status='active',suspended_at=null,
   next_due_at=greatest(next_due_at,now()+interval'1 day'),
   grace_period_ends_at=greatest(grace_period_ends_at,now()+make_interval(days=>grace_period_days+1)),updated_at=now()
  where id=subscription.id;
 end if;
end$$;
revoke all on function public.platform_reactivate_subscription(uuid)from public,anon;
grant execute on function public.platform_reactivate_subscription(uuid)to authenticated;
notify pgrst,'reload schema';

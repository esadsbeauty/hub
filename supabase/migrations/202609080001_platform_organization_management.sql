-- Platform-only organization inventory and guarded removal of disposable tenants.
-- db-audit: reviewed-destructive platform-admin-test-demo-only
alter table public.organizations add column if not exists organization_type text not null default 'production'
  check(organization_type in('production','test','demo'));
create index if not exists organizations_type_created_idx on public.organizations(organization_type,created_at desc);

create or replace function public.platform_organizations_page(filters jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare page_size integer:=least(greatest(coalesce((filters->>'pageSize')::integer,20),1),50);page_number integer:=greatest(coalesce((filters->>'page')::integer,1),1);result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'platform_admin_required' using errcode='42501';end if;
 with inventory as(
  select o.id,o.name,o.slug,o.organization_type,o.created_at,o.updated_at,p.name plan_name,p.id plan_id,
   coalesce(s.status,'active') subscription_status,case when s.status in('suspended','cancelled')then'suspended'else'active'end operational_status,
   owner_profile.name owner_name,owner_profile.email owner_email,count(distinct m.id)::integer member_count
  from public.organizations o
  left join public.organization_plans op on op.organization_id=o.id and op.status='active'and op.ends_at is null
  left join public.plans p on p.id=op.plan_id
  left join lateral(select x.*from public.organization_subscriptions x where x.organization_id=o.id order by(x.status<>'cancelled')desc,x.created_at desc limit 1)s on true
  left join public.organization_members m on m.organization_id=o.id
  left join lateral(select pr.name,pr.email from public.organization_members om join public.roles r on r.id=om.role_id join public.profiles pr on pr.id=om.user_id where om.organization_id=o.id and r.slug='owner' order by(om.status='active')desc,om.created_at limit 1)owner_profile on true
  group by o.id,p.id,p.name,s.status,owner_profile.name,owner_profile.email
 ),filtered as(select *from inventory where
  (coalesce(filters->>'query','')=''or concat_ws(' ',name,slug,owner_email)ilike'%'||trim(filters->>'query')||'%')and
  (coalesce(filters->>'type','')=''or organization_type=filters->>'type')and
  (coalesce(filters->>'status','')=''or operational_status=filters->>'status')and
  (coalesce(filters->>'planId','')=''or plan_id::text=filters->>'planId')and
  (coalesce(filters->>'subscriptionStatus','')=''or subscription_status=filters->>'subscriptionStatus')and
  (coalesce(filters->>'created','')=''or created_at>=now()-case filters->>'created'when'30'then interval'30 days'when'90'then interval'90 days'else interval'100 years'end)
 ),ordered as(select*from filtered order by case when filters->>'sort'='oldest'then created_at end,case when filters->>'sort'='name'then name end,case when filters->>'sort'='updated'then updated_at end desc,case when coalesce(filters->>'sort','newest')='newest'then created_at end desc,id limit page_size offset(page_number-1)*page_size)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x))from ordered x),'[]'::jsonb),'total',(select count(*)from filtered),'page',page_number,'pageSize',page_size,
  'metrics',jsonb_build_object('total',(select count(*)from inventory),'production',(select count(*)from inventory where organization_type='production'),'test',(select count(*)from inventory where organization_type='test'),'demo',(select count(*)from inventory where organization_type='demo'),'active',(select count(*)from inventory where operational_status='active'),'suspended',(select count(*)from inventory where operational_status='suspended'),'last30Days',(select count(*)from inventory where created_at>=now()-interval'30 days')),
  'plans',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name)order by name)from public.plans),'[]'::jsonb))into result;
 return result;
end$$;

create or replace function public.platform_organization_details(target_organization_id uuid)returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'platform_admin_required' using errcode='42501';end if;
 select jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug,'organizationType',o.organization_type,'timezone',o.timezone,'locale',o.locale,'currency',o.currency,'createdAt',o.created_at,'updatedAt',o.updated_at,
  'owner',(select jsonb_build_object('id',m.user_id,'name',p.name,'email',p.email,'membershipStatus',m.status)from public.organization_members m join public.roles r on r.id=m.role_id join public.profiles p on p.id=m.user_id where m.organization_id=o.id and r.slug='owner'order by(m.status='active')desc,m.created_at limit 1),
  'plan',(select jsonb_build_object('id',p.id,'name',p.name,'priceCents',p.price_cents,'entitlements',(select coalesce(jsonb_agg(pe.module order by pe.module),'[]')from public.plan_entitlements pe where pe.plan_id=p.id and pe.enabled))from public.organization_plans op join public.plans p on p.id=op.plan_id where op.organization_id=o.id and op.status='active'and op.ends_at is null order by op.starts_at desc limit 1),
  'subscription',(select jsonb_build_object('id',s.id,'status',s.status,'nextDueAt',s.next_due_at,'startedAt',s.started_at,'suspendedAt',s.suspended_at,'cancelledAt',s.cancelled_at)from public.organization_subscriptions s where s.organization_id=o.id order by(s.status<>'cancelled')desc,s.created_at desc limit 1),
  'users',jsonb_build_object('total',(select count(*)from public.organization_members where organization_id=o.id),'owners',(select count(*)from public.organization_members m join public.roles r on r.id=m.role_id where m.organization_id=o.id and r.slug='owner'),'admins',(select count(*)from public.organization_members m join public.roles r on r.id=m.role_id where m.organization_id=o.id and r.slug='admin'),'others',(select count(*)from public.organization_members m join public.roles r on r.id=m.role_id where m.organization_id=o.id and r.slug not in('owner','admin'))),
  'impact',jsonb_build_object('members',(select count(*)from public.organization_members where organization_id=o.id),'companies',(select count(*)from public.companies where organization_id=o.id),'contacts',(select count(*)from public.contacts where organization_id=o.id),'opportunities',(select count(*)from public.opportunities where organization_id=o.id),'pipelines',(select count(*)from public.pipelines where organization_id=o.id),'pipelineStages',(select count(*)from public.pipeline_stages ps join public.pipelines p on p.id=ps.pipeline_id where p.organization_id=o.id),'tasks',(select count(*)from public.tasks where organization_id=o.id),'calendarEvents',(select count(*)from public.tasks where organization_id=o.id and type='meeting'),'activities',(select count(*)from public.activities where organization_id=o.id),'customers',(select count(*)from public.customer_accounts where organization_id=o.id))
 )into result from public.organizations o where o.id=target_organization_id;
 if result is null then raise exception 'organization_not_found'using errcode='P0002';end if;return result;
end$$;

create or replace function public.platform_update_organization(target_organization_id uuid,organization_data jsonb)returns jsonb
language plpgsql security definer set search_path=public as $$
declare old_row public.organizations;changed public.organizations;clean_slug text:=lower(trim(organization_data->>'slug'));
begin
 if not public.is_platform_admin() then raise exception 'platform_admin_required'using errcode='42501';end if;
 select*into old_row from public.organizations where id=target_organization_id for update;if old_row.id is null then raise exception 'organization_not_found';end if;
 if clean_slug!~'^[a-z0-9]+(?:-[a-z0-9]+)*$'or length(clean_slug)>80 then raise exception 'invalid_organization_slug'using errcode='22023';end if;
 if exists(select 1 from public.organizations where slug=clean_slug and id<>target_organization_id)then raise exception 'organization_slug_already_exists'using errcode='23505';end if;
 update public.organizations set name=trim(organization_data->>'name'),slug=clean_slug,organization_type=organization_data->>'organizationType',timezone=trim(organization_data->>'timezone'),locale=trim(organization_data->>'locale'),currency=upper(trim(organization_data->>'currency')),updated_at=now()where id=target_organization_id returning*into changed;
 if changed.name=''or changed.organization_type not in('production','test','demo')or changed.timezone=''or changed.locale=''or changed.currency!~'^[A-Z]{3}$'then raise exception 'invalid_organization_data'using errcode='22023';end if;
 insert into public.audit_logs(organization_id,user_id,action,entity_type,entity_id,module,old_values,new_values)values(target_organization_id,auth.uid(),'platform_organization_updated','organization',target_organization_id,'platform',to_jsonb(old_row),to_jsonb(changed));return to_jsonb(changed);
end$$;

create or replace function public.platform_delete_test_organization(target_organization_id uuid,confirmation_name text)returns void
language plpgsql security definer set search_path=public as $$
declare target public.organizations;platform_org uuid;platform_admin_member_count integer;
begin
 if not public.is_platform_admin()then raise exception 'platform_admin_required'using errcode='42501';end if;
 select*into target from public.organizations where id=target_organization_id for update;if target.id is null then raise exception 'organization_not_found';end if;
 if target.slug='esads-beauty'then raise exception 'platform_organization_protected'using errcode='42501';end if;
 if target.organization_type not in('test','demo')then raise exception 'production_organization_cannot_be_deleted'using errcode='42501';end if;
 if confirmation_name is distinct from target.name then raise exception 'organization_name_confirmation_mismatch'using errcode='22023';end if;
 select count(*)into platform_admin_member_count from public.organization_members m join public.platform_admins a on a.user_id=m.user_id where m.organization_id=target.id;if platform_admin_member_count>0 then raise exception 'platform_admin_membership_protected'using errcode='42501';end if;
 select id into platform_org from public.organizations where slug='esads-beauty';if platform_org is null then raise exception 'platform_organization_not_found';end if;
 insert into public.audit_logs(organization_id,user_id,action,entity_type,entity_id,module,old_values,new_values,metadata)values(platform_org,null,'platform_test_organization_deleted','organization',target.id,'platform',to_jsonb(target),'{}',jsonb_build_object('deletedBy',auth.uid()));
 delete from public.payment_allocations where organization_id=target.id;delete from public.financial_transactions where organization_id=target.id;delete from public.receivables where organization_id=target.id;delete from public.payables where organization_id=target.id;delete from public.recurrence_rules where organization_id=target.id;delete from public.financial_accounts where organization_id=target.id;delete from public.financial_categories where organization_id=target.id;delete from public.cost_centers where organization_id=target.id;
 delete from public.contract_services where organization_id=target.id;delete from public.onboarding_steps where organization_id=target.id;delete from public.contracts where organization_id=target.id;delete from public.onboardings where organization_id=target.id;delete from public.customer_services where organization_id=target.id;delete from public.services where organization_id=target.id;delete from public.customer_accounts where organization_id=target.id;
 delete from public.lead_acquisitions where organization_id=target.id;delete from public.marketing_spend where organization_id=target.id;delete from public.marketing_ads where organization_id=target.id;delete from public.marketing_ad_groups where organization_id=target.id;delete from public.marketing_campaigns where organization_id=target.id;delete from public.marketing_connections where organization_id=target.id;delete from public.marketing_sources where organization_id=target.id;
 delete from public.diagnostic_answers where submission_id in(select id from public.diagnostic_submissions where organization_id=target.id);delete from public.diagnostic_submissions where organization_id=target.id;delete from public.blog_posts where organization_id=target.id;delete from public.blog_categories where organization_id=target.id;
 delete from public.opportunity_stage_history where organization_id=target.id;delete from public.notes where organization_id=target.id;delete from public.tasks where organization_id=target.id;delete from public.activities where organization_id=target.id;delete from public.opportunities where organization_id=target.id;delete from public.contacts where organization_id=target.id;delete from public.companies where organization_id=target.id;delete from public.pipelines where organization_id=target.id;
 delete from public.public_sales_leads where organization_id=target.id;delete from public.organization_onboarding where organization_id=target.id;delete from public.payment_provider_events where external_payment_id in(select external_payment_id from public.billing_charges where organization_id=target.id and external_payment_id is not null);delete from public.billing_charges where organization_id=target.id;delete from public.subscription_payments where organization_id=target.id;delete from public.organization_subscriptions where organization_id=target.id;delete from public.organization_plans where organization_id=target.id;delete from public.audit_logs where organization_id=target.id;delete from public.organization_members where organization_id=target.id;delete from public.roles where organization_id=target.id;
 update public.profiles p set organization_id=(select m.organization_id from public.organization_members m where m.user_id=p.id and m.organization_id<>target.id order by(m.status='active')desc,m.created_at limit 1)where p.organization_id=target.id and exists(select 1 from public.organization_members m where m.user_id=p.id and m.organization_id<>target.id);
 delete from public.profiles where organization_id=target.id;delete from public.organizations where id=target.id;
end$$;

revoke all on function public.platform_organizations_page(jsonb),public.platform_organization_details(uuid),public.platform_update_organization(uuid,jsonb),public.platform_delete_test_organization(uuid,text)from public,anon;
grant execute on function public.platform_organizations_page(jsonb),public.platform_organization_details(uuid),public.platform_update_organization(uuid,jsonb),public.platform_delete_test_organization(uuid,text)to authenticated;

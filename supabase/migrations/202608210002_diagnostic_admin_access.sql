-- Authenticated, tenant-scoped read model for the Marketing diagnostic inbox.
create or replace function public.list_diagnostic_submissions(page_limit integer default 100, page_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_profile public.profiles;
begin
  select * into current_profile from public.profiles where id = auth.uid();
  if current_profile.id is null or not public.has_permission('marketing.view') then
    raise exception 'insufficient_permission' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'businessName', s.business_name,
      'whatsapp', s.whatsapp, 'email', s.email, 'instagram', s.instagram,
      'totalScore', s.total_score, 'resultLevel', s.result_level,
      'businessStage', s.business_stage, 'primaryNeed', s.primary_need,
      'primaryBottleneck', s.primary_bottleneck, 'utmSource', s.utm_source,
      'utmCampaign', s.utm_campaign, 'companyId', s.company_id,
      'opportunityId', s.opportunity_id, 'completedAt', s.completed_at
    ) order by s.completed_at desc)
    from (select * from public.diagnostic_submissions
      where organization_id = current_profile.organization_id
      order by completed_at desc limit least(greatest(page_limit, 1), 200)
      offset greatest(page_offset, 0)) s
  ), '[]'::jsonb);
end
$$;
revoke all on function public.list_diagnostic_submissions(integer, integer) from public, anon;
grant execute on function public.list_diagnostic_submissions(integer, integer) to authenticated;

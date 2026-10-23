
-- Trigger functions must not be callable as public RPC endpoints.
revoke all on function public.register_note_activity() from public, anon, authenticated;
revoke all on function public.register_post_sales_activity() from public, anon, authenticated;
revoke all on function public.register_task_activity() from public, anon, authenticated;
revoke all on function public.seed_b2c_beauty_services_after_mode_change() from public, anon, authenticated;
revoke all on function public.sync_company_lifecycle_from_opportunity() from public, anon, authenticated;
revoke all on function public.touch_company_last_interaction() from public, anon, authenticated;
revoke all on function public.track_opportunity_stage_change() from public, anon, authenticated;

grant execute on function public.register_note_activity() to service_role;
grant execute on function public.register_post_sales_activity() to service_role;
grant execute on function public.register_task_activity() to service_role;
grant execute on function public.seed_b2c_beauty_services_after_mode_change() to service_role;
grant execute on function public.sync_company_lifecycle_from_opportunity() to service_role;
grant execute on function public.touch_company_last_interaction() to service_role;
grant execute on function public.track_opportunity_stage_change() to service_role;

alter function public.prospecting_phone_match_key(text)
set search_path = public;

revoke all on function public.upsert_whatsapp_inbound_lead(uuid, text, text) from public;
revoke all on function public.upsert_whatsapp_inbound_lead(uuid, text, text) from anon;
revoke all on function public.upsert_whatsapp_inbound_lead(uuid, text, text) from authenticated;
grant execute on function public.upsert_whatsapp_inbound_lead(uuid, text, text) to service_role;

revoke all on function public.convert_prospecting_reply_to_crm(uuid, uuid, text) from public;
revoke all on function public.convert_prospecting_reply_to_crm(uuid, uuid, text) from anon;
revoke all on function public.convert_prospecting_reply_to_crm(uuid, uuid, text) from authenticated;
grant execute on function public.convert_prospecting_reply_to_crm(uuid, uuid, text) to service_role;

revoke all on function public.auto_link_whatsapp_conversation_to_crm() from public;
revoke all on function public.auto_link_whatsapp_conversation_to_crm() from anon;
revoke all on function public.auto_link_whatsapp_conversation_to_crm() from authenticated;
grant execute on function public.auto_link_whatsapp_conversation_to_crm() to service_role;

revoke all on function public.whatsapp_inbox_snapshot(uuid) from public;
revoke all on function public.whatsapp_inbox_snapshot(uuid) from anon;
grant execute on function public.whatsapp_inbox_snapshot(uuid) to authenticated, service_role;

revoke all on function public.whatsapp_inbox_snapshot(uuid, integer, integer) from public;
revoke all on function public.whatsapp_inbox_snapshot(uuid, integer, integer) from anon;
grant execute on function public.whatsapp_inbox_snapshot(uuid, integer, integer) to authenticated, service_role;

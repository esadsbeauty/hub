drop policy if exists whatsapp_connections_manage
on public.whatsapp_connections;

create policy whatsapp_connections_manage
on public.whatsapp_connections
for all
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members om
    join public.roles r
      on r.id = om.role_id
    where om.organization_id = whatsapp_connections.organization_id
      and om.user_id = auth.uid()
      and r.slug in ('owner', 'admin')
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members om
    join public.roles r
      on r.id = om.role_id
    where om.organization_id = whatsapp_connections.organization_id
      and om.user_id = auth.uid()
      and r.slug in ('owner', 'admin')
  )
);
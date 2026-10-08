-- =========================================================
-- SECURITY: endurecimento de RLS do CRM, vendas e WhatsApp
-- =========================================================

-- ---------------------------------------------------------
-- COMPANIES
-- ---------------------------------------------------------

drop policy if exists companies_member on public.companies;

create policy companies_read
on public.companies
for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.view')
);

create policy companies_insert
on public.companies
for insert
to authenticated
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
);

create policy companies_update
on public.companies
for update
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
)
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
);

create policy companies_delete
on public.companies
for delete
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
);


-- ---------------------------------------------------------
-- CONTACTS
-- ---------------------------------------------------------

drop policy if exists contacts_member on public.contacts;

create policy contacts_read
on public.contacts
for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.view')
);

create policy contacts_insert
on public.contacts
for insert
to authenticated
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
);

create policy contacts_update
on public.contacts
for update
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
)
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
);

create policy contacts_delete
on public.contacts
for delete
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
);


-- ---------------------------------------------------------
-- OPPORTUNITIES
-- ---------------------------------------------------------

drop policy if exists opportunities_member on public.opportunities;

create policy opportunities_read
on public.opportunities
for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.view')
);

create policy opportunities_insert
on public.opportunities
for insert
to authenticated
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
);

create policy opportunities_update
on public.opportunities
for update
to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.has_permission('crm.manage')
    or public.has_permission('crm.opportunity.move')
    or public.has_permission('crm.opportunity.close')
  )
)
with check (
  organization_id = public.current_organization_id()
  and (
    public.has_permission('crm.manage')
    or public.has_permission('crm.opportunity.move')
    or public.has_permission('crm.opportunity.close')
  )
);

create policy opportunities_delete
on public.opportunities
for delete
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
);


-- ---------------------------------------------------------
-- CRM SALES
-- ---------------------------------------------------------

drop policy if exists crm_sales_tenant on public.crm_sales;

create policy crm_sales_read
on public.crm_sales
for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.has_permission('crm.view')
    or public.has_permission('finance.view')
  )
);

create policy crm_sales_insert
on public.crm_sales
for insert
to authenticated
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.opportunity.close')
);

create policy crm_sales_update
on public.crm_sales
for update
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.opportunity.close')
)
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.opportunity.close')
);

create policy crm_sales_delete
on public.crm_sales
for delete
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
);


-- ---------------------------------------------------------
-- CRM SALE ITEMS
-- ---------------------------------------------------------

drop policy if exists crm_sale_items_tenant on public.crm_sale_items;

create policy crm_sale_items_read
on public.crm_sale_items
for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.has_permission('crm.view')
    or public.has_permission('finance.view')
  )
);

create policy crm_sale_items_insert
on public.crm_sale_items
for insert
to authenticated
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.opportunity.close')
);

create policy crm_sale_items_update
on public.crm_sale_items
for update
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.opportunity.close')
)
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.opportunity.close')
);

create policy crm_sale_items_delete
on public.crm_sale_items
for delete
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
);


-- ---------------------------------------------------------
-- WHATSAPP CONNECTIONS
-- ---------------------------------------------------------

drop policy if exists whatsapp_connections_manage
on public.whatsapp_connections;

drop policy if exists whatsapp_connections_select
on public.whatsapp_connections;

create policy whatsapp_connections_read
on public.whatsapp_connections
for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.view')
);

create policy whatsapp_connections_manage
on public.whatsapp_connections
for all
to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.is_platform_admin()
    or exists (
      select 1
      from public.organization_members om
      join public.roles r on r.id = om.role_id
      where om.organization_id = whatsapp_connections.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and r.slug in ('owner', 'admin')
    )
  )
)
with check (
  organization_id = public.current_organization_id()
  and (
    public.is_platform_admin()
    or exists (
      select 1
      from public.organization_members om
      join public.roles r on r.id = om.role_id
      where om.organization_id = whatsapp_connections.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and r.slug in ('owner', 'admin')
    )
  )
);


-- ---------------------------------------------------------
-- WHATSAPP CONVERSATIONS
-- ---------------------------------------------------------

drop policy if exists whatsapp_conversations_manage
on public.whatsapp_conversations;

drop policy if exists whatsapp_conversations_select
on public.whatsapp_conversations;

create policy whatsapp_conversations_read
on public.whatsapp_conversations
for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.view')
);

create policy whatsapp_conversations_manage
on public.whatsapp_conversations
for all
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
)
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
);


-- ---------------------------------------------------------
-- WHATSAPP MESSAGES
-- ---------------------------------------------------------

drop policy if exists whatsapp_messages_manage
on public.whatsapp_messages;

drop policy if exists whatsapp_messages_select
on public.whatsapp_messages;

create policy whatsapp_messages_read
on public.whatsapp_messages
for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.view')
);

create policy whatsapp_messages_manage
on public.whatsapp_messages
for all
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
)
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('crm.manage')
);

notify pgrst, 'reload schema';
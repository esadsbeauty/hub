-- =========================================================
-- SECURITY: remover execução anônima de funções internas
-- =========================================================

-- CRM / Agenda / Financeiro: somente usuários autenticados
revoke execute on function public.activate_customer_from_won_opportunity(uuid)
from public, anon;

grant execute on function public.activate_customer_from_won_opportunity(uuid)
to authenticated, service_role;


revoke execute on function public.cancel_task(uuid)
from public, anon;

grant execute on function public.cancel_task(uuid)
to authenticated, service_role;


revoke execute on function public.close_opportunity_with_sale(
  uuid,
  uuid,
  numeric,
  timestamptz,
  text,
  text
)
from public, anon;

grant execute on function public.close_opportunity_with_sale(
  uuid,
  uuid,
  numeric,
  timestamptz,
  text,
  text
)
to authenticated, service_role;


revoke execute on function public.complete_task(uuid)
from public, anon;

grant execute on function public.complete_task(uuid)
to authenticated, service_role;


revoke execute on function public.complete_onboarding_step(uuid)
from public, anon;

grant execute on function public.complete_onboarding_step(uuid)
to authenticated, service_role;


revoke execute on function public.generate_recurring_entries(uuid, date)
from public, anon;

grant execute on function public.generate_recurring_entries(uuid, date)
to authenticated, service_role;


-- Administração da plataforma nunca precisa estar disponível para anon
revoke execute on function public.platform_public_sales_leads_page(jsonb)
from anon;

revoke execute on function public.platform_update_public_sales_lead(uuid, text, text)
from anon;


-- Helpers internos de tenant/financeiro
revoke execute on function public.assert_financial_reversal_permission()
from public, anon;

revoke execute on function public.assert_payable_tenant_links()
from public, anon;

revoke execute on function public.assert_receivable_tenant_links()
from public, anon;

revoke execute on function public.assert_recurrence_rule_tenant_links()
from public, anon;


notify pgrst, 'reload schema';
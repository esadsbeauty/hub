-- Financeiro 1.0 is a core module of ESADS BEAUTY CRM.
-- Make the finance module available to every current and future plan.
-- User access remains controlled independently by RBAC permissions.

insert into public.plan_entitlements (
  plan_id,
  module,
  enabled
)
select
  p.id,
  'finance',
  true
from public.plans p
on conflict (plan_id, module)
do update
set enabled = true;

notify pgrst, 'reload schema';
-- Keep the Fundadores plan limited to its intended launch modules.
-- The previous platform-plan migration granted the full Legacy module set to
-- both Legacy and Fundadores. Preserve Legacy as-is and explicitly disable
-- modules that are not part of Fundadores.
insert into public.plan_entitlements(plan_id,module,enabled)
select p.id,m,false
from public.plans p
cross join unnest(array['finance','marketing','reports','audit','blog']) as m
where p.slug='fundadores'
on conflict(plan_id,module) do update set enabled=false;

notify pgrst,'reload schema';

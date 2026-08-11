-- Evolui oportunidades sem alterar ou remover registros existentes.
alter table public.opportunities
  add column if not exists lost_reason_notes text;

alter table public.opportunities
  drop constraint if exists opportunities_lost_reason_check;
alter table public.opportunities
  add constraint opportunities_lost_reason_check check (
    lost_reason is null or lost_reason in (
      'price', 'no_response', 'no_interest', 'competitor',
      'timing', 'no_budget', 'unqualified', 'other'
    )
  ) not valid;

create table if not exists public.opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  opportunity_id uuid not null references public.opportunities(id),
  from_stage_id uuid references public.pipeline_stages(id),
  to_stage_id uuid not null references public.pipeline_stages(id),
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists opportunity_stage_history_opportunity_idx
  on public.opportunity_stage_history(opportunity_id, changed_at desc);
create index if not exists opportunity_stage_history_org_changed_idx
  on public.opportunity_stage_history(organization_id, changed_at desc);

insert into public.opportunity_stage_history(
  organization_id, opportunity_id, from_stage_id, to_stage_id, changed_by, changed_at
)
select organization_id, id, null, stage_id, created_by, coalesce(stage_entered_at, created_at)
from public.opportunities;

alter table public.opportunity_stage_history enable row level security;
drop policy if exists opportunity_stage_history_member on public.opportunity_stage_history;
create policy opportunity_stage_history_member
  on public.opportunity_stage_history for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create or replace function public.track_opportunity_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_stage_name text;
  new_stage_name text;
  actor_id uuid;
begin
  if new.stage_id is distinct from old.stage_id then
    select name into old_stage_name from public.pipeline_stages where id = old.stage_id;
    select name into new_stage_name
      from public.pipeline_stages
      where id = new.stage_id and pipeline_id = new.pipeline_id;

    if new_stage_name is null then
      raise exception 'A etapa não pertence ao pipeline da oportunidade';
    end if;

    actor_id := coalesce(auth.uid(), new.created_by);
    new.stage_entered_at := now();

    insert into public.opportunity_stage_history(
      organization_id, opportunity_id, from_stage_id, to_stage_id, changed_by
    ) values (
      new.organization_id, new.id, old.stage_id, new.stage_id, actor_id
    );

    insert into public.activities(
      organization_id, company_id, opportunity_id, user_id,
      type, title, description, metadata
    ) values (
      new.organization_id, new.company_id, new.id, actor_id,
      case when new.status = 'won' then 'deal_won'
           when new.status = 'lost' then 'deal_lost'
           else 'stage_changed' end,
      case when new.status = 'won' then 'Negócio ganho'
           when new.status = 'lost' then 'Negócio perdido'
           else 'Etapa atualizada' end,
      old_stage_name || ' → ' || new_stage_name,
      jsonb_build_object(
        'from_stage_id', old.stage_id,
        'from_stage', old_stage_name,
        'to_stage_id', new.stage_id,
        'to_stage', new_stage_name
      )
    );
  end if;
  return new;
end
$$;

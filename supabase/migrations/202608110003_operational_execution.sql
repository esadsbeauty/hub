-- Unifica agenda, follow-ups, reuniões e tarefas sem remover registros existentes.
create type public.task_priority as enum ('low','medium','high','urgent');
create type public.meeting_location_type as enum ('online','in_person','phone','other');

alter table public.tasks
  alter column priority drop default;
alter table public.tasks
  alter column priority type public.task_priority
  using case priority::text
    when 'baixa' then 'low'::public.task_priority
    when 'media' then 'medium'::public.task_priority
    when 'alta' then 'high'::public.task_priority
    else 'medium'::public.task_priority
  end;
alter table public.tasks
  alter column priority set default 'medium';

-- A coluna já era TIMESTAMPTZ; o novo nome elimina ambiguidade de data/hora.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'due_date'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'due_at'
  ) then
    alter table public.tasks rename column due_date to due_at;
  end if;
end
$$;

alter table public.tasks
  add column if not exists cancelled_at timestamptz,
  add column if not exists duration_minutes integer check (duration_minutes is null or duration_minutes between 5 and 1440),
  add column if not exists location_type public.meeting_location_type,
  add column if not exists location text,
  add column if not exists meeting_url text;

alter table public.organizations
  add column if not exists timezone text not null default 'America/Sao_Paulo';

create index if not exists tasks_assignee_due_idx
  on public.tasks(organization_id, assigned_to, due_at)
  where status = 'pending' and deleted_at is null;
create index if not exists tasks_range_idx
  on public.tasks(organization_id, due_at, type, status)
  where deleted_at is null;
create index if not exists tasks_opportunity_due_idx
  on public.tasks(opportunity_id, due_at)
  where status = 'pending' and deleted_at is null;

create or replace function public.register_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_type text;
  activity_title text;
  activity_metadata jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    activity_type := case
      when new.type = 'follow_up' then 'followup_created'
      when new.type = 'meeting' then 'meeting_scheduled'
      else 'task_created'
    end;
    activity_title := case
      when new.type = 'follow_up' then 'Follow-up criado'
      when new.type = 'meeting' then 'Reunião agendada'
      else 'Tarefa criada'
    end;
  elsif new.status = 'completed' and old.status is distinct from 'completed' then
    activity_type := case
      when new.type = 'follow_up' then 'followup_completed'
      when new.type = 'meeting' then 'meeting_completed'
      when new.type = 'call' then 'call_completed'
      when new.type = 'whatsapp' then 'whatsapp_sent'
      when new.type = 'email' then 'email_sent'
      else 'task_completed'
    end;
    activity_title := case
      when new.type = 'follow_up' then 'Follow-up concluído'
      when new.type = 'meeting' then 'Reunião concluída'
      when new.type = 'call' then 'Ligação concluída'
      when new.type = 'whatsapp' then 'WhatsApp registrado'
      when new.type = 'email' then 'Email registrado'
      else 'Tarefa concluída'
    end;
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    activity_type := case when new.type = 'meeting' then 'meeting_cancelled' else 'task_cancelled' end;
    activity_title := case when new.type = 'meeting' then 'Reunião cancelada' else 'Tarefa cancelada' end;
  elsif new.due_at is distinct from old.due_at then
    activity_type := 'task_rescheduled';
    activity_title := 'Tarefa reagendada';
    activity_metadata := jsonb_build_object(
      'old_due_at', old.due_at,
      'new_due_at', new.due_at
    );
  else
    return new;
  end if;

  insert into public.activities(
    organization_id, company_id, opportunity_id, user_id,
    type, title, description, metadata
  ) values (
    new.organization_id, new.company_id, new.opportunity_id,
    coalesce(auth.uid(), new.created_by), activity_type,
    activity_title, new.title, activity_metadata
  );
  return new;
end
$$;

-- O trigger anterior observava apenas status; due_at também precisa de auditoria.
drop trigger if exists tasks_complete_activity on public.tasks;
create trigger tasks_complete_activity
  after update of status, due_at on public.tasks
  for each row execute function public.register_task_activity();

create or replace function public.complete_task(target_task_id uuid)
returns public.tasks
language plpgsql
security invoker
set search_path = public
as $$
declare updated_task public.tasks;
begin
  update public.tasks
  set status = 'completed', completed_at = now(), cancelled_at = null
  where id = target_task_id and status = 'pending' and deleted_at is null
  returning * into updated_task;
  if updated_task.id is null then raise exception 'Tarefa pendente não encontrada'; end if;
  return updated_task;
end
$$;

create or replace function public.reschedule_task(target_task_id uuid, new_due_at timestamptz)
returns public.tasks
language plpgsql
security invoker
set search_path = public
as $$
declare updated_task public.tasks;
begin
  update public.tasks
  set due_at = new_due_at
  where id = target_task_id and status = 'pending' and deleted_at is null
  returning * into updated_task;
  if updated_task.id is null then raise exception 'Tarefa pendente não encontrada'; end if;
  return updated_task;
end
$$;

create or replace function public.cancel_task(target_task_id uuid)
returns public.tasks
language plpgsql
security invoker
set search_path = public
as $$
declare updated_task public.tasks;
begin
  update public.tasks
  set status = 'cancelled', cancelled_at = now(), completed_at = null
  where id = target_task_id and status = 'pending' and deleted_at is null
  returning * into updated_task;
  if updated_task.id is null then raise exception 'Tarefa pendente não encontrada'; end if;
  return updated_task;
end
$$;

-- Activities são histórico append-only para usuários autenticados.
revoke update, delete on public.activities from authenticated;

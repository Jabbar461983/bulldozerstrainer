-- Aufgaben weiterleiten.
--
-- Der Empfänger einer (noch offenen) Aufgabe darf sie an eine andere Person
-- weiterleiten. Die Zeile wird dabei der neuen Person zugewiesen
-- (assigned_to), jede Weiterleitung wird in task_forwards protokolliert,
-- damit in der Aufgabe "von XY weitergeleitet an YZ" angezeigt werden kann.
--
-- Weil tasks_guard() Empfängern das Ändern von assigned_to verbietet, läuft
-- die Weiterleitung ausschliesslich über die Funktion forward_task(), die
-- dafür ein transaktionslokales Flag setzt.

create table task_forwards (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  from_user uuid references profiles (id) on delete set null,
  to_user uuid references profiles (id) on delete set null,
  forwarded_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_task_forwards_task on task_forwards (task_id, created_at);

alter table task_forwards enable row level security;

-- Sichtbar für alle, die die Aufgabe selbst sehen dürfen (Subquery
-- unterliegt der tasks_select-Policy).
create policy task_forwards_select on task_forwards for select
  using (exists (select 1 from tasks t where t.id = task_forwards.task_id));

-- Kein insert/update/delete-Policy: Einträge entstehen nur über forward_task().

create or replace function tasks_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_admin() or auth.uid() = old.created_by) then
    if coalesce(current_setting('app.task_forwarding', true), '') = 'on'
      and new.assigned_to <> old.assigned_to
    then
      -- Weiterleitung via forward_task(): nur assigned_to darf sich ändern.
      null;
    elsif new.assigned_to <> old.assigned_to then
      raise exception 'Nur Ersteller oder Admin dürfen diese Angaben ändern.';
    end if;
    if new.title <> old.title
      or coalesce(new.description, '') <> coalesce(old.description, '')
      or new.due_date <> old.due_date
      or coalesce(new.attachment_path, '') <> coalesce(old.attachment_path, '')
      or new.is_team_task <> old.is_team_task
      or new.task_group_id <> old.task_group_id
      or new.created_by is distinct from old.created_by
    then
      raise exception 'Nur Ersteller oder Admin dürfen diese Angaben ändern.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function forward_task(p_task_id uuid, p_to_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task tasks%rowtype;
begin
  select * into v_task from tasks where id = p_task_id;
  if not found then
    raise exception 'Aufgabe nicht gefunden.';
  end if;
  if not (is_admin() or auth.uid() = v_task.assigned_to or auth.uid() = v_task.created_by) then
    raise exception 'Nur der Empfänger, der Ersteller oder ein Admin darf diese Aufgabe weiterleiten.';
  end if;
  if v_task.completed then
    raise exception 'Erledigte Aufgaben können nicht weitergeleitet werden.';
  end if;
  if p_to_user is null or p_to_user = v_task.assigned_to then
    raise exception 'Bitte eine andere Person auswählen.';
  end if;
  if not exists (select 1 from profiles where id = p_to_user) then
    raise exception 'Empfänger nicht gefunden.';
  end if;
  if exists (
    select 1 from tasks
    where task_group_id = v_task.task_group_id and assigned_to = p_to_user
  ) then
    raise exception 'Diese Person hat diese Aufgabe bereits.';
  end if;

  perform set_config('app.task_forwarding', 'on', true);
  update tasks set assigned_to = p_to_user where id = p_task_id;
  perform set_config('app.task_forwarding', 'off', true);

  insert into task_forwards (task_id, from_user, to_user, forwarded_by)
  values (p_task_id, v_task.assigned_to, p_to_user, auth.uid());
end;
$$;

grant execute on function forward_task(uuid, uuid) to authenticated;

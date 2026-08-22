-- Modul Aufgaben.
--
-- Ein "Aufgaben"-Formular kann an mehrere Empfänger gleichzeitig gerichtet
-- werden (z.B. "Alle Coaches"); dafür wird pro Empfänger eine eigene Zeile
-- angelegt, alle mit derselben task_group_id verknüpft. Bei "Teamaufgabe"
-- zählt die Erledigung einer Person für die ganze Gruppe (Trigger unten).
--
-- Rechte:
--   - Jeder eingeloggte Nutzer darf Aufgaben erstellen (created_by = er selbst).
--   - Sichtbar sind eigene (zugewiesene oder erstellte) Aufgaben, Admin sieht alle.
--   - Inhaltliche Felder (Titel/Beschrieb/Fälligkeitsdatum/Anhang/Teamaufgabe)
--     dürfen nur Ersteller und Admin ändern - für Empfänger ist die Aufgabe
--     fix, sie dürfen nur completed/completed_at/remark setzen (per Trigger
--     durchgesetzt, analog zu profiles_guard()).
--   - Löschen dürfen nur Ersteller und Admin.

create table tasks (
  id uuid primary key default gen_random_uuid(),
  task_group_id uuid not null default gen_random_uuid(),
  title text not null,
  description text,
  due_date date not null,
  attachment_path text,
  is_team_task boolean not null default false,
  created_by uuid not null references profiles (id) on delete cascade,
  assigned_to uuid not null references profiles (id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  remark text,
  created_at timestamptz not null default now()
);

create index idx_tasks_assigned_to on tasks (assigned_to, completed, due_date);
create index idx_tasks_created_by on tasks (created_by);
create index idx_tasks_group on tasks (task_group_id);

alter table tasks enable row level security;

create policy tasks_select on tasks for select
  using (is_admin() or assigned_to = auth.uid() or created_by = auth.uid());

create policy tasks_insert on tasks for insert
  with check (auth.uid() is not null and created_by = auth.uid());

create policy tasks_update on tasks for update
  using (is_admin() or assigned_to = auth.uid() or created_by = auth.uid())
  with check (is_admin() or assigned_to = auth.uid() or created_by = auth.uid());

create policy tasks_delete on tasks for delete
  using (is_admin() or created_by = auth.uid());

-- Verhindert, dass Empfänger (nicht Ersteller/Admin) Titel, Beschrieb,
-- Fälligkeitsdatum, Anhang, Teamaufgabe-Flag oder die Zuordnung ändern.
create or replace function tasks_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_admin() or auth.uid() = old.created_by) then
    if new.title <> old.title
      or coalesce(new.description, '') <> coalesce(old.description, '')
      or new.due_date <> old.due_date
      or coalesce(new.attachment_path, '') <> coalesce(old.attachment_path, '')
      or new.is_team_task <> old.is_team_task
      or new.task_group_id <> old.task_group_id
      or new.created_by <> old.created_by
      or new.assigned_to <> old.assigned_to
    then
      raise exception 'Nur Ersteller oder Admin dürfen diese Angaben ändern.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_tasks_guard
  before update on tasks
  for each row execute function tasks_guard();

-- Teamaufgabe: sobald eine Person ihre Zeile als erledigt markiert, gilt die
-- Aufgabe für alle Empfänger derselben task_group_id als erledigt.
create or replace function tasks_propagate_team_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_team_task and new.completed and not old.completed then
    update tasks
    set completed = true, completed_at = coalesce(new.completed_at, now())
    where task_group_id = new.task_group_id
      and id <> new.id
      and completed = false;
  end if;
  return new;
end;
$$;

create trigger trg_tasks_propagate_completion
  after update on tasks
  for each row execute function tasks_propagate_team_completion();

-- ---------------- Empfänger-Auflösung ----------------
-- "Alle Benutzer sollen Aufgaben anlegen können" erfordert, dass jeder
-- Nutzer beim Erfassen einer Aufgabe alle Teams bzw. alle Nutzer als
-- möglichen Empfänger sehen kann - unabhängig von den sonst strikteren
-- teams_select/profiles_select-Policies. Dafür zwei schlanke, auf die
-- nötigen Felder beschränkte Funktionen (kein E-Mail/Telefon).

create or replace function task_all_teams()
returns table (team_id uuid, team_name text, category_name text, season text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, c.name, t.season
  from teams t
  join categories c on c.id = t.category_id
  order by t.season desc, c.sort_order, t.name;
$$;

create or replace function task_recipients(p_scope text, p_team_id uuid default null)
returns table (user_id uuid, first_name text, last_name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id, p.first_name, p.last_name
  from profiles p
  where
    (p_scope = 'all_users')
    or (p_scope = 'all_headcoaches' and exists (
      select 1 from user_team_roles utr where utr.user_id = p.id and utr.role = 'headcoach'
    ))
    or (p_scope = 'all_coaches' and exists (
      select 1 from user_team_roles utr where utr.user_id = p.id and utr.role in ('headcoach', 'assistant_coach')
    ))
    or (p_scope = 'team_coaches' and p_team_id is not null and exists (
      select 1 from user_team_roles utr
      where utr.user_id = p.id and utr.team_id = p_team_id and utr.role in ('headcoach', 'assistant_coach')
    ))
  order by p.last_name, p.first_name;
$$;

-- Auflösung von Ersteller-/Empfängernamen für bereits (per tasks_select)
-- sichtbare Aufgaben - Aufgaben können teamübergreifend zugewiesen werden,
-- daher reicht profiles_select hierfür nicht immer aus.
create or replace function task_profile_names(p_ids uuid[])
returns table (id uuid, first_name text, last_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.first_name, p.last_name from profiles p where p.id = any(p_ids);
$$;

-- Storage für Datei-/Foto-Anhänge (max. 1 pro Aufgabe, wie bei Belegen).
insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

create policy task_attachments_storage_select on storage.objects for select
  using (bucket_id = 'task-attachments' and auth.uid() is not null);
create policy task_attachments_storage_insert on storage.objects for insert
  with check (bucket_id = 'task-attachments' and auth.uid() is not null);
create policy task_attachments_storage_delete on storage.objects for delete
  using (bucket_id = 'task-attachments' and (is_admin() or owner = auth.uid()));

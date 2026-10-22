-- Aufgaben: Kategorie "Sport" oder "Vorstand".
--
-- - Jede Aufgabe ist entweder eine Sport- oder eine Vorstands-Aufgabe.
--   Bestehende Aufgaben werden zu "Sport".
-- - Neuer Empfänger "Vorstand (alle)" = alle mit der Rolle Vorstand.
-- - Löschen nur noch durch den Admin. Ersteller dürfen den Inhalt (inkl.
--   Kategorie) weiterhin ändern, Empfänger nur Bemerkung und Erledigt.
-- Rein additiv bzw. abwärtskompatibel: die bisherige App-Version legt
-- Aufgaben ohne Kategorie an (= Sport) und funktioniert bis zum Update weiter.

alter table tasks add column if not exists category text not null default 'sport'
  check (category in ('sport', 'vorstand'));

-- Löschen nur Admin
drop policy if exists tasks_delete on tasks;
create policy tasks_delete on tasks for delete using (is_admin());

-- Kategorie gehört zum Inhalt: nur Ersteller/Admin dürfen sie ändern.
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
      or new.category <> old.category
    then
      raise exception 'Nur Ersteller oder Admin dürfen diese Angaben ändern.';
    end if;
  end if;
  return new;
end;
$$;

-- Empfänger-Gruppen: zusätzlich "vorstand_all"
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
      select 1 from user_team_roles utr join roles r on r.id = utr.role_id
      where utr.user_id = p.id and r.system_key = 'headcoach'
    ))
    or (p_scope = 'all_coaches' and exists (
      select 1 from user_team_roles utr join roles r on r.id = utr.role_id
      where utr.user_id = p.id and r.system_key in ('headcoach', 'assistant_coach')
    ))
    or (p_scope = 'team_coaches' and p_team_id is not null and exists (
      select 1 from user_team_roles utr join roles r on r.id = utr.role_id
      where utr.user_id = p.id and (utr.team_id = p_team_id or utr.team_id is null)
        and r.system_key in ('headcoach', 'assistant_coach')
    ))
    or (p_scope = 'vorstand_all' and exists (
      select 1 from user_team_roles utr join roles r on r.id = utr.role_id
      where utr.user_id = p.id and r.system_key = 'vorstand'
    ))
  order by p.last_name, p.first_name;
$$;

-- Für die Zuordnung beim Erstellen: hat die Person die Rolle Vorstand
-- und/oder eine andere (sportliche) Rolle?
create or replace function task_person_roles(p_user_id uuid)
returns table (is_vorstand boolean, has_sport_role boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from user_team_roles utr join roles r on r.id = utr.role_id
      where utr.user_id = p_user_id and r.system_key = 'vorstand'
    ),
    exists (
      select 1 from user_team_roles utr join roles r on r.id = utr.role_id
      where utr.user_id = p_user_id and r.system_key is distinct from 'vorstand'
    );
$$;

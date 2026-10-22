-- Vorstand-Ressorts (Unterrollen des Vorstands).
--
-- - Ressorts werden bei der Rolle Vorstand gepflegt (nur Admin).
-- - Jede Vorstands-Zuweisung braucht ein Ressort; eine Person kann mehrere
--   Ressorts haben (je eine Zeile in user_team_roles).
-- - Neuer Aufgaben-Empfänger "vorstand_ressort" = alle Mitglieder eines Ressorts.
-- - task_ressort_members() liefert die Ressort-Zugehörigkeit für die
--   Aufgaben-Übersicht (Vorstand nach Ressort).
-- Bestehende Vorstands-Zuweisungen ohne Ressort bleiben bestehen und
-- erscheinen in der Übersicht unter "Ohne Ressort", bis sie ergänzt werden.

create table vorstand_ressorts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into vorstand_ressorts (name, sort_order) values
  ('Präsidiales', 1),
  ('Aktive', 2),
  ('Junioren', 3),
  ('Finanzen', 4),
  ('Marketing', 5),
  ('Sponsoring', 6),
  ('Infrastruktur', 7),
  ('Planung', 8);

alter table vorstand_ressorts enable row level security;
create policy vorstand_ressorts_select on vorstand_ressorts for select using (auth.uid() is not null);
create policy vorstand_ressorts_write on vorstand_ressorts for all using (is_admin()) with check (is_admin());

alter table user_team_roles
  add column ressort_id uuid references vorstand_ressorts (id) on delete restrict;

alter table user_team_roles drop constraint if exists user_team_roles_user_team_role_id_key;
alter table user_team_roles
  add constraint user_team_roles_user_team_role_ressort_key
  unique nulls not distinct (user_id, team_id, role_id, ressort_id);

-- Vorstand: immer alle Teams und Pflicht-Ressort (für neue/geänderte
-- Zuweisungen); andere Rollen haben nie ein Ressort.
create or replace function user_team_roles_compat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vorstand uuid := (select id from roles where system_key = 'vorstand');
begin
  if new.role_id is null and new.role is not null then
    new.role_id := (select id from roles where system_key = new.role::text);
  end if;
  if new.role_id = v_vorstand then
    if new.team_id is not null then
      raise exception 'Die Rolle Vorstand wird immer für alle Teams vergeben.';
    end if;
    if new.ressort_id is null then
      raise exception 'Bitte für die Rolle Vorstand ein Ressort wählen.';
    end if;
  else
    new.ressort_id := null;
  end if;
  return new;
end;
$$;

-- Empfänger-Gruppen: zusätzlich "vorstand_ressort" (p_ressort_id)
drop function if exists task_recipients(text, uuid);
create or replace function task_recipients(p_scope text, p_team_id uuid default null, p_ressort_id uuid default null)
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
    or (p_scope = 'vorstand_ressort' and p_ressort_id is not null and exists (
      select 1 from user_team_roles utr join roles r on r.id = utr.role_id
      where utr.user_id = p.id and r.system_key = 'vorstand' and utr.ressort_id = p_ressort_id
    ))
  order by p.last_name, p.first_name;
$$;

-- Ressort-Zugehörigkeit der Vorstandsmitglieder (für die Übersicht).
-- ressort_id null = Vorstand ohne Ressort.
create or replace function task_ressort_members()
returns table (ressort_id uuid, user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select utr.ressort_id, utr.user_id
  from user_team_roles utr
  join roles r on r.id = utr.role_id
  where r.system_key = 'vorstand';
$$;

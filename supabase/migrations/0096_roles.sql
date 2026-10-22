-- Frei definierbare Rollen.
--
-- Der Admin legt Rollen an und hakt pro Rolle die Module an, die sie sieht.
-- Zuweisung wie bisher über user_team_roles: Benutzer + Team + Rolle; neu
-- kann team_id leer sein = "Alle Teams" (vereinsweit).
--   - Team-Module (training, saisonplanung, spiele, spieler, checklisten,
--     finanzen) gelten im zugewiesenen Team bzw. in allen Teams.
--   - Vereinsweite Module (uebungen, trainer, teams, checklisten_verwaltung,
--     finanzen_verein, aufgaben_uebersicht) gelten, sobald die Person die
--     Rolle irgendwo hat.
--   - Admin (profiles.is_admin) sieht und darf weiterhin alles; Benutzer,
--     Rollen und alle Sonderrechte (z.B. Budget, Löschen) bleiben beim Admin.
--
-- Übernahme 1:1: headcoach/assistant_coach/finance -> gleichnamige Rollen,
-- Häkchen "Zugriff auf Finanzen" -> zusätzliche Zuweisung Rolle "Finanzen".
--
-- Übergang: die alten Spalten role/finance_access bleiben vorerst bestehen
-- und werden per Trigger auf role_id abgebildet, damit die bisherige
-- App-Version bis zum Update weiter funktioniert.

-- ---------------- Rollen ----------------
create table roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  -- Fest eingebaute Rollen (nicht löschbar): headcoach, assistant_coach,
  -- vorstand. "finance" dient nur der Übernahme und ist löschbar.
  system_key text unique,
  modules text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint roles_modules_valid check (modules <@ array[
    'training', 'saisonplanung', 'spiele', 'spieler', 'checklisten', 'finanzen',
    'uebungen', 'trainer', 'teams', 'checklisten_verwaltung', 'finanzen_verein', 'aufgaben_uebersicht'
  ]::text[])
);

insert into roles (name, system_key, modules, sort_order) values
  ('Headcoach', 'headcoach', '{training,saisonplanung,spiele,spieler,checklisten,uebungen}', 1),
  ('Assistenzcoach', 'assistant_coach', '{training,saisonplanung,spiele,spieler,checklisten,uebungen}', 2),
  ('Finanzen', 'finance', '{finanzen}', 3),
  ('Vorstand', 'vorstand', '{aufgaben_uebersicht}', 4);

create or replace function roles_guard_delete()
returns trigger
language plpgsql
as $$
begin
  if old.system_key in ('headcoach', 'assistant_coach', 'vorstand') then
    raise exception 'Die Rolle "%" ist fest eingebaut und kann nicht gelöscht werden.', old.name;
  end if;
  return old;
end;
$$;

create trigger trg_roles_guard_delete
  before delete on roles
  for each row execute function roles_guard_delete();

alter table roles enable row level security;

create policy roles_select on roles for select using (auth.uid() is not null);
create policy roles_write on roles for all using (is_admin()) with check (is_admin());

-- ---------------- Zuweisungen ----------------
alter table user_team_roles add column role_id uuid references roles (id) on delete restrict;
alter table user_team_roles alter column role drop not null;
alter table user_team_roles alter column team_id drop not null;

update user_team_roles utr
set role_id = r.id
from roles r
where r.system_key = utr.role::text;

alter table user_team_roles
  add constraint user_team_roles_user_team_role_id_key unique nulls not distinct (user_id, team_id, role_id);

-- Häkchen "Zugriff auf Finanzen" -> zusätzliche Zuweisung der Rolle Finanzen
insert into user_team_roles (user_id, team_id, role_id, finance_access)
select distinct utr.user_id, utr.team_id, (select id from roles where system_key = 'finance'), false
from user_team_roles utr
where utr.finance_access
  and not exists (
    select 1 from user_team_roles x
    where x.user_id = utr.user_id and x.team_id = utr.team_id
      and x.role_id = (select id from roles where system_key = 'finance')
  );

alter table user_team_roles alter column role_id set not null;

-- Übergang: Einträge der bisherigen App-Version (role statt role_id) abbilden.
create or replace function user_team_roles_compat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role_id is null and new.role is not null then
    new.role_id := (select id from roles where system_key = new.role::text);
  end if;
  if new.role_id = (select id from roles where system_key = 'vorstand') and new.team_id is not null then
    raise exception 'Die Rolle Vorstand wird immer für alle Teams vergeben.';
  end if;
  return new;
end;
$$;

create trigger trg_user_team_roles_compat
  before insert or update on user_team_roles
  for each row execute function user_team_roles_compat();

create or replace function user_team_roles_compat_finance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.finance_access and new.role is distinct from 'finance' then
    insert into user_team_roles (user_id, team_id, role_id, finance_access)
    select new.user_id, new.team_id, r.id, false from roles r
    where r.system_key = 'finance'
      and not exists (
        select 1 from user_team_roles x
        where x.user_id = new.user_id and x.team_id is not distinct from new.team_id and x.role_id = r.id
      );
  end if;
  return new;
end;
$$;

create trigger trg_user_team_roles_compat_finance
  after insert on user_team_roles
  for each row execute function user_team_roles_compat_finance();

-- ---------------- Hilfsfunktionen ----------------
-- true, wenn der Benutzer Admin ist oder eine Rolle mit diesem Modul hat.
create or replace function has_module(p_module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_admin() or exists (
    select 1 from user_team_roles utr
    join roles r on r.id = utr.role_id
    where utr.user_id = auth.uid() and p_module = any(r.modules)
  );
$$;

-- Teams, in denen der Benutzer das Modul sieht (Admin: alle Teams).
create or replace function module_team_ids(p_module text)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id from teams t
  where is_admin() or exists (
    select 1 from user_team_roles utr
    join roles r on r.id = utr.role_id
    where utr.user_id = auth.uid() and p_module = any(r.modules)
      and (utr.team_id is null or utr.team_id = t.id)
  );
$$;

-- Teams, denen der Benutzer überhaupt (mit irgendeiner Rolle) zugewiesen ist.
create or replace function my_team_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id from teams t
  where is_admin() or exists (
    select 1 from user_team_roles utr
    where utr.user_id = auth.uid() and (utr.team_id is null or utr.team_id = t.id)
  );
$$;

-- Teams, deren Spieler der Benutzer sehen darf (Spieler-, Spiele- oder Training-Modul).
create or replace function player_read_team_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select module_team_ids('spieler')
  union select module_team_ids('spiele')
  union select module_team_ids('training');
$$;

create or replace function is_vorstand()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_team_roles utr
    join roles r on r.id = utr.role_id
    where utr.user_id = auth.uid() and r.system_key = 'vorstand'
  );
$$;

-- ---------------- Policies neu auf Module ----------------

-- profiles
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (is_admin() or id = auth.uid() or exists (
    select 1 from user_team_roles utr
    where utr.user_id = profiles.id and utr.team_id in (select my_team_ids())
  ));

-- categories / teams
-- Teams sichtbar: eigene Teams (irgendeine Rolle) sowie für vereinsweite
-- Bereiche, die Teams auswählen/anzeigen müssen.
drop policy if exists categories_write on categories;
create policy categories_write on categories for all
  using (has_module('teams')) with check (has_module('teams'));

drop policy if exists teams_select on teams;
drop policy if exists teams_write on teams;
create policy teams_select on teams for select
  using (
    id in (select my_team_ids())
    or has_module('teams') or has_module('trainer') or has_module('checklisten_verwaltung')
    or has_module('finanzen_verein') or has_module('aufgaben_uebersicht')
  );
create policy teams_write on teams for all
  using (has_module('teams')) with check (has_module('teams'));

-- players
drop policy if exists players_select on players;
drop policy if exists players_insert on players;
drop policy if exists players_update on players;
drop policy if exists players_delete on players;
create policy players_select on players for select
  using (
    is_admin()
    or id in (select pt.player_id from player_teams pt where pt.team_id in (select player_read_team_ids()))
    or (
      not exists (select 1 from player_teams pt where pt.player_id = players.id)
      and exists (select 1 from module_team_ids('spieler'))
    )
  );
create policy players_insert on players for insert
  with check (exists (select 1 from module_team_ids('spieler')));
create policy players_update on players for update
  using (is_admin() or exists (
    select 1 from player_teams pt
    where pt.player_id = players.id and pt.team_id in (select module_team_ids('spieler'))
  ))
  with check (is_admin() or exists (
    select 1 from player_teams pt
    where pt.player_id = players.id and pt.team_id in (select module_team_ids('spieler'))
  ));
create policy players_delete on players for delete
  using (is_admin() or exists (
    select 1 from player_teams pt
    where pt.player_id = players.id and pt.team_id in (select module_team_ids('spieler'))
  ));

drop policy if exists player_teams_select on player_teams;
drop policy if exists player_teams_write on player_teams;
create policy player_teams_select on player_teams for select
  using (team_id in (select player_read_team_ids()));
create policy player_teams_write on player_teams for all
  using (team_id in (select module_team_ids('spieler')))
  with check (team_id in (select module_team_ids('spieler')));

drop policy if exists player_notes_select on player_notes;
drop policy if exists player_notes_write on player_notes;
create policy player_notes_select on player_notes for select
  using (player_id in (select pt.player_id from player_teams pt where pt.team_id in (select player_read_team_ids())));
create policy player_notes_write on player_notes for insert
  with check (player_id in (select pt.player_id from player_teams pt where pt.team_id in (select player_read_team_ids())));

drop policy if exists player_game_comments_select on player_game_comments;
drop policy if exists player_game_comments_write on player_game_comments;
create policy player_game_comments_select on player_game_comments for select
  using (player_id in (select pt.player_id from player_teams pt where pt.team_id in (select player_read_team_ids())));
create policy player_game_comments_write on player_game_comments for all
  using (player_id in (select pt.player_id from player_teams pt where pt.team_id in (select player_read_team_ids())))
  with check (player_id in (select pt.player_id from player_teams pt where pt.team_id in (select player_read_team_ids())));

drop policy if exists player_goal_seasons_select on player_goal_seasons;
drop policy if exists player_goal_seasons_write on player_goal_seasons;
create policy player_goal_seasons_select on player_goal_seasons for select
  using (player_id in (select pt.player_id from player_teams pt where pt.team_id in (select player_read_team_ids())));
create policy player_goal_seasons_write on player_goal_seasons for all
  using (player_id in (select pt.player_id from player_teams pt where pt.team_id in (select module_team_ids('spieler'))))
  with check (player_id in (select pt.player_id from player_teams pt where pt.team_id in (select module_team_ids('spieler'))));

drop policy if exists player_goals_select on player_goals;
drop policy if exists player_goals_write on player_goals;
create policy player_goals_select on player_goals for select
  using (player_goal_season_id in (
    select pgs.id from player_goal_seasons pgs
    where pgs.player_id in (select pt.player_id from player_teams pt where pt.team_id in (select player_read_team_ids()))
  ));
create policy player_goals_write on player_goals for all
  using (player_goal_season_id in (
    select pgs.id from player_goal_seasons pgs
    where pgs.player_id in (select pt.player_id from player_teams pt where pt.team_id in (select module_team_ids('spieler')))
  ))
  with check (player_goal_season_id in (
    select pgs.id from player_goal_seasons pgs
    where pgs.player_id in (select pt.player_id from player_teams pt where pt.team_id in (select module_team_ids('spieler')))
  ));

-- trainers
drop policy if exists trainers_select on trainers;
drop policy if exists trainers_write on trainers;
create policy trainers_select on trainers for select
  using (has_module('trainer') or id in (
    select tt.trainer_id from trainer_teams tt
    where tt.team_id in (select module_team_ids('training') union select module_team_ids('spiele'))
  ));
create policy trainers_write on trainers for all
  using (has_module('trainer')) with check (has_module('trainer'));

drop policy if exists trainer_teams_select on trainer_teams;
drop policy if exists trainer_teams_write on trainer_teams;
create policy trainer_teams_select on trainer_teams for select
  using (has_module('trainer') or team_id in (select module_team_ids('training') union select module_team_ids('spiele')));
create policy trainer_teams_write on trainer_teams for all
  using (has_module('trainer')) with check (has_module('trainer'));

-- trainings (+ Saisonplanung darf lesen, für die Abdeckung)
drop policy if exists trainings_select on trainings;
drop policy if exists trainings_write on trainings;
create policy trainings_select on trainings for select
  using (team_id in (select module_team_ids('training') union select module_team_ids('saisonplanung')));
create policy trainings_write on trainings for all
  using (team_id in (select module_team_ids('training')))
  with check (team_id in (select module_team_ids('training')));

drop policy if exists training_exercises_select on training_exercises;
drop policy if exists training_exercises_write on training_exercises;
create policy training_exercises_select on training_exercises for select
  using (training_id in (select id from trainings where team_id in (select module_team_ids('training'))));
create policy training_exercises_write on training_exercises for all
  using (training_id in (select id from trainings where team_id in (select module_team_ids('training'))))
  with check (training_id in (select id from trainings where team_id in (select module_team_ids('training'))));

drop policy if exists training_ratings_select on training_ratings;
drop policy if exists training_ratings_write on training_ratings;
create policy training_ratings_select on training_ratings for select
  using (training_id in (select id from trainings where team_id in (select module_team_ids('training'))));
create policy training_ratings_write on training_ratings for all
  using (training_id in (select id from trainings where team_id in (select module_team_ids('training'))))
  with check (training_id in (select id from trainings where team_id in (select module_team_ids('training'))));

drop policy if exists training_absences_select on training_absences;
drop policy if exists training_absences_write on training_absences;
create policy training_absences_select on training_absences for select
  using (training_id in (select id from trainings where team_id in (select module_team_ids('training'))));
create policy training_absences_write on training_absences for all
  using (training_id in (select id from trainings where team_id in (select module_team_ids('training'))))
  with check (training_id in (select id from trainings where team_id in (select module_team_ids('training'))));

drop policy if exists training_trainers_select on training_trainers;
drop policy if exists training_trainers_write on training_trainers;
create policy training_trainers_select on training_trainers for select
  using (training_id in (select id from trainings where team_id in (select module_team_ids('training'))));
create policy training_trainers_write on training_trainers for all
  using (training_id in (select id from trainings where team_id in (select module_team_ids('training'))))
  with check (training_id in (select id from trainings where team_id in (select module_team_ids('training'))));

-- Saisonplanung
drop policy if exists season_planning_events_all on season_planning_events;
drop policy if exists season_planning_events_select on season_planning_events;
drop policy if exists season_planning_events_write on season_planning_events;
create policy season_planning_events_select on season_planning_events for select
  using (team_id in (select module_team_ids('saisonplanung') union select module_team_ids('training')));
create policy season_planning_events_write on season_planning_events for all
  using (team_id in (select module_team_ids('saisonplanung')))
  with check (team_id in (select module_team_ids('saisonplanung')));

drop policy if exists training_season_focuses_all on training_season_focuses;
create policy training_season_focuses_all on training_season_focuses for all
  using (training_id in (
    select id from trainings
    where team_id in (select module_team_ids('training') union select module_team_ids('saisonplanung'))
  ))
  with check (training_id in (
    select id from trainings
    where team_id in (select module_team_ids('training') union select module_team_ids('saisonplanung'))
  ));

drop policy if exists training_focus_percentages_all on training_focus_percentages;
create policy training_focus_percentages_all on training_focus_percentages for all
  using (training_id in (
    select id from trainings
    where team_id in (select module_team_ids('training') union select module_team_ids('saisonplanung'))
  ))
  with check (training_id in (
    select id from trainings
    where team_id in (select module_team_ids('training') union select module_team_ids('saisonplanung'))
  ));

-- Spiele (+ Saisonplanung darf lesen, für den Kalender)
drop policy if exists games_select on games;
drop policy if exists games_write on games;
create policy games_select on games for select
  using (our_team_id in (select module_team_ids('spiele') union select module_team_ids('saisonplanung')));
create policy games_write on games for all
  using (our_team_id in (select module_team_ids('spiele')))
  with check (our_team_id in (select module_team_ids('spiele')));

drop policy if exists game_lineups_select on game_lineups;
drop policy if exists game_lineups_write on game_lineups;
create policy game_lineups_select on game_lineups for select
  using (game_id in (select id from games where our_team_id in (select module_team_ids('spiele'))));
create policy game_lineups_write on game_lineups for all
  using (game_id in (select id from games where our_team_id in (select module_team_ids('spiele'))))
  with check (game_id in (select id from games where our_team_id in (select module_team_ids('spiele'))));

drop policy if exists game_absences_select on game_absences;
drop policy if exists game_absences_write on game_absences;
create policy game_absences_select on game_absences for select
  using (game_id in (select id from games where our_team_id in (select module_team_ids('spiele'))));
create policy game_absences_write on game_absences for all
  using (game_id in (select id from games where our_team_id in (select module_team_ids('spiele'))))
  with check (game_id in (select id from games where our_team_id in (select module_team_ids('spiele'))));

drop policy if exists game_ratings_select on game_ratings;
drop policy if exists game_ratings_write on game_ratings;
create policy game_ratings_select on game_ratings for select
  using (game_id in (select id from games where our_team_id in (select module_team_ids('spiele'))));
create policy game_ratings_write on game_ratings for all
  using (game_id in (select id from games where our_team_id in (select module_team_ids('spiele'))))
  with check (game_id in (select id from games where our_team_id in (select module_team_ids('spiele'))));

-- Übungen: alle mit Modul Übungen dürfen jede Übung bearbeiten
drop policy if exists exercises_update on exercises;
create policy exercises_update on exercises for update
  using (is_admin() or author_id = auth.uid() or has_module('uebungen'));

-- Checklisten
drop policy if exists checklists_select on checklists;
drop policy if exists checklists_write on checklists;
create policy checklists_select on checklists for select
  using (
    has_module('checklisten_verwaltung')
    or is_global
    or id in (select ct.checklist_id from checklist_teams ct where ct.team_id in (select module_team_ids('checklisten')))
  );
create policy checklists_write on checklists for all
  using (has_module('checklisten_verwaltung')) with check (has_module('checklisten_verwaltung'));

drop policy if exists checklist_items_select on checklist_items;
drop policy if exists checklist_items_write on checklist_items;
create policy checklist_items_select on checklist_items for select
  using (checklist_id in (select id from checklists));
create policy checklist_items_write on checklist_items for all
  using (has_module('checklisten_verwaltung')) with check (has_module('checklisten_verwaltung'));

drop policy if exists checklist_teams_select on checklist_teams;
drop policy if exists checklist_teams_write on checklist_teams;
create policy checklist_teams_select on checklist_teams for select
  using (has_module('checklisten_verwaltung'));
create policy checklist_teams_write on checklist_teams for all
  using (has_module('checklisten_verwaltung')) with check (has_module('checklisten_verwaltung'));

drop policy if exists checklist_instances_select on checklist_instances;
drop policy if exists checklist_instances_insert on checklist_instances;
drop policy if exists checklist_instances_update on checklist_instances;
create policy checklist_instances_select on checklist_instances for select
  using (
    has_module('checklisten_verwaltung')
    or checklist_id in (select id from checklists where is_global)
    or team_id in (select module_team_ids('checklisten'))
  );
create policy checklist_instances_insert on checklist_instances for insert
  with check (has_module('checklisten_verwaltung'));
create policy checklist_instances_update on checklist_instances for update
  using (has_module('checklisten_verwaltung')) with check (has_module('checklisten_verwaltung'));
-- checklist_instances_delete (nur Admin, nicht archiviert) bleibt unverändert.

drop policy if exists checklist_item_completions_select on checklist_item_completions;
drop policy if exists checklist_item_completions_write on checklist_item_completions;
create policy checklist_item_completions_select on checklist_item_completions for select
  using (
    has_module('checklisten_verwaltung')
    or user_id = auth.uid()
    or checklist_instance_id in (select id from checklist_instances where team_id in (select module_team_ids('checklisten')))
  );
create policy checklist_item_completions_write on checklist_item_completions for all
  using (is_admin() or (
    user_id = auth.uid()
    and checklist_instance_id in (select id from checklist_instances where team_id in (select module_team_ids('checklisten')))
  ))
  with check (is_admin() or (
    user_id = auth.uid()
    and checklist_instance_id in (select id from checklist_instances where team_id in (select module_team_ids('checklisten')))
  ));

drop policy if exists "Team members can view item attachments" on checklist_item_attachments;
drop policy if exists "Admins can upload attachments" on checklist_item_attachments;
create policy checklist_item_attachments_select on checklist_item_attachments for select
  using (checklist_item_id in (select id from checklist_items));
create policy checklist_item_attachments_insert on checklist_item_attachments for insert
  with check (has_module('checklisten_verwaltung') and uploaded_by = auth.uid());
-- Löschen (Uploader oder Admin) bleibt unverändert.

-- Finanzen: Budget bearbeiten nur Admin
drop policy if exists budgets_select on budgets;
drop policy if exists budgets_write on budgets;
create policy budgets_select on budgets for select
  using (has_module('finanzen_verein') or team_id in (select module_team_ids('finanzen')));
create policy budgets_write on budgets for all
  using (is_admin()) with check (is_admin());

drop policy if exists receipts_select on receipts;
drop policy if exists receipts_write on receipts;
create policy receipts_select on receipts for select
  using (has_module('finanzen_verein') or team_id in (select module_team_ids('finanzen')));
create policy receipts_write on receipts for all
  using ((team_id is null and has_module('finanzen_verein')) or team_id in (select module_team_ids('finanzen')))
  with check ((team_id is null and has_module('finanzen_verein')) or team_id in (select module_team_ids('finanzen')));

-- Aufgaben: Modul "Aufgaben-Übersichten" sieht alle Aufgaben (nur lesen)
drop policy if exists tasks_select on tasks;
create policy tasks_select on tasks for select
  using (is_admin() or assigned_to = auth.uid() or created_by = auth.uid() or has_module('aufgaben_uebersicht'));

-- Empfänger-Gruppen für Aufgaben über die fest eingebauten Rollen
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
  order by p.last_name, p.first_name;
$$;

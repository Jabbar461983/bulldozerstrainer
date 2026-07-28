-- Row Level Security & Rechtematrix
--
-- Rollenmodell:
--   is_admin          -> voller Zugriff auf alles
--   headcoach         -> erweiterte Rechte, aber nur für zugewiesene Team(s)
--   assistant_coach   -> eingeschränkte Rechte, nur für zugewiesene Team(s)
--
-- Modul x Rolle (siehe Konzept):
--   Finanzen: admin, headcoach            (assistant_coach: kein Zugriff)
--   Training/Spiele/Spieler: admin, headcoach, assistant_coach (jeweils nur eigenes Team)

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false);
$$;

create or replace function user_team_ids(allowed_roles coach_role[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from user_team_roles
  where user_id = auth.uid() and role = any(allowed_roles);
$$;

create or replace function user_category_ids(allowed_roles coach_role[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct t.category_id from teams t
  where t.id in (select user_team_ids(allowed_roles));
$$;

-- Verhindert, dass sich Nicht-Admins selbst zu Admin machen oder fremde Profile
-- manipulieren.
create or replace function profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    if new.id <> auth.uid() then
      raise exception 'not allowed';
    end if;
    if new.is_admin <> old.is_admin then
      raise exception 'not allowed to change admin flag';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_guard
  before update on profiles
  for each row execute function profiles_guard();

alter table profiles enable row level security;
alter table categories enable row level security;
alter table teams enable row level security;
alter table user_team_roles enable row level security;
alter table players enable row level security;
alter table player_teams enable row level security;
alter table trainers enable row level security;
alter table trainer_teams enable row level security;
alter table player_notes enable row level security;
alter table exercises enable row level security;
alter table trainings enable row level security;
alter table training_exercises enable row level security;
alter table training_ratings enable row level security;
alter table games enable row level security;
alter table game_lineups enable row level security;
alter table game_absences enable row level security;
alter table game_ratings enable row level security;
alter table player_game_comments enable row level security;
alter table budgets enable row level security;
alter table receipts enable row level security;

-- ---------------- profiles ----------------
create policy profiles_select on profiles for select
  using (is_admin() or id = auth.uid() or exists (
    select 1 from user_team_roles utr
    where utr.user_id = profiles.id and utr.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));
create policy profiles_insert on profiles for insert with check (is_admin() or id = auth.uid());
create policy profiles_update on profiles for update using (is_admin() or id = auth.uid());
create policy profiles_delete on profiles for delete using (is_admin());

-- ---------------- categories ----------------
create policy categories_select on categories for select using (auth.uid() is not null);
create policy categories_write on categories for all
  using (is_admin()) with check (is_admin());

-- ---------------- teams ----------------
create policy teams_select on teams for select
  using (is_admin() or id in (select user_team_ids('{headcoach,assistant_coach}')));
create policy teams_write on teams for all
  using (is_admin()) with check (is_admin());

-- ---------------- user_team_roles ----------------
create policy user_team_roles_select on user_team_roles for select
  using (is_admin() or user_id = auth.uid());
create policy user_team_roles_write on user_team_roles for all
  using (is_admin()) with check (is_admin());

-- ---------------- players / player_teams ----------------
create policy players_select on players for select
  using (is_admin() or id in (
    select pt.player_id from player_teams pt
    where pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));
create policy players_write on players for all
  using (is_admin() or exists (
    select 1 from player_teams pt
    where pt.player_id = players.id and pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ) or not exists (select 1 from player_teams pt where pt.player_id = players.id))
  with check (is_admin() or true);

create policy player_teams_select on player_teams for select
  using (is_admin() or team_id in (select user_team_ids('{headcoach,assistant_coach}')));
create policy player_teams_write on player_teams for all
  using (is_admin() or team_id in (select user_team_ids('{headcoach,assistant_coach}')))
  with check (is_admin() or team_id in (select user_team_ids('{headcoach,assistant_coach}')));

-- ---------------- trainers / trainer_teams ----------------
create policy trainers_select on trainers for select
  using (is_admin() or id in (
    select tt.trainer_id from trainer_teams tt
    where tt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));
create policy trainers_write on trainers for all
  using (is_admin() or true) with check (is_admin() or true);

create policy trainer_teams_select on trainer_teams for select
  using (is_admin() or team_id in (select user_team_ids('{headcoach,assistant_coach}')));
create policy trainer_teams_write on trainer_teams for all
  using (is_admin() or team_id in (select user_team_ids('{headcoach,assistant_coach}')))
  with check (is_admin() or team_id in (select user_team_ids('{headcoach,assistant_coach}')));

-- ---------------- player_notes (Timeline) ----------------
create policy player_notes_select on player_notes for select
  using (is_admin() or player_id in (
    select pt.player_id from player_teams pt
    where pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));
create policy player_notes_write on player_notes for insert
  with check (is_admin() or player_id in (
    select pt.player_id from player_teams pt
    where pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));

-- ---------------- exercises (Übungsdatenbank) ----------------
create policy exercises_select on exercises for select using (auth.uid() is not null);
create policy exercises_insert on exercises for insert with check (auth.uid() is not null);
create policy exercises_update on exercises for update
  using (is_admin() or author_id = auth.uid());
create policy exercises_delete on exercises for delete using (is_admin());

-- ---------------- trainings ----------------
create policy trainings_select on trainings for select
  using (is_admin() or team_id in (select user_team_ids('{headcoach,assistant_coach}')));
create policy trainings_write on trainings for all
  using (is_admin() or team_id in (select user_team_ids('{headcoach,assistant_coach}')))
  with check (is_admin() or team_id in (select user_team_ids('{headcoach,assistant_coach}')));

create policy training_exercises_select on training_exercises for select
  using (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));
create policy training_exercises_write on training_exercises for all
  using (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ))
  with check (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));

create policy training_ratings_select on training_ratings for select
  using (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));
create policy training_ratings_write on training_ratings for all
  using (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ))
  with check (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));

-- ---------------- games ----------------
create policy games_select on games for select
  using (is_admin() or our_team_id in (select user_team_ids('{headcoach,assistant_coach}')));
create policy games_write on games for all
  using (is_admin() or our_team_id in (select user_team_ids('{headcoach,assistant_coach}')))
  with check (is_admin() or our_team_id in (select user_team_ids('{headcoach,assistant_coach}')));

create policy game_lineups_select on game_lineups for select
  using (is_admin() or game_id in (
    select id from games where our_team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));
create policy game_lineups_write on game_lineups for all
  using (is_admin() or game_id in (
    select id from games where our_team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ))
  with check (is_admin() or game_id in (
    select id from games where our_team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));

create policy game_absences_select on game_absences for select
  using (is_admin() or game_id in (
    select id from games where our_team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));
create policy game_absences_write on game_absences for all
  using (is_admin() or game_id in (
    select id from games where our_team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ))
  with check (is_admin() or game_id in (
    select id from games where our_team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));

create policy game_ratings_select on game_ratings for select
  using (is_admin() or game_id in (
    select id from games where our_team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));
create policy game_ratings_write on game_ratings for all
  using (is_admin() or game_id in (
    select id from games where our_team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ))
  with check (is_admin() or game_id in (
    select id from games where our_team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));

create policy player_game_comments_select on player_game_comments for select
  using (is_admin() or player_id in (
    select pt.player_id from player_teams pt
    where pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));
create policy player_game_comments_write on player_game_comments for all
  using (is_admin() or player_id in (
    select pt.player_id from player_teams pt
    where pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ))
  with check (is_admin() or player_id in (
    select pt.player_id from player_teams pt
    where pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));

-- ---------------- Finanzen: nur admin + headcoach ----------------
create policy budgets_select on budgets for select
  using (is_admin() or team_id in (select user_team_ids('{headcoach}')));
create policy budgets_write on budgets for all
  using (is_admin()) with check (is_admin());

create policy receipts_select on receipts for select
  using (is_admin() or team_id in (select user_team_ids('{headcoach}')));
create policy receipts_write on receipts for all
  using (is_admin() or team_id in (select user_team_ids('{headcoach}')))
  with check (is_admin() or team_id in (select user_team_ids('{headcoach}')));

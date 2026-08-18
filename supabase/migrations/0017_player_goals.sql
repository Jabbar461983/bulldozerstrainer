-- Spieler Ziele und Beurteilungen

create table player_goal_seasons (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id) on delete cascade,
  season text not null,
  created_at timestamptz not null default now(),
  unique (player_id, season)
);

create table player_goals (
  id uuid primary key default gen_random_uuid(),
  player_goal_season_id uuid not null references player_goal_seasons (id) on delete cascade,
  title text not null,
  rating_stars int check (rating_stars >= 0 and rating_stars <= 5),
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS Policies
alter table player_goal_seasons enable row level security;
alter table player_goals enable row level security;

create policy player_goal_seasons_select on player_goal_seasons for select
  using (is_admin() or player_id in (
    select pt.player_id from player_teams pt
    where pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));

create policy player_goal_seasons_write on player_goal_seasons for all
  using (is_admin() or exists (
    select 1 from player_teams pt
    where pt.player_id = player_goal_seasons.player_id and pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ))
  with check (is_admin() or exists (
    select 1 from player_teams pt
    where pt.player_id = player_goal_seasons.player_id and pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));

create policy player_goals_select on player_goals for select
  using (is_admin() or player_goal_season_id in (
    select pgs.id from player_goal_seasons pgs
    where pgs.player_id in (
      select pt.player_id from player_teams pt
      where pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
    )
  ));

create policy player_goals_write on player_goals for all
  using (is_admin() or player_goal_season_id in (
    select pgs.id from player_goal_seasons pgs
    where pgs.player_id in (
      select pt.player_id from player_teams pt
      where pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
    )
  ))
  with check (is_admin() or player_goal_season_id in (
    select pgs.id from player_goal_seasons pgs
    where pgs.player_id in (
      select pt.player_id from player_teams pt
      where pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
    )
  ));

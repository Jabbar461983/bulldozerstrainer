-- Add is_home field to games table
alter table games
  add column is_home boolean not null default true;

-- Add auto_create_for_home_games to checklists table
alter table checklists
  add column auto_create_for_home_games boolean not null default false;

-- Create index for efficient home games queries
create index idx_games_is_home_date on games(is_home, date, our_team_id);

-- Season planning tables for coach training plan module
-- Stores season-wide planning events (activities, techniques, tactics, physical training)
-- Links trainings to these planning events and tracks time percentages

create type season_planning_category as enum ('activities', 'technique', 'tactics', 'physical');

create table if not exists season_planning_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  title text not null,
  start_date date not null,
  end_date date not null,
  category season_planning_category not null,
  subcategory text,
  sort_order int not null default 0,
  is_template boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_season_planning_events_team_id on season_planning_events(team_id);
create index if not exists idx_season_planning_events_date_range on season_planning_events(start_date, end_date);

-- Junction table: links trainings to season planning events
create table if not exists training_season_focuses (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references trainings(id) on delete cascade,
  season_planning_event_id uuid not null references season_planning_events(id) on delete cascade,
  created_at timestamp with time zone not null default now(),

  unique(training_id, season_planning_event_id)
);

create index if not exists idx_training_season_focuses_training_id on training_season_focuses(training_id);
create index if not exists idx_training_season_focuses_event_id on training_season_focuses(season_planning_event_id);

-- Stores the percentage of training time per category for each training
create table if not exists training_focus_percentages (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references trainings(id) on delete cascade,
  category season_planning_category not null,
  percentage int not null check (percentage >= 0 and percentage <= 100),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  unique(training_id, category)
);

create index if not exists idx_training_focus_percentages_training_id on training_focus_percentages(training_id);

-- Enable RLS (Row Level Security)
alter table season_planning_events enable row level security;
alter table training_season_focuses enable row level security;
alter table training_focus_percentages enable row level security;

-- RLS Policies for season_planning_events
create policy "Teams can view and manage their own season planning events" on season_planning_events
  as permissive
  for all
  using (
    auth.uid() in (
      select user_id from user_team_roles where team_id = season_planning_events.team_id
    )
    or auth.uid() in (select id from profiles where is_admin = true)
  );

-- RLS Policies for training_season_focuses (based on training's team)
create policy "Teams can manage season focuses for their trainings" on training_season_focuses
  as permissive
  for all
  using (
    training_id in (
      select t.id from trainings t
      where t.team_id in (
        select team_id from user_team_roles where user_id = auth.uid()
      )
      or t.team_id in (
        select team_id from user_team_roles
        where user_id in (select id from profiles where is_admin = true)
      )
    )
  );

-- RLS Policies for training_focus_percentages (based on training's team)
create policy "Teams can manage focus percentages for their trainings" on training_focus_percentages
  as permissive
  for all
  using (
    training_id in (
      select t.id from trainings t
      where t.team_id in (
        select team_id from user_team_roles where user_id = auth.uid()
      )
      or t.team_id in (
        select team_id from user_team_roles
        where user_id in (select id from profiles where is_admin = true)
      )
    )
  );

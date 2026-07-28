-- Junioren Manager: Grundschema
-- Reihenfolge folgt der Modulstruktur aus dem Konzept.

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. Profile & Rollen
-- ============================================================

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create type coach_role as enum ('headcoach', 'assistant_coach');

-- ============================================================
-- 2. Teamverwaltung
-- ============================================================

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

insert into categories (name, sort_order, is_default) values
  ('U9', 1, true),
  ('U12', 2, true),
  ('U15', 3, true),
  ('U18', 4, true);

create table teams (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id),
  name text not null,
  season text not null,
  default_training_duration_minutes int not null default 90,
  created_at timestamptz not null default now()
);

create table user_team_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  role coach_role not null,
  unique (user_id, team_id, role)
);

-- ============================================================
-- 3. Spieler & Trainer
-- ============================================================

create table players (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  birthdate date,
  created_at timestamptz not null default now()
);

create table player_teams (
  player_id uuid not null references players (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  primary key (player_id, team_id)
);

create table trainers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  birthdate date,
  created_at timestamptz not null default now()
);

create table trainer_teams (
  trainer_id uuid not null references trainers (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  primary key (trainer_id, team_id)
);

create table player_notes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id) on delete cascade,
  source text not null check (source in ('training', 'game', 'misc')),
  source_id uuid,
  note text not null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. Übungsdatenbank
-- ============================================================

create table exercises (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  focus_areas text[] not null default '{}',
  age_category_ids uuid[] not null default '{}',
  media jsonb not null default '[]',
  author_id uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 5. Training
-- ============================================================

create table trainings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  date date not null,
  start_time time,
  duration_minutes int not null,
  series_id uuid,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table training_exercises (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references trainings (id) on delete cascade,
  exercise_id uuid not null references exercises (id),
  duration_minutes int not null,
  notes text,
  sort_order int not null default 0
);

create table training_ratings (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references trainings (id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  notes text,
  created_by uuid references profiles (id),
  is_admin_feedback boolean not null default false,
  created_at timestamptz not null default now()
);

-- Genau eine reguläre (Coach-)Bewertung pro Training; Admin-Zusatzfeedback unbegrenzt.
create unique index one_regular_rating_per_training
  on training_ratings (training_id)
  where not is_admin_feedback;

-- ============================================================
-- 6. Spiele
-- ============================================================

create table games (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories (id),
  our_team_id uuid references teams (id),
  date date not null,
  time time,
  location text,
  home_team text not null,
  away_team text not null,
  season text,
  result_us int,
  result_them int,
  pre_game_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type game_lineup_position as enum ('goalie', 'defense', 'wing', 'center', 'field');

create table game_lineups (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  player_id uuid not null references players (id),
  block_number int,
  position game_lineup_position,
  unique (game_id, player_id)
);

create table game_absences (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  person_type text not null check (person_type in ('player', 'trainer')),
  player_id uuid references players (id),
  trainer_id uuid references trainers (id)
);

create table game_ratings (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  category text not null check (
    category in ('goalie', 'defense', 'offense', 'powerplay', 'boxplay', 'overall')
  ),
  stars int not null check (stars between 1 and 5),
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (game_id, category)
);

create table player_game_comments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id) on delete cascade,
  game_id uuid references games (id) on delete cascade,
  date date not null default current_date,
  opponent text,
  note text not null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 7. Finanzen
-- ============================================================

create table budgets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  season text not null,
  amount numeric(12, 2) not null default 0,
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now(),
  unique (team_id, season)
);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  season text not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null,
  recipient_type text not null check (recipient_type in ('company', 'person')),
  recipient_name text not null,
  notes text,
  photo_path text,
  date date not null default current_date,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Indizes
-- ============================================================

create index idx_teams_category on teams (category_id);
create index idx_user_team_roles_user on user_team_roles (user_id);
create index idx_user_team_roles_team on user_team_roles (team_id);
create index idx_player_teams_team on player_teams (team_id);
create index idx_trainer_teams_team on trainer_teams (team_id);
create index idx_trainings_team_date on trainings (team_id, date);
create index idx_training_exercises_training on training_exercises (training_id);
create index idx_games_team_date on games (our_team_id, date);
create index idx_receipts_team_season on receipts (team_id, season);
create index idx_player_notes_player on player_notes (player_id, created_at desc);
create index idx_player_game_comments_player on player_game_comments (player_id, date desc);

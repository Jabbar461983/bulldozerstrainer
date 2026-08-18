-- Persönliche Favoriten: jeder Trainer kann Übungen für sich selbst markieren,
-- unabhängig von anderen Trainern.
create table exercise_favorites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, exercise_id)
);

alter table exercise_favorites enable row level security;

create policy exercise_favorites_select on exercise_favorites for select
  using (is_admin() or profile_id = auth.uid());

create policy exercise_favorites_write on exercise_favorites for all
  using (is_admin() or profile_id = auth.uid())
  with check (is_admin() or profile_id = auth.uid());

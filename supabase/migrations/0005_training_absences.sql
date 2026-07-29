-- Abwesenheiten (Spieler/Trainer) pro Training, analog zu game_absences.

create table training_absences (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references trainings (id) on delete cascade,
  person_type text not null check (person_type in ('player', 'trainer')),
  player_id uuid references players (id),
  trainer_id uuid references trainers (id)
);

create index idx_training_absences_training on training_absences (training_id);

alter table training_absences enable row level security;

create policy training_absences_select on training_absences for select
  using (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));
create policy training_absences_write on training_absences for all
  using (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ))
  with check (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));

-- Zuordnung, welche Trainer ein Training geleitet haben.

create table training_trainers (
  training_id uuid not null references trainings (id) on delete cascade,
  trainer_id uuid not null references trainers (id) on delete cascade,
  primary key (training_id, trainer_id)
);

create index idx_training_trainers_training on training_trainers (training_id);

alter table training_trainers enable row level security;

create policy training_trainers_select on training_trainers for select
  using (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));
create policy training_trainers_write on training_trainers for all
  using (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ))
  with check (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));

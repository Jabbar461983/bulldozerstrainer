-- Übungen liessen sich nicht löschen, sobald sie in einem Training verwendet
-- wurden (Fremdschlüssel exercise_id ohne ON DELETE CASCADE). Beim Löschen
-- einer Übung sollen die zugehörigen Trainings-Einträge automatisch mit
-- entfernt werden.
alter table training_exercises drop constraint if exists training_exercises_exercise_id_fkey;
alter table training_exercises
  add constraint training_exercises_exercise_id_fkey
  foreign key (exercise_id) references exercises (id) on delete cascade;

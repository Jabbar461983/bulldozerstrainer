-- Diverse Tabellen verweisen auf profiles(id) ohne explizites ON DELETE-
-- Verhalten (Standard: NO ACTION), wodurch das Löschen eines Benutzers
-- fehlschlägt, sobald er irgendwo als Ersteller/Bewerter/Hochlader referenziert
-- wird ("Database error deleting user"). Inhalte sollen beim Löschen eines
-- Benutzers erhalten bleiben - nur die "erstellt von"-Zuordnung wird auf NULL
-- gesetzt. Rein persönliche Datensätze (wer hat ein Checklisten-Item
-- abgehakt) werden dagegen mitgelöscht (wie schon bei exercise_favorites).

alter table player_notes drop constraint player_notes_created_by_fkey;
alter table player_notes add constraint player_notes_created_by_fkey
  foreign key (created_by) references profiles (id) on delete set null;

alter table exercises drop constraint exercises_author_id_fkey;
alter table exercises add constraint exercises_author_id_fkey
  foreign key (author_id) references profiles (id) on delete set null;

alter table trainings drop constraint trainings_created_by_fkey;
alter table trainings add constraint trainings_created_by_fkey
  foreign key (created_by) references profiles (id) on delete set null;

alter table training_ratings drop constraint training_ratings_created_by_fkey;
alter table training_ratings add constraint training_ratings_created_by_fkey
  foreign key (created_by) references profiles (id) on delete set null;

alter table game_ratings drop constraint game_ratings_created_by_fkey;
alter table game_ratings add constraint game_ratings_created_by_fkey
  foreign key (created_by) references profiles (id) on delete set null;

alter table player_game_comments drop constraint player_game_comments_created_by_fkey;
alter table player_game_comments add constraint player_game_comments_created_by_fkey
  foreign key (created_by) references profiles (id) on delete set null;

alter table budgets drop constraint budgets_updated_by_fkey;
alter table budgets add constraint budgets_updated_by_fkey
  foreign key (updated_by) references profiles (id) on delete set null;

alter table receipts drop constraint receipts_created_by_fkey;
alter table receipts add constraint receipts_created_by_fkey
  foreign key (created_by) references profiles (id) on delete set null;

alter table season_planning_events drop constraint season_planning_events_created_by_fkey;
alter table season_planning_events add constraint season_planning_events_created_by_fkey
  foreign key (created_by) references profiles (id) on delete set null;

alter table player_goals drop constraint player_goals_created_by_fkey;
alter table player_goals add constraint player_goals_created_by_fkey
  foreign key (created_by) references profiles (id) on delete set null;

alter table checklists drop constraint checklists_created_by_fkey;
alter table checklists add constraint checklists_created_by_fkey
  foreign key (created_by) references profiles (id) on delete set null;

alter table checklist_instances drop constraint checklist_instances_created_by_fkey;
alter table checklist_instances add constraint checklist_instances_created_by_fkey
  foreign key (created_by) references profiles (id) on delete set null;

alter table checklist_instances drop constraint checklist_instances_completed_by_fkey;
alter table checklist_instances add constraint checklist_instances_completed_by_fkey
  foreign key (completed_by) references profiles (id) on delete set null;

alter table checklist_item_attachments alter column uploaded_by drop not null;
alter table checklist_item_attachments drop constraint checklist_item_attachments_uploaded_by_fkey;
alter table checklist_item_attachments add constraint checklist_item_attachments_uploaded_by_fkey
  foreign key (uploaded_by) references profiles (id) on delete set null;

-- Persönlicher Abhak-Status: ergibt ohne den Benutzer keinen Sinn mehr.
alter table checklist_item_completions drop constraint checklist_item_completions_user_id_fkey;
alter table checklist_item_completions add constraint checklist_item_completions_user_id_fkey
  foreign key (user_id) references profiles (id) on delete cascade;

-- ---------------- tasks.created_by ----------------
-- Aufgaben, die einem gelöschten Benutzer ZUGEWIESEN sind, sollen mit
-- gelöscht werden (assigned_to bleibt ON DELETE CASCADE, unverändert).
-- Aufgaben, die er für ANDERE ERSTELLT hat, sollen dagegen erhalten
-- bleiben - nur die Ersteller-Zuordnung wird auf NULL gesetzt (sonst würde
-- das Löschen eines Ersteller-Kontos fremde, noch offene Aufgaben löschen).
alter table tasks alter column created_by drop not null;
alter table tasks drop constraint tasks_created_by_fkey;
alter table tasks add constraint tasks_created_by_fkey
  foreign key (created_by) references profiles (id) on delete set null;

-- Steuert, ob die Übungsbeschreibung im PDF-Export des Trainings erscheint.
-- Default true, damit bestehende Trainings ihr bisheriges Verhalten behalten.
alter table trainings add column if not exists show_exercise_descriptions boolean not null default true;

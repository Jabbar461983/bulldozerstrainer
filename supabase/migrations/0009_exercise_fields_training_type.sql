-- Übungsdatenbank: Lerninhalte & Varianten
alter table exercises
  add column learning_content text,
  add column variants text;

-- Training: On Field / Off Field
alter table trainings
  add column field_type text not null default 'on_field'
    check (field_type in ('on_field', 'off_field'));

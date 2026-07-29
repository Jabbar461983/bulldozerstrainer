-- Übungsdatenbank: Lerninhalte & Varianten
alter table exercises add column if not exists learning_content text;
alter table exercises add column if not exists variants text;

-- Training: On Field / Off Field
alter table trainings add column if not exists field_type text not null default 'on_field';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trainings_field_type_check'
  ) then
    alter table trainings
      add constraint trainings_field_type_check check (field_type in ('on_field', 'off_field'));
  end if;
end $$;

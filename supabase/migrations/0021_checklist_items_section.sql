-- Checklisten: Abschnittsüberschriften für Items
alter table checklist_items
  add column is_section boolean not null default false;

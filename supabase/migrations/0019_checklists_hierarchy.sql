-- Checklisten-Modul: Hierarchie & Gesamt-Notiz
-- Ermöglicht Sub-Items und Notizen nur beim finalen Speichern

-- Hierarchie: parent_id für Sub-Items
alter table checklist_items
  add column parent_id uuid references checklist_items (id) on delete cascade;

create index idx_checklist_items_parent on checklist_items (checklist_id, parent_id);

-- Gesamt-Notiz: notes und completed_by
alter table checklist_instances
  add column notes text,
  add column completed_by uuid references profiles (id);

-- completed_at wird nullable (nicht automatisch gesetzt mehr)
alter table checklist_instances
  alter column completed_at drop not null;

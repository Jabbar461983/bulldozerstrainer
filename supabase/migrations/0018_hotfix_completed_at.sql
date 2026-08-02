-- Fix: Füge fehlende completed_at Spalte zu checklist_instances hinzu
alter table checklist_instances
  add column completed_at timestamptz;

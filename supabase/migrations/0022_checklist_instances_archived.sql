-- Add archived_at column to track when checklists are archived
alter table checklist_instances
  add column archived_at timestamptz null;

-- Create index for efficient filtering
create index idx_checklist_instances_archived on checklist_instances(archived_at);

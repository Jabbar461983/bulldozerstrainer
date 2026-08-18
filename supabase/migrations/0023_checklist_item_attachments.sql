-- Create table for checklist item attachments (documents, photos)
create table checklist_item_attachments (
  id uuid primary key default gen_random_uuid(),
  checklist_item_id uuid not null references checklist_items(id) on delete cascade,
  checklist_instance_id uuid references checklist_instances(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text not null,
  file_size integer not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_checklist_item_attachments_item on checklist_item_attachments(checklist_item_id);
create index idx_checklist_item_attachments_instance on checklist_item_attachments(checklist_instance_id);

-- RLS Policies for attachments
alter table checklist_item_attachments enable row level security;

create policy "Anyone with team access can view attachments"
  on checklist_item_attachments for select
  using (
    exists (
      select 1 from checklist_instances ci
      join checklists c on ci.checklist_id = c.id
      join user_team_roles utr on c.is_global or ci.team_id = utr.team_id or not exists(
        select 1 from checklist_teams ct where ct.checklist_id = c.id
      )
      where ci.id = checklist_item_attachments.checklist_instance_id
      and utr.user_id = auth.uid()
    )
  );

create policy "Team members can upload attachments"
  on checklist_item_attachments for insert
  with check (
    exists (
      select 1 from checklist_instances ci
      join checklists c on ci.checklist_id = c.id
      join user_team_roles utr on c.is_global or ci.team_id = utr.team_id or not exists(
        select 1 from checklist_teams ct where ct.checklist_id = c.id
      )
      where ci.id = checklist_item_attachments.checklist_instance_id
      and utr.user_id = auth.uid()
    )
  );

create policy "Team members can delete their attachments"
  on checklist_item_attachments for delete
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from checklist_instances ci
      join checklists c on ci.checklist_id = c.id
      join user_team_roles utr on c.is_global or ci.team_id = utr.team_id or not exists(
        select 1 from checklist_teams ct where ct.checklist_id = c.id
      )
      where ci.id = checklist_item_attachments.checklist_instance_id
      and utr.user_id = auth.uid()
      and utr.role = 'headcoach'
    )
  );

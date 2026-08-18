-- Create table for checklist item attachments (documents, photos)
-- Attachments sind direkt am Item, nicht an der Instance
create table checklist_item_attachments (
  id uuid primary key default gen_random_uuid(),
  checklist_item_id uuid not null references checklist_items(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text not null,
  file_size integer not null,
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_checklist_item_attachments_item on checklist_item_attachments(checklist_item_id);

-- RLS Policies for attachments
alter table checklist_item_attachments enable row level security;

-- Admins und Teamleiter können attachments sehen (über die Checkliste)
create policy "Team members can view item attachments"
  on checklist_item_attachments for select
  using (
    exists (
      select 1 from checklist_items ci
      join checklists c on ci.checklist_id = c.id
      join user_team_roles utr on c.is_global or not exists(
        select 1 from checklist_teams ct where ct.checklist_id = c.id
      ) or exists(
        select 1 from checklist_teams ct where ct.checklist_id = c.id and ct.team_id = utr.team_id
      )
      where ci.id = checklist_item_attachments.checklist_item_id
      and utr.user_id = auth.uid()
    )
  );

-- Nur Admins können attachments hochladen (bei Item-Erstellung/Bearbeitung)
create policy "Admins can upload attachments"
  on checklist_item_attachments for insert
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.is_admin
    )
    and uploaded_by = auth.uid()
  );

-- Nur Uploader oder Admins können attachments löschen
create policy "Admins and uploader can delete attachments"
  on checklist_item_attachments for delete
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );

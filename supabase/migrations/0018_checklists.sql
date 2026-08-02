-- Checklisten-Modul
-- Admins erstellen und verwalten Checklisten
-- Coaches haken Items ab und fügen Notizen hinzu

create table checklists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  has_reporting boolean not null default false,
  is_global boolean not null default true,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table checklist_teams (
  checklist_id uuid not null references checklists (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  primary key (checklist_id, team_id)
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references checklists (id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table checklist_instances (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references checklists (id) on delete cascade,
  team_id uuid references teams (id) on delete cascade,
  event_date date,
  event_context text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table checklist_item_completions (
  id uuid primary key default gen_random_uuid(),
  checklist_instance_id uuid not null references checklist_instances (id) on delete cascade,
  checklist_item_id uuid not null references checklist_items (id) on delete cascade,
  user_id uuid not null references profiles (id),
  notes text,
  completed_at timestamptz not null default now(),
  unique (checklist_instance_id, checklist_item_id)
);

-- RLS Policies

alter table checklists enable row level security;
alter table checklist_teams enable row level security;
alter table checklist_items enable row level security;
alter table checklist_instances enable row level security;
alter table checklist_item_completions enable row level security;

-- checklists: Admins full access, Coaches see global + their assigned teams
create policy checklists_select on checklists for select
  using (
    is_admin() or
    is_global or
    id in (
      select ct.checklist_id from checklist_teams ct
      where ct.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
    )
  );

create policy checklists_write on checklists for all
  using (is_admin())
  with check (is_admin());

-- checklist_teams: Admin only
create policy checklist_teams_select on checklist_teams for select
  using (is_admin());

create policy checklist_teams_write on checklist_teams for all
  using (is_admin())
  with check (is_admin());

-- checklist_items: Admins full access, Coaches read if they see the checklist
create policy checklist_items_select on checklist_items for select
  using (
    is_admin() or
    checklist_id in (
      select id from checklists
      where is_global or
            id in (
              select ct.checklist_id from checklist_teams ct
              where ct.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
            )
    )
  );

create policy checklist_items_write on checklist_items for all
  using (is_admin())
  with check (is_admin());

-- checklist_instances: Admins full access, Coaches see/edit their teams + global
create policy checklist_instances_select on checklist_instances for select
  using (
    is_admin() or
    checklist_id in (
      select id from checklists
      where is_global
    ) or
    team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  );

create policy checklist_instances_write on checklist_instances for all
  using (is_admin())
  with check (is_admin());

-- checklist_item_completions: Admins see all, Coaches see their own + can edit their own
create policy checklist_item_completions_select on checklist_item_completions for select
  using (
    is_admin() or
    user_id = auth.uid() or
    checklist_instance_id in (
      select id from checklist_instances
      where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
    )
  );

create policy checklist_item_completions_write on checklist_item_completions for all
  using (
    is_admin() or
    (user_id = auth.uid() and
     checklist_instance_id in (
       select ci.id from checklist_instances ci
       where ci.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
     ))
  )
  with check (
    is_admin() or
    (user_id = auth.uid() and
     checklist_instance_id in (
       select ci.id from checklist_instances ci
       where ci.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
     ))
  );

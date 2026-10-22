-- Serienaufgaben (wöchentlich, 14-täglich, monatlich, quartalsweise,
-- halbjährlich, jährlich), optional mit Enddatum.
--
-- - task_series hält die Vorlage (Inhalt, Empfänger, Rhythmus). Jeder Termin
--   ist eine normale Aufgabe (eigene task_group_id) mit series_id.
-- - extend_task_series() legt die Termine an: bis zum Enddatum, höchstens bis
--   heute + 12 Monate. Ohne Enddatum ergänzt die App die Serie laufend (Aufruf
--   beim Start der App).
-- - "Alle Termine löschen" (Admin) beendet die Serie und löscht nur die
--   offenen Termine; erledigte bleiben erhalten.
-- Rein additiv: bestehende Aufgaben bleiben unverändert (series_id = null).

create table task_series (
  id uuid primary key default gen_random_uuid(),
  recurrence text not null
    check (recurrence in ('weekly', 'biweekly', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
  start_date date not null,
  end_date date,
  title text not null,
  description text,
  attachment_path text,
  is_team_task boolean not null default false,
  category text not null default 'sport' check (category in ('sport', 'vorstand')),
  recipients uuid[] not null,
  created_by uuid not null references profiles (id) on delete cascade,
  generated_until date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

alter table tasks
  add column series_id uuid references task_series (id) on delete set null;

create index idx_tasks_series on tasks (series_id);

alter table task_series enable row level security;

-- Sichtbar, wenn man mindestens einen Termin der Serie sehen darf.
create policy task_series_select on task_series for select
  using (
    is_admin() or created_by = auth.uid()
    or exists (select 1 from tasks t where t.series_id = task_series.id)
  );
create policy task_series_insert on task_series for insert
  with check (auth.uid() is not null and created_by = auth.uid());
create policy task_series_update on task_series for update
  using (is_admin() or created_by = auth.uid())
  with check (is_admin() or created_by = auth.uid());
create policy task_series_delete on task_series for delete using (is_admin());

-- n-ter Termin einer Serie (n = 0 ist das Startdatum). Monate werden immer
-- vom Startdatum aus gerechnet: 31. Jan -> 28./29. Feb -> 31. März.
create or replace function task_series_occurrence(p_recurrence text, p_start date, p_n integer)
returns date
language sql
immutable
as $$
  select case p_recurrence
    when 'weekly' then p_start + p_n * 7
    when 'biweekly' then p_start + p_n * 14
    when 'monthly' then (p_start + make_interval(months => p_n))::date
    when 'quarterly' then (p_start + make_interval(months => 3 * p_n))::date
    when 'halfyearly' then (p_start + make_interval(months => 6 * p_n))::date
    when 'yearly' then (p_start + make_interval(years => p_n))::date
  end;
$$;

-- Legt fehlende Termine an (eine Serie oder alle aktiven Serien).
create or replace function extend_task_series(p_series_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s task_series%rowtype;
  v_limit date;
  v_date date;
  v_n integer;
  v_group uuid;
  v_count integer := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;
  for s in
    select * from task_series
    where active
      and (p_series_id is null or id = p_series_id)
      and (generated_until is null
        or generated_until < least(coalesce(end_date, 'infinity'::date), (current_date + interval '12 months')::date))
    for update skip locked
  loop
    v_limit := least(coalesce(s.end_date, 'infinity'::date), (current_date + interval '12 months')::date);
    v_n := 0;
    loop
      v_date := task_series_occurrence(s.recurrence, s.start_date, v_n);
      exit when v_date > v_limit;
      if s.generated_until is null or v_date > s.generated_until then
        v_group := gen_random_uuid();
        insert into tasks (task_group_id, title, description, due_date, attachment_path, is_team_task,
                           category, created_by, assigned_to, series_id)
        select v_group, s.title, s.description, v_date, s.attachment_path, s.is_team_task,
               s.category, s.created_by, p.id, s.id
        from profiles p
        where p.id = any (s.recipients);
        v_count := v_count + 1;
      end if;
      v_n := v_n + 1;
    end loop;
    update task_series set generated_until = v_limit where id = s.id;
  end loop;
  return v_count;
end;
$$;

-- Empfänger dürfen die Serien-Zugehörigkeit nicht ändern.
create or replace function tasks_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_admin() or auth.uid() = old.created_by) then
    if coalesce(current_setting('app.task_forwarding', true), '') = 'on'
      and new.assigned_to <> old.assigned_to
    then
      -- Weiterleitung via forward_task(): nur assigned_to darf sich ändern.
      null;
    elsif new.assigned_to <> old.assigned_to then
      raise exception 'Nur Ersteller oder Admin dürfen diese Angaben ändern.';
    end if;
    if new.title <> old.title
      or coalesce(new.description, '') <> coalesce(old.description, '')
      or new.due_date <> old.due_date
      or coalesce(new.attachment_path, '') <> coalesce(old.attachment_path, '')
      or new.is_team_task <> old.is_team_task
      or new.task_group_id <> old.task_group_id
      or new.created_by is distinct from old.created_by
      or new.category <> old.category
      or new.series_id is distinct from old.series_id
    then
      raise exception 'Nur Ersteller oder Admin dürfen diese Angaben ändern.';
    end if;
  end if;
  return new;
end;
$$;

-- Neues globales Recht "Übungen bearbeiten": ermöglicht es dem Admin, einzelnen
-- Trainern zu erlauben, ALLE Übungen in der Übungsdatenbank zu bearbeiten
-- (nicht nur die selbst erstellten). Die Übungsdatenbank ist nicht team-
-- gebunden, daher als Profil-Flag (analog zu is_admin) statt als Team-Rolle.

alter table profiles add column can_edit_exercises boolean not null default false;

-- Trigger, der bei Erstellung eines Users automatisch das Profil anlegt: neues
-- Flag ebenfalls aus user_metadata übernehmen (default false).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, email, phone, is_admin, can_edit_exercises)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    coalesce((new.raw_user_meta_data ->> 'is_admin')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'can_edit_exercises')::boolean, false)
  );
  return new;
end;
$$;

-- Guard-Trigger: Nicht-Admins dürfen das neue Flag genausowenig selbst setzen
-- wie den Admin-Status.
create or replace function profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    if new.id <> auth.uid() then
      raise exception 'not allowed';
    end if;
    if new.is_admin <> old.is_admin then
      raise exception 'not allowed to change admin flag';
    end if;
    if new.can_edit_exercises <> old.can_edit_exercises then
      raise exception 'not allowed to change can_edit_exercises flag';
    end if;
  end if;
  return new;
end;
$$;

create or replace function can_edit_all_exercises()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.can_edit_exercises from profiles p where p.id = auth.uid()), false);
$$;

drop policy exercises_update on exercises;
create policy exercises_update on exercises for update
  using (is_admin() or author_id = auth.uid() or can_edit_all_exercises());

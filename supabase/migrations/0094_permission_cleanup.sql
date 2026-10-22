-- Bereinigung der Zugriffsregeln (vor der Umstellung auf frei definierbare
-- Rollen). In der App ändert sich sichtbar nichts; es werden nur Lücken in
-- der Datenbank geschlossen, die über die Oberfläche nicht erreichbar waren.

-- ---------------- 1. Saisonplanung ----------------
-- Bisher: jede Rolle im Team (auch "finance") durfte lesen und schreiben.
-- Neu: nur Admin sowie Headcoach/Assistenzcoach des Teams.
drop policy if exists "Teams can view and manage their own season planning events" on season_planning_events;

create policy season_planning_events_all on season_planning_events for all
  using (is_admin() or team_id in (select user_team_ids('{headcoach,assistant_coach}')))
  with check (is_admin() or team_id in (select user_team_ids('{headcoach,assistant_coach}')));

-- ---------------- 2. Trainingsschwerpunkte ----------------
-- Bisher fehlerhaft: war ein Admin einem Team zugewiesen, durften alle
-- angemeldeten Benutzer die Schwerpunkte dieses Teams ändern.
drop policy if exists "Teams can manage season focuses for their trainings" on training_season_focuses;
drop policy if exists "Teams can manage focus percentages for their trainings" on training_focus_percentages;

create policy training_season_focuses_all on training_season_focuses for all
  using (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ))
  with check (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));

create policy training_focus_percentages_all on training_focus_percentages for all
  using (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ))
  with check (is_admin() or training_id in (
    select id from trainings where team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));

-- ---------------- 3. Spieler ----------------
-- Bisher: Spieler ohne Team durfte jeder Coach bearbeiten/löschen, und
-- anlegen durfte jeder angemeldete Benutzer.
-- Neu: anlegen Admin oder Coaches (die das Team danach über player_teams
-- zuweisen - dort gilt weiterhin: nur eigene Teams); ändern/löschen nur
-- Admin oder Coaches eines Teams, in dem der Spieler ist.
drop policy if exists players_write on players;

create policy players_insert on players for insert
  with check (is_admin() or exists (select 1 from user_team_ids('{headcoach,assistant_coach}')));

create policy players_update on players for update
  using (is_admin() or exists (
    select 1 from player_teams pt
    where pt.player_id = players.id and pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ))
  with check (is_admin() or exists (
    select 1 from player_teams pt
    where pt.player_id = players.id and pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));

create policy players_delete on players for delete
  using (is_admin() or exists (
    select 1 from player_teams pt
    where pt.player_id = players.id and pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
  ));

-- ---------------- 4. Speicher "uploads" (Checklisten-Dateien/-Fotos) ----------------
-- Der Speicher wurde von Hand im Dashboard angelegt; seine Regeln waren
-- nirgends festgehalten. Er bleibt öffentlich lesbar (die App verwendet
-- direkte Links, bestehende Links funktionieren weiter). Alle bisherigen,
-- von Hand angelegten Regeln für diesen Speicher werden entfernt und durch
-- diese ersetzt: hochladen alle Angemeldeten, löschen nur Admin oder wer die
-- Datei hochgeladen hat.
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

do $$
declare
  r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%''uploads''%' or coalesce(with_check, '') ilike '%''uploads''%')
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy uploads_storage_select on storage.objects for select
  using (bucket_id = 'uploads' and auth.uid() is not null);
create policy uploads_storage_insert on storage.objects for insert
  with check (bucket_id = 'uploads' and auth.uid() is not null);
create policy uploads_storage_delete on storage.objects for delete
  using (bucket_id = 'uploads' and (is_admin() or owner = auth.uid()));

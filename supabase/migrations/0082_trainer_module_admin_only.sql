-- Das Trainer-Modul (Stammdatenverwaltung der Trainer) ist neu nur noch für
-- Admins zugänglich, nicht mehr für Headcoach/Assistenzcoach. Leserechte auf
-- trainers/trainer_teams bleiben unverändert (werden u.a. für Abwesenheiten
-- bei Training/Spiel benötigt) - nur das Anlegen/Bearbeiten/Löschen wird auf
-- Admin eingeschränkt.
--
-- trainers_write erlaubte bisher fälschlicherweise jedem eingeloggten
-- Nutzer Schreibzugriff (`is_admin() or true`); das wird hier ebenfalls
-- korrigiert.

drop policy trainers_write on trainers;
create policy trainers_write on trainers for all
  using (is_admin()) with check (is_admin());

drop policy trainer_teams_write on trainer_teams;
create policy trainer_teams_write on trainer_teams for all
  using (is_admin()) with check (is_admin());

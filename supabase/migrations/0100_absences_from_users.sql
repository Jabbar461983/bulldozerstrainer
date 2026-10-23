-- Trainer-Abmeldungen (Training/Spiel) neu über die Benutzer.
--
-- - In den Abmeldungen erscheinen die Benutzer mit Rolle Headcoach oder
--   Assistenzcoach im jeweiligen Team (team_coach_roster()).
-- - training_absences/game_absences erhalten profile_id. Bestehende
--   Trainer-Abmeldungen werden per Vor- und Nachname einem Benutzer
--   zugeordnet; trainer_id bleibt erhalten (keine Daten gehen verloren).
-- - Die Tabellen trainers/trainer_teams bleiben bestehen, werden von der
--   App aber nicht mehr gepflegt.
-- Kann gefahrlos mehrmals ausgeführt werden (z.B. nachdem fehlende
-- Benutzer angelegt wurden): die Zuordnung ergänzt nur, was noch fehlt.

alter table training_absences
  add column if not exists profile_id uuid references profiles (id) on delete cascade;
alter table game_absences
  add column if not exists profile_id uuid references profiles (id) on delete cascade;

-- Alte Trainer-Einträge -> Benutzer mit gleichem Namen (nur bei eindeutigem Treffer)
create or replace function trainer_profile_id(p_trainer_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when count(*) = 1 then min(p.id::text)::uuid end
  from trainers t
  join profiles p
    on lower(trim(p.first_name)) = lower(trim(t.first_name))
   and lower(trim(p.last_name)) = lower(trim(t.last_name))
  where t.id = p_trainer_id;
$$;

update training_absences
set profile_id = trainer_profile_id(trainer_id)
where person_type = 'trainer' and profile_id is null and trainer_id is not null;

update game_absences
set profile_id = trainer_profile_id(trainer_id)
where person_type = 'trainer' and profile_id is null and trainer_id is not null;

-- Coaches eines Teams (für die Abmeldungen). Nur für Benutzer, die das
-- Training oder die Spiele dieses Teams sehen.
create or replace function team_coach_roster(p_team_id uuid)
returns table (user_id uuid, first_name text, last_name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id, p.first_name, p.last_name
  from profiles p
  join user_team_roles utr on utr.user_id = p.id
  join roles r on r.id = utr.role_id
  where utr.team_id = p_team_id
    and r.system_key in ('headcoach', 'assistant_coach')
    and (
      p_team_id in (select module_team_ids('training'))
      or p_team_id in (select module_team_ids('spiele'))
    )
  order by p.last_name, p.first_name;
$$;

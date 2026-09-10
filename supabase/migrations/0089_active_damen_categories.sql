-- Neue Alterskategorien "Aktive" und "Damen" für die aktiven Teams des
-- Vereins, zusätzlich zu U9/U12/U15/U18. Kategorien sind bereits vollständig
-- dynamisch im ganzen Tool (Teams, Übungen, Spieler, Trainer, Import-Dialoge
-- laden Kategorien immer aus der Tabelle, keine Hardcodierung gefunden) -
-- daher reicht die reine Datenerfassung.

insert into categories (name, sort_order, is_default) values
  ('Aktive', 5, true),
  ('Damen', 6, true);

-- Alle Übungen, bei denen U18 als Alterskategorie ausgewählt ist, zusätzlich
-- für Aktive und Damen freischalten, damit sie dort direkt auswählbar sind.
do $$
declare
  u18_id uuid;
  aktive_id uuid;
  damen_id uuid;
begin
  select id into u18_id from categories where name = 'U18';
  select id into aktive_id from categories where name = 'Aktive';
  select id into damen_id from categories where name = 'Damen';

  update exercises
    set age_category_ids = (
      select array_agg(distinct cat_id)
      from unnest(age_category_ids || array[aktive_id, damen_id]) as cat_id
    )
    where u18_id = any(age_category_ids);
end $$;

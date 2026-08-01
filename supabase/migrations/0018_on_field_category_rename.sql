-- On-Field-Kategorien umbenannt: Passspiel -> Passen, Zweikampfverhalten ->
-- Zweikampf, Angriff -> Offensivverhalten; Verteidigung komplett entfernt
-- (kein Ersatz). Bestehende Daten nachziehen.

update exercises
  set focus_areas = array_replace(focus_areas, 'Passspiel', 'Passen')
  where 'Passspiel' = any(focus_areas);

update exercises
  set focus_areas = array_replace(focus_areas, 'Zweikampfverhalten', 'Zweikampf')
  where 'Zweikampfverhalten' = any(focus_areas);

update exercises
  set focus_areas = array_replace(focus_areas, 'Angriff', 'Offensivverhalten')
  where 'Angriff' = any(focus_areas);

update exercises
  set focus_areas = array_remove(focus_areas, 'Verteidigung')
  where 'Verteidigung' = any(focus_areas);

-- Saisonplanungs-Unterkategorien (season_planning_events.subcategory) folgen
-- derselben Umbenennung, damit bestehende Einträge weiterhin korrekt der
-- richtigen Übungs-Kategorie zugeordnet werden.
update season_planning_events set subcategory = 'Passen' where subcategory = 'Passspiel';
update season_planning_events set subcategory = 'Zweikampf' where subcategory = 'Zweikampfverhalten';

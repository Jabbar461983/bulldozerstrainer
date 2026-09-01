-- On-Field-Kategorie "Ballabdecken" umbenannt in "Ballführung-/abdecken".
-- Bestehende Daten nachziehen.

update exercises
  set focus_areas = array_replace(focus_areas, 'Ballabdecken', 'Ballführung-/abdecken')
  where 'Ballabdecken' = any(focus_areas);

update season_planning_events set subcategory = 'Ballführung-/abdecken' where subcategory = 'Ballabdecken';

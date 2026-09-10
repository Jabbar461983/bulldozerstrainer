-- Datenreparatur: Checklisten-Punkte, die als Elternteil anderer Punkte
-- dienen (also faktisch eine Überschrift sind), aber nie mit
-- is_section = true gespeichert wurden - Folge eines Bugs beim Anlegen
-- einer Checkliste über den "Neue Checkliste"-Dialog, der Überschriften
-- immer mit dem Spalten-Default is_section = false eingefügt hat.
--
-- Betroffene Punkte wurden dadurch im Abhak-Screen fälschlich als
-- ankreuzbare Schritte behandelt (inkl. Zählung im Fortschritt) statt als
-- reine Gliederungs-Überschrift.

update checklist_items
set is_section = true
where is_section = false
  and id in (select distinct parent_id from checklist_items where parent_id is not null);

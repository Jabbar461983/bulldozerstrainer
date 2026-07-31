-- Schweizer Rechtschreibung: "ß" wird nicht verwendet, stattdessen "ss".
-- Betrifft die feste Unterkategorie "Schießen" aus der Saisonplanung, die
-- bereits gespeicherte Einträge übernehmen sonst weiterhin die alte Schreibweise.
update season_planning_events set subcategory = 'Schiessen' where subcategory = 'Schießen';

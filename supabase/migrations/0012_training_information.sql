-- Zusätzliches Freitextfeld "Informationen" pro Training, getrennt von den
-- normalen Notizen - gedacht für den Abspielmodus (letzte Seite).
alter table trainings add column if not exists information text;

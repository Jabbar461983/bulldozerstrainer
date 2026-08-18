-- Optionales Feld für Coachingfragen, die Coaches helfen, Spieler auf die
-- richtigen Details einer Übung aufmerksam zu machen.
alter table exercises add column if not exists coaching_questions text;

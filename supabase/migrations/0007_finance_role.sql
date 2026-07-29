-- Neue Rolle "Finanzen" (voller Zugriff auf das Finanzen-Modul, pro Team
-- vergebbar, analog zu Headcoach/Assistenzcoach).
--
-- WICHTIG: Dieses Skript muss ZUERST und SEPARAT ausgeführt werden (eigene
-- "Run" im SQL-Editor). Postgres erlaubt es nicht, einen frisch
-- hinzugefügten Enum-Wert in derselben Transaktion zu verwenden, in der er
-- hinzugefügt wurde. Die Rechte-Vergabe folgt in
-- 0008_finance_role_grants.sql (erst danach ausführen).

alter type coach_role add value 'finance';

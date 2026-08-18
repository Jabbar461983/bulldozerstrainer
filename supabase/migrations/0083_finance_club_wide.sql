-- Erlaubt Budgets/Belege ohne Team-Bezug ("Verein"), damit der
-- Juniorenverantwortliche (Admin) eigene Belege unabhängig von einem
-- einzelnen Team erfassen kann. Die bestehenden RLS-Policies auf budgets/
-- receipts greifen unverändert: bei team_id IS NULL ist `team_id in (...)`
-- immer NULL (nicht true), also kommt nur is_admin() durch - damit ist der
-- Verein-Scope automatisch admin-only, ohne dass die Policies angepasst
-- werden müssen.

alter table budgets alter column team_id drop not null;
alter table receipts alter column team_id drop not null;

-- Die bisherige unique(team_id, season) lässt bei team_id = NULL beliebig
-- viele Zeilen mit derselben Saison zu (NULL gilt in Unique-Constraints nie
-- als gleich). Dafür zwei partielle Indizes: einer wie bisher pro Team,
-- einer zusätzlich für höchstens ein Verein-Budget pro Saison.
alter table budgets drop constraint budgets_team_id_season_key;
create unique index budgets_team_season_unique on budgets (team_id, season) where team_id is not null;
create unique index budgets_club_season_unique on budgets (season) where team_id is null;

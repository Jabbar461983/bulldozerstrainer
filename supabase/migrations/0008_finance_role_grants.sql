-- Rechte für die neue Rolle "Finanzen": voller Zugriff (lesen + schreiben)
-- auf Budgets und Belege im eigenen Team, kein Zugriff auf andere Module.
-- Headcoach behält seinen bisherigen Zugriff (Budgets nur lesen, Belege
-- lesen/schreiben) unverändert.
--
-- Erst NACH 0007_finance_role.sql ausführen.

drop policy budgets_select on budgets;
create policy budgets_select on budgets for select
  using (is_admin() or team_id in (select user_team_ids('{headcoach,finance}')));

drop policy budgets_write on budgets;
create policy budgets_write on budgets for all
  using (is_admin() or team_id in (select user_team_ids('{finance}')))
  with check (is_admin() or team_id in (select user_team_ids('{finance}')));

drop policy receipts_select on receipts;
create policy receipts_select on receipts for select
  using (is_admin() or team_id in (select user_team_ids('{headcoach,finance}')));

drop policy receipts_write on receipts;
create policy receipts_write on receipts for all
  using (is_admin() or team_id in (select user_team_ids('{headcoach,finance}')))
  with check (is_admin() or team_id in (select user_team_ids('{headcoach,finance}')));

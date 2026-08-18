-- Zugriff aufs Finanzen-Modul eines Teams war bisher an die Headcoach-Rolle
-- gekoppelt. Neu kann der Admin das pro Team-Zuweisung (Headcoach oder
-- Assistenzcoach) unabhängig von der Rolle per Checkbox an- oder abschalten
-- (finance_access). Die dedizierte "Finanzen"-Rolle bleibt zusätzlich
-- bestehen (für reine Finanzverantwortliche ohne Team-Zugriff) und gewährt
-- weiterhin automatisch vollen Finanzen-Zugriff.
--
-- Budget-BEARBEITEN bleibt bewusst unverändert Admin/Finanzen-Rolle
-- vorbehalten (budgets_write) - die Checkbox gewährt nur den regulären
-- Modulzugriff (Budget ansehen, Belege verwalten), analog zum bisherigen
-- Headcoach-Zugriff.

alter table user_team_roles add column finance_access boolean not null default false;

-- Bestehende Headcoach-Zuweisungen behalten ihren bisherigen Zugriff.
update user_team_roles set finance_access = true where role = 'headcoach';

create or replace function user_finance_team_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from user_team_roles
  where user_id = auth.uid() and (role = 'finance' or finance_access);
$$;

drop policy budgets_select on budgets;
create policy budgets_select on budgets for select
  using (is_admin() or team_id in (select user_finance_team_ids()));

drop policy receipts_select on receipts;
create policy receipts_select on receipts for select
  using (is_admin() or team_id in (select user_finance_team_ids()));

drop policy receipts_write on receipts;
create policy receipts_write on receipts for all
  using (is_admin() or team_id in (select user_finance_team_ids()))
  with check (is_admin() or team_id in (select user_finance_team_ids()));

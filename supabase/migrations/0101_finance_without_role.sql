-- Finanzen ohne eigene Rolle.
--
-- - Vorstand Ressort "Finanzen": voller Finanzzugriff (alle Teams, Verein,
--   Gesamtübersicht). Dafür erhalten Ressorts eigene Module.
-- - Headcoach: Finanzen seines Teams (Belege erfassen und ansehen).
-- - Assistenzcoach: Finanzen seines Teams nur mit Häkchen "Finanzzugriff"
--   (Spalte user_team_roles.finance_access).
-- - Die Rolle "Finanzen" wird entfernt. Wer sie zusätzlich zur Rolle
--   Assistenzcoach im selben Team hatte, erhält dort das Häkchen.
-- Budget bleibt wie bisher dem Admin vorbehalten.

-- ---------------- Module pro Ressort ----------------
alter table vorstand_ressorts add column if not exists modules text[] not null default '{}';
alter table vorstand_ressorts drop constraint if exists vorstand_ressorts_modules_valid;
alter table vorstand_ressorts add constraint vorstand_ressorts_modules_valid check (modules <@ array[
  'training', 'saisonplanung', 'spiele', 'spieler', 'checklisten', 'finanzen',
  'uebungen', 'teams', 'checklisten_verwaltung', 'finanzen_verein', 'aufgaben_uebersicht'
]::text[]);

update vorstand_ressorts set modules = '{finanzen,finanzen_verein}' where name = 'Finanzen';

-- ---------------- Headcoach: Finanzen des eigenen Teams ----------------
update roles set modules = array_append(modules, 'finanzen')
where system_key = 'headcoach' and not ('finanzen' = any (modules));

-- ---------------- Häkchen Finanzzugriff (Assistenzcoach) ----------------
-- Der Übergangs-Trigger aus 0096 legte bei finance_access eine Zuweisung der
-- Rolle Finanzen an; das entfällt.
drop trigger if exists trg_user_team_roles_compat_finance on user_team_roles;
drop function if exists user_team_roles_compat_finance();

-- finance_access stammt noch aus 0084 (damals bei allen Headcoaches gesetzt)
-- und wird neu aufgesetzt.
update user_team_roles set finance_access = false where finance_access;

update user_team_roles utr
set finance_access = true
from roles r
where r.id = utr.role_id
  and r.system_key = 'assistant_coach'
  and exists (
    select 1 from user_team_roles f
    join roles fr on fr.id = f.role_id and fr.system_key = 'finance'
    where f.user_id = utr.user_id and (f.team_id is null or f.team_id = utr.team_id)
  );

-- ---------------- Rolle Finanzen entfernen ----------------
delete from user_team_roles where role_id in (select id from roles where system_key = 'finance');
delete from roles where system_key = 'finance';

-- ---------------- Rechte-Funktionen ----------------
-- Modul aus Rolle, aus dem Vorstands-Ressort oder (Finanzen) per Häkchen.
create or replace function has_module(p_module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_admin() or exists (
    select 1 from user_team_roles utr
    join roles r on r.id = utr.role_id
    left join vorstand_ressorts vr on vr.id = utr.ressort_id
    where utr.user_id = auth.uid()
      and (
        p_module = any (r.modules)
        or p_module = any (coalesce(vr.modules, '{}'))
        or (p_module = 'finanzen' and utr.finance_access)
      )
  );
$$;

create or replace function module_team_ids(p_module text)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id from teams t
  where is_admin() or exists (
    select 1 from user_team_roles utr
    join roles r on r.id = utr.role_id
    left join vorstand_ressorts vr on vr.id = utr.ressort_id
    where utr.user_id = auth.uid()
      and (
        p_module = any (r.modules)
        or p_module = any (coalesce(vr.modules, '{}'))
        or (p_module = 'finanzen' and utr.finance_access)
      )
      and (utr.team_id is null or utr.team_id = t.id)
  );
$$;

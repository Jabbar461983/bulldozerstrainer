-- Korrektur zu 0094: Beim Anlegen liest die App den neuen Spieler sofort
-- zurück (insert ... returning), bevor das Team zugewiesen ist. Mit 0094
-- war ein Spieler ohne Team für Coaches nicht mehr lesbar - Anlegen schlug
-- deshalb fehl. Coaches dürfen Spieler ohne Team wieder lesen (nur lesen;
-- ändern/löschen bleibt auf die eigenen Teams beschränkt).
drop policy if exists players_select on players;

create policy players_select on players for select
  using (
    is_admin()
    or id in (
      select pt.player_id from player_teams pt
      where pt.team_id in (select user_team_ids('{headcoach,assistant_coach}'))
    )
    or (
      not exists (select 1 from player_teams pt where pt.player_id = players.id)
      and exists (select 1 from user_team_ids('{headcoach,assistant_coach}'))
    )
  );

-- Spielerkommentare (player_notes mit source='game') sollen vom Admin
-- gelöscht werden können, von Trainern jedoch nicht. Die Timeline bleibt
-- für alle anderen Einträge (Training/Notiz) weiterhin unveränderlich.

create policy player_notes_delete on player_notes for delete
  using (is_admin() and source = 'game');

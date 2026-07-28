import { supabase } from '../../lib/supabase';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';
import type { Player, PlayerNote } from '../../types/database';
import type { RosterImportRow } from '../../lib/csv';

export interface PlayerRow extends Player {
  teams: TeamOption[];
}

export async function fetchPlayers(): Promise<PlayerRow[]> {
  const [{ data: players, error: playersError }, { data: playerTeams, error: playerTeamsError }, teamOptions] =
    await Promise.all([
      supabase.from('players').select('*').order('last_name', { ascending: true }),
      supabase.from('player_teams').select('player_id, team_id'),
      fetchTeamOptions(),
    ]);
  if (playersError) throw playersError;
  if (playerTeamsError) throw playerTeamsError;

  const teamById = new Map(teamOptions.map((t) => [t.teamId, t]));

  return (players ?? []).map((player: Player) => ({
    ...player,
    teams: (playerTeams ?? [])
      .filter((pt: { player_id: string }) => pt.player_id === player.id)
      .map((pt: { team_id: string }) => teamById.get(pt.team_id))
      .filter((t): t is TeamOption => Boolean(t)),
  }));
}

export async function createPlayer(payload: {
  first_name: string;
  last_name: string;
  birthdate: string | null;
  team_ids: string[];
}) {
  const { team_ids, ...playerPayload } = payload;
  const { data, error } = await (supabase.from('players') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert(playerPayload)
    .select('id')
    .single();
  if (error) throw error;
  await replacePlayerTeams(data.id, team_ids);
}

export async function updatePlayer(
  id: string,
  updates: Partial<Pick<Player, 'first_name' | 'last_name' | 'birthdate'>>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('players') as any).update(updates).eq('id', id);
  if (error) throw error;
}

export async function deletePlayer(id: string) {
  const { error } = await supabase.from('players').delete().eq('id', id);
  if (error) throw error;
}

export async function replacePlayerTeams(playerId: string, teamIds: string[]) {
  const { error: deleteError } = await supabase.from('player_teams').delete().eq('player_id', playerId);
  if (deleteError) throw deleteError;
  if (teamIds.length === 0) return;
  const rows = teamIds.map((teamId) => ({ player_id: playerId, team_id: teamId }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase.from('player_teams') as any).insert(rows);
  if (insertError) throw insertError;
}

export async function fetchPlayerNotes(playerId: string): Promise<PlayerNote[]> {
  const { data, error } = await supabase
    .from('player_notes')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addPlayerNote(playerId: string, note: string, createdBy: string | null) {
  const { error } = await (supabase.from('player_notes') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({ player_id: playerId, source: 'misc', note, created_by: createdBy });
  if (error) throw error;
}

export async function importPlayers(rows: RosterImportRow[], teamId: string) {
  const validRows = rows.filter((r) => r.valid);
  for (const row of validRows) {
    await createPlayer({
      first_name: row.firstName,
      last_name: row.lastName,
      birthdate: row.birthdate,
      team_ids: [teamId],
    });
  }
}

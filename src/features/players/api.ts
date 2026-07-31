import { supabase } from '../../lib/supabase';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';
import type { Player, PlayerNote, PlayerGoalSeason, PlayerGoal } from '../../types/database';
import type { RosterImportRow } from '../../lib/csv';

export interface PlayerRow extends Player {
  teams: TeamOption[];
  currentSeasonGoals?: PlayerGoal[];
  recentNotes?: PlayerNote[];
}

export async function fetchPlayers(filterByTeamId?: string): Promise<PlayerRow[]> {
  let query = supabase.from('players').select('*').order('last_name', { ascending: true });

  const [{ data: players, error: playersError }, { data: playerTeams, error: playerTeamsError }, teamOptions] =
    await Promise.all([
      query,
      supabase.from('player_teams').select('player_id, team_id'),
      fetchTeamOptions(),
    ]);
  if (playersError) throw playersError;
  if (playerTeamsError) throw playerTeamsError;

  const teamById = new Map(teamOptions.map((t) => [t.teamId, t]));

  let playerList = (players ?? []).map((player: Player) => {
    const playerTeamIds = (playerTeams ?? [])
      .filter((pt: { player_id: string }) => pt.player_id === player.id)
      .map((pt: { team_id: string }) => pt.team_id);

    return {
      ...player,
      teams: playerTeamIds
        .map((teamId) => teamById.get(teamId))
        .filter((t): t is TeamOption => Boolean(t)),
    };
  });

  if (filterByTeamId) {
    playerList = playerList.filter((p) => p.teams.some((t) => t.teamId === filterByTeamId));
  }

  return playerList;
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

export interface PlayerNoteWithUser extends PlayerNote {
  createdByName?: string;
}

export async function fetchPlayerNotes(playerId: string): Promise<PlayerNoteWithUser[]> {
  const { data, error } = await supabase
    .from('player_notes')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  // Fetch user names for created_by IDs
  const notes = (data ?? []) as Array<PlayerNote & { created_by?: string | null }>;
  const userIds = [...new Set(notes.map((n) => n.created_by).filter(Boolean))] as string[];

  let userNames: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name');

    if (profiles) {
      userNames = Object.fromEntries(
        profiles.map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]) // eslint-disable-line @typescript-eslint/no-explicit-any
      );
    }
  }

  return notes.map((note) => ({
    ...note,
    createdByName: note.created_by ? userNames[note.created_by] : undefined,
  }));
}

export async function addPlayerNote(playerId: string, note: string, createdBy: string | null) {
  const { error } = await (supabase.from('player_notes') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({ player_id: playerId, source: 'misc', note, created_by: createdBy });
  if (error) throw error;
}

export async function importPlayers(rows: { row: RosterImportRow; teamId: string }[]) {
  for (const { row, teamId } of rows) {
    if (!row.valid) continue;
    await createPlayer({
      first_name: row.firstName,
      last_name: row.lastName,
      birthdate: row.birthdate,
      team_ids: [teamId],
    });
  }
}

export async function fetchPlayerGoalSeasons(playerId: string): Promise<PlayerGoalSeason[]> {
  const { data, error } = await supabase
    .from('player_goal_seasons')
    .select('*')
    .eq('player_id', playerId)
    .order('season', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPlayerGoals(seasonId: string): Promise<PlayerGoal[]> {
  const { data, error } = await supabase
    .from('player_goals')
    .select('*')
    .eq('player_goal_season_id', seasonId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPlayerGoalSeason(playerId: string, season: string): Promise<string> {
  const { data, error } = await (supabase.from('player_goal_seasons') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({ player_id: playerId, season })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function createPlayerGoal(
  seasonId: string,
  title: string,
  ratingStars: number | null,
  notes: string | null,
  createdBy: string | null,
): Promise<void> {
  const { error } = await (supabase.from('player_goals') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({
      player_goal_season_id: seasonId,
      title,
      rating_stars: ratingStars,
      notes,
      created_by: createdBy,
    });
  if (error) throw error;
}

export async function updatePlayerGoal(
  goalId: string,
  updates: {
    title?: string;
    rating_stars?: number | null;
    notes?: string | null;
  },
): Promise<void> {
  const { error } = await (supabase.from('player_goals') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', goalId);
  if (error) throw error;
}

export async function deletePlayerGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from('player_goals').delete().eq('id', goalId);
  if (error) throw error;
}

import { supabase } from './supabase';

export interface RosterPlayer {
  playerId: string;
  firstName: string;
  lastName: string;
}

export async function fetchTeamPlayerRoster(teamId: string): Promise<RosterPlayer[]> {
  const { data: links, error: linksError } = await supabase
    .from('player_teams')
    .select('player_id')
    .eq('team_id', teamId);
  if (linksError) throw linksError;
  const playerIds = (links ?? []).map((l: { player_id: string }) => l.player_id);
  if (playerIds.length === 0) return [];
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .in('id', playerIds)
    .order('last_name', { ascending: true });
  if (playersError) throw playersError;
  return (players ?? []).map((p: { id: string; first_name: string; last_name: string }) => ({
    playerId: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
  }));
}

export interface RosterTrainer {
  trainerId: string;
  firstName: string;
  lastName: string;
}

/** Trainer eines Teams = Benutzer mit Rolle Headcoach/Assistenzcoach in diesem Team. trainerId ist die Benutzer-ID. */
export async function fetchTeamTrainerRoster(teamId: string): Promise<RosterTrainer[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('team_coach_roster', { p_team_id: teamId });
  if (error) throw error;
  return ((data ?? []) as { user_id: string; first_name: string; last_name: string }[]).map((t) => ({
    trainerId: t.user_id,
    firstName: t.first_name,
    lastName: t.last_name,
  }));
}

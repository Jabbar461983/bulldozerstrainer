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

export async function fetchTeamTrainerRoster(teamId: string): Promise<RosterTrainer[]> {
  const { data: links, error: linksError } = await supabase
    .from('trainer_teams')
    .select('trainer_id')
    .eq('team_id', teamId);
  if (linksError) throw linksError;
  const trainerIds = (links ?? []).map((l: { trainer_id: string }) => l.trainer_id);
  if (trainerIds.length === 0) return [];
  const { data: trainers, error: trainersError } = await supabase
    .from('trainers')
    .select('id, first_name, last_name')
    .in('id', trainerIds)
    .order('last_name', { ascending: true });
  if (trainersError) throw trainersError;
  return (trainers ?? []).map((t: { id: string; first_name: string; last_name: string }) => ({
    trainerId: t.id,
    firstName: t.first_name,
    lastName: t.last_name,
  }));
}

import { supabase } from '../../lib/supabase';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';
import type { Trainer } from '../../types/database';
import type { RosterImportRow } from '../../lib/csv';

export interface TrainerRow extends Trainer {
  teams: TeamOption[];
}

export async function fetchTrainers(): Promise<TrainerRow[]> {
  const [{ data: trainers, error: trainersError }, { data: trainerTeams, error: trainerTeamsError }, teamOptions] =
    await Promise.all([
      supabase.from('trainers').select('*').order('last_name', { ascending: true }),
      supabase.from('trainer_teams').select('trainer_id, team_id'),
      fetchTeamOptions(),
    ]);
  if (trainersError) throw trainersError;
  if (trainerTeamsError) throw trainerTeamsError;

  const teamById = new Map(teamOptions.map((t) => [t.teamId, t]));

  return (trainers ?? []).map((trainer: Trainer) => ({
    ...trainer,
    teams: (trainerTeams ?? [])
      .filter((tt: { trainer_id: string }) => tt.trainer_id === trainer.id)
      .map((tt: { team_id: string }) => teamById.get(tt.team_id))
      .filter((t): t is TeamOption => Boolean(t)),
  }));
}

export async function createTrainer(payload: {
  first_name: string;
  last_name: string;
  birthdate: string | null;
  team_ids: string[];
}) {
  const { team_ids, ...trainerPayload } = payload;
  const { data, error } = await (supabase.from('trainers') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert(trainerPayload)
    .select('id')
    .single();
  if (error) throw error;
  await replaceTrainerTeams(data.id, team_ids);
}

export async function updateTrainer(
  id: string,
  updates: Partial<Pick<Trainer, 'first_name' | 'last_name' | 'birthdate'>>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('trainers') as any).update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteTrainer(id: string) {
  const { error } = await supabase.from('trainers').delete().eq('id', id);
  if (error) throw error;
}

export async function replaceTrainerTeams(trainerId: string, teamIds: string[]) {
  const { error: deleteError } = await supabase.from('trainer_teams').delete().eq('trainer_id', trainerId);
  if (deleteError) throw deleteError;
  if (teamIds.length === 0) return;
  const rows = teamIds.map((teamId) => ({ trainer_id: trainerId, team_id: teamId }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase.from('trainer_teams') as any).insert(rows);
  if (insertError) throw insertError;
}

export async function importTrainers(rows: RosterImportRow[], teamId: string) {
  const validRows = rows.filter((r) => r.valid);
  for (const row of validRows) {
    await createTrainer({
      first_name: row.firstName,
      last_name: row.lastName,
      birthdate: row.birthdate,
      team_ids: [teamId],
    });
  }
}

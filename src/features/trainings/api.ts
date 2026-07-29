import { supabase } from '../../lib/supabase';
import type {
  Training,
  TrainingAbsence,
  TrainingExercise,
  TrainingFieldType,
  TrainingRating,
  TrainingTrainer,
} from '../../types/database';
import { fetchExerciseMediaByIds } from '../exercises/api';
import type { ExerciseMediaView } from '../exercises/api';

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export async function fetchTrainings(teamId: string): Promise<Training[]> {
  const { data, error } = await supabase
    .from('trainings')
    .select('*')
    .eq('team_id', teamId)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface TrainingOverviewInfo {
  plannedMinutes: number;
  ratingStars: number | null;
  ratingByName: string | null;
  trainerNames: string[];
}

export async function fetchTrainingsOverview(trainingIds: string[]): Promise<Record<string, TrainingOverviewInfo>> {
  const overview: Record<string, TrainingOverviewInfo> = {};
  for (const id of trainingIds) {
    overview[id] = { plannedMinutes: 0, ratingStars: null, ratingByName: null, trainerNames: [] };
  }
  if (trainingIds.length === 0) return overview;

  const { data: exerciseRows, error: exerciseError } = await supabase
    .from('training_exercises')
    .select('training_id, duration_minutes')
    .in('training_id', trainingIds);
  if (exerciseError) throw exerciseError;

  const { data: ratingRows, error: ratingError } = await supabase
    .from('training_ratings')
    .select('training_id, stars, created_by')
    .eq('is_admin_feedback', false)
    .in('training_id', trainingIds);
  if (ratingError) throw ratingError;

  const { data: trainerLinkRows, error: trainerLinkError } = await supabase
    .from('training_trainers')
    .select('training_id, trainer_id')
    .in('training_id', trainingIds);
  if (trainerLinkError) throw trainerLinkError;

  type RatingRow = { training_id: string; stars: number; created_by: string | null };
  type TrainerLinkRow = { training_id: string; trainer_id: string };

  const raterIds = Array.from(
    new Set((ratingRows as RatingRow[] ?? []).map((r) => r.created_by).filter((id): id is string => !!id)),
  );
  let raterNameById = new Map<string, string>();
  if (raterIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', raterIds);
    if (profileError) throw profileError;
    raterNameById = new Map(
      (profileRows ?? []).map((p: { id: string; first_name: string; last_name: string }) => [
        p.id,
        `${p.first_name} ${p.last_name}`,
      ]),
    );
  }

  const trainerIds = Array.from(new Set((trainerLinkRows as TrainerLinkRow[] ?? []).map((r) => r.trainer_id)));
  let trainerNameById = new Map<string, string>();
  if (trainerIds.length > 0) {
    const { data: trainerRows, error: trainerError } = await supabase
      .from('trainers')
      .select('id, first_name, last_name')
      .in('id', trainerIds);
    if (trainerError) throw trainerError;
    trainerNameById = new Map(
      (trainerRows ?? []).map((t: { id: string; first_name: string; last_name: string }) => [
        t.id,
        `${t.first_name} ${t.last_name}`,
      ]),
    );
  }

  for (const row of (exerciseRows as { training_id: string; duration_minutes: number }[] ?? [])) {
    overview[row.training_id].plannedMinutes += row.duration_minutes;
  }
  for (const row of (ratingRows as RatingRow[] ?? [])) {
    overview[row.training_id].ratingStars = row.stars;
    overview[row.training_id].ratingByName = row.created_by ? raterNameById.get(row.created_by) ?? null : null;
  }
  for (const row of (trainerLinkRows as TrainerLinkRow[] ?? [])) {
    const name = trainerNameById.get(row.trainer_id);
    if (name) overview[row.training_id].trainerNames.push(name);
  }

  return overview;
}

export async function fetchTrainingTrainers(trainingId: string): Promise<TrainingTrainer[]> {
  const { data, error } = await supabase.from('training_trainers').select('*').eq('training_id', trainingId);
  if (error) throw error;
  return data ?? [];
}

export async function replaceTrainingTrainers(trainingId: string, trainerIds: string[]) {
  const { error: deleteError } = await supabase.from('training_trainers').delete().eq('training_id', trainingId);
  if (deleteError) throw deleteError;
  if (trainerIds.length === 0) return;
  const rows = trainerIds.map((trainerId) => ({ training_id: trainingId, trainer_id: trainerId }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase.from('training_trainers') as any).insert(rows);
  if (insertError) throw insertError;
}

export interface CreateTrainingPayload {
  team_id: string;
  date: string;
  start_time: string | null;
  duration_minutes: number;
  field_type: TrainingFieldType;
  notes: string | null;
  created_by: string | null;
  repeatWeeks?: number;
}

export async function createTraining(payload: CreateTrainingPayload): Promise<string[]> {
  const { repeatWeeks = 0, ...base } = payload;
  const seriesId = repeatWeeks > 0 ? crypto.randomUUID() : null;
  const dates = [base.date];
  if (repeatWeeks > 0) {
    for (let i = 1; i <= repeatWeeks; i++) {
      dates.push(addDays(base.date, i * 7));
    }
  }
  const rows = dates.map((date) => ({ ...base, date, series_id: seriesId }));
  const { data, error } = await (supabase.from('trainings') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert(rows)
    .select('id');
  if (error) throw error;
  return (data ?? []).map((r: { id: string }) => r.id);
}

export async function duplicateTrainingContent(sourceTrainingId: string, targetTrainingId: string) {
  const [exercises, trainerLinks] = await Promise.all([
    fetchTrainingExercises(sourceTrainingId),
    fetchTrainingTrainers(sourceTrainingId),
  ]);

  if (exercises.length > 0) {
    const rows = exercises.map((e) => ({
      training_id: targetTrainingId,
      exercise_id: e.exercise_id,
      duration_minutes: e.duration_minutes,
      notes: e.notes,
      sort_order: e.sort_order,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('training_exercises') as any).insert(rows);
    if (error) throw error;
  }

  if (trainerLinks.length > 0) {
    await replaceTrainingTrainers(
      targetTrainingId,
      trainerLinks.map((t) => t.trainer_id),
    );
  }
}

export async function updateTraining(
  id: string,
  updates: Partial<Pick<Training, 'date' | 'start_time' | 'duration_minutes' | 'field_type' | 'notes'>>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('trainings') as any).update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteTraining(id: string) {
  const { error } = await supabase.from('trainings').delete().eq('id', id);
  if (error) throw error;
}

export interface TrainingExerciseRow extends TrainingExercise {
  exerciseTitle: string;
  exerciseDescription: string | null;
  media: ExerciseMediaView[];
}

export async function fetchTrainingExercises(trainingId: string): Promise<TrainingExerciseRow[]> {
  const { data: rows, error: rowsError } = await supabase
    .from('training_exercises')
    .select('*')
    .eq('training_id', trainingId)
    .order('sort_order', { ascending: true });
  if (rowsError) throw rowsError;

  const exerciseIds = Array.from(new Set((rows ?? []).map((r: TrainingExercise) => r.exercise_id)));
  let infoById = new Map<string, { title: string; description: string | null }>();
  if (exerciseIds.length > 0) {
    const { data: exercises, error: exercisesError } = await supabase
      .from('exercises')
      .select('id, title, description')
      .in('id', exerciseIds);
    if (exercisesError) throw exercisesError;
    infoById = new Map(
      (exercises ?? []).map((e: { id: string; title: string; description: string | null }) => [
        e.id,
        { title: e.title, description: e.description },
      ]),
    );
  }
  const mediaById = await fetchExerciseMediaByIds(exerciseIds);

  return (rows ?? []).map((r: TrainingExercise) => ({
    ...r,
    exerciseTitle: infoById.get(r.exercise_id)?.title ?? 'Unbekannte Übung',
    exerciseDescription: infoById.get(r.exercise_id)?.description ?? null,
    media: mediaById.get(r.exercise_id) ?? [],
  }));
}

export async function addTrainingExercise(trainingId: string, exerciseId: string, durationMinutes: number) {
  const { data: existing, error: existingError } = await supabase
    .from('training_exercises')
    .select('sort_order')
    .eq('training_id', trainingId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (existingError) throw existingError;
  const lastSortOrder = (existing as { sort_order: number }[] | null ?? [])[0]?.sort_order;
  const nextSortOrder = (lastSortOrder ?? -1) + 1;
  const { error } = await (supabase.from('training_exercises') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({
      training_id: trainingId,
      exercise_id: exerciseId,
      duration_minutes: durationMinutes,
      sort_order: nextSortOrder,
    });
  if (error) throw error;
}

export async function updateTrainingExercise(
  id: string,
  updates: Partial<Pick<TrainingExercise, 'duration_minutes' | 'notes'>>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('training_exercises') as any).update(updates).eq('id', id);
  if (error) throw error;
}

export async function removeTrainingExercise(id: string) {
  const { error } = await supabase.from('training_exercises').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderTrainingExercises(items: { id: string; sort_order: number }[]) {
  for (const item of items) {
    const { error } = await (supabase.from('training_exercises') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .update({ sort_order: item.sort_order })
      .eq('id', item.id);
    if (error) throw error;
  }
}

export interface TrainingRatingState {
  regular: TrainingRating | null;
  adminFeedback: TrainingRating[];
}

export async function fetchTrainingRatings(trainingId: string): Promise<TrainingRatingState> {
  const { data, error } = await supabase
    .from('training_ratings')
    .select('*')
    .eq('training_id', trainingId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as TrainingRating[];
  return {
    regular: rows.find((r) => !r.is_admin_feedback) ?? null,
    adminFeedback: rows.filter((r) => r.is_admin_feedback),
  };
}

export async function saveRegularRating(
  trainingId: string,
  existingId: string | null,
  stars: number,
  notes: string | null,
  createdBy: string | null,
) {
  if (existingId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('training_ratings') as any).update({ stars, notes }).eq('id', existingId);
    if (error) throw error;
  } else {
    const { error } = await (supabase.from('training_ratings') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert({ training_id: trainingId, stars, notes, created_by: createdBy, is_admin_feedback: false });
    if (error) throw error;
  }
}

export async function addAdminFeedback(
  trainingId: string,
  stars: number,
  notes: string | null,
  createdBy: string | null,
) {
  const { error } = await (supabase.from('training_ratings') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({ training_id: trainingId, stars, notes, created_by: createdBy, is_admin_feedback: true });
  if (error) throw error;
}

export async function deleteRating(id: string) {
  const { error } = await supabase.from('training_ratings').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTrainingAbsences(trainingId: string): Promise<TrainingAbsence[]> {
  const { data, error } = await supabase.from('training_absences').select('*').eq('training_id', trainingId);
  if (error) throw error;
  return (data ?? []) as TrainingAbsence[];
}

export async function addTrainingAbsence(
  trainingId: string,
  personType: 'player' | 'trainer',
  personId: string,
) {
  const payload =
    personType === 'player'
      ? { training_id: trainingId, person_type: 'player', player_id: personId, trainer_id: null }
      : { training_id: trainingId, person_type: 'trainer', player_id: null, trainer_id: personId };
  const { error } = await (supabase.from('training_absences') as any).insert(payload); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (error) throw error;
}

export async function removeTrainingAbsence(id: string) {
  const { error } = await supabase.from('training_absences').delete().eq('id', id);
  if (error) throw error;
}

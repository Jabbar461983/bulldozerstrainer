import { supabase } from '../../lib/supabase';
import type { Training, TrainingAbsence, TrainingExercise, TrainingRating } from '../../types/database';
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

export interface CreateTrainingPayload {
  team_id: string;
  date: string;
  start_time: string | null;
  duration_minutes: number;
  notes: string | null;
  created_by: string | null;
  repeatWeeks?: number;
}

export async function createTraining(payload: CreateTrainingPayload) {
  const { repeatWeeks = 0, ...base } = payload;
  const seriesId = repeatWeeks > 0 ? crypto.randomUUID() : null;
  const dates = [base.date];
  if (repeatWeeks > 0) {
    for (let i = 1; i <= repeatWeeks; i++) {
      dates.push(addDays(base.date, i * 7));
    }
  }
  const rows = dates.map((date) => ({ ...base, date, series_id: seriesId }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('trainings') as any).insert(rows);
  if (error) throw error;
}

export async function updateTraining(
  id: string,
  updates: Partial<Pick<Training, 'date' | 'start_time' | 'duration_minutes' | 'notes'>>,
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
  let titleById = new Map<string, string>();
  if (exerciseIds.length > 0) {
    const { data: exercises, error: exercisesError } = await supabase
      .from('exercises')
      .select('id, title')
      .in('id', exerciseIds);
    if (exercisesError) throw exercisesError;
    titleById = new Map((exercises ?? []).map((e: { id: string; title: string }) => [e.id, e.title]));
  }
  const mediaById = await fetchExerciseMediaByIds(exerciseIds);

  return (rows ?? []).map((r: TrainingExercise) => ({
    ...r,
    exerciseTitle: titleById.get(r.exercise_id) ?? 'Unbekannte Übung',
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

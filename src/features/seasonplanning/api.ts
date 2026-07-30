import { supabase } from '../../lib/supabase';
import type { SeasonPlanningEvent, TrainingSeasonFocus, TrainingFocusPercentage, SeasonPlanningCategory } from '../../types/database';

export async function fetchSeasonPlanningEvents(teamId: string): Promise<SeasonPlanningEvent[]> {
  const { data, error } = await (supabase as any)
    .from('season_planning_events')
    .select('*')
    .eq('team_id', teamId)
    .order('start_date', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createSeasonPlanningEvent(event: Omit<SeasonPlanningEvent, 'id' | 'created_at' | 'updated_at'>): Promise<SeasonPlanningEvent> {
  const { data, error } = await (supabase as any)
    .from('season_planning_events')
    .insert([event])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSeasonPlanningEvent(id: string, updates: Partial<SeasonPlanningEvent>): Promise<SeasonPlanningEvent> {
  const { data, error } = await (supabase as any)
    .from('season_planning_events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSeasonPlanningEvent(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('season_planning_events')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function fetchTrainingSeasonFocuses(trainingId: string): Promise<TrainingSeasonFocus[]> {
  const { data, error } = await (supabase as any)
    .from('training_season_focuses')
    .select('*')
    .eq('training_id', trainingId);
  if (error) throw error;
  return data ?? [];
}

export async function addTrainingSeasonFocus(trainingId: string, eventId: string): Promise<TrainingSeasonFocus> {
  const { data, error } = await (supabase as any)
    .from('training_season_focuses')
    .insert([{ training_id: trainingId, season_planning_event_id: eventId }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeTrainingSeasonFocus(trainingId: string, eventId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('training_season_focuses')
    .delete()
    .eq('training_id', trainingId)
    .eq('season_planning_event_id', eventId);
  if (error) throw error;
}

export async function fetchTrainingFocusPercentages(trainingId: string): Promise<Record<SeasonPlanningCategory, number>> {
  const { data, error } = await (supabase as any)
    .from('training_focus_percentages')
    .select('*')
    .eq('training_id', trainingId);
  if (error) throw error;

  const result: Record<SeasonPlanningCategory, number> = {
    activities: 0,
    technique: 0,
    tactics: 0,
    physical: 0,
  };

  for (const row of data ?? []) {
    result[row.category as SeasonPlanningCategory] = row.percentage;
  }

  return result;
}

export async function setTrainingFocusPercentage(trainingId: string, category: SeasonPlanningCategory, percentage: number): Promise<TrainingFocusPercentage> {
  const { data, error } = await (supabase as any)
    .from('training_focus_percentages')
    .upsert(
      [{ training_id: trainingId, category, percentage, updated_at: new Date().toISOString() }],
      { onConflict: 'training_id,category' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSeasonDateRange(season: string): Promise<{ startDate: string; endDate: string }> {
  // Season is like "2024/25", returns July 1, 2024 to May 31, 2025
  const [startYear] = season.split('/').map(Number);
  const startDate = `${startYear}-07-01`;
  const endDate = `${startYear + 1}-05-31`;
  return { startDate, endDate };
}

// Helper: Get all events for a given date range (for calendar view)
export async function fetchSeasonPlanningEventsByDateRange(
  teamId: string,
  startDate: string,
  endDate: string
): Promise<SeasonPlanningEvent[]> {
  const { data, error } = await (supabase as any)
    .from('season_planning_events')
    .select('*')
    .eq('team_id', teamId)
    .gte('end_date', startDate)
    .lte('start_date', endDate)
    .order('start_date', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Helper: Get events applicable to a specific training date
export async function fetchApplicableSeasonPlanningEvents(teamId: string, trainingDate: string): Promise<SeasonPlanningEvent[]> {
  const { data, error } = await (supabase as any)
    .from('season_planning_events')
    .select('*')
    .eq('team_id', teamId)
    .lte('start_date', trainingDate)
    .gte('end_date', trainingDate)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
